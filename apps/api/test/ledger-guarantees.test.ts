import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { HAS_TEST_DB, SKIP_REASON, closeTestDb, testDb } from './db.js';
import {
  createTestCustomer,
  createTestTenant,
  inTenant,
  resetAll,
  type TestTenant,
} from './helpers.js';

/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  ضمانات دفتر الحركات — مفروضة في قاعدة البيانات.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  كل اختبار هنا يحاول **كسر** ضمان مالي بأسوأ طريقة ممكنة — SQL مباشر،
 *  متجاوزًا كل طبقات التطبيق — ويتوقع أن ترفضه قاعدة البيانات.
 *
 *  الفكرة: لا نختبر أن الكود يتصرّف بشكل صحيح. نختبر أن **التصرّف الخاطئ
 *  مستحيل**، حتى لو كتبه مهاجم أو مطوّر مخطئ.
 */

if (!HAS_TEST_DB) {
   
  console.warn(`\n⚠  ${SKIP_REASON}\n`);
}

describe.skipIf(!HAS_TEST_DB)('ضمانات دفتر الحركات', () => {
  let t: TestTenant;
  let customerId: string;

  beforeAll(async () => {
    await resetAll();
    t = await createTestTenant('ledger-guards');
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
    customerId = await createTestCustomer(t, 'زبون الاختبار');
  });

  /** يُدرج قيدًا صحيحًا — للبناء عليه. */
  async function seedEntry(over: Record<string, unknown> = {}) {
    return inTenant(t.tenantId, (tx) =>
      tx.ledgerEntry.create({
        data: {
          tenantId: t.tenantId,
          storeId: t.storeId,
          customerId,
          seq: 1,
          entryType: 'ORDER_DEBIT',
          openingBalance: '0',
          debit: '1000.0000',
          credit: '0',
          runningBalance: '1000.0000',
          refType: 'ORDER',
          ...over,
        },
        select: { id: true, seq: true },
      }),
    );
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  1. APPEND ONLY — لا تعديل، لا حذف. أبدًا.
  // ═════════════════════════════════════════════════════════════════════════

  describe('append-only', () => {
    it('⛔ UPDATE على قيد مرفوض — trigger', async () => {
      const entry = await seedEntry();

      await expect(
        inTenant(t.tenantId, (tx) =>
          tx.ledgerEntry.update({
            where: { id: entry.id },
            data: { debit: '999999.0000' },
          }),
        ),
      ).rejects.toThrow(/append-only|غير قابل للتغيير|permission denied/i);
    });

    it('⛔ DELETE على قيد مرفوض — trigger', async () => {
      const entry = await seedEntry();

      await expect(
        inTenant(t.tenantId, (tx) => tx.ledgerEntry.delete({ where: { id: entry.id } })),
      ).rejects.toThrow(/append-only|غير قابل للتغيير|permission denied/i);
    });

    it('⛔ حتى SQL خام لا يستطيع تعديل الرصيد', async () => {
      await seedEntry();

      // أخطر محاولة ممكنة: تجاوز Prisma تمامًا وكتابة SQL مباشرة.
      await expect(
        inTenant(t.tenantId, (tx) =>
          tx.$executeRawUnsafe(
            `UPDATE ledger_entries SET running_balance = 0 WHERE customer_id = '${customerId}'`,
          ),
        ),
      ).rejects.toThrow();
    });

    it('⛔ توزيعات الدفعات append-only أيضًا', async () => {
      // توزيع مرتبط بقيد محاسبي — تعديله يفسد التوافق بين الطلب والدفتر.
      const payment = await inTenant(t.tenantId, (tx) =>
        tx.payment.create({
          data: {
            tenantId: t.tenantId,
            storeId: t.storeId,
            customerId,
            number: 'PAY-00001',
            amount: '500.0000',
            method: 'CASH',
            paidAt: new Date(),
            idempotencyKey: 'test-key-alloc',
          },
          select: { id: true },
        }),
      );

      const order = await inTenant(t.tenantId, (tx) =>
        tx.order.create({
          data: {
            tenantId: t.tenantId,
            storeId: t.storeId,
            customerId,
            number: 'ORD-00001',
            status: 'CONFIRMED',
            total: '1000.0000',
          },
          select: { id: true },
        }),
      );

      const allocation = await inTenant(t.tenantId, (tx) =>
        tx.paymentAllocation.create({
          data: {
            tenantId: t.tenantId,
            paymentId: payment.id,
            orderId: order.id,
            amount: '500.0000',
          },
          select: { id: true },
        }),
      );

      await expect(
        inTenant(t.tenantId, (tx) =>
          tx.paymentAllocation.update({
            where: { id: allocation.id },
            data: { amount: '999.0000' },
          }),
        ),
      ).rejects.toThrow(/append-only|غير قابل للتغيير|permission denied/i);
    });
  });

  // ═════════════════════════════════════════════════════════════════════════
  //  2. المعادلة المحاسبية — لا يمكن كتابة رصيد لا ينتج عن الحركة
  // ═════════════════════════════════════════════════════════════════════════

  describe('المعادلة: running = opening + debit − credit', () => {
    it('⛔ رصيد ملفّق مرفوض عند الإدراج', async () => {
      // 0 + 1000 − 0 = 1000، لا 5000.
      await expect(
        seedEntry({ runningBalance: '5000.0000' }),
      ).rejects.toThrow(/ledger_balance_equation|constraint/i);
    });

    it('⛔ رصيد افتتاحي ملفّق مرفوض', async () => {
      await expect(
        seedEntry({ openingBalance: '9999.0000', runningBalance: '1000.0000' }),
      ).rejects.toThrow(/ledger_balance_equation|constraint/i);
    });

    it('✓ المعادلة الصحيحة تُقبَل', async () => {
      const entry = await seedEntry({
        openingBalance: '500.0000',
        debit: '300.0000',
        credit: '0',
        runningBalance: '800.0000', // 500 + 300 − 0
      });
      expect(entry.id).toBeTruthy();
    });

    it('✓ القيد الدائن ينقص الرصيد', async () => {
      const entry = await seedEntry({
        entryType: 'PAYMENT_CREDIT',
        openingBalance: '1000.0000',
        debit: '0',
        credit: '400.0000',
        runningBalance: '600.0000', // 1000 + 0 − 400
        refType: 'PAYMENT',
      });
      expect(entry.id).toBeTruthy();
    });
  });

  // ═════════════════════════════════════════════════════════════════════════
  //  3. مدين XOR دائن
  // ═════════════════════════════════════════════════════════════════════════

  describe('مدين أو دائن — لا كلاهما', () => {
    it('⛔ قيد مدين ودائن معًا مرفوض', async () => {
      await expect(
        seedEntry({
          debit: '100.0000',
          credit: '50.0000',
          runningBalance: '50.0000', // معادلة صحيحة، لكن الاتجاه مختلط
        }),
      ).rejects.toThrow(/ledger_debit_xor_credit|constraint/i);
    });

    it('⛔ قيد بلا مبلغ مرفوض (إلا الرصيد الافتتاحي الصفري)', async () => {
      await expect(
        seedEntry({ debit: '0', credit: '0', runningBalance: '0' }),
      ).rejects.toThrow(/ledger_debit_xor_credit|constraint/i);
    });

    it('⛔ مبلغ سالب مرفوض — الاتجاه في العمود لا في الإشارة', async () => {
      await expect(
        seedEntry({ debit: '-100.0000', runningBalance: '-100.0000' }),
      ).rejects.toThrow(/non_negative|xor|constraint/i);
    });
  });

  // ═════════════════════════════════════════════════════════════════════════
  //  4. التسلسل — لا فروع، لا تكرار
  // ═════════════════════════════════════════════════════════════════════════

  describe('تسلسل القيود', () => {
    it('⛔ تسلسل مكرر لنفس الزبون مرفوض', async () => {
      await seedEntry({ seq: 1 });

      // نفس seq = فرع في السلسلة. UNIQUE(tenant, customer, seq) يرفضه.
      await expect(
        seedEntry({
          seq: 1,
          openingBalance: '1000.0000',
          debit: '500.0000',
          runningBalance: '1500.0000',
        }),
      ).rejects.toThrow();
    });

    it('⛔ تسلسل صفر أو سالب مرفوض', async () => {
      await expect(seedEntry({ seq: 0 })).rejects.toThrow(/seq_positive|constraint/i);
    });

    it('✓ زبونان مختلفان يبدآن من 1 — سلسلتان مستقلتان', async () => {
      const other = await createTestCustomer(t, 'زبون آخر');

      await seedEntry({ seq: 1 });
      const second = await inTenant(t.tenantId, (tx) =>
        tx.ledgerEntry.create({
          data: {
            tenantId: t.tenantId,
            storeId: t.storeId,
            customerId: other,
            seq: 1,
            entryType: 'ORDER_DEBIT',
            openingBalance: '0',
            debit: '200.0000',
            credit: '0',
            runningBalance: '200.0000',
            refType: 'ORDER',
          },
          select: { seq: true },
        }),
      );

      expect(second.seq).toBe(1);
    });
  });

  // ═════════════════════════════════════════════════════════════════════════
  //  5. قيد العكس يجب أن يشير إلى قيد
  // ═════════════════════════════════════════════════════════════════════════

  describe('قيود العكس', () => {
    it('⛔ REVERSAL بلا هدف مرفوض', async () => {
      await expect(
        seedEntry({ entryType: 'REVERSAL', reversesEntryId: null }),
      ).rejects.toThrow(/reversal_has_target|constraint/i);
    });

    it('⛔ قيد عادي يشير إلى قيد آخر مرفوض', async () => {
      const original = await seedEntry({ seq: 1 });

      await expect(
        seedEntry({
          seq: 2,
          entryType: 'ORDER_DEBIT', // ليس REVERSAL
          reversesEntryId: original.id,
          openingBalance: '1000.0000',
          runningBalance: '2000.0000',
        }),
      ).rejects.toThrow(/reversal_has_target|constraint/i);
    });

    it('✓ REVERSAL صحيح يُقبَل ويُعيد الرصيد', async () => {
      const original = await seedEntry({ seq: 1 }); // +1000

      const reversal = await inTenant(t.tenantId, (tx) =>
        tx.ledgerEntry.create({
          data: {
            tenantId: t.tenantId,
            storeId: t.storeId,
            customerId,
            seq: 2,
            entryType: 'REVERSAL',
            reversesEntryId: original.id,
            openingBalance: '1000.0000',
            debit: '0',
            credit: '1000.0000', // اتجاه معاكس
            runningBalance: '0', // الرصيد عاد كما كان
            refType: 'ORDER',
            notes: 'عكس',
          },
          select: { runningBalance: true },
        }),
      );

      expect(reversal.runningBalance.toString()).toBe('0');
    });
  });

  // ═════════════════════════════════════════════════════════════════════════
  //  6. لا رصيد مخزّن — الضمان الأهم
  // ═════════════════════════════════════════════════════════════════════════

  describe('⭐ الرصيد لا يُخزَّن', () => {
    it('جدول customers لا يحوي أي عمود رصيد', async () => {
      const db = testDb();

      const columns = await db.$queryRawUnsafe<{ column_name: string }[]>(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'customers'
      `);

      const names = columns.map((c) => c.column_name);

      // البحث عن أي شيء يشبه الرصيد.
      const balanceLike = names.filter(
        (n) => n.includes('balance') || n === 'debt' || n === 'total_due',
      );

      expect(
        balanceLike,
        `وُجد عمود رصيد في جدول الزبائن: ${balanceLike.join(', ')} — ` +
          'الرصيد يجب أن يبقى مشتقًا من دفتر الحركات حصرًا.',
      ).toEqual([]);

      // نتأكد أن الجدول موجود فعلًا (وإلا لمرّ الاختبار كذبًا).
      expect(names).toContain('credit_limit');
    });

    it('دالة app_customer_balance تحسبه من الدفتر', async () => {
      await seedEntry({ seq: 1, debit: '1000.0000', runningBalance: '1000.0000' });

      await inTenant(t.tenantId, (tx) =>
        tx.ledgerEntry.create({
          data: {
            tenantId: t.tenantId,
            storeId: t.storeId,
            customerId,
            seq: 2,
            entryType: 'PAYMENT_CREDIT',
            openingBalance: '1000.0000',
            debit: '0',
            credit: '300.0000',
            runningBalance: '700.0000',
            refType: 'PAYMENT',
          },
        }),
      );

      const result = await inTenant(t.tenantId, (tx) =>
        tx.$queryRaw<{ balance: string }[]>`
          SELECT app_customer_balance(${customerId}::uuid)::text AS balance
        `,
      );

      // 1000 − 300 = 700
      expect(result[0]?.balance).toBe('700.0000');
    });

    it('الرصيد المحسوب = آخر runningBalance (تطابق حتمي)', async () => {
      await seedEntry({ seq: 1, debit: '1500.5000', runningBalance: '1500.5000' });
      await inTenant(t.tenantId, (tx) =>
        tx.ledgerEntry.create({
          data: {
            tenantId: t.tenantId,
            storeId: t.storeId,
            customerId,
            seq: 2,
            entryType: 'PAYMENT_CREDIT',
            openingBalance: '1500.5000',
            debit: '0',
            credit: '500.2500',
            runningBalance: '1000.2500',
            refType: 'PAYMENT',
          },
        }),
      );

      const [aggregate, last] = await inTenant(t.tenantId, async (tx) => {
        const agg = await tx.$queryRaw<{ b: string }[]>`
          SELECT app_customer_balance(${customerId}::uuid)::text AS b
        `;
        const l = await tx.ledgerEntry.findFirst({
          where: { customerId },
          orderBy: { seq: 'desc' },
          select: { runningBalance: true },
        });
        return [agg[0]?.b, l?.runningBalance.toString()];
      });

      // SUM(debit) − SUM(credit) يجب أن يساوي آخر runningBalance.
      // قيد المعادلة في القاعدة هو ما يضمن هذا التطابق.
      expect(aggregate).toBe('1000.2500');
      expect(last).toBe('1000.25');
    });
  });

  // ═════════════════════════════════════════════════════════════════════════
  //  7. قفل الطلب المؤكد
  // ═════════════════════════════════════════════════════════════════════════

  describe('قفل الطلب المؤكد', () => {
    async function confirmedOrder() {
      return inTenant(t.tenantId, (tx) =>
        tx.order.create({
          data: {
            tenantId: t.tenantId,
            storeId: t.storeId,
            customerId,
            number: `ORD-${Math.random().toString(36).slice(2, 7)}`,
            status: 'CONFIRMED',
            subtotal: '1000.0000',
            total: '1000.0000',
            lockedAt: new Date(),
            confirmedAt: new Date(),
          },
          select: { id: true },
        }),
      );
    }

    it('⛔ تعديل إجمالي طلب مؤكد مرفوض', async () => {
      const order = await confirmedOrder();

      await expect(
        inTenant(t.tenantId, (tx) =>
          tx.order.update({ where: { id: order.id }, data: { total: '9999.0000' } }),
        ),
      ).rejects.toThrow(/مؤكد ومقفل|locked/i);
    });

    it('⛔ تغيير زبون طلب مؤكد مرفوض', async () => {
      const order = await confirmedOrder();
      const other = await createTestCustomer(t, 'زبون بديل');

      await expect(
        inTenant(t.tenantId, (tx) =>
          tx.order.update({ where: { id: order.id }, data: { customerId: other } }),
        ),
      ).rejects.toThrow(/مؤكد ومقفل|locked/i);
    });

    it('⛔ إضافة بند لطلب مؤكد مرفوضة', async () => {
      const order = await confirmedOrder();

      await expect(
        inTenant(t.tenantId, (tx) =>
          tx.orderItem.create({
            data: {
              tenantId: t.tenantId,
              orderId: order.id,
              name: 'بند مهرَّب',
              quantity: '1',
              unitPrice: '500.0000',
              lineTotal: '500.0000',
            },
          }),
        ),
      ).rejects.toThrow(/مؤكد ومقفل|locked/i);
    });

    it('✓ تحديث paidAmount و status مسموح — نتيجة دفعة', async () => {
      const order = await confirmedOrder();

      const updated = await inTenant(t.tenantId, (tx) =>
        tx.order.update({
          where: { id: order.id },
          data: { paidAmount: '400.0000', status: 'PARTIALLY_PAID' },
          select: { paidAmount: true, status: true },
        }),
      );

      expect(updated.status).toBe('PARTIALLY_PAID');
      expect(updated.paidAmount.toString()).toBe('400');
    });

    it('✓ المسودة قابلة للتعديل بالكامل', async () => {
      const draft = await inTenant(t.tenantId, (tx) =>
        tx.order.create({
          data: {
            tenantId: t.tenantId,
            storeId: t.storeId,
            customerId,
            number: 'ORD-DRAFT',
            status: 'DRAFT',
            total: '100.0000',
          },
          select: { id: true },
        }),
      );

      const updated = await inTenant(t.tenantId, (tx) =>
        tx.order.update({
          where: { id: draft.id },
          data: { total: '250.0000' },
          select: { total: true },
        }),
      );

      expect(updated.total.toString()).toBe('250');
    });

    it('⛔ لا يمكن دفع أكثر من إجمالي الطلب', async () => {
      const order = await confirmedOrder();

      await expect(
        inTenant(t.tenantId, (tx) =>
          tx.order.update({
            where: { id: order.id },
            data: { paidAmount: '1500.0000' }, // الإجمالي 1000
          }),
        ),
      ).rejects.toThrow(/paid_not_over_total|constraint/i);
    });
  });

  // ═════════════════════════════════════════════════════════════════════════
  //  8. عزل المستأجرين على الجداول المالية
  // ═════════════════════════════════════════════════════════════════════════

  describe('عزل المستأجرين', () => {
    it('مستأجر آخر لا يرى قيود هذا المستأجر — ولا بلا فلترة', async () => {
      await seedEntry();

      const other = await createTestTenant('ledger-other');

      // استعلام **بلا أي where** — أسوأ خطأ برمجي ممكن.
      const entries = await inTenant(other.tenantId, (tx) => tx.ledgerEntry.findMany());
      expect(entries).toHaveLength(0);

      const customers = await inTenant(other.tenantId, (tx) => tx.customer.findMany());
      expect(customers).toHaveLength(0);
    });

    it('دالة الرصيد تحترم RLS — زبون مستأجر آخر يعطي صفرًا', async () => {
      await seedEntry({ debit: '5000.0000', runningBalance: '5000.0000' });

      const other = await createTestTenant('ledger-other-2');

      const result = await inTenant(other.tenantId, (tx) =>
        tx.$queryRaw<{ balance: string }[]>`
          SELECT app_customer_balance(${customerId}::uuid)::text AS balance
        `,
      );

      // لا خطأ، ولا تسريب — صفر.
      expect(result[0]?.balance).toBe('0.0000');
    });

    it('⛔ لا يمكن كتابة قيد بـtenantId مستأجر آخر', async () => {
      const other = await createTestTenant('ledger-other-3');

      await expect(
        inTenant(t.tenantId, (tx) =>
          tx.ledgerEntry.create({
            data: {
              tenantId: other.tenantId, // ← تزوير
              storeId: other.storeId,
              customerId,
              seq: 1,
              entryType: 'ORDER_DEBIT',
              openingBalance: '0',
              debit: '1000.0000',
              credit: '0',
              runningBalance: '1000.0000',
              refType: 'ORDER',
            },
          }),
        ),
      ).rejects.toThrow();
    });
  });
});
