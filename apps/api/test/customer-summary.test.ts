import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { CreateCustomerRequest, CreateOrderRequest } from '@oh/contracts';
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
import { isoDateInTimeZone } from '../src/core/time/iso-date-in-timezone.js';

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
    items: [
      { sourceType: 'MANUAL', name: 'بند', quantity: '1', unitPrice, discount: '0', taxRate: '0' },
    ],
  } as CreateOrderRequest;
}

const dateFromToday = (days: number): string => {
  const today = isoDateInTimeZone(new Date(), 'Asia/Jerusalem');
  return new Date(new Date(`${today}T00:00:00.000Z`).getTime() + days * 86_400_000)
    .toISOString()
    .slice(0, 10);
};

function customerPayload(
  name: string,
  openingBalance: string,
  paymentDueDay = 15,
): CreateCustomerRequest {
  return {
    name,
    company: '',
    phone: '',
    email: '',
    address: '',
    city: '',
    taxNumber: '',
    notes: '',
    tags: [],
    creditLimit: '1500',
    paymentTermDays: 30,
    paymentDueDay,
    status: 'ACTIVE',
    openingBalance,
  };
}

describe.skipIf(!HAS_TEST_DB)('ملخّص الزبون', () => {
  let t: TestTenant;
  let customers: CustomersService;
  let orders: OrdersService;

  beforeAll(async () => {
    await resetAll();
    t = await createTestTenant('cust-summary');
    const prisma = fakePrisma();
    customers = new CustomersService(
      prisma,
      new LedgerService(),
      new NumberingService(),
      new AuditService(),
    );
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

  it('يفسر الرصيد الافتتاحي الموجب كرصيد للزبون والسالب كدين عليه', async () => {
    const credited = await asUser(t, () => customers.create(customerPayload('رصيد موجب', '500')));
    const indebted = await asUser(t, () => customers.create(customerPayload('رصيد سالب', '-350')));

    expect(credited.balance).toBe('-500.00');
    expect(credited.accountState).toBe('CREDIT');
    expect(indebted.balance).toBe('350.00');
    expect(indebted.accountState).toBe('DEBIT');
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

  it('يظهر استحقاق الحساب في اليوم المتفق عليه ما دام الرصيد دينًا دون ربطه بطلب', async () => {
    const customer = await asUser(t, () =>
      customers.create(
        customerPayload('مستحق اليوم', '-1000', Number(dateFromToday(0).slice(8, 10))),
      ),
    );

    const s = await asUser(t, () => customers.summary(customer.id));
    expect(s.totalOrders).toBe(0);
    expect(s.overdueOrders).toBe(0);
    expect(s.paymentDueReached).toBe(true);
    expect(s.paymentDueAmount).toBe('1000.00');
  });

  it('لا يظهر استحقاق الحساب قبل التاريخ المتفق عليه', async () => {
    const customer = await asUser(t, () =>
      customers.create(
        customerPayload('موعده لاحقًا', '-1000', Number(dateFromToday(1).slice(8, 10))),
      ),
    );

    const s = await asUser(t, () => customers.summary(customer.id));
    expect(s.paymentDueReached).toBe(false);
    expect(s.paymentDueAmount).toBe('0.00');
  });
});
