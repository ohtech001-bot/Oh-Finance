import { z } from 'zod';
import {
  isoDateSchema,
  isoDateTimeSchema,
  nonNegativeMoneySchema,
  paginationQuerySchema,
  positiveMoneySchema,
  sortOrderSchema,
  uuidSchema,
} from './common.js';

/**
 * عقود الطلبات.
 *
 * الطلب **حاوية**: بنود + مبالغ مشتقة منها. لا منطق مالي في العقد نفسه —
 * كل المبالغ تُعاد حسابها على الخادم بـ@oh/money، ولا يُوثق بأي مبلغ يرسله
 * العميل.
 *
 * ⚠️ العميل **لا يرسل** `subtotal` ولا `total`. لو قبلناهما، لأمكن لمهاجم
 *    إنشاء طلب ببنود بقيمة 5000 وإجمالي معلن 5 — فيُقيَّد عليه 5 فقط.
 *    الخادم يحسب، والعميل يعرض.
 */

export const orderStatusSchema = z.enum([
  'DRAFT',
  'QUOTE',
  'CONFIRMED',
  'PARTIALLY_PAID',
  'PAID',
  'CANCELLED',
]);
export type OrderStatus = z.infer<typeof orderStatusSchema>;

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  DRAFT: 'مسودة',
  QUOTE: 'عرض سعر',
  CONFIRMED: 'مؤكد',
  PARTIALLY_PAID: 'مدفوع جزئيًا',
  PAID: 'مدفوع',
  CANCELLED: 'ملغي',
};

/** الحالات التي تقبل التعديل. ما عداها مقفل. */
export const EDITABLE_ORDER_STATUSES: OrderStatus[] = ['DRAFT', 'QUOTE'];

export const orderItemSourceSchema = z.enum(['MANUAL', 'PRODUCT', 'SERVICE']);
export type OrderItemSource = z.infer<typeof orderItemSourceSchema>;

// ── البنود ──────────────────────────────────────────────────────────────────

export const orderItemSchema = z.object({
  id: uuidSchema,
  sourceType: orderItemSourceSchema,
  sourceId: uuidSchema.nullable(),

  name: z.string(),
  description: z.string().nullable(),

  /** كمية عشرية كنص — "1.5" كجم، "0.25" ساعة. */
  quantity: z.string(),
  unitPrice: nonNegativeMoneySchema,
  discount: nonNegativeMoneySchema,
  taxRate: z.string(),

  /** محسوب على الخادم. */
  lineTotal: nonNegativeMoneySchema,
  sortOrder: z.number().int(),
});
export type OrderItem = z.infer<typeof orderItemSchema>;

/** كمية موجبة كنص — لا `number` (قد تكون 0.001). */
const quantitySchema = z
  .string()
  .regex(/^\d+(\.\d{1,4})?$/, 'كمية غير صالحة.')
  .refine((v) => !/^0+(\.0+)?$/.test(v), 'الكمية يجب أن تكون أكبر من صفر.');

/** نسبة ضريبة: "0" إلى "100". */
const taxRateSchema = z
  .string()
  .regex(/^\d+(\.\d{1,3})?$/, 'نسبة ضريبة غير صالحة.')
  .refine((v) => Number.parseInt(v.split('.')[0] ?? '0', 10) <= 100, 'النسبة تتجاوز 100%.');

export const orderItemInputSchema = z
  .object({
    sourceType: orderItemSourceSchema.default('MANUAL'),
    sourceId: uuidSchema.optional(),

    name: z.string().trim().min(1, 'اسم البند مطلوب.').max(200),
    description: z.string().trim().max(1000).optional().or(z.literal('')),

    quantity: quantitySchema,
    unitPrice: nonNegativeMoneySchema,
    discount: nonNegativeMoneySchema.default('0'),
    taxRate: taxRateSchema.default('0'),
  })
  /**
   * البند اليدوي بلا مصدر؛ البند المرتبط يجب أن يحمل معرّفه.
   * نفس القيد مفروض بـCHECK في القاعدة — الطبقتان معًا.
   */
  .refine(
    (item) =>
      (item.sourceType === 'MANUAL' && !item.sourceId) ||
      (item.sourceType !== 'MANUAL' && Boolean(item.sourceId)),
    { message: 'بند مرتبط بمنتج أو خدمة يجب أن يحمل معرّف المصدر.', path: ['sourceId'] },
  );
