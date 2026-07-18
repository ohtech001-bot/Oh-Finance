import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { CreateOrderRequest } from '@oh/contracts';
import { HAS_TEST_DB, SKIP_REASON, closeTestDb, testDb } from './db.js';
import { createTestCustomer, createTestTenant, resetAll, type TestTenant } from './helpers.js';
import { CustomersService } from '../src/modules/customers/customers.service.js';
import { OrdersService } from '../src/modules/orders/orders.service.js';
import { LedgerService } from '../src/modules/ledger/ledger.service.js';
import { OrderCalculator } from '../src/modules/orders/order-calculator.js';
import { NumberingService } from '../src/core/numbering/numbering.service.js';
import { AuditService } from '../src/core/audit/audit.service.js';
import type { PrismaService } from '../src/core/prisma/prisma.service.js';
import { TenantContext } from '../src/core/tenancy/tenant-context.js';

/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  ملخّص الزبون — المؤشرات المشتقة (المرحلة 3.5).
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  نتحقق أن استخدام الائتمان، صحّة الزبون، ومتوسط أيام السداد محسوبة فعلًا من
 *  دفتر الحركات والطلبات — لا قيم ثابتة.
 */

if (!HAS_TEST_DB) {

  console.warn(`\n⚠  ${SKIP_REASON}\n`);
}

const TX_OPTS = { maxWait: 30_000, timeout: 30_000 } as const;

function fakePrisma(): PrismaService {
  return {
    runInTenant<T>(tenantId: string, fn: (tx: never) => Promise<T>): Promise<T> {
      return testDb().$transaction(async (tx) => {
        await tx.$executeRawUnsafe('SET LOCAL ROLE oh_app');
        await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}::text, true)`;
        return fn(tx as never);
      }, TX_OPTS);
    },
  } as unknown as PrismaService;
}

function asUser<T>(t: TestTenant, fn: () => Promise<T>): Promise<T> {
  return TenantContext.run(
    {
      requestId: 'test-customer-summary',
      tenantId: t.tenantId,
      userId: t.userId,
      storeId: t.storeId,
      isSuperAdmin: false,
      permissions: [],
      ip: null,
      userAgent: null,
    },
    fn,
  );
}

function orderPayload(
  customerId: string,
  unitPrice: string,
  dates: { issuedAt?: string; dueAt?: string } = {},
): CreateOrderRequest {
  return {
    customerId,
    status: 'CONFIRMED',
    discountAmount: '0',
    ...dates,
    items: [{ sourceType: 'MANUAL', name: 'بند', quantity: '1', unitPrice, discount: '0', taxRate: '0' }],
  } as CreateOrderRequest;
}

const daysAgo = (n: number): string => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);

describe.skipIf(!HAS_TEST_DB)('ملخّص الزبون', () => {
  let t: TestTenant;
  let customers: CustomersService;
  let orders: OrdersService;

  beforeAll(async () => {
    await resetAll();
    t = await createTestTenant('cust-summary');
    const prisma = fakePrisma();
    customers = new CustomersService(prisma, new LedgerService(), new NumberingService(), new AuditService());
    orders = new OrdersService(
      prisma,
      new LedgerService(),
      new OrderCalculator(),
      new NumberingService(),
      new AuditService(),
    );
  });

  afterAll(async () => {
    await closeTestDb();
  });

  beforeEach(async () => {
    const db = testDb();
    await db.$executeRawUnsafe(`
      TRUNCATE TABLE payment_allocations, payments, ledger_entries,
                     order_items, orders, customers, tenant_counters
      RESTART IDENTITY CASCADE
    `);
  });

  it('زبون جديد بلا نشاط: صحّة ممتازة، متوسط سداد null', async () => {
    const id = await createTestCustomer(t, 'زبون جديد', { creditLimit: '1000' });
    const s = await asUser(t, () => customers.summary(id));

    expect(s.customerHealth).toBe('EXCELLENT');
    expect(s.avgPaymentDays).toBeNull();
    expect(s.creditUsagePct).toBe(0); // له حد لكن لا رصيد
    expect(s.totalOrders).toBe(0);
  });

  it('بلا حد ائتمان: استخدام الائتمان null', async () => {
    const id = await createTestCustomer(t, 'بلا حد', { creditLimit: '0' });
    const s = await asUser(t, () => customers.summary(id));
    expect(s.creditUsagePct).toBeNull();
  });

  it('طلب ضمن الحد: صحّة جيدة واستخدام محسوب', async () => {
    const id = await createTestCustomer(t, 'ضمن الحد', { creditLimit: '2000' });
    await asUser(t, () => orders.create(orderPayload(id, '1000')));

    const s = await asUser(t, () => customers.summary(id));
    expect(s.creditUsagePct).toBe(50); // 1000 / 2000
    expect(s.customerHealth).toBe('GOOD');
    expect(s.avgPaymentDays).toBeNull(); // لا دفعات بعد
  });

  it('قارب حد الائتمان (80%+): صحّة تحذير', async () => {
    const id = await createTestCustomer(t, 'قريب من الحد', { creditLimit: '1000' });
    await asUser(t, () => orders.create(orderPayload(id, '800')));

    const s = await asUser(t, () => customers.summary(id));
    expect(s.creditUsagePct).toBe(80); // 800 / 1000
    expect(s.customerHealth).toBe('WARNING');
  });

  it('طلب متأخر عن الاستحقاق: صحّة متعثّرة', async () => {
    const id = await createTestCustomer(t, 'متأخر', { creditLimit: '5000' });
    // طلب أُصدر قبل 60 يومًا واستحق قبل 30 — متأخر وغير مسدَّد.
    await asUser(t, () => orders.create(orderPayload(id, '1000', { issuedAt: daysAgo(60), dueAt: daysAgo(30) })));

    const s = await asUser(t, () => customers.summary(id));
    expect(s.overdueOrders).toBe(1);
    expect(s.customerHealth).toBe('AT_RISK');
  });
});
