import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { CreateOrderRequest, CreatePaymentRequest, DashboardQuery } from '@oh/contracts';
import { HAS_TEST_DB, SKIP_REASON, closeTestDb, testDb } from './db.js';
import { createTestCustomer, createTestTenant, inTenant, resetAll, type TestTenant } from './helpers.js';
import { OrdersService } from '../src/modules/orders/orders.service.js';
import { PaymentsService } from '../src/modules/payments/payments.service.js';
import { DashboardService } from '../src/modules/dashboard/dashboard.service.js';
import { LedgerService } from '../src/modules/ledger/ledger.service.js';
import { OrderCalculator } from '../src/modules/orders/order-calculator.js';
import { NumberingService } from '../src/core/numbering/numbering.service.js';
import { AuditService } from '../src/core/audit/audit.service.js';
import type { PrismaService } from '../src/core/prisma/prisma.service.js';
import { TenantContext } from '../src/core/tenancy/tenant-context.js';

/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  لوحة التحكم — المرحلة 3.5 / Increment 3 (Dashboard Completion).
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  كل رقم مشتق من قاعدة البيانات: إيراد، مقبوضات، دَين، متأخرات، دفعات غير
 *  موزّعة… مع مقارنة الفترة السابقة، وترشيح الأقسام بالصلاحيات، والعزل بين
 *  المستأجرين. لا قيم ثابتة ولا بيانات وهمية.
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

const FULL = [
  'dashboard.read',
  'orders.read',
  'payments.read',
  'ledger.read',
  'customers.read',
  'subscription.read',
] as const;

function asUser<T>(t: TestTenant, fn: () => Promise<T>, perms: readonly string[] = FULL): Promise<T> {
  return TenantContext.run(
    {
      requestId: 'test-dashboard',
      tenantId: t.tenantId,
      userId: t.userId,
      storeId: t.storeId,
      isSuperAdmin: false,
      permissions: perms as never,
      ip: null,
      userAgent: null,
    },
    fn,
  );
}

function orderPayload(customerId: string, over: Partial<CreateOrderRequest> = {}): CreateOrderRequest {
  return {
    customerId,
    status: 'CONFIRMED',
    discountAmount: '0',
    items: [
      { sourceType: 'MANUAL', name: 'بند', quantity: '1', unitPrice: '1000', discount: '0', taxRate: '0' },
    ],
    ...over,
  } as CreateOrderRequest;
}

function paymentPayload(customerId: string, amount: string): CreatePaymentRequest {
  return { customerId, amount, method: 'CASH', strategy: 'AUTO_OLDEST_FIRST' } as CreatePaymentRequest;
}

const Q = (over: Partial<DashboardQuery> = {}): DashboardQuery =>
  ({ preset: 'this_month', granularity: 'auto', ...over }) as DashboardQuery;

/** يعيد مؤشرًا بمعرّفه من مصفوفة KPIs (أو undefined إن رُشِّح بالصلاحيات). */
function kpi(data: { kpis: { id: string; value: string; previous: string | null; deltaPct: number | null }[] }, id: string) {
  return data.kpis.find((k) => k.id === id);
}

