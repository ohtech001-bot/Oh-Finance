import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { CreateOrderRequest, CreatePaymentRequest, ReportsQuery } from '@oh/contracts';
import { HAS_TEST_DB, SKIP_REASON, closeTestDb, testDb } from './db.js';
import { createTestCustomer, createTestTenant, resetAll, type TestTenant } from './helpers.js';
import { OrdersService } from '../src/modules/orders/orders.service.js';
import { PaymentsService } from '../src/modules/payments/payments.service.js';
import { ReportsService } from '../src/modules/reports/reports.service.js';
import { LedgerService } from '../src/modules/ledger/ledger.service.js';
import { OrderCalculator } from '../src/modules/orders/order-calculator.js';
import { NumberingService } from '../src/core/numbering/numbering.service.js';
import { AuditService } from '../src/core/audit/audit.service.js';
import type { PrismaService } from '../src/core/prisma/prisma.service.js';
import { TenantContext } from '../src/core/tenancy/tenant-context.js';

/**
 * التقارير — المرحلة 4 / Increment 4.1.
 * كل رقم مشتق من قاعدة البيانات؛ نتحقق من الإيراد/المقبوضات/الضريبة/الخصم،
 * أفضل المنتجات، طرق الدفع، الطلبات حسب الحالة/اليوم، أداء الموظفين، والعزل.
 */

if (!HAS_TEST_DB) console.warn(`\n⚠  ${SKIP_REASON}\n`);

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

const PERMS = ['reports.read'] as const;
function asUser<T>(t: TestTenant, fn: () => Promise<T>): Promise<T> {
  return TenantContext.run(
    { requestId: 'test-reports', tenantId: t.tenantId, userId: t.userId, storeId: t.storeId,
      isSuperAdmin: false, permissions: PERMS as never, ip: null, userAgent: null },
    fn,
  );
}

function orderPayload(customerId: string, over: Partial<CreateOrderRequest> = {}): CreateOrderRequest {
  return {
    customerId, status: 'CONFIRMED', discountAmount: '0',
    items: [{ sourceType: 'MANUAL', name: 'أرز', quantity: '2', unitPrice: '500', discount: '0', taxRate: '0' }],
    ...over,
  } as CreateOrderRequest;
}
const Q = (over: Partial<ReportsQuery> = {}): ReportsQuery =>
  ({ preset: 'this_month', granularity: 'auto', ...over }) as ReportsQuery;