export type OrderItemInput = z.infer<typeof orderItemInputSchema>;

// ── الطلب ───────────────────────────────────────────────────────────────────

export const orderSchema = z.object({
  id: uuidSchema,
  number: z.string(),
  status: orderStatusSchema,

  customerId: uuidSchema,
  customerName: z.string(),
  customerCode: z.string(),

  issuedAt: isoDateTimeSchema,
  dueAt: isoDateTimeSchema.nullable(),

  subtotal: nonNegativeMoneySchema,
  discountAmount: nonNegativeMoneySchema,
  taxAmount: nonNegativeMoneySchema,
  total: nonNegativeMoneySchema,

  paidAmount: nonNegativeMoneySchema,
  /** = total − paidAmount. مشتق. */
  remainingAmount: nonNegativeMoneySchema,

  notes: z.string().nullable(),

  /** true بعد التأكيد — الواجهة تُعطّل التعديل. */
  isLocked: z.boolean(),
  /** الطلب مؤكد وتجاوز تاريخ استحقاقه ولم يُسدَّد. */
  isOverdue: z.boolean(),
  /** مؤرشف — مخفي من القوائم الافتراضية. */
  isArchived: z.boolean(),

  itemCount: z.number().int(),
  version: z.number().int(),

  confirmedAt: isoDateTimeSchema.nullable(),
  cancelledAt: isoDateTimeSchema.nullable(),
  cancelReason: z.string().nullable(),
  createdAt: isoDateTimeSchema,
});
export type Order = z.infer<typeof orderSchema>;

export const orderDetailSchema = orderSchema.extend({
  items: z.array(orderItemSchema),
  /** الدفعات التي وُزِّع جزء منها على هذا الطلب. */
  allocations: z.array(
    z.object({
      paymentId: uuidSchema,
      paymentNumber: z.string(),
      paidAt: isoDateTimeSchema,
      method: z.string(),
      amount: positiveMoneySchema,
    }),
  ),
});
export type OrderDetail = z.infer<typeof orderDetailSchema>;

// ── الكتابة ─────────────────────────────────────────────────────────────────

/** الحالة المطلوبة عند الإنشاء. لا يُسمح بإنشاء طلب مدفوع مباشرة. */
export const createOrderStatusSchema = z.enum(['DRAFT', 'QUOTE', 'CONFIRMED']);

export const createOrderSchema = z.object({
  customerId: uuidSchema,
  status: createOrderStatusSchema.default('DRAFT'),

  issuedAt: isoDateSchema.optional(),
  /** إن غاب: يُحسب من `paymentTermDays` للزبون عند التأكيد. */
  dueAt: isoDateSchema.optional(),

  /** خصم على مستوى الطلب (فوق خصومات البنود). */
  discountAmount: nonNegativeMoneySchema.default('0'),

  notes: z.string().trim().max(2000).optional().or(z.literal('')),

  items: z
    .array(orderItemInputSchema)
    .min(1, 'الطلب يحتاج بندًا واحدًا على الأقل.')
    .max(200, 'عدد البنود يتجاوز الحد.'),
});
export type CreateOrderRequest = z.infer<typeof createOrderSchema>;

/**
 * التعديل — للمسودات وعروض الأسعار فقط.
 *
 * `version` إلزامي: **قفل متفائل**. لو عدّل موظفان نفس الطلب في آنٍ واحد،
 * فالثاني يصطدم بـ409 بدل أن يكتب فوق تعديل الأول بصمت.
 */
export const updateOrderSchema = z.object({
  version: z.number().int().min(0),

  customerId: uuidSchema.optional(),
  issuedAt: isoDateSchema.optional(),
  dueAt: isoDateSchema.optional(),
  discountAmount: nonNegativeMoneySchema.optional(),
  notes: z.string().trim().max(2000).optional().or(z.literal('')),
  items: z.array(orderItemInputSchema).min(1).max(200).optional(),
});
export type UpdateOrderRequest = z.infer<typeof updateOrderSchema>;

