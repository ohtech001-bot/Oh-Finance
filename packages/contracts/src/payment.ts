import { z } from 'zod';
import {
  isoDateSchema,
  isoDateTimeSchema,
  moneySchema,
  nonNegativeMoneySchema,
  paginationQuerySchema,
  positiveMoneySchema,
  sortOrderSchema,
  uuidSchema,
} from './common.js';

/**
 * عقود الدفعات.
 *
 * ⚠️ لا يوجد `orderId` في أي عقد هنا — بقرار صريح (ADR-0004).
 *    الدفعة تُوزَّع على **عدة طلبات** عبر `allocations`.
 */

export const paymentMethodSchema = z.enum(['CASH', 'BANK_TRANSFER', 'CARD', 'CHECK']);
export type PaymentMethod = z.infer<typeof paymentMethodSchema>;

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: 'نقدي',
  BANK_TRANSFER: 'تحويل بنكي',
  CARD: 'بطاقة',
  CHECK: 'شيك',
};

export const paymentStatusSchema = z.enum(['POSTED', 'REVERSED']);
export type PaymentStatus = z.infer<typeof paymentStatusSchema>;

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  POSTED: 'مُسجَّلة',
  REVERSED: 'معكوسة',
};

// ── القراءة ─────────────────────────────────────────────────────────────────

export const paymentAllocationSchema = z.object({
  orderId: uuidSchema,
  orderNumber: z.string(),
  orderTotal: nonNegativeMoneySchema,
  amount: positiveMoneySchema,
});
export type PaymentAllocation = z.infer<typeof paymentAllocationSchema>;

export const paymentSchema = z.object({
  id: uuidSchema,
  number: z.string(),

  customerId: uuidSchema,
  customerName: z.string(),
  customerCode: z.string(),

  amount: positiveMoneySchema,
  method: paymentMethodSchema,
  status: paymentStatusSchema,

  paidAt: isoDateTimeSchema,
  reference: z.string().nullable(),
  notes: z.string().nullable(),

  /**
   * لقطة الرصيد لحظة الدفع — من القيد المحاسبي نفسه، لا محسوبة الآن.
   *
   * هذا ما تعرضه شاشة الدفعات في المرجع: «المبلغ قبل الدفع / المدفوع /
   * المبلغ المتبقي». وهي بالضبط `openingBalance / amount / runningBalance`
   * من قيد `PAYMENT_CREDIT`.
   *
   * لماذا لقطة لا حساب لحظي؟ لأن دفعة سُجّلت قبل شهر يجب أن تعرض الرصيد
   * **كما كان حينها**، لا كما هو اليوم.
   */
  balanceBefore: moneySchema,
  balanceAfter: moneySchema,

  allocations: z.array(paymentAllocationSchema),
  /** المبلغ غير الموزَّع — يصير رصيدًا دائنًا (دفعة مقدّمة). */
  unallocatedAmount: nonNegativeMoneySchema,

  reversedAt: isoDateTimeSchema.nullable(),
  reverseReason: z.string().nullable(),

  createdAt: isoDateTimeSchema,
  createdBy: uuidSchema.nullable(),
  createdByName: z.string().nullable(),
});
export type Payment = z.infer<typeof paymentSchema>;

// ── الكتابة ─────────────────────────────────────────────────────────────────

/**
 * استراتيجية التوزيع.
 *
 *   AUTO_OLDEST_FIRST — الأقدم أولًا (العرف المحاسبي: أقدم دَين يُسدَّد أولًا)
 *   MANUAL            — المستخدم يحدد كم يذهب لكل طلب
 *   NONE              — دفعة مقدّمة، لا تُوزَّع على طلب
 */
export const allocationStrategySchema = z.enum(['AUTO_OLDEST_FIRST', 'MANUAL', 'NONE']);
export type AllocationStrategy = z.infer<typeof allocationStrategySchema>;

export const ALLOCATION_STRATEGY_LABELS: Record<AllocationStrategy, string> = {
  AUTO_OLDEST_FIRST: 'تلقائي — الأقدم أولًا',
  MANUAL: 'توزيع يدوي',
  NONE: 'دفعة مقدّمة (بلا توزيع)',
};

export const manualAllocationSchema = z.object({
  orderId: uuidSchema,
  amount: positiveMoneySchema,
});