describe.skipIf(!HAS_TEST_DB)('التقارير — Increment 4.1', () => {
  let t: TestTenant, b: TestTenant;
  let orders: OrdersService, payments: PaymentsService, reports: ReportsService;
  let payKey = 0;

  beforeAll(async () => {
    await resetAll();
    t = await createTestTenant('rep-a');
    b = await createTestTenant('rep-b');
    const prisma = fakePrisma();
    const ledger = new LedgerService();
    const audit = new AuditService();
    orders = new OrdersService(prisma, ledger, new OrderCalculator(), new NumberingService(), audit);
    payments = new PaymentsService(prisma, ledger, new NumberingService(), audit);
    reports = new ReportsService(prisma);
  });
  afterAll(async () => { await closeTestDb(); });
  beforeEach(async () => {
    await testDb().$executeRawUnsafe(`TRUNCATE TABLE payment_allocations, payments, ledger_entries,
      order_items, orders, customers, tenant_counters, audit_logs RESTART IDENTITY CASCADE`);
  });

  it('تقرير فارغ: أصفار وأقسام مؤجَّلة بحالة صريحة بلا انهيار', async () => {
    const d = await asUser(t, () => reports.getReports(Q()));
    expect(d.kpis.sales.value).toBe('0.00');
    expect(d.kpis.averageOrderValue.value).toBe('0.00');
    expect(d.salesByCategory.available).toBe(false);
    expect(d.branchReports.available).toBe(false);
    expect(d.ordersByWeekday).toHaveLength(7);
    expect(d.topProducts).toHaveLength(0);
  });

  it('طلب مؤكد + دفعة: مبيعات/مقبوضات/دَين/متوسط/أفضل منتج/طريقة دفع/الحالة/الموظف', async () => {
    const cid = await createTestCustomer(t, 'زبون', { creditLimit: '9999' });
    await asUser(t, () => orders.create(orderPayload(cid))); // 2×500 = 1000
    await asUser(t, () => payments.create({ customerId: cid, amount: '400', method: 'CASH', strategy: 'AUTO_OLDEST_FIRST' } as CreatePaymentRequest, `k${payKey++}`));

    const d = await asUser(t, () => reports.getReports(Q()));
    expect(d.kpis.sales.value).toBe('1000.00');
    expect(d.kpis.payments.value).toBe('400.00');
    expect(d.kpis.outstanding.value).toBe('600.00');
    expect(d.kpis.ordersCount.value).toBe('1');
    expect(d.kpis.averageOrderValue.value).toBe('1000.00');
    expect(d.topProducts[0]?.name).toBe('أرز');
    expect(d.topProducts[0]?.sales).toBe('1000.00');
    expect(d.paymentMethods.find((m) => m.method === 'CASH')?.amount).toBe('400.00');
    // بعد دفع جزئي (400 من 1000) يصبح الطلب PARTIALLY_PAID لا CONFIRMED.
    expect(d.ordersByStatus.find((s) => s.status === 'PARTIALLY_PAID')?.count).toBe(1);
    expect(d.employeePerformance[0]?.orders).toBe(1);
    expect(d.employeePerformance[0]?.sales).toBe('1000.00');
    expect(d.ordersByWeekday.reduce((s, w) => s + w.count, 0)).toBe(1);
  });

  it('الضريبة والخصم يظهران في المؤشرات', async () => {
    const cid = await createTestCustomer(t, 'زبون', { creditLimit: '9999' });
    await asUser(t, () =>
      orders.create(orderPayload(cid, {
        discountAmount: '50',
        items: [{ sourceType: 'MANUAL', name: 'سلعة', quantity: '1', unitPrice: '1000', discount: '0', taxRate: '10' }],
      } as Partial<CreateOrderRequest>)),
    );
    const d = await asUser(t, () => reports.getReports(Q()));
    expect(Number(d.kpis.taxes.value)).toBeGreaterThan(0);
    expect(Number(d.kpis.discounts.value)).toBeGreaterThanOrEqual(50);
  });

  it('مقارنة الفترة السابقة: مبيعات هذا الشهر مقابل صفر الشهر الماضي', async () => {
    const cid = await createTestCustomer(t, 'زبون', { creditLimit: '9999' });
    await asUser(t, () => orders.create(orderPayload(cid)));
    const d = await asUser(t, () => reports.getReports(Q()));
    expect(d.kpis.sales.previous).toBe('0.00');
    expect(d.kpis.sales.deltaPct).toBe(100);
  });

  it('عزل المستأجرين: المستأجر ب لا يرى بيانات أ', async () => {
    const cid = await createTestCustomer(t, 'زبون', { creditLimit: '9999' });
    await asUser(t, () => orders.create(orderPayload(cid)));
    const d = await asUser(b, () => reports.getReports(Q()));
    expect(d.kpis.sales.value).toBe('0.00');
    expect(d.topCustomers).toHaveLength(0);
  });

  it('فترة مخصّصة في الماضي تستبعد طلب اليوم', async () => {
    const cid = await createTestCustomer(t, 'زبون', { creditLimit: '9999' });
    await asUser(t, () => orders.create(orderPayload(cid)));
    const d = await asUser(t, () => reports.getReports(Q({ preset: 'custom', from: '2020-01-01', to: '2020-01-31' })));
    expect(d.kpis.sales.value).toBe('0.00');
  });
});