/** تأكيد الطلب — يولّد القيد المدين. */
export const confirmOrderSchema = z.object({
  version: z.number().int().min(0),
  dueAt: isoDateSchema.optional(),
  /**
   * تجاوز حد الائتمان.
   *
   * لو تجاوز الطلبُ حدَّ الائتمان، يُرفض التأكيد. صاحب المحل (وحده) يستطيع
   * التجاوز بسبب مكتوب — ويُسجَّل في سجل التدقيق. الحد ليس زينة.
   */
  overrideCreditLimit: z.boolean().default(false),
  overrideReason: z.string().trim().max(500).optional(),
});
export type ConfirmOrderRequest = z.infer<typeof confirmOrderSchema>;

/** الإلغاء — يولّد قيد عكس إن كان الطلب مؤكدًا. */
export const cancelOrderSchema = z.object({
  version: z.number().int().min(0),
  reason: z.string().trim().min(3, 'سبب الإلغاء مطلوب ويُسجَّل في سجل التدقيق.').max(500),
});
export type CancelOrderRequest = z.infer<typeof cancelOrderSchema>;

/**
 * عمليات تحمل رقم النسخة فقط (قفل متفائل).
 * تُستخدم للحذف والأرشفة والعودة إلى مسودة.
 */
export const orderVersionSchema = z.object({
  version: z.number().int().min(0),
});
export type OrderVersionRequest = z.infer<typeof orderVersionSchema>;

// ── الاستعلام ───────────────────────────────────────────────────────────────

export const orderSortSchema = z.enum([
  'number',
  'issuedAt',
  'dueAt',
  'total',
  'remainingAmount',
  'createdAt',
]);

export const orderListQuerySchema = paginationQuerySchema.extend({
  /** بحث برقم الطلب أو اسم الزبون (المتطلب 13). */
  search: z.string().trim().max(120).optional(),
  status: orderStatusSchema.optional(),
  customerId: uuidSchema.optional(),

  /** تصفية حسب التاريخ (المتطلب 14). */
  from: isoDateSchema.optional(),
  to: isoDateSchema.optional(),

  /** المتأخرة عن الاستحقاق فقط. */
  overdueOnly: z.coerce.boolean().optional(),
  /** غير المسدَّدة بالكامل. */
  unpaidOnly: z.coerce.boolean().optional(),

  /** إظهار المؤرشفة (مخفية افتراضيًا). */
  includeArchived: z.coerce.boolean().default(false),

  sortBy: orderSortSchema.default('issuedAt'),
  sortOrder: sortOrderSchema,
});
export type OrderListQuery = z.infer<typeof orderListQuerySchema>;

/** بطاقات إحصاء رأس شاشة الطلبات (كما في المرجع البصري). */
export const orderStatsSchema = z.object({
  total: z.number().int(),
  draft: z.number().int(),
  quote: z.number().int(),
  confirmed: z.number().int(),
  partiallyPaid: z.number().int(),
  paid: z.number().int(),
  cancelled: z.number().int(),
  totalAmount: nonNegativeMoneySchema,
  outstandingAmount: nonNegativeMoneySchema,
});
export type OrderStats = z.infer<typeof orderStatsSchema>;

/**
 * معاينة حساب الطلب — يحسبها الخادم من البنود قبل الحفظ.
 *
 * لماذا نقطة API لمجرد الحساب؟ لأن الواجهة **لا يجوز أن تحسب المبالغ**
 * ثم ترسلها. لو حسبت الواجهة 1250 وحسب الخادم 1249.99 (فرق تقريب)، لعرضنا
 * رقمًا وحفظنا آخر. مصدر حساب واحد = رقم واحد.
 */
export const orderPreviewSchema = z.object({
  items: z.array(orderItemInputSchema).min(1).max(200),
  discountAmount: nonNegativeMoneySchema.default('0'),
});
export type OrderPreviewRequest = z.infer<typeof orderPreviewSchema>;

export const orderTotalsSchema = z.object({
  lineTotals: z.array(nonNegativeMoneySchema),
  subtotal: nonNegativeMoneySchema,
  discountAmount: nonNegativeMoneySchema,
  taxAmount: nonNegativeMoneySchema,
  total: nonNegativeMoneySchema,
});
export type OrderTotals = z.infer<typeof orderTotalsSchema>;
