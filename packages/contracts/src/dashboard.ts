import { z } from 'zod';
import { isoDateSchema, isoDateTimeSchema, uuidSchema } from './common.js';
import { orderStatusSchema } from './order.js';
import { paymentMethodSchema } from './payment.js';

/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  عقد لوحة التحكم — المرحلة 3.5 / Increment 3 (Dashboard Completion).
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  مبدآن غير قابلين للتفاوض:
 *
 *  1. **لا حساب مالي في الواجهة.** كل رقم مشتق من قاعدة البيانات عبر تجميع
 *     على الخادم، ويُنقل نصًا عشريًا (Decimal String). الواجهة تعرض وتنسّق فقط.
 *
 *  2. **المنطقة الزمنية مصدرها المحل.** حدود الفترات (اليوم/الشهر…) تُحسب
 *     بمنطقة المستأجر الزمنية على الخادم (`AT TIME ZONE`)، لا بمنطقة المتصفح.
 *     الواجهة ترسل «اسم فترة» (preset) أو تاريخين تقويميين فقط.
 */

// ── الفترة الزمنية ───────────────────────────────────────────────────────────

/**
 * فترات جاهزة. الخادم يحوّلها إلى حدّي [start, end) فعليين بمنطقة المحل، ويحسب
 * الفترة السابقة المقابلة للمقارنة (اليوم←أمس، هذا الشهر←الشهر الماضي…).
 */
export const dashboardRangePresetSchema = z.enum([
  'today',
  'yesterday',
  'last_7_days',
  'last_30_days',
  'this_month',
  'previous_month',
  'this_year',
  'custom',
]);
export type DashboardRangePreset = z.infer<typeof dashboardRangePresetSchema>;

/** دقّة تجميع المنحنيات. `auto` = يختارها الخادم بحسب طول الفترة. */
export const dashboardGranularitySchema = z.enum(['auto', 'day', 'week', 'month']);
export type DashboardGranularity = z.infer<typeof dashboardGranularitySchema>;

/** الدقّة الفعلية المُطبَّقة (بعد حلّ `auto`). */
export const resolvedGranularitySchema = z.enum(['day', 'week', 'month']);
export type ResolvedGranularity = z.infer<typeof resolvedGranularitySchema>;

/**
 * استعلام لوحة التحكم. عند `custom` يجب تمرير `from` و`to` (تاريخان تقويميان
 * YYYY-MM-DD يُفسَّران كحدود يوم بمنطقة المحل).
 */
export const dashboardQuerySchema = z
  .object({
    preset: dashboardRangePresetSchema.default('this_month'),
    from: isoDateSchema.optional(),
    to: isoDateSchema.optional(),
    granularity: dashboardGranularitySchema.default('auto'),
  })
  .refine((q) => q.preset !== 'custom' || (q.from && q.to), {
    message: 'الفترة المخصّصة تتطلب تاريخي بداية ونهاية.',
    path: ['from'],
  })
  .refine((q) => !(q.from && q.to) || q.from <= q.to, {
    message: 'تاريخ البداية بعد تاريخ النهاية.',
    path: ['to'],
  });
export type DashboardQuery = z.infer<typeof dashboardQuerySchema>;

/** الفترة المحلولة كما طبّقها الخادم — تُعرض في الواجهة بوضوح. */
export const dashboardResolvedRangeSchema = z.object({
  preset: dashboardRangePresetSchema,
  /** حدود الفترة الحالية (لحظات UTC، لكنها مشتقة من منطقة المحل). */
  from: isoDateTimeSchema,
  to: isoDateTimeSchema,
  /** حدود الفترة السابقة المقابلة (للمقارنة). */
  previousFrom: isoDateTimeSchema,
  previousTo: isoDateTimeSchema,
  granularity: resolvedGranularitySchema,
  /** تسمية عربية جاهزة («الشهر الحالي»، «آخر ٧ أيام»…). */
  label: z.string(),
});
export type DashboardResolvedRange = z.infer<typeof dashboardResolvedRangeSchema>;

// ── مؤشرات الأداء (KPIs) ─────────────────────────────────────────────────────

export const dashboardKpiIdSchema = z.enum([
  'revenue', // «Today's Revenue» بحسب الفترة
  'payments', // «Payments Today»
  'orders', // «Orders Today»
  'outstanding_balance',
  'overdue_balance',
  'overdue_customers',
  'active_customers',
  'average_order_value',
  'collection_rate',
  'unallocated_payments',
]);
export type DashboardKpiId = z.infer<typeof dashboardKpiIdSchema>;

/** وحدة العرض — تحدد المنسّق في الواجهة. */
export const kpiUnitSchema = z.enum(['money', 'count', 'percent']);
export type KpiUnit = z.infer<typeof kpiUnitSchema>;

/**
 * مؤشر واحد: القيمة الحالية، قيمة الفترة السابقة، نسبة التغيّر، والاتجاه.
 * كل القيم نصوص (المال عشري، العدد صحيح كنص، النسبة عشرية) لتفادي الفاصلة
 * العائمة على الطرفين.
 */
