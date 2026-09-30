import { describe, expect, it } from 'vitest';
import { customerListQuerySchema } from '@oh/contracts';
import { customerBalanceQuery } from './customer-balance-query.js';

describe('customer balance pagination', () => {
  it('parameterizes user input and tenant identity, paginates in SQL, and sorts numbers not strings', () => {
    const search = "'; DROP TABLE customers; --";
    const query = customerBalanceQuery(
      'tenant',
      customerListQuerySchema.parse({
        search,
        accountState: 'DEBIT',
        sortBy: 'balance',
        page: 3,
        pageSize: 10,
      }),
      new Date(),
    );
    expect(query.text).not.toContain(search);
    expect(query.values).toContain(search);
    expect(query.text).toContain('filtered.balance');
    expect(query.text).toContain('balance > 0');
    expect(query.text).toContain('LIMIT');
    expect(query.values).toContain(20);
    expect(query.text).toContain('tenant_id =');
  });
  it('keeps credit, settled, and archive filters in SQL', () => {
    const credit = customerBalanceQuery(
      'tenant',
      customerListQuerySchema.parse({ accountState: 'CREDIT', archivedOnly: true }),
      new Date(),
    );
    expect(credit.text).toContain('balance < 0');
    expect(credit.text).toContain('c.archived_at >');
    const settled = customerBalanceQuery(
      'tenant',
      customerListQuerySchema.parse({ accountState: 'SETTLED', overCreditLimit: true }),
      new Date(),
    );
    expect(settled.text).toContain('balance = 0');
    expect(settled.text).toContain('balance > credit_limit');
  });
});
