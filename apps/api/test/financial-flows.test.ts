import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { type PrismaClient } from '@prisma/client';
import { HAS_TEST_DB, SKIP_REASON, closeTestDb, testDb } from './db.js';
import {
  createTestCustomer,
  createTestTenant,
  inTenant,
  resetAll,
  type TestTenant,
} from './helpers.js';
import { LedgerService } from '../src/modules/ledger/ledger.service.js';
import { NumberingService } from '../src/core/numbering/numbering.service.js';
import { OrderCalculator } from '../src/modules/orders/order-calculator.js';

/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  تدفقات مالية كاملة — على قاعدة بيانات حقيقية.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  نختبر خدمات الدومين (LedgerService, NumberingService) مباشرة ضد Postgres،
 *  لا عبر HTTP: نريد اختبار **المنطق المالي والتزامن**، لا التوجيه والمصادقة
 *  (وهما مُختبَران في المرحلة 1).
 */

if (!HAS_TEST_DB) {
   
  console.warn(`\n⚠  ${SKIP_REASON}\n`);
}

type Tx = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0];

describe.skipIf(!HAS_TEST_DB)('تدفقات مالية', () => {
  let t: TestTenant;
  let ledger: LedgerService;
  let numbering: NumberingService;
  let calculator: OrderCalculator;

  beforeAll(async () => {
    await resetAll();
    t = await createTestTenant('flows');
    ledger = new LedgerService();
    numbering = new NumberingService();
    calculator = new OrderCalculator();
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

  // ═════════════════════════════════════════════════════════════════════════
  //  1. LedgerService.append — سلسلة الرصيد
  // ═════════════════════════════════════════════════════════════════════════

  describe('LedgerService.append', () => {
    it('أول قيد يبدأ من رصيد صفر و seq = 1', async () => {
      const customerId = await createTestCustomer(t, 'زبون');

      const entry = await inTenant(t.tenantId, (tx) =>
        ledger.append(tx as Tx, {
          tenantId: t.tenantId,
          storeId: t.storeId,
          customerId,
          entryType: 'ORDER_DEBIT',
          direction: 'DEBIT',
          amount: '1000.00',
          refType: 'ORDER',
        }),
      );

      expect(entry.seq).toBe(1);
      expect(entry.openingBalance.toFixed(2)).toBe('0.00');
      expect(entry.runningBalance.toFixed(2)).toBe('1000.00');
    });

    it('كل قيد يبني على سابقه', async () => {
      const customerId = await createTestCustomer(t, 'زبون');

      const first = await inTenant(t.tenantId, (tx) =>
        ledger.append(tx as Tx, {
          tenantId: t.tenantId, storeId: t.storeId, customerId,
          entryType: 'ORDER_DEBIT', direction: 'DEBIT', amount: '1000.00', refType: 'ORDER',
        }),
      );

      const second = await inTenant(t.tenantId, (tx) =>
        ledger.append(tx as Tx, {
          tenantId: t.tenantId, storeId: t.storeId, customerId,
          entryType: 'PAYMENT_CREDIT', direction: 'CREDIT', amount: '400.00', refType: 'PAYMENT',
        }),
      );

      expect(second.seq).toBe(2);
      // الرصيد الافتتاحي للقيد الثاني = الرصيد النهائي للأول.
      expect(second.openingBalance.toFixed(2)).toBe(first.runningBalance.toFixed(2));
      expect(second.runningBalance.toFixed(2)).toBe('600.00');
    });

    it('رصيد دائن (سالب) — دفعة تتجاوز الدَّين', async () => {
      const customerId = await createTestCustomer(t, 'زبون');

      await inTenant(t.tenantId, (tx) =>
        ledger.append(tx as Tx, {
          tenantId: t.tenantId, storeId: t.storeId, customerId,
          entryType: 'ORDER_DEBIT', direction: 'DEBIT', amount: '100.00', refType: 'ORDER',
        }),
      );

      const overpay = await inTenant(t.tenantId, (tx) =>
        ledger.append(tx as Tx, {
          tenantId: t.tenantId, storeId: t.storeId, customerId,
          entryType: 'PAYMENT_CREDIT', direction: 'CREDIT', amount: '250.00', refType: 'PAYMENT',
        }),
      );

      // 100 − 250 = −150 ⇒ نحن مدينون له بـ150 (دفعة مقدّمة).
      expect(overpay.runningBalance.toFixed(2)).toBe('-150.00');
    });

    it('يرفض المبلغ السالب — الاتجاه في direction لا في الإشارة', async () => {
      const customerId = await createTestCustomer(t, 'زبون');

      await expect(
        inTenant(t.tenantId, (tx) =>
          ledger.append(tx as Tx, {
            tenantId: t.tenantId, storeId: t.storeId, customerId,
            entryType: 'ORDER_DEBIT', direction: 'DEBIT', amount: '-100.00', refType: 'ORDER',
          }),
        ),
      ).rejects.toThrow(/سالب/);
    });
  });

  // ═════════════════════════════════════════════════════════════════════════
  //  2. ⭐ التزامن — أخطر سيناريو في النظام
  // ═════════════════════════════════════════════════════════════════════════

  describe('⭐ التزامن (Race Conditions)', () => {
    /**
     * ═══════════════════════════════════════════════════════════════════════
     *  عشر دفعات متزامنة على نفس الزبون.
     * ═══════════════════════════════════════════════════════════════════════
     *
     *  بلا القفل الاستشاري، تقرأ كلها نفس `runningBalance` ونفس `seq`،
     *  فتُدرج قيودًا متضاربة — ويصير الرصيد النهائي خاطئًا.
     *
     *  مع القفل: تتسلسل. كل واحدة ترى نتيجة سابقتها.
     *
     *  الفحص النهائي: الرصيد = 1000 − (10 × 50) = 500. بالضبط.
     */
    it('عشر دفعات متزامنة تُنتج رصيدًا صحيحًا — لا فقد ولا تكرار', async () => {
      const customerId = await createTestCustomer(t, 'زبون التزامن');

      // دَين أولي 1000
      await inTenant(t.tenantId, (tx) =>
        ledger.append(tx as Tx, {
          tenantId: t.tenantId, storeId: t.storeId, customerId,
          entryType: 'ORDER_DEBIT', direction: 'DEBIT', amount: '1000.00', refType: 'ORDER',
        }),
      );

      // 10 دفعات × 50 — **متزامنة**
      await Promise.all(
        Array.from({ length: 10 }, () =>
          inTenant(t.tenantId, (tx) =>
            ledger.append(tx as Tx, {
              tenantId: t.tenantId, storeId: t.storeId, customerId,
              entryType: 'PAYMENT_CREDIT', direction: 'CREDIT', amount: '50.00', refType: 'PAYMENT',
            }),
          ),
        ),
      );

      const check = await inTenant(t.tenantId, (tx) =>
        ledger.verifyIntegrity(tx as Tx, t.tenantId, customerId),
      );

      expect(check.errors).toEqual([]);
      expect(check.valid).toBe(true);
      expect(check.entriesChecked).toBe(11); // 1 مدين + 10 دائنة

      // 1000 − 500 = 500. بالضبط.
      expect(check.computedBalance).toBe('500.0000');
      expect(check.aggregateBalance).toBe('500.0000');
    });

    it('التسلسل متصل بلا فجوات تحت التزامن', async () => {
      const customerId = await createTestCustomer(t, 'زبون');

      await Promise.all(
        Array.from({ length: 15 }, () =>
          inTenant(t.tenantId, (tx) =>
            ledger.append(tx as Tx, {
              tenantId: t.tenantId, storeId: t.storeId, customerId,
              entryType: 'ORDER_DEBIT', direction: 'DEBIT', amount: '10.00', refType: 'ORDER',
            }),
          ),
        ),
      );

      const entries = await inTenant(t.tenantId, (tx) =>
        tx.ledgerEntry.findMany({
          where: { customerId },
          orderBy: { seq: 'asc' },
          select: { seq: true },
        }),
      );

      // 1, 2, 3, ... 15 — بلا فجوة ولا تكرار.
      expect(entries.map((e) => e.seq)).toEqual(
        Array.from({ length: 15 }, (_, i) => i + 1),
      );
    });

    it('زبائن مختلفون يعملون بالتوازي — القفل لا يُسلسِل الجميع', async () => {
      const a = await createTestCustomer(t, 'زبون أ');
      const b = await createTestCustomer(t, 'زبون ب');

      await Promise.all([
        ...Array.from({ length: 5 }, () =>
          inTenant(t.tenantId, (tx) =>
            ledger.append(tx as Tx, {
              tenantId: t.tenantId, storeId: t.storeId, customerId: a,
              entryType: 'ORDER_DEBIT', direction: 'DEBIT', amount: '100.00', refType: 'ORDER',
            }),
          ),
        ),
        ...Array.from({ length: 5 }, () =>
          inTenant(t.tenantId, (tx) =>
            ledger.append(tx as Tx, {
              tenantId: t.tenantId, storeId: t.storeId, customerId: b,
              entryType: 'ORDER_DEBIT', direction: 'DEBIT', amount: '200.00', refType: 'ORDER',
            }),
          ),
        ),
      ]);

      const [checkA, checkB] = await Promise.all([
        inTenant(t.tenantId, (tx) => ledger.verifyIntegrity(tx as Tx, t.tenantId, a)),
        inTenant(t.tenantId, (tx) => ledger.verifyIntegrity(tx as Tx, t.tenantId, b)),
      ]);

      expect(checkA.valid).toBe(true);
      expect(checkB.valid).toBe(true);
      expect(checkA.computedBalance).toBe('500.0000');
      expect(checkB.computedBalance).toBe('1000.0000');
    });
  });

  // ═════════════════════════════════════════════════════════════════════════
  //  3. ⭐ منع الدفعة المزدوجة
  // ═════════════════════════════════════════════════════════════════════════

  describe('⭐ منع الدفعة المزدوجة', () => {
    it('دفعتان بنفس مفتاح منع التكرار ⇒ واحدة تنجح والأخرى ترفض', async () => {
      const customerId = await createTestCustomer(t, 'زبون');
      const key = `idem-${Date.now()}`;

      const attempt = () =>
        inTenant(t.tenantId, async (tx) => {
          const number = await numbering.next(tx as Tx, t.tenantId, t.storeId, 'payment');
          return tx.payment.create({
            data: {
              tenantId: t.tenantId,
              storeId: t.storeId,
              customerId,
              number,
              amount: '500.0000',
              method: 'CASH',
              paidAt: new Date(),
              idempotencyKey: key, // ← نفس المفتاح
            },
            select: { id: true },
          });
        });

      const results = await Promise.allSettled([attempt(), attempt()]);

      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');

      // **دفعة واحدة فقط.** القاعدة تضمنها بـUNIQUE، لا الكود.
      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);

      const count = await inTenant(t.tenantId, (tx) => tx.payment.count({ where: { customerId } }));
      expect(count).toBe(1);
    });

    it('القيد المحاسبي نفسه يرفض المفتاح المكرر — خط دفاع ثانٍ', async () => {
      const customerId = await createTestCustomer(t, 'زبون');
      const key = `idem-ledger-${Date.now()}`;

      await inTenant(t.tenantId, (tx) =>
        ledger.append(tx as Tx, {
          tenantId: t.tenantId, storeId: t.storeId, customerId,
          entryType: 'PAYMENT_CREDIT', direction: 'CREDIT', amount: '100.00',
          refType: 'PAYMENT', idempotencyKey: key,
        }),
      );

      // حتى لو تسلّل طلب مكرر عبر كل الطبقات، القيد يرفضه.
      await expect(
        inTenant(t.tenantId, (tx) =>
          ledger.append(tx as Tx, {
            tenantId: t.tenantId, storeId: t.storeId, customerId,
            entryType: 'PAYMENT_CREDIT', direction: 'CREDIT', amount: '100.00',
            refType: 'PAYMENT', idempotencyKey: key,
          }),
        ),
      ).rejects.toThrow();

      const entries = await inTenant(t.tenantId, (tx) =>
        tx.ledgerEntry.count({ where: { customerId } }),
      );
      expect(entries).toBe(1);
    });
  });

  // ═════════════════════════════════════════════════════════════════════════
  //  4. الترقيم تحت التزامن
  // ═════════════════════════════════════════════════════════════════════════

  describe('الترقيم', () => {
    it('20 طلبًا متزامنًا ⇒ 20 رقمًا فريدًا بلا فجوات', async () => {
      const numbers = await Promise.all(
        Array.from({ length: 20 }, () =>
          inTenant(t.tenantId, (tx) =>
            numbering.next(tx as Tx, t.tenantId, t.storeId, 'order'),
          ),
        ),
      );

      const unique = new Set(numbers);
      expect(unique.size).toBe(20); // لا تكرار

      const values = numbers
        .map((n) => Number.parseInt(n.split('-')[1] ?? '0', 10))
        .sort((a, b) => a - b);

      expect(values).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
      expect(numbers[0]).toMatch(/^ORD-\d{5}$/);
    });

    it('عدّادات مستقلة لكل نوع', async () => {
      const [order, payment, customer] = await Promise.all([
        inTenant(t.tenantId, (tx) => numbering.next(tx as Tx, t.tenantId, t.storeId, 'order')),
        inTenant(t.tenantId, (tx) => numbering.next(tx as Tx, t.tenantId, t.storeId, 'payment')),
        inTenant(t.tenantId, (tx) => numbering.next(tx as Tx, t.tenantId, t.storeId, 'customer')),
      ]);

      expect(order).toBe('ORD-00001');
      expect(payment).toBe('PAY-00001');
      expect(customer).toBe('CUST-0001');
    });

    it('عدّادات مستقلة لكل محل — لا تسريب حجم نشاط المنافس', async () => {
      const other = await createTestTenant('numbering-other');

      await inTenant(t.tenantId, (tx) => numbering.next(tx as Tx, t.tenantId, t.storeId, 'order'));
      await inTenant(t.tenantId, (tx) => numbering.next(tx as Tx, t.tenantId, t.storeId, 'order'));

      // المحل الآخر يبدأ من 1، لا من 3.
      const otherFirst = await inTenant(other.tenantId, (tx) =>
        numbering.next(tx as Tx, other.tenantId, other.storeId, 'order'),
      );

      expect(otherFirst).toBe('ORD-00001');
    });
  });

  // ═════════════════════════════════════════════════════════════════════════
  //  5. العكس يعيد الرصيد ويحفظ التاريخ
  // ═════════════════════════════════════════════════════════════════════════

  describe('عكس القيود', () => {
    it('العكس يعيد الرصيد ويُبقي القيد الأصلي', async () => {
      const customerId = await createTestCustomer(t, 'زبون');

      const original = await inTenant(t.tenantId, (tx) =>
        ledger.append(tx as Tx, {
          tenantId: t.tenantId, storeId: t.storeId, customerId,
          entryType: 'ORDER_DEBIT', direction: 'DEBIT', amount: '750.00', refType: 'ORDER',
        }),
      );
      expect(original.runningBalance.toFixed(2)).toBe('750.00');

      const reversal = await inTenant(t.tenantId, (tx) =>
        ledger.reverse(tx as Tx, {
          tenantId: t.tenantId,
          storeId: t.storeId,
          entryId: original.id,
          reason: 'إلغاء الطلب',
          createdBy: t.userId,
        }),
      );

      // الرصيد عاد إلى صفر.
      expect(reversal.runningBalance.toFixed(2)).toBe('0.00');

      // القيد الأصلي **ما زال موجودًا** — التاريخ محفوظ.
      const all = await inTenant(t.tenantId, (tx) =>
        tx.ledgerEntry.findMany({ where: { customerId }, orderBy: { seq: 'asc' } }),
      );

      expect(all).toHaveLength(2);
      expect(all[0]?.entryType).toBe('ORDER_DEBIT');
      expect(all[1]?.entryType).toBe('REVERSAL');
      expect(all[1]?.reversesEntryId).toBe(original.id);
    });

    it('⛔ العكس المزدوج مرفوض', async () => {
      const customerId = await createTestCustomer(t, 'زبون');

      const original = await inTenant(t.tenantId, (tx) =>
        ledger.append(tx as Tx, {
          tenantId: t.tenantId, storeId: t.storeId, customerId,
          entryType: 'ADJUSTMENT_DEBIT', direction: 'DEBIT', amount: '100.00', refType: 'ADJUSTMENT',
        }),
      );

      await inTenant(t.tenantId, (tx) =>
        ledger.reverse(tx as Tx, {
          tenantId: t.tenantId, storeId: t.storeId, entryId: original.id,
          reason: 'أول عكس', createdBy: t.userId,
        }),
      );

      // العكس الثاني يُلغي أثر الأول — فساد صامت. مرفوض.
      await expect(
        inTenant(t.tenantId, (tx) =>
          ledger.reverse(tx as Tx, {
            tenantId: t.tenantId, storeId: t.storeId, entryId: original.id,
            reason: 'عكس ثانٍ', createdBy: t.userId,
          }),
        ),
      ).rejects.toThrow(/معكوس مسبقًا/);
    });

    it('⛔ لا يُعكس قيد عكس', async () => {
      const customerId = await createTestCustomer(t, 'زبون');

      const original = await inTenant(t.tenantId, (tx) =>
        ledger.append(tx as Tx, {
          tenantId: t.tenantId, storeId: t.storeId, customerId,
          entryType: 'ADJUSTMENT_DEBIT', direction: 'DEBIT', amount: '100.00', refType: 'ADJUSTMENT',
        }),
      );

      const reversal = await inTenant(t.tenantId, (tx) =>
        ledger.reverse(tx as Tx, {
          tenantId: t.tenantId, storeId: t.storeId, entryId: original.id,
          reason: 'عكس', createdBy: t.userId,
        }),
      );

      await expect(
        inTenant(t.tenantId, (tx) =>
          ledger.reverse(tx as Tx, {
            tenantId: t.tenantId, storeId: t.storeId, entryId: reversal.id,
            reason: 'عكس العكس', createdBy: t.userId,
          }),
        ),
      ).rejects.toThrow(/لا يُعكس قيد عكس/);
    });

    it('العكس يحافظ على سلامة السلسلة', async () => {
      const customerId = await createTestCustomer(t, 'زبون');

      const e1 = await inTenant(t.tenantId, (tx) =>
        ledger.append(tx as Tx, {
          tenantId: t.tenantId, storeId: t.storeId, customerId,
          entryType: 'ORDER_DEBIT', direction: 'DEBIT', amount: '1000.00', refType: 'ORDER',
        }),
      );
      await inTenant(t.tenantId, (tx) =>
        ledger.append(tx as Tx, {
          tenantId: t.tenantId, storeId: t.storeId, customerId,
          entryType: 'PAYMENT_CREDIT', direction: 'CREDIT', amount: '300.00', refType: 'PAYMENT',
        }),
      );
      await inTenant(t.tenantId, (tx) =>
        ledger.reverse(tx as Tx, {
          tenantId: t.tenantId, storeId: t.storeId, entryId: e1.id,
          reason: 'عكس الطلب', createdBy: t.userId,
        }),
      );

      const check = await inTenant(t.tenantId, (tx) =>
        ledger.verifyIntegrity(tx as Tx, t.tenantId, customerId),
      );

      expect(check.valid).toBe(true);
      // 1000 − 300 − 1000 = −300 (رصيد دائن للزبون)
      expect(check.computedBalance).toBe('-300.0000');
    });
  });

  // ═════════════════════════════════════════════════════════════════════════
  //  6. verifyIntegrity يكشف الفساد فعلًا
  // ═════════════════════════════════════════════════════════════════════════

  describe('verifyIntegrity', () => {
    it('يعطي valid على دفتر سليم', async () => {
      const customerId = await createTestCustomer(t, 'زبون');

      for (const amount of ['100.00', '250.50', '75.25']) {
        await inTenant(t.tenantId, (tx) =>
          ledger.append(tx as Tx, {
            tenantId: t.tenantId, storeId: t.storeId, customerId,
            entryType: 'ORDER_DEBIT', direction: 'DEBIT', amount, refType: 'ORDER',
          }),
        );
      }

      const check = await inTenant(t.tenantId, (tx) =>
        ledger.verifyIntegrity(tx as Tx, t.tenantId, customerId),
      );

      expect(check.valid).toBe(true);
      expect(check.entriesChecked).toBe(3);
      expect(check.computedBalance).toBe('425.7500');
    });

    it('دفتر فارغ صالح برصيد صفر', async () => {
      const customerId = await createTestCustomer(t, 'زبون بلا حركات');

      const check = await inTenant(t.tenantId, (tx) =>
        ledger.verifyIntegrity(tx as Tx, t.tenantId, customerId),
      );

      expect(check.valid).toBe(true);
      expect(check.entriesChecked).toBe(0);
      expect(check.computedBalance).toBe('0.0000');
    });

    it('⚠️ يكشف الفجوة في التسلسل', async () => {
      const customerId = await createTestCustomer(t, 'زبون');

      // نُدرج seq=1 و seq=3 مباشرة (قفزنا 2) — محاكاة فساد.
      await inTenant(t.tenantId, async (tx) => {
        await tx.ledgerEntry.create({
          data: {
            tenantId: t.tenantId, storeId: t.storeId, customerId, seq: 1,
            entryType: 'ORDER_DEBIT', openingBalance: '0', debit: '100.0000',
            credit: '0', runningBalance: '100.0000', refType: 'ORDER',
          },
        });
        await tx.ledgerEntry.create({
          data: {
            tenantId: t.tenantId, storeId: t.storeId, customerId, seq: 3, // ← فجوة
            entryType: 'ORDER_DEBIT', openingBalance: '100.0000', debit: '50.0000',
            credit: '0', runningBalance: '150.0000', refType: 'ORDER',
          },
        });
      });

      const check = await inTenant(t.tenantId, (tx) =>
        ledger.verifyIntegrity(tx as Tx, t.tenantId, customerId),
      );

      expect(check.valid).toBe(false);
      expect(check.errors.some((e) => e.includes('فجوة'))).toBe(true);
    });

    it('⚠️ يكشف انقطاع سلسلة الرصيد', async () => {
      const customerId = await createTestCustomer(t, 'زبون');

      await inTenant(t.tenantId, async (tx) => {
        await tx.ledgerEntry.create({
          data: {
            tenantId: t.tenantId, storeId: t.storeId, customerId, seq: 1,
            entryType: 'ORDER_DEBIT', openingBalance: '0', debit: '100.0000',
            credit: '0', runningBalance: '100.0000', refType: 'ORDER',
          },
        });
        // القيد الثاني يبدأ من 999 لا من 100 — سلسلة مكسورة.
        // (المعادلة صحيحة داخليًا، فيمر قيد CHECK — لكن الربط مكسور.)
        await tx.ledgerEntry.create({
          data: {
            tenantId: t.tenantId, storeId: t.storeId, customerId, seq: 2,
            entryType: 'ORDER_DEBIT', openingBalance: '999.0000', debit: '1.0000',
            credit: '0', runningBalance: '1000.0000', refType: 'ORDER',
          },
        });
      });

      const check = await inTenant(t.tenantId, (tx) =>
        ledger.verifyIntegrity(tx as Tx, t.tenantId, customerId),
      );

      expect(check.valid).toBe(false);
      expect(check.errors.some((e) => e.includes('سلسلة مكسورة'))).toBe(true);
    });
  });

  // ═════════════════════════════════════════════════════════════════════════
  //  7. تدفق كامل: طلب → دفعة جزئية → دفعة كاملة
  // ═════════════════════════════════════════════════════════════════════════

  describe('تدفق كامل', () => {
    it('طلب 1000 → دفعة 400 → دفعة 600 = رصيد صفر', async () => {
      const customerId = await createTestCustomer(t, 'زبون');

      const calculated = calculator.calculate([
        {
          sourceType: 'MANUAL',
          name: 'بضاعة',
          description: '',
          quantity: '10',
          unitPrice: '100.00',
          discount: '0',
          taxRate: '0',
        },
      ]);
      expect(calculated.total.toFixed(2)).toBe('1000.00');

      // الطلب المؤكد → قيد مدين
      await inTenant(t.tenantId, (tx) =>
        ledger.append(tx as Tx, {
          tenantId: t.tenantId, storeId: t.storeId, customerId,
          entryType: 'ORDER_DEBIT', direction: 'DEBIT',
          amount: calculated.total.toFixed(4), refType: 'ORDER',
        }),
      );

      // دفعة جزئية
      const partial = await inTenant(t.tenantId, (tx) =>
        ledger.append(tx as Tx, {
          tenantId: t.tenantId, storeId: t.storeId, customerId,
          entryType: 'PAYMENT_CREDIT', direction: 'CREDIT', amount: '400.00', refType: 'PAYMENT',
        }),
      );
      expect(partial.openingBalance.toFixed(2)).toBe('1000.00');
      expect(partial.runningBalance.toFixed(2)).toBe('600.00');

      // السداد الكامل
      const final = await inTenant(t.tenantId, (tx) =>
        ledger.append(tx as Tx, {
          tenantId: t.tenantId, storeId: t.storeId, customerId,
          entryType: 'PAYMENT_CREDIT', direction: 'CREDIT', amount: '600.00', refType: 'PAYMENT',
        }),
      );
      expect(final.runningBalance.toFixed(2)).toBe('0.00');

      const check = await inTenant(t.tenantId, (tx) =>
        ledger.verifyIntegrity(tx as Tx, t.tenantId, customerId),
      );
      expect(check.valid).toBe(true);
      expect(check.computedBalance).toBe('0.0000');
    });

    it('رصيد افتتاحي ثم طلب — يتراكمان', async () => {
      const customerId = await createTestCustomer(t, 'زبون بدَين قديم');

      // دَين مُرحَّل 500
      await inTenant(t.tenantId, (tx) =>
        ledger.append(tx as Tx, {
          tenantId: t.tenantId, storeId: t.storeId, customerId,
          entryType: 'OPENING_BALANCE', direction: 'DEBIT', amount: '500.00',
          refType: 'CUSTOMER', notes: 'رصيد افتتاحي',
        }),
      );

      // طلب جديد 300
      const order = await inTenant(t.tenantId, (tx) =>
        ledger.append(tx as Tx, {
          tenantId: t.tenantId, storeId: t.storeId, customerId,
          entryType: 'ORDER_DEBIT', direction: 'DEBIT', amount: '300.00', refType: 'ORDER',
        }),
      );

      expect(order.openingBalance.toFixed(2)).toBe('500.00');
      expect(order.runningBalance.toFixed(2)).toBe('800.00');
    });
  });
});
