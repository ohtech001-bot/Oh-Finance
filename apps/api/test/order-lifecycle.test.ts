import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { CreateOrderRequest, CreatePaymentRequest } from '@oh/contracts';
import { HAS_TEST_DB, SKIP_REASON, closeTestDb, testDb } from './db.js';
import {
  createTestCustomer,
  createTestTenant,
  inTenant,
  resetAll,
  type TestTenant,
} from './helpers.js';
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
 *  دورة حياة الطلب — نسخ/حذف/أرشفة/إرجاع إلى مسودة (المرحلة 3).
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  نختبر `OrdersService` مباشرةً ضد Postgres الحقيقي، لا عبر HTTP. نحقن
 *  `PrismaService` مزيّفًا يوجّه `runInTenant` إلى قاعدة الاختبار بنفس منطق
 *  العزل (SET LOCAL ROLE oh_app + app.tenant_id) — فنختبر المنطق كما يعمل
 *  في الإنتاج بالضبط، بلا تجاوز RLS.
 */

if (!HAS_TEST_DB) {
  console.warn(`\n⚠  ${SKIP_REASON}\n`);
}

const TX_OPTS = { maxWait: 30_000, timeout: 30_000 } as const;

/** PrismaService مزيّف: `runInTenant` يعمل على قاعدة الاختبار بدور التطبيق. */
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