export const kpiMetricSchema = z.object({
  id: dashboardKpiIdSchema,
  unit: kpiUnitSchema,
  value: z.string(),
  previous: z.string().nullable(),
  /** نسبة التغيّر المئوية (قد تكون سالبة)؛ null إذا الأساس صفر أو غير معرّف. */
  deltaPct: z.number().nullable(),
  trend: z.enum(['up', 'down', 'flat']),
});
export type KpiMetric = z.infer<typeof kpiMetricSchema>;

/**
 * بيانات وصفية ثابتة لكل مؤشر — تسمية، تعريف الحساب (Tooltip)، هل الارتفاع
 * «جيد» (لتلوين الاتجاه). مصدر واحد يخدم الواجهة والاختبارات معًا.
 */
export interface KpiMeta {
  unit: KpiUnit;
  label: string;
  /** تعريف الحساب الدقيق — يظهر في Tooltip ويُوثَّق في الاختبارات. */
  definition: string;
  /** ارتفاع القيمة مرغوب؟ الإيراد نعم، الديون المتأخرة لا. */
  positiveIsGood: boolean;
}

export const DASHBOARD_KPI_META: Record<DashboardKpiId, KpiMeta> = {
  revenue: {
    unit: 'money',
    label: 'الإيراد',
    definition:
      'مجموع إجماليات الطلبات المؤكَّدة خلال الفترة (بتاريخ التأكيد، بمنطقة المحل). ' +
      'يستبعد المسودات وعروض الأسعار والملغاة. ليس مجموع الطلبات المُنشأة.',
    positiveIsGood: true,
  },
  payments: {
    unit: 'money',
    label: 'المقبوضات',
    definition:
      'مجموع الدفعات المُثبَّتة (POSTED) بتاريخ الدفع خلال الفترة، بمنطقة المحل. ' +
      'يستبعد الدفعات المعكوسة (REVERSED).',
    positiveIsGood: true,
  },
  orders: {
    unit: 'count',
    label: 'الطلبات',
    definition: 'عدد الطلبات غير الملغاة المُصدَرة خلال الفترة، بمنطقة المحل.',
    positiveIsGood: true,
  },
  outstanding_balance: {
    unit: 'money',
    label: 'إجمالي الديون',
    definition:
      'مجموع الأرصدة الموجبة لكل الزبائن غير المؤرشفين — من آخر running_balance ' +
      'في دفتر الحركات. لا يُعاد تجميعه من الطلبات والدفعات. قيمة لحظية (حتى الآن).',
    positiveIsGood: false,
  },
  overdue_balance: {
    unit: 'money',
    label: 'الديون المتأخرة',
    definition:
      'مجموع (الإجمالي − المدفوع) للطلبات المفتوحة (مؤكَّدة أو مدفوعة جزئيًا) التي ' +
      'تجاوز تاريخ استحقاقها الآن. يعالج الدفعات الجزئية بطرح المدفوع.',
    positiveIsGood: false,
  },
  overdue_customers: {
    unit: 'count',
    label: 'زبائن متأخرون',
    definition: 'عدد الزبائن الذين لهم طلب مفتوح واحد على الأقل تجاوز استحقاقه.',
    positiveIsGood: false,
  },
  active_customers: {
    unit: 'count',
    label: 'زبائن نشِطون',
    definition: 'عدد الزبائن غير المؤرشفين بحالة ACTIVE (قيمة لحظية).',
    positiveIsGood: true,
  },
  average_order_value: {
    unit: 'money',
    label: 'متوسط قيمة الطلب',
    definition:
      'إجمالي إيراد الفترة ÷ عدد الطلبات المؤكَّدة في الفترة. القسمة على صفر ' +
      'تُعيد صفرًا لا NaN.',
    positiveIsGood: true,
  },
  collection_rate: {
    unit: 'percent',
    label: 'نسبة التحصيل',
    definition:
      'المقبوضات المُثبَّتة في الفترة ÷ إيراد الفترة، ×100. المقام صفر يُعيد null ' +
      '(لا NaN ولا Infinity).',
    positiveIsGood: true,
  },
  unallocated_payments: {
    unit: 'money',
    label: 'دفعات غير موزّعة',
    definition:
      'مجموع (مبلغ الدفعة − مجموع توزيعاتها) للدفعات المُثبَّتة — رصيد دائن قُبض ' +
      'ولم يُخصَّص لطلب بعد. قيمة لحظية.',
    positiveIsGood: false,
  },
};

// ── المنحنيات (Trends) ───────────────────────────────────────────────────────

export const dashboardTrendIdSchema = z.enum([
  'revenue',
  'payments',
  'orders',
  'outstanding_balance',
  'new_customers',
]);
export type DashboardTrendId = z.infer<typeof dashboardTrendIdSchema>;