describe.skipIf(!HAS_TEST_DB)('لوحة التحكم — Increment 3', () => {
  let t: TestTenant;
  let b: TestTenant;
  let orders: OrdersService;
  let payments: PaymentsService;
  let dashboard: DashboardService;
  let payKey = 0;

  beforeAll(async () => {
    await resetAll();
    t = await createTestTenant('dash-a');
    b = await createTestTenant('dash-b');
    const prisma = fakePrisma();
    const ledger = new LedgerService();
    const audit = new AuditService();
    orders = new OrdersService(prisma, ledger, new OrderCalculator(), new NumberingService(), audit);
    payments = new PaymentsService(prisma, ledger, new NumberingService(), audit);
    dashboard = new DashboardService(prisma);
  });

  afterAll(async () => {
    await closeTestDb();
  });

  beforeEach(async () => {
    await testDb().$executeRawUnsafe(`
      TRUNCATE TABLE payment_allocations, payments, ledger_entries,
                     order_items, orders, customers, tenant_counters, audit_logs
      RESTART IDENTITY CASCADE
    `);
  });

  const pay = (cid: string, amount: string) =>
    asUser(t, () => payments.create(paymentPayload(cid, amount), `k${payKey++}`));

  it('لوحة فارغة: كل المؤشرات أصفار ومنحنيات ذات دلاء، بلا انهيار', async () => {
    const data = await asUser(t, () => dashboard.getDashboard(Q()));

    expect(data.kpis.length).toBeGreaterThan(0);
    expect(kpi(data, 'revenue')?.value).toBe('0.00');
    expect(kpi(data, 'outstanding_balance')?.value).toBe('0.00');
    expect(kpi(data, 'collection_rate')?.value).toBe('0.00');
    expect(data.trends.find((s) => s.id === 'revenue')?.points.length).toBeGreaterThan(0);
    expect(data.topDebtors).toHaveLength(0);
    expect(data.recentOrders).toHaveLength(0);
  });

  it('طلب مؤكد 1000 + دفعة 400: إيراد/مقبوضات/تحصيل/دَين/متوسط الطلب', async () => {
    const cid = await createTestCustomer(t, 'زبون', { creditLimit: '5000' });
    await asUser(t, () => orders.create(orderPayload(cid)));
    await pay(cid, '400');

    const data = await asUser(t, () => dashboard.getDashboard(Q()));

    expect(kpi(data, 'revenue')?.value).toBe('1000.00');
    expect(kpi(data, 'payments')?.value).toBe('400.00');
    expect(kpi(data, 'orders')?.value).toBe('1');
    expect(kpi(data, 'average_order_value')?.value).toBe('1000.00');
    expect(kpi(data, 'collection_rate')?.value).toBe('40.00');
    expect(kpi(data, 'outstanding_balance')?.value).toBe('600.00');
    expect(data.topDebtors[0]?.balance).toBe('600.00');
    expect(data.recentPayments[0]?.createdByName).toBeTruthy();
  });

  it('المسودة لا تُحتسب في الإيراد ولا عدد الطلبات', async () => {
    const cid = await createTestCustomer(t, 'زبون');
    await asUser(t, () => orders.create(orderPayload(cid, { status: 'DRAFT' })));

    const data = await asUser(t, () => dashboard.getDashboard(Q()));
    expect(kpi(data, 'revenue')?.value).toBe('0.00');
    expect(kpi(data, 'orders')?.value).toBe('0');
    expect(kpi(data, 'outstanding_balance')?.value).toBe('0.00');
  });

  it('الدفعة المعكوسة لا تُحتسب في المقبوضات', async () => {
    const cid = await createTestCustomer(t, 'زبون', { creditLimit: '5000' });
    await asUser(t, () => orders.create(orderPayload(cid)));
    const p = await pay(cid, '400');
    // عكس الدفعة على مستوى الحالة (نختبر ترشيح المؤشر).
    await inTenant(t.tenantId, (tx) =>
      tx.$executeRawUnsafe(`UPDATE payments SET status='REVERSED' WHERE id=$1::uuid`, p.id),
    );

    const data = await asUser(t, () => dashboard.getDashboard(Q()));
    expect(kpi(data, 'payments')?.value).toBe('0.00');
  });

  it('دفعة زائدة تُنتج دفعات غير موزّعة ورصيدًا دائنًا لا يُحتسب في الدَّين', async () => {
    const cid = await createTestCustomer(t, 'زبون', { creditLimit: '5000' });
    await asUser(t, () => orders.create(orderPayload(cid, { items: [{ sourceType: 'MANUAL', name: 'x', quantity: '1', unitPrice: '500', discount: '0', taxRate: '0' }] } as Partial<CreateOrderRequest>)));
    await pay(cid, '800'); // 500 توزَّع، 300 فائض

    const data = await asUser(t, () => dashboard.getDashboard(Q()));
    expect(kpi(data, 'unallocated_payments')?.value).toBe('300.00');
    // الرصيد صار دائنًا (−300) فلا يدخل في إجمالي الديون.
    expect(kpi(data, 'outstanding_balance')?.value).toBe('0.00');
  });

  it('طلب متأخر مدفوع جزئيًا: المتأخرات = الإجمالي − المدفوع', async () => {
    const cid = await createTestCustomer(t, 'زبون', { creditLimit: '5000' });
    const o = await asUser(t, () => orders.create(orderPayload(cid)));
    await pay(cid, '300');
    // نُرجِع تاريخ الاستحقاق للماضي لمحاكاة التأخر.
    await inTenant(t.tenantId, (tx) =>
      tx.$executeRawUnsafe(`UPDATE orders SET due_at = now() - interval '10 days' WHERE id=$1::uuid`, o.id),
    );

    const data = await asUser(t, () => dashboard.getDashboard(Q()));
    expect(kpi(data, 'overdue_balance')?.value).toBe('700.00');
    expect(kpi(data, 'overdue_customers')?.value).toBe('1');
  });

  it('نسبة التحصيل بمقام صفر تُعيد صفرًا لا NaN/Infinity', async () => {
    const cid = await createTestCustomer(t, 'زبون', { creditLimit: '5000' });
    // دفعة بلا إيراد مؤكد (دفعة مقدَّمة) → المقام صفر.
    await pay(cid, '200');
    const data = await asUser(t, () => dashboard.getDashboard(Q()));
    const rate = kpi(data, 'collection_rate');
    expect(rate?.value).toBe('0.00');
    expect(Number.isFinite(Number(rate?.value))).toBe(true);
  });

  it('قيمة عشرية كبيرة تُحفظ بدقّة (بلا فاصلة عائمة)', async () => {
    const cid = await createTestCustomer(t, 'زبون', { creditLimit: '9999999' });
    await asUser(t, () =>
      orders.create(
        orderPayload(cid, {
          items: [{ sourceType: 'MANUAL', name: 'x', quantity: '1', unitPrice: '999999.99', discount: '0', taxRate: '0' }],
        } as Partial<CreateOrderRequest>),
      ),
    );
    const data = await asUser(t, () => dashboard.getDashboard(Q()));
    expect(kpi(data, 'revenue')?.value).toBe('999999.99');
  });

  it('ترتيب أعلى المدينين ثابت عند تساوي الرصيد', async () => {
    const c1 = await createTestCustomer(t, 'أ', { creditLimit: '5000', code: 'C1' });
    const c2 = await createTestCustomer(t, 'ب', { creditLimit: '5000', code: 'C2' });
    await asUser(t, () => orders.create(orderPayload(c1)));
    await asUser(t, () => orders.create(orderPayload(c2)));

    const a = await asUser(t, () => dashboard.getDashboard(Q()));
    const b2 = await asUser(t, () => dashboard.getDashboard(Q()));
    expect(a.topDebtors.map((d) => d.id)).toEqual(b2.topDebtors.map((d) => d.id));
    expect(a.topDebtors).toHaveLength(2);
  });

  it('فترة مخصّصة في الماضي تستبعد طلب اليوم', async () => {
    const cid = await createTestCustomer(t, 'زبون', { creditLimit: '5000' });
    await asUser(t, () => orders.create(orderPayload(cid)));

    const past = await asUser(t, () =>
      dashboard.getDashboard(Q({ preset: 'custom', from: '2020-01-01', to: '2020-01-31' })),
    );
    expect(kpi(past, 'revenue')?.value).toBe('0.00');
  });

  it('مقارنة الفترة السابقة: إيراد هذا الشهر مقابل صفر الشهر الماضي', async () => {
    const cid = await createTestCustomer(t, 'زبون', { creditLimit: '5000' });
    await asUser(t, () => orders.create(orderPayload(cid)));

    const data = await asUser(t, () => dashboard.getDashboard(Q()));
    const rev = kpi(data, 'revenue');
    expect(rev?.value).toBe('1000.00');
    expect(rev?.previous).toBe('0.00');
    expect(rev?.deltaPct).toBe(100);
  });

  it('عزل المستأجرين: المستأجر ب لا يرى بيانات المستأجر أ', async () => {
    const cid = await createTestCustomer(t, 'زبون', { creditLimit: '5000' });
    await asUser(t, () => orders.create(orderPayload(cid)));

    const bData = await asUser(b, () => dashboard.getDashboard(Q()));
    expect(kpi(bData, 'revenue')?.value).toBe('0.00');
    expect(kpi(bData, 'outstanding_balance')?.value).toBe('0.00');
    expect(bData.topDebtors).toHaveLength(0);
  });

  it('ترشيح الأقسام بالصلاحيات', async () => {
    const cid = await createTestCustomer(t, 'زبون', { creditLimit: '5000' });
    await asUser(t, () => orders.create(orderPayload(cid)));
    await pay(cid, '400');

    // بلا payments.read: لا مؤشر مقبوضات ولا قائمة دفعات.
    const noPay = await asUser(t, () => dashboard.getDashboard(Q()), [
      'dashboard.read',
      'orders.read',
      'ledger.read',
      'customers.read',
    ]);
    expect(kpi(noPay, 'payments')).toBeUndefined();
    expect(noPay.recentPayments).toHaveLength(0);
    expect(noPay.meta.scope.kpis).not.toContain('payments');

    // بلا ledger.read: لا دَين ولا متأخرات ولا مدينون.
    const noLedger = await asUser(t, () => dashboard.getDashboard(Q()), [
      'dashboard.read',
      'orders.read',
      'payments.read',
      'customers.read',
    ]);
    expect(kpi(noLedger, 'outstanding_balance')).toBeUndefined();
    expect(kpi(noLedger, 'overdue_balance')).toBeUndefined();
    expect(noLedger.topDebtors).toHaveLength(0);

    // بلا orders.read: لا إيراد ولا طلبات.
    const noOrders = await asUser(t, () => dashboard.getDashboard(Q()), [
      'dashboard.read',
      'payments.read',
      'ledger.read',
      'customers.read',
    ]);
    expect(kpi(noOrders, 'revenue')).toBeUndefined();
    expect(noOrders.recentOrders).toHaveLength(0);
    expect(noOrders.meta.topCustomersBasis).toBe('collection');
  });
});