/** يشغّل دالة ضمن سياق طلب موثّق — كما يفعل حارس المصادقة. */
function asUser<T>(t: TestTenant, fn: () => Promise<T>): Promise<T> {
  return TenantContext.run(
    {
      requestId: 'test-order-lifecycle',
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
  over: Partial<CreateOrderRequest> = {},
): CreateOrderRequest {
  return {
    customerId,
    status: 'DRAFT',
    discountAmount: '0',
    items: [
      {
        sourceType: 'MANUAL',
        name: 'بند تجريبي',
        quantity: '1',
        unitPrice: '100',
        discount: '0',
        taxRate: '0',
      },
    ],
    ...over,
  } as CreateOrderRequest;
}

describe.skipIf(!HAS_TEST_DB)('دورة حياة الطلب', () => {
  let t: TestTenant;
  let orders: OrdersService;
  let payments: PaymentsService;

  beforeAll(async () => {
    await resetAll();
    t = await createTestTenant('order-lifecycle');
    orders = new OrdersService(
      fakePrisma(),
      new LedgerService(),
      new OrderCalculator(),
      new NumberingService(),
      new AuditService(),
    );
    payments = new PaymentsService(
      fakePrisma(),
      new LedgerService(),
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

  describe('السداد التلقائي من رصيد الزبون', () => {
    async function customerWithCredit(amount: string): Promise<string> {
      const customerId = await createTestCustomer(t, 'زبون له رصيد');
      await inTenant(t.tenantId, (tx) =>
        new LedgerService().append(tx, {
          tenantId: t.tenantId,
          storeId: t.storeId,
          customerId,
          entryType: 'OPENING_BALANCE',
          direction: 'CREDIT',
          amount,
          refType: 'CUSTOMER',
          refId: customerId,
          createdBy: t.userId,
        }),
      );
      return customerId;
    }

    it('يسدد الطلب كاملًا تلقائيًا عندما يغطي الرصيد قيمته', async () => {
      const customerId = await customerWithCredit('200');
      const order = await asUser(t, () =>
        orders.create(
          orderPayload(customerId, {
            status: 'CONFIRMED',
            items: [
              {
                sourceType: 'MANUAL',
                name: 'منتج',
                quantity: '1',
                unitPrice: '50',
                discount: '0',
                taxRate: '0',
              },
            ],
          }),
        ),
      );

      expect(order.status).toBe('PAID');
      expect(order.creditAppliedAmount).toBe('50.00');
      expect(order.paidAmount).toBe('50.00');
      expect(order.remainingAmount).toBe('0.00');
    });

    it('يسدد جزئيًا من الرصيد ويترك الفرق دينًا', async () => {
      const customerId = await customerWithCredit('200');
      const order = await asUser(t, () =>
        orders.create(
          orderPayload(customerId, {
            status: 'CONFIRMED',
            items: [
              {
                sourceType: 'MANUAL',
                name: 'منتج',
                quantity: '1',
                unitPrice: '300',
                discount: '0',
                taxRate: '0',
              },
            ],
          }),
        ),
      );

      expect(order.status).toBe('PARTIALLY_PAID');
      expect(order.creditAppliedAmount).toBe('200.00');
      expect(order.paidAmount).toBe('200.00');
      expect(order.remainingAmount).toBe('100.00');
    });
  });

  describe('تسوية الدفعة العامة على الطلبات', () => {
    it('يسدد الأقدم أولاً ثم يسدد الطلب التالي جزئياً ويغلقه عند اكتمال الدين', async () => {
      const customerId = await createTestCustomer(t, 'زبون عليه طلبان');
      const first = await asUser(t, () =>
        orders.create(
          orderPayload(customerId, {
            status: 'CONFIRMED',
            items: [
              {
                sourceType: 'MANUAL',
                name: 'الطلب الأول',
                quantity: '1',
                unitPrice: '500',
                discount: '0',
                taxRate: '0',
              },
            ],
          }),
        ),
      );
      const second = await asUser(t, () =>
        orders.create(
          orderPayload(customerId, {
            status: 'CONFIRMED',
            items: [
              {
                sourceType: 'MANUAL',
                name: 'الطلب الثاني',
                quantity: '1',
                unitPrice: '700',
                discount: '0',
                taxRate: '0',
              },
            ],
          }),
        ),
      );

      await asUser(t, () =>
        payments.create(
          {
            customerId,
            amount: '1000',
            method: 'CASH',
            strategy: 'NONE',
          } as CreatePaymentRequest,
          'general-payment-1000',
        ),
      );

      const afterPartial = await inTenant(t.tenantId, (tx) =>
        tx.order.findMany({
          where: { id: { in: [first.id, second.id] } },
          orderBy: { number: 'asc' },
          select: { status: true, paidAmount: true },
        }),
      );
      expect(afterPartial[0]?.status).toBe('PAID');
      expect(afterPartial[0]?.paidAmount.toString()).toBe('500');
      expect(afterPartial[1]?.status).toBe('PARTIALLY_PAID');
      expect(afterPartial[1]?.paidAmount.toString()).toBe('500');

      await asUser(t, () =>
        payments.create(
          {
            customerId,
            amount: '200',
            method: 'CASH',
            strategy: 'AUTO_OLDEST_FIRST',
          } as CreatePaymentRequest,
          'general-payment-200',
        ),
      );

      const afterFull = await inTenant(t.tenantId, (tx) =>
        tx.order.findMany({
          where: { id: { in: [first.id, second.id] } },
          orderBy: { number: 'asc' },
          select: { status: true, paidAmount: true },
        }),
      );
      expect(afterFull.map((order) => order.status)).toEqual(['PAID', 'PAID']);
      expect(afterFull.map((order) => order.paidAmount.toString())).toEqual(['500', '700']);
    });
  });

  // ── النسخ ─────────────────────────────────────────────────────────────────

  describe('duplicate', () => {
    it('ينشئ مسودة جديدة بنفس البنود ورقم مختلف وبلا أثر مالي', async () => {
      const customerId = await createTestCustomer(t, 'زبون');

      const source = await asUser(t, () =>
        orders.create(orderPayload(customerId, { status: 'CONFIRMED' })),
      );
      const copy = await asUser(t, () => orders.duplicate(source.id));

      expect(copy.id).not.toBe(source.id);
      expect(copy.number).not.toBe(source.number);
      expect(copy.status).toBe('DRAFT');
      expect(copy.total).toBe(source.total);
      expect(copy.items).toHaveLength(source.items.length);
      expect(copy.paidAmount).toBe('0.00');

      // النسخة مسودة ⇒ لا قيد محاسبي لها.
      const entries = await testDb().$queryRaw<{ n: bigint }[]>`
        SELECT count(*)::bigint AS n FROM ledger_entries WHERE ref_id = ${copy.id}::uuid
      `;
      expect(Number(entries[0]!.n)).toBe(0);
    });
  });

  // ── الحذف ─────────────────────────────────────────────────────────────────

  describe('remove', () => {
    it('يحذف مسودة', async () => {
      const customerId = await createTestCustomer(t, 'زبون');
      const draft = await asUser(t, () => orders.create(orderPayload(customerId)));

      await asUser(t, () => orders.remove(draft.id, draft.version));

      const found = await asUser(t, () => orders.findOne(draft.id));
      expect(found).toBeNull();
    });

    it('يرفض حذف طلب مؤكد — له أثر محاسبي', async () => {
      const customerId = await createTestCustomer(t, 'زبون');
      const confirmed = await asUser(t, () =>
        orders.create(orderPayload(customerId, { status: 'CONFIRMED' })),
      );

      await expect(
        asUser(t, () => orders.remove(confirmed.id, confirmed.version)),
      ).rejects.toThrow();

      // الطلب ما زال موجودًا.
      const found = await asUser(t, () => orders.findOne(confirmed.id));
      expect(found).not.toBeNull();
    });

    it('يرفض الحذف عند عدم تطابق رقم النسخة (قفل متفائل)', async () => {
      const customerId = await createTestCustomer(t, 'زبون');
      const draft = await asUser(t, () => orders.create(orderPayload(customerId)));

      await expect(asUser(t, () => orders.remove(draft.id, draft.version + 5))).rejects.toThrow();
    });
  });

  // ── الأرشفة ─────────────────────────────────────────────────────────────────

  describe('setArchived', () => {
    it('يؤرشف مسودة ويستبعدها من القائمة الافتراضية', async () => {
      const customerId = await createTestCustomer(t, 'زبون');
      const draft = await asUser(t, () => orders.create(orderPayload(customerId)));

      const archived = await asUser(t, () => orders.setArchived(draft.id, draft.version, true));
      expect(archived.isArchived).toBe(true);

      const active = await asUser(t, () =>
        orders.list({
          page: 1,
          pageSize: 25,
          includeArchived: false,
          sortBy: 'issuedAt',
          sortOrder: 'desc',
        }),
      );
      expect(active.items.find((o) => o.id === draft.id)).toBeUndefined();

      const all = await asUser(t, () =>
        orders.list({
          page: 1,
          pageSize: 25,
          includeArchived: true,
          sortBy: 'issuedAt',
          sortOrder: 'desc',
        }),
      );
      expect(all.items.find((o) => o.id === draft.id)).toBeDefined();
    });

    it('يلغي الأرشفة فيعود الطلب إلى القائمة', async () => {
      const customerId = await createTestCustomer(t, 'زبون');
      const draft = await asUser(t, () => orders.create(orderPayload(customerId)));

      const archived = await asUser(t, () => orders.setArchived(draft.id, draft.version, true));
      const restored = await asUser(t, () =>
        orders.setArchived(archived.id, archived.version, false),
      );
      expect(restored.isArchived).toBe(false);
    });

    it('يرفض أرشفة طلب نشط (مؤكد)', async () => {
      const customerId = await createTestCustomer(t, 'زبون');
      const confirmed = await asUser(t, () =>
        orders.create(orderPayload(customerId, { status: 'CONFIRMED' })),
      );

      await expect(
        asUser(t, () => orders.setArchived(confirmed.id, confirmed.version, true)),
      ).rejects.toThrow();
    });
  });

  // ── الإرجاع إلى مسودة ────────────────────────────────────────────────────────

  describe('revertToDraft', () => {
    it('يرجع عرض سعر إلى مسودة', async () => {
      const customerId = await createTestCustomer(t, 'زبون');
      const quote = await asUser(t, () =>
        orders.create(orderPayload(customerId, { status: 'QUOTE' })),
      );

      const draft = await asUser(t, () => orders.revertToDraft(quote.id, quote.version));
      expect(draft.status).toBe('DRAFT');
    });

    it('يرفض إرجاع طلب مؤكد إلى مسودة', async () => {
      const customerId = await createTestCustomer(t, 'زبون');
      const confirmed = await asUser(t, () =>
        orders.create(orderPayload(customerId, { status: 'CONFIRMED' })),
      );

      await expect(
        asUser(t, () => orders.revertToDraft(confirmed.id, confirmed.version)),
      ).rejects.toThrow();
    });
  });

  describe('order statistics debt total', () => {
    it('uses debtor ledger balances and ignores customer credit and drafts', async () => {
      const debtorId = await createTestCustomer(t, 'debtor');
      const creditorId = await createTestCustomer(t, 'creditor');
      const ledger = new LedgerService();

      await inTenant(t.tenantId, async (tx) => {
        await ledger.append(tx, {
          tenantId: t.tenantId,
          storeId: t.storeId,
          customerId: debtorId,
          entryType: 'OPENING_BALANCE',
          direction: 'DEBIT',
          amount: '500',
          refType: 'CUSTOMER',
          refId: debtorId,
          createdBy: t.userId,
        });
        await ledger.append(tx, {
          tenantId: t.tenantId,
          storeId: t.storeId,
          customerId: creditorId,
          entryType: 'OPENING_BALANCE',
          direction: 'CREDIT',
          amount: '200',
          refType: 'CUSTOMER',
          refId: creditorId,
          createdBy: t.userId,
        });
      });

      await asUser(t, () => orders.create(orderPayload(creditorId)));

      const stats = await asUser(t, () =>
        orders.stats({} as Parameters<OrdersService['stats']>[0]),
      );

      expect(stats.outstandingAmount).toBe('500.00');
    });
  });
});
