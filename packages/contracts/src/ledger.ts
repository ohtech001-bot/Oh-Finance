import { z } from 'zod';
import {
  isoDateSchema,
  isoDateTimeSchema,
  moneySchema,
  nonNegativeMoneySchema,
  paginationQuerySchema,
  positiveMoneySchema,
  uuidSchema,
} from './common.js';

/**
 * عقود دفتر الحركات.
 *
 * ⚠️ لا يوجد هنا `updateLedgerEntrySchema` ولا `deleteLedgerEntrySchema`.
 *    غيابهما **متعمَّد وهو جوهر التصميم**: الدفتر append-only.
 *    الشيء الوحيد الذي يمكن فعله بقيد قائم هو **عكسه بقيد جديد**.
 */

export const ledgerEntryTypeSchema = z.enum([
  'OPENING_BALANCE',
  'ORDER_DEBIT',
  'PAYMENT_CREDIT',
  'ADJUSTMENT_DEBIT',
  'ADJUSTMENT_CREDIT',
  'REVERSAL',
  'WRITE_OFF',
]);
export type LedgerEntryType = z.infer<typeof ledgerEntryTypeSchema>;

export const LEDGER_TYPE_LABELS: Record<LedgerEntryType, string> = {
  OPENING_BALANCE: 'رصيد افتتاحي',
  ORDER_DEBIT: 'طلب',
  PAYMENT_CREDIT: 'دفعة',
  ADJUSTMENT_DEBIT: 'تسوية مدينة',
  ADJUSTMENT_CREDIT: 'تسوية دائنة',
  REVERSAL: 'عكس قيد',
  WRITE_OFF: 'إعدام دَين',
};

export const ledgerRefTypeSchema = z.enum(['CUSTOMER', 'ORDER', 'PAYMENT', 'ADJUSTMENT']);
export type LedgerRefType = z.infer<typeof ledgerRefTypeSchema>;

/**
 * القيد المحاسبي.
 *
 * الحقول الثلاثة التي تجعله دفترًا حقيقيًا لا مجرد سجل:
 *   openingBalance → الرصيد قبل
 *   debit / credit → المبلغ
 *   runningBalance → الرصيد بعد
 *
 * قيد `CHECK` في القاعدة يفرض: `running = opening + debit − credit`.
 * فلا يمكن لأي كود — صحيح أو خاطئ أو خبيث — كتابة رصيد لا ينتج عن حركته.
 */
export const ledgerEntrySchema = z.object({
  id: uuidSchema,
  seq: z.number().int(),

  customerId: uuidSchema,
  customerName: z.string(),
  customerCode: z.string(),

  entryType: ledgerEntryTypeSchema,

  openingBalance: moneySchema,
  debit: nonNegativeMoneySchema,
  credit: nonNegativeMoneySchema,
  runningBalance: moneySchema,

  refType: ledgerRefTypeSchema,
  refId: uuidSchema.nullable(),
  /** رقم الطلب/الدفعة المرجعي — للعرض في الجدول. */
  refNumber: z.string().nullable(),

  reversesEntryId: uuidSchema.nullable(),
  /** true إن كان هذا القيد قد عُكس بقيد لاحق. */
  isReversed: z.boolean(),

  notes: z.string().nullable(),

  occurredAt: isoDateTimeSchema,
  createdAt: isoDateTimeSchema,
  createdBy: uuidSchema.nullable(),
  createdByName: z.string().nullable(),
});
export type LedgerEntry = z.infer<typeof ledgerEntrySchema>;

// ── الاستعلام ───────────────────────────────────────────────────────────────

export const ledgerListQuerySchema = paginationQuerySchema.extend({
  customerId: uuidSchema.optional(),
  entryType: ledgerEntryTypeSchema.optional(),
  refType: ledgerRefTypeSchema.optional(),
  /** قيود مرجع محدد — لتفاصيل الطلب/الدفعة. */
  refId: uuidSchema.optional(),

  from: isoDateSchema.optional(),
  to: isoDateSchema.optional(),

  search: z.string().trim().max(120).optional(),
});
export type LedgerListQuery = z.infer<typeof ledgerListQuerySchema>;

/** إجماليات أسفل جدول الحركات (كما في المرجع البصري). */
export const ledgerTotalsSchema = z.object({
  totalDebit: nonNegativeMoneySchema,
  totalCredit: nonNegativeMoneySchema,
  /** الرصيد الحالي = آخر runningBalance. */
  currentBalance: moneySchema,
  entryCount: z.number().int(),
});
export type LedgerTotals = z.infer<typeof ledgerTotalsSchema>;

/** كشف حساب زبون. */
export const customerStatementSchema = z.object({
  customerId: uuidSchema,
  customerName: z.string(),
  customerCode: z.string(),

  /** الرصيد قبل بداية الفترة. */
  openingBalance: moneySchema,
  /** الرصيد في نهاية الفترة. */
  closingBalance: moneySchema,

  entries: z.array(ledgerEntrySchema),
  totals: ledgerTotalsSchema,

  from: isoDateSchema.nullable(),
  to: isoDateSchema.nullable(),
  generatedAt: isoDateTimeSchema,
});
export type CustomerStatement = z.infer<typeof customerStatementSchema>;

// ── الكتابة: الطريق الوحيد لتغيير رصيد يدويًا ───────────────────────────────

/**
 * قيد تسوية يدوي.
 *
 * هذه هي **البوابة الوحيدة** في النظام لتغيير رصيد زبون بلا طلب أو دفعة.
 * محصورة بصلاحية `ledger.adjust` (صاحب المحل وحده)، والسبب إلزامي،
 * والقيد يُسجَّل في سجل التدقيق.
 *
 * لا توجد بوابة أخرى. لا endpoint لكتابة `balance`، لأن `balance` ليس عمودًا.
 */
export const createAdjustmentSchema = z.object({
  customerId: uuidSchema,

  /** DEBIT: يزيد ما على الزبون. CREDIT: ينقصه. */
  direction: z.enum(['DEBIT', 'CREDIT']),
  amount: positiveMoneySchema,

  /** السبب — إلزامي. قيد بلا سبب ليس تسوية، بل تلاعب. */
  reason: z.string().trim().min(5, 'سبب التسوية مطلوب (5 أحرف على الأقل).').max(1000),

  /** تاريخ الحركة — قد يسبق اليوم (تصحيح بأثر رجعي). */
  occurredAt: isoDateSchema.optional(),
});
export type CreateAdjustmentRequest = z.infer<typeof createAdjustmentSchema>;

/**
 * عكس قيد.
 *
 * يُنشئ قيدًا مضادًا بنفس المبلغ ويشير إلى الأصلي. القيد الأصلي **يبقى**
 * في الدفتر مرئيًا — لأن ما حدث حدث، وإخفاؤه تزوير.
 */
export const reverseEntrySchema = z.object({
  reason: z.string().trim().min(5, 'سبب العكس مطلوب.').max(1000),
});
export type ReverseEntryRequest = z.infer<typeof reverseEntrySchema>;
