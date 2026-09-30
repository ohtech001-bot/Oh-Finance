import { Prisma } from '@prisma/client';
import type { CustomerListQuery } from '@oh/contracts';

export function customerBalanceQuery(tenantId: string, query: CustomerListQuery, cutoff: Date) {
  const filters: Prisma.Sql[] = [Prisma.sql`c.tenant_id = ${tenantId}::uuid`];
  if (query.archivedOnly) filters.push(Prisma.sql`c.archived_at > ${cutoff}`);
  else if (!query.includeArchived) filters.push(Prisma.sql`c.archived_at IS NULL`);
  if (query.status) filters.push(Prisma.sql`c.status::text = ${query.status}`);
  if (query.city) filters.push(Prisma.sql`lower(c.city) = lower(${query.city})`);
  if (query.tag) filters.push(Prisma.sql`${query.tag} = ANY(c.tags)`);
  if (query.search) {
    const search = query.search.toLowerCase();
    filters.push(Prisma.sql`(
      position(${search} in lower(c.name)) > 0 OR position(${search} in lower(c.code)) > 0 OR
      position(${search} in lower(c.company)) > 0 OR position(${query.search} in c.phone) > 0 OR
      position(${query.search} in c.tax_number) > 0
    )`);
  }
  const balances: Prisma.Sql[] = [Prisma.sql`TRUE`];
  if (query.accountState === 'DEBIT') balances.push(Prisma.sql`balance > 0`);
  if (query.accountState === 'CREDIT') balances.push(Prisma.sql`balance < 0`);
  if (query.accountState === 'SETTLED') balances.push(Prisma.sql`balance = 0`);
  if (query.overCreditLimit) balances.push(Prisma.sql`credit_limit > 0 AND balance > credit_limit`);
  const sort =
    query.sortBy === 'balance'
      ? Prisma.sql`filtered.balance`
      : query.sortBy === 'name'
        ? Prisma.sql`filtered.name`
        : query.sortBy === 'code'
          ? Prisma.sql`filtered.code`
          : Prisma.sql`filtered.created_at`;
  const direction = query.sortOrder === 'asc' ? Prisma.sql`ASC` : Prisma.sql`DESC`;
  return Prisma.sql`
    WITH candidates AS (
      SELECT c.id, c.name, c.code, c.created_at, c.credit_limit,
        COALESCE(latest.running_balance, 0) AS balance
      FROM customers c
      LEFT JOIN LATERAL (
        SELECT running_balance FROM ledger_entries
        WHERE tenant_id = ${tenantId}::uuid AND customer_id = c.id
        ORDER BY seq DESC LIMIT 1
      ) latest ON TRUE
      WHERE ${Prisma.join(filters, ' AND ')}
    ), filtered AS (
      SELECT * FROM candidates WHERE ${Prisma.join(balances, ' AND ')}
    ), paged AS (
      SELECT id, balance::text AS balance,
        row_number() OVER (ORDER BY ${sort} ${direction}, id ASC) AS position
      FROM filtered
      ORDER BY ${sort} ${direction}, id ASC
      LIMIT ${query.pageSize} OFFSET ${(query.page - 1) * query.pageSize}
    )
    SELECT (SELECT COUNT(*)::int FROM filtered) AS total,
      COALESCE((SELECT jsonb_agg(
        jsonb_build_object('id', paged.id, 'balance', paged.balance) ORDER BY paged.position
      ) FROM paged), '[]'::jsonb) AS items
  `;
}