export const createPaymentSchema = z
  .object({
    customerId: uuidSchema,

    amount: positiveMoneySchema,
    method: paymentMethodSchema,

    /** تاريخ الدفع الفعلي — قد يسبق اليوم. */
    paidAt: isoDateSchema.optional(),

    reference: z.string().trim().max(120).optional().or(z.literal('')),
    notes: z.string().trim().max(1000).optional().or(z.literal('')),

    strategy: allocationStrategySchema.default('AUTO_OLDEST_FIRST'),

    /** إلزامي عند `MANUAL`، ومُتجاهَل فيما عداه. */
    allocations: z.array(manualAllocationSchema).max(100).optional(),
  })
  .refine(
    (dto) => dto.strategy !== 'MANUAL' || (dto.allocations?.length ?? 0) > 0,
    { message: 'التوزيع اليدوي يتطلب تحديد طلب واحد على الأقل.', path: ['allocations'] },
  );
export type CreatePaymentRequest = z.infer<typeof createPaymentSchema>;

/**
 * عكس دفعة.
 *
 * لا تُحذف الدفعة ولا توزيعاتها. يُنشأ قيد عكس، وتُعاد الطلبات إلى حالتها
 * السابقة. الدفعة تبقى مرئية بحالة `REVERSED`.
 *
 * محصورة بصلاحية `payments.reverse` (صاحب المحل وحده).
 */
export const reversePaymentSchema = z.object({
  reason: z.string().trim().min(5, 'سبب عكس الدفعة مطلوب.').max(500),
});
export type ReversePaymentRequest = z.infer<typeof reversePaymentSchema>;

// ── الاستعلام ───────────────────────────────────────────────────────────────

export const paymentSortSchema = z.enum(['number', 'paidAt', 'amount', 'createdAt']);

export const paymentListQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().max(120).optional(),
  customerId: uuidSchema.optional(),
  method: paymentMethodSchema.optional(),
  status: paymentStatusSchema.optional(),

  from: isoDateSchema.optional(),
  to: isoDateSchema.optional(),

  sortBy: paymentSortSchema.default('paidAt'),
  sortOrder: sortOrderSchema,
});
export type PaymentListQuery = z.infer<typeof paymentListQuerySchema>;

/** بطاقات إحصاء رأس شاشة الدفعات (مطابقة للمرجع البصري). */
export const paymentStatsSchema = z.object({
  totalCount: z.number().int(),
  totalAmount: nonNegativeMoneySchema,

  byMethod: z.object({
    CASH: z.object({ count: z.number().int(), amount: nonNegativeMoneySchema }),
    BANK_TRANSFER: z.object({ count: z.number().int(), amount: nonNegativeMoneySchema }),
    CARD: z.object({ count: z.number().int(), amount: nonNegativeMoneySchema }),
    CHECK: z.object({ count: z.number().int(), amount: nonNegativeMoneySchema }),
  }),

  /** متوسط الدفعة اليومي هذا الشهر. */
  dailyAverage: nonNegativeMoneySchema,
});
export type PaymentStats = z.infer<typeof paymentStatsSchema>;

/**
 * معاينة التوزيع — قبل التسجيل.
 *
 * تُظهر للكاشير **بالضبط** أين ستذهب الدفعة قبل أن يضغط «تسجيل».
 * بلا هذه المعاينة، يسجّل الدفعة ثم يكتشف أنها ذهبت لطلب آخر — وعكسها
 * يتطلب صلاحية صاحب المحل.
 */
export const allocationPreviewRequestSchema = z.object({
  customerId: uuidSchema,
  amount: positiveMoneySchema,
  strategy: allocationStrategySchema.default('AUTO_OLDEST_FIRST'),
});
export type AllocationPreviewRequest = z.infer<typeof allocationPreviewRequestSchema>;

export const allocationPreviewSchema = z.object({
  allocations: z.array(
    z.object({
      orderId: uuidSchema,
      orderNumber: z.string(),
      orderTotal: nonNegativeMoneySchema,
      alreadyPaid: nonNegativeMoneySchema,
      remaining: nonNegativeMoneySchema,
      /** كم من هذه الدفعة سيذهب لهذا الطلب. */
      willAllocate: positiveMoneySchema,
      /** المتبقي على الطلب بعد هذه الدفعة. */
      remainingAfter: nonNegativeMoneySchema,
    }),
  ),
  unallocatedAmount: nonNegativeMoneySchema,
  balanceBefore: moneySchema,
  balanceAfter: moneySchema,
});
export type AllocationPreview = z.infer<typeof allocationPreviewSchema>;

/** الطلبات غير المسدَّدة لزبون — لشاشة التوزيع اليدوي. */
export const openOrderSchema = z.object({
  id: uuidSchema,
  number: z.string(),
  issuedAt: isoDateTimeSchema,
  dueAt: isoDateTimeSchema.nullable(),
  total: nonNegativeMoneySchema,
  paidAmount: nonNegativeMoneySchema,
  remaining: positiveMoneySchema,
  isOverdue: z.boolean(),
});
export type OpenOrder = z.infer<typeof openOrderSchema>;