/** نقطة على منحنى — بداية الدلو (تاريخ ISO) وقيمتها (نص). */
export const trendPointSchema = z.object({
  bucket: isoDateSchema,
  value: z.string(),
});
export type TrendPoint = z.infer<typeof trendPointSchema>;

export const trendSeriesSchema = z.object({
  id: dashboardTrendIdSchema,
  unit: kpiUnitSchema,
  points: z.array(trendPointSchema),
});
export type TrendSeries = z.infer<typeof trendSeriesSchema>;

export const TREND_META: Record<DashboardTrendId, { label: string; unit: KpiUnit }> = {
  revenue: { label: 'الإيراد', unit: 'money' },
  payments: { label: 'المقبوضات', unit: 'money' },
  orders: { label: 'الطلبات', unit: 'count' },
  outstanding_balance: { label: 'إجمالي الديون', unit: 'money' },
  new_customers: { label: 'زبائن جدد', unit: 'count' },
};

// ── القوائم المرتّبة ─────────────────────────────────────────────────────────

export const topCustomerSchema = z.object({
  id: uuidSchema,
  code: z.string(),
  name: z.string(),
  /** المعيار المختار: مبيعات الفترة أو تحصيلها. */
  amount: z.string(),
});
export type TopCustomer = z.infer<typeof topCustomerSchema>;

export const topDebtorSchema = z.object({
  id: uuidSchema,
  code: z.string(),
  name: z.string(),
  balance: z.string(),
  oldestOverdueAt: isoDateTimeSchema.nullable(),
  openOrders: z.number().int(),
});
export type TopDebtor = z.infer<typeof topDebtorSchema>;

export const recentPaymentSchema = z.object({
  id: uuidSchema,
  number: z.string(),
  customerId: uuidSchema,
  customerName: z.string(),
  amount: z.string(),
  method: paymentMethodSchema,
  paidAt: isoDateTimeSchema,
  createdByName: z.string().nullable(),
});
export type RecentPayment = z.infer<typeof recentPaymentSchema>;

export const recentOrderSchema = z.object({
  id: uuidSchema,
  number: z.string(),
  customerId: uuidSchema,
  customerName: z.string(),
  status: orderStatusSchema,
  total: z.string(),
  issuedAt: isoDateTimeSchema,
});
export type RecentOrder = z.infer<typeof recentOrderSchema>;

/** المعيار المُعتمد لقائمة «أعلى الزبائن». */
export const topCustomersBasisSchema = z.enum(['sales', 'collection']);
export type TopCustomersBasis = z.infer<typeof topCustomersBasisSchema>;

// ── التنبيهات ────────────────────────────────────────────────────────────────

export const alertSeveritySchema = z.enum(['info', 'warning', 'critical']);
export type AlertSeverity = z.infer<typeof alertSeveritySchema>;

export const dashboardAlertKindSchema = z.enum([
  'approaching_credit_limit',
  'over_credit_limit',
  'long_overdue',
  'unallocated_payments',
  'stale_draft_orders',
  'inactive_no_activity',
  'subscription_ending',
]);
export type DashboardAlertKind = z.infer<typeof dashboardAlertKindSchema>;

export const dashboardAlertSchema = z.object({
  id: z.string(),
  kind: dashboardAlertKindSchema,
  severity: alertSeveritySchema,
  message: z.string(),
  amount: z.string().nullable(),
  entityType: z.string().nullable(),
  entityId: uuidSchema.nullable(),
  /** رابط داخلي آمن للكيان، أو null إذا لا صفحة له. */
  actionHref: z.string().nullable(),
  date: isoDateTimeSchema.nullable(),
});
export type DashboardAlert = z.infer<typeof dashboardAlertSchema>;

// ── الاستجابة الكاملة ────────────────────────────────────────────────────────

export const dashboardMetaSchema = z.object({
  storeName: z.string(),
  currency: z.string(),
  timezone: z.string(),
  generatedAt: isoDateTimeSchema,
  range: dashboardResolvedRangeSchema,
  topCustomersBasis: topCustomersBasisSchema,
  /** الأقسام التي رشّحتها الصلاحيات (للواجهة كي لا تُظهر فراغًا). */
  scope: z.object({
    kpis: z.array(dashboardKpiIdSchema),
    trends: z.array(dashboardTrendIdSchema),
    lists: z.array(z.enum(['topCustomers', 'topDebtors', 'recentPayments', 'recentOrders'])),
  }),
});
export type DashboardMeta = z.infer<typeof dashboardMetaSchema>;

export const dashboardSchema = z.object({
  meta: dashboardMetaSchema,
  kpis: z.array(kpiMetricSchema),
  trends: z.array(trendSeriesSchema),
  topCustomers: z.array(topCustomerSchema),
  topDebtors: z.array(topDebtorSchema),
  recentPayments: z.array(recentPaymentSchema),
  recentOrders: z.array(recentOrderSchema),
  alerts: z.array(dashboardAlertSchema),
});
export type DashboardData = z.infer<typeof dashboardSchema>;
