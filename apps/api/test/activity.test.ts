import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { CreateCustomerRequest, CreateOrderRequest, CreatePaymentRequest } from '@oh/contracts';
import { AUDIT_ACTIONS } from '@oh/contracts';
import { HAS_TEST_DB, SKIP_REASON, closeTestDb, testDb } from './db.js';
import { createTestTenant, inTenant, resetAll, type TestTenant } from './helpers.js';
import { ActivityService } from '../src/modules/activity/activity.service.js';
import { CustomersService } from '../src/modules/customers/customers.service.js';
import { OrdersService } from '../src/modules/orders/orders.service.js';
import { PaymentsService } from '../src/modules/payments/payments.service.js';
import { LedgerService } from '../src/modules/ledger/ledger.service.js';
import { OrderCalculator } from '../src/modules/orders/order-calculator.js';
import { NumberingService } from '../src/core/numbering/numbering.service.js';
import { AuditService } from '../src/core/audit/audit.service.js';
import type { PrismaService } from '../src/core/prisma/prisma.service.js';
import { TenantContext } from '../src/core/tenancy/tenant-context.js';

/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  موجز النشاط — المرحلة 3.5 / Increment 2.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  نتحقق من الخط الزمني للزبون وموجز المحل من مصدر واحد (سجل التدقيق):
 *  تجميع أحداث الزبون وطلباته ودفعاته، الترتيب الزمني التنازلي، الفلترة بالنوع
 *  والتاريخ، الترقيم، العزل بين المستأجرين، وترشيح الأنواع بالصلاحيات.
 *
 *  ملاحظة على الصلاحيات: الحماية عند حدّ المسار (activity.read لموجز المحل،
 *  customers.read للخط الزمني) مُختبَرة في `activity-permission.guard.test.ts`.
 *  هنا نختبر الترشيح الداخلي للأنواع الذي تطبّقه الخدمة بعد اجتياز الحارس.
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

const FULL_READ = ['customers.read', 'orders.read', 'payments.read', 'ledger.read', 'audit.read'] as const;

function asUser<T>(tn: TestTenant, fn: () => Promise<T>, perms: readonly string[] = FULL_READ): Promise<T> {
  return TenantContext.run(
    {
      requestId: 'test-activity',
      tenantId: tn.tenantId,
      userId: tn.userId,
      storeId: tn.storeId,
      isSuperAdmin: false,
      permissions: perms as never,
      ip: null,
      userAgent: null,
    },
    fn,
  );
}

function customerPayload(name: string): CreateCustomerRequest {
  return {
    name,
    tags: [],
    creditLimit: '5000',
    paymentTermDays: 30,
    status: 'ACTIVE',
    openingBalance: '0',
  } as CreateCustomerRequest;
}

function orderPayload(customerId: string): CreateOrderRequest {
  return {
    customerId,
    status: 'CONFIRMED',
    discountAmount: '0',
    items: [{ sourceType: 'MANUAL', name: 'بند', quantity: '1', unitPrice: '500', discount: '0', taxRate: '0' }],
  } as CreateOrderRequest;
}

function paymentPayload(customerId: string, amount = '200'): CreatePaymentRequest {
  return {
    customerId,
    amount,
    method: 'CASH',
    strategy: 'AUTO_OLDEST_FIRST',
  } as CreatePaymentRequest;
}

