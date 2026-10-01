import 'reflect-metadata';
import dotenv from 'dotenv';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { PrismaService } from '../apps/api/dist/core/prisma/prisma.service.js';
import { TenantContext } from '../apps/api/dist/core/tenancy/tenant-context.js';
import { CustomersService } from '../apps/api/dist/modules/customers/customers.service.js';
import { OrdersService } from '../apps/api/dist/modules/orders/orders.service.js';
import { LedgerService } from '../apps/api/dist/modules/ledger/ledger.service.js';
import { customerListQuerySchema, orderListQuerySchema } from '@oh/contracts';

dotenv.config({ path: '.env.development', quiet: true });
dotenv.config({ path: '.env', quiet: true });
const databaseHost = new URL(process.env.DATABASE_URL ?? '').hostname;
if (!/\.supabase\.(com|co)$/.test(databaseHost)) throw new Error('Supabase database required');

const prisma = new PrismaService();
const transaction = prisma.raw.$transaction.bind(prisma.raw);
// Every callback, including service code, is enforced read-only by PostgreSQL.
prisma.raw.$transaction = (callback, options) =>
  transaction(async (tx) => {
    await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
    return callback(tx);
  }, options);

try {
  const owner = await prisma.raw.user.findFirst({
    where: { status: 'ACTIVE', tenantId: { not: null }, storeId: { not: null } },
    select: { id: true, tenantId: true, storeId: true },
  });
  assert(owner?.tenantId && owner.storeId, 'An active tenant user is required');
  const state = async (tx) => tx.$queryRaw`
    SELECT current_user AS role, current_setting('app.tenant_id', true) AS tenant`;
  const initial = await state(prisma.raw);
  const scoped = await prisma.runInTenant(owner.tenantId, state);
  assert.equal(scoped[0].role, 'oh_app');
  assert.equal(scoped[0].tenant, owner.tenantId);
  const foreignRows = await prisma.runInTenant('00000000-0000-0000-0000-000000000000', (tx) =>
    tx.customer.count(),
  );
  assert.equal(foreignRows, 0);
  const afterCommit = await state(prisma.raw);
  assert.equal(afterCommit[0].role, initial[0].role);
  assert(!afterCommit[0].tenant);
  await assert.rejects(
    prisma.runInTenant(owner.tenantId, async () => {
      throw new Error('Intentional read-only rollback');
    }),
  );
  const afterRollback = await state(prisma.raw);
  assert.equal(afterRollback[0].role, initial[0].role);
  assert(!afterRollback[0].tenant);

  const old = {
    runInTenant: (tenantId, callback) =>
      prisma.raw.$transaction(
        async (tx) => {
          await tx.$executeRawUnsafe('SET LOCAL ROLE oh_app');
          await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}::text, true)`;
          return callback(tx);
        },
        { timeout: 15_000 },
      ),
  };
  const ledger = new LedgerService();
  const services = (db) => ({
    customers: new CustomersService(db, ledger, {}, {}),
    orders: new OrdersService(db, ledger, {}, {}, {}),
  });
  const before = services(old);
  const after = services(prisma);
  const customerQuery = customerListQuerySchema.parse({ page: 1, pageSize: 10 });
  const orderQuery = orderListQuerySchema.parse({ page: 1, pageSize: 10 });
  const tasks = {
    'customers/list': (s) => s.customers.list(customerQuery),
    'customers/stats': (s) => s.customers.stats(),
    'orders/list': (s) => s.orders.list(orderQuery),
    'orders/stats': (s) => s.orders.stats(orderQuery),
  };
  const timings = {};
  await TenantContext.run(
    {
      requestId: 'readonly-performance-check',
      tenantId: owner.tenantId,
      storeId: owner.storeId,
      userId: owner.id,
      isSuperAdmin: false,
      supportMode: false,
      permissions: [],
      mustChangePassword: false,
      ip: null,
      userAgent: null,
    },
    async () => {
      for (const [name, run] of Object.entries(tasks)) {
        const samples = { before: [], after: [] };
        for (let trial = 0; trial < 3; trial++) {
          for (const [mode, s] of trial % 2
            ? [
                ['after', after],
                ['before', before],
              ]
            : [
                ['before', before],
                ['after', after],
              ]) {
            const start = performance.now();
            await run(s);
          samples[mode].push(Math.trunc(performance.now() - start));
          }
        }
        timings[name] = Object.fromEntries(
          Object.entries(samples).map(([mode, ms]) => [
            mode + 'MedianMs',
            [...ms].sort((a, b) => a - b)[1],
          ]),
        );
      }
    },
  );
  console.log(
    JSON.stringify(
      {
        readOnly: true,
        rlsIsolation: true,
        roleResetAfterCommitAndRollback: true,
        samplesPerMode: 3,
        timings,
        note: 'Local-to-Supabase service timings, not production HTTP latency.',
      },
      null,
      2,
    ),
  );
} catch (error) {
  console.error(
    JSON.stringify({ checkFailed: true, type: error?.name, code: error?.code ?? null }),
  );
  process.exitCode = 1;
} finally {
  await prisma.raw.$disconnect();
}