/** تاريخ YYYY-MM-DD مزاحًا بعدد أيام عن اليوم (UTC). */
function isoDay(offsetDays: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

describe.skipIf(!HAS_TEST_DB)('موجز النشاط', () => {
  let a: TestTenant;
  let b: TestTenant;
  let activity: ActivityService;
  let customers: CustomersService;
  let orders: OrdersService;
  let payments: PaymentsService;
  let audit: AuditService;
  let payKey = 0;

  beforeAll(async () => {
    await resetAll();
    a = await createTestTenant('activity-a');
    b = await createTestTenant('activity-b');
    const prisma = fakePrisma();
    const ledger = new LedgerService();
    audit = new AuditService();
    activity = new ActivityService(prisma);
    customers = new CustomersService(prisma, ledger, new NumberingService(), audit);
    orders = new OrdersService(prisma, ledger, new OrderCalculator(), new NumberingService(), audit);
    payments = new PaymentsService(prisma, ledger, new NumberingService(), audit);
  });

  afterAll(async () => {
    await closeTestDb();
  });

  beforeEach(async () => {
    const db = testDb();
    await db.$executeRawUnsafe(`
      TRUNCATE TABLE payment_allocations, payments, ledger_entries,
                     order_items, orders, customers, tenant_counters, audit_logs
      RESTART IDENTITY CASCADE
    `);
  });

  /** يسجّل حدث تسوية دفتر (ledger.*) مرتبطًا بالزبون — كما تفعل تسوية حقيقية. */
  async function recordLedgerEvent(tn: TestTenant, customerId: string): Promise<void> {
    await asUser(tn, () =>
      inTenant(tn.tenantId, (tx) =>
        audit.record(tx as never, {
          action: AUDIT_ACTIONS.LEDGER_ADJUSTMENT,
          summary: 'قيد تسوية اختباري',
          entityType: 'Customer',
          entityId: customerId,
        }),
      ),
    );
  }

  // ── التجميع والترتيب ──────────────────────────────────────────────────────

  it('خط الزبون يجمع أحداث الزبون وطلباته ودفعاته', async () => {
    const customer = await asUser(a, () => customers.create(customerPayload('زبون النشاط')));
    await asUser(a, () => orders.create(orderPayload(customer.id)));
    await asUser(a, () => payments.create(paymentPayload(customer.id), `k${payKey++}`));

    const feed = await asUser(a, () => activity.feed({ customerId: customer.id, page: 1, pageSize: 50 }));

    expect(feed.items.some((i) => i.category === 'CUSTOMER')).toBe(true);
    expect(feed.items.some((i) => i.category === 'ORDER')).toBe(true);
    expect(feed.items.some((i) => i.category === 'PAYMENT')).toBe(true);
    // كل عنصر يحمل وقتًا وعنوانًا.
    expect(feed.items.every((i) => i.occurredAt && i.title)).toBe(true);
  });

  it('الترتيب زمني تنازلي بالتسلسل', async () => {
    const customer = await asUser(a, () => customers.create(customerPayload('زبون')));
    await asUser(a, () => orders.create(orderPayload(customer.id)));
    await asUser(a, () => payments.create(paymentPayload(customer.id), `k${payKey++}`));

    const feed = await asUser(a, () => activity.feed({ page: 1, pageSize: 50 }));
    const seqs = feed.items.map((i) => Number(i.seq));
    expect(seqs).toEqual([...seqs].sort((x, y) => y - x));
  });

  it('موجز المحل يشمل نشاط كل الزبائن', async () => {
    const c1 = await asUser(a, () => customers.create(customerPayload('زبون ١')));
    const c2 = await asUser(a, () => customers.create(customerPayload('زبون ٢')));
    await asUser(a, () => orders.create(orderPayload(c1.id)));
    await asUser(a, () => orders.create(orderPayload(c2.id)));

    const feed = await asUser(a, () => activity.feed({ page: 1, pageSize: 50 }));
    expect(feed.total).toBeGreaterThanOrEqual(4); // زبونان + طلبان
  });

  // ── الفلترة ───────────────────────────────────────────────────────────────

  it('الفلترة بالنوع ORDER تُعيد أحداث الطلبات فقط', async () => {
    const customer = await asUser(a, () => customers.create(customerPayload('زبون')));
    await asUser(a, () => orders.create(orderPayload(customer.id)));

    const feed = await asUser(a, () =>
      activity.feed({ customerId: customer.id, page: 1, pageSize: 20, category: 'ORDER' }),
    );
    expect(feed.total).toBeGreaterThan(0);
    expect(feed.items.every((i) => i.category === 'ORDER')).toBe(true);
  });

  it('فلترة from تشمل أحداث اليوم وتستبعد ما قبل نطاق مستقبلي', async () => {
    const customer = await asUser(a, () => customers.create(customerPayload('زبون')));
    await asUser(a, () => orders.create(orderPayload(customer.id)));

    // from = اليوم → يشمل أحداث اليوم.
    const today = await asUser(a, () => activity.feed({ page: 1, pageSize: 50, from: isoDay(0) }));
    expect(today.total).toBeGreaterThan(0);

    // from = الغد → يستبعد كل ما جرى اليوم.
    const future = await asUser(a, () => activity.feed({ page: 1, pageSize: 50, from: isoDay(1) }));
    expect(future.total).toBe(0);
  });

  it('فلترة to تستبعد أحداث اليوم إن كان الحد الأعلى بالأمس', async () => {
    const customer = await asUser(a, () => customers.create(customerPayload('زبون')));
    await asUser(a, () => orders.create(orderPayload(customer.id)));

    // to = اليوم → شامل (حتى 23:59:59).
    const upToToday = await asUser(a, () => activity.feed({ page: 1, pageSize: 50, to: isoDay(0) }));
    expect(upToToday.total).toBeGreaterThan(0);

    // to = الأمس → يستبعد أحداث اليوم.
    const upToYesterday = await asUser(a, () => activity.feed({ page: 1, pageSize: 50, to: isoDay(-1) }));
    expect(upToYesterday.total).toBe(0);
  });

  // ── الترقيم ───────────────────────────────────────────────────────────────

  it('ترقيم الصفحات: الحجم يحدّ العناصر والإجمالي يعكس الكل', async () => {
    const customer = await asUser(a, () => customers.create(customerPayload('زبون')));
    await asUser(a, () => orders.create(orderPayload(customer.id)));
    await asUser(a, () => orders.create(orderPayload(customer.id)));

    const page1 = await asUser(a, () => activity.feed({ page: 1, pageSize: 2 }));
    expect(page1.items).toHaveLength(2);
    expect(page1.total).toBeGreaterThanOrEqual(3);
    expect(page1.pageSize).toBe(2);
  });

  it('صفحة خارج النطاق تُعيد قائمة فارغة مع إجمالي صحيح', async () => {
    const customer = await asUser(a, () => customers.create(customerPayload('زبون')));
    await asUser(a, () => orders.create(orderPayload(customer.id)));

    const far = await asUser(a, () => activity.feed({ page: 999, pageSize: 10 }));
    expect(far.items).toHaveLength(0);
    expect(far.total).toBeGreaterThan(0);
    expect(far.totalPages).toBeGreaterThanOrEqual(1);
  });

  // ── العزل ─────────────────────────────────────────────────────────────────

  it('عزل المستأجرين: لا يرى مستأجر نشاط آخر', async () => {
    const custA = await asUser(a, () => customers.create(customerPayload('زبون أ')));
    await asUser(a, () => orders.create(orderPayload(custA.id)));

    const feedB = await asUser(b, () => activity.feed({ page: 1, pageSize: 50 }));
    expect(feedB.total).toBe(0);

    const feedA = await asUser(a, () => activity.feed({ page: 1, pageSize: 50 }));
    expect(feedA.total).toBeGreaterThan(0);
  });

  it('معرّف زبون من مستأجر آخر لا يكشف وجودًا (خط زمني فارغ)', async () => {
    const custB = await asUser(b, () => customers.create(customerPayload('زبون ب')));
    await asUser(b, () => orders.create(orderPayload(custB.id)));

    // المستأجر أ يطلب خطّ زبون يخص المستأجر ب — RLS يعزل، فلا نشاط ولا تسريب.
    const leaked = await asUser(a, () => activity.feed({ customerId: custB.id, page: 1, pageSize: 50 }));
    expect(leaked.total).toBe(0);
    expect(leaked.items).toHaveLength(0);
  });

  // ── ترشيح الأنواع بالصلاحيات ─────────────────────────────────────────────

  it('بلا orders.read لا تظهر أحداث الطلبات', async () => {
    const customer = await asUser(a, () => customers.create(customerPayload('زبون')));
    await asUser(a, () => orders.create(orderPayload(customer.id)));

    const limited = await asUser(
      a,
      () => activity.feed({ customerId: customer.id, page: 1, pageSize: 25 }),
      ['customers.read'],
    );
    expect(limited.total).toBeGreaterThan(0);
    expect(limited.items.some((i) => i.category === 'ORDER')).toBe(false);

    const full = await asUser(
      a,
      () => activity.feed({ customerId: customer.id, page: 1, pageSize: 25 }),
      ['customers.read', 'orders.read'],
    );
    expect(full.items.some((i) => i.category === 'ORDER')).toBe(true);
  });

  it('بلا payments.read لا تظهر أحداث الدفعات', async () => {
    const customer = await asUser(a, () => customers.create(customerPayload('زبون')));
    await asUser(a, () => orders.create(orderPayload(customer.id)));
    await asUser(a, () => payments.create(paymentPayload(customer.id), `k${payKey++}`));

    const noPay = await asUser(
      a,
      () => activity.feed({ customerId: customer.id, page: 1, pageSize: 25 }),
      ['customers.read', 'orders.read'],
    );
    expect(noPay.items.some((i) => i.category === 'PAYMENT')).toBe(false);

    const withPay = await asUser(
      a,
      () => activity.feed({ customerId: customer.id, page: 1, pageSize: 25 }),
      ['customers.read', 'orders.read', 'payments.read'],
    );
    expect(withPay.items.some((i) => i.category === 'PAYMENT')).toBe(true);
  });

  it('بلا ledger.read لا تظهر أحداث تسوية الدفتر', async () => {
    const customer = await asUser(a, () => customers.create(customerPayload('زبون')));
    await recordLedgerEvent(a, customer.id);

    const noLedger = await asUser(
      a,
      () => activity.feed({ customerId: customer.id, page: 1, pageSize: 25 }),
      ['customers.read'],
    );
    expect(noLedger.items.some((i) => i.category === 'LEDGER')).toBe(false);

    const withLedger = await asUser(
      a,
      () => activity.feed({ customerId: customer.id, page: 1, pageSize: 25 }),
      ['customers.read', 'ledger.read'],
    );
    expect(withLedger.items.some((i) => i.category === 'LEDGER')).toBe(true);
  });
});
