import { z } from 'zod';
import { isoDateSchema, isoDateTimeSchema, uuidSchema } from './common.js';
import {
  dashboardGranularitySchema,
  dashboardRangePresetSchema,
  dashboardResolvedRangeSchema,
} from './dashboard.js';
import { orderStatusSchema } from './order.js';
import { paymentMethodSchema } from './payment.js';

/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  عقد التقارير — المرحلة 4 / Increment 4.1 (Reports).
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  نفس مبدأي لوحة التحكم: كل رقم مشتق من قاعدة البيانات على الخادم بمنطقة
 *  المحل، وينُقل نصًا عشريًا. لا حساب في الواجهة، لا بيانات وهمية.
 *
 *  الاستعلام يعيد استخدام فترات لوحة التحكم (preset/custom + منطقة المحل).
 */

export const reportsQuerySchema = z
  .object({
    preset: dashboardRangePresetSchema.default('last_30_days'),
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
export type ReportsQuery = z.infer<typeof reportsQuerySchema>;

/** مؤشر بمقارنة الفترة السابقة (نفس دلالة لوحة التحكم). */
export const reportMetricSchema = z.object({
  value: z.string(),
  previous: z.string().nullable(),
  deltaPct: z.number().nullable(),
});
export type ReportMetric = z.infer<typeof reportMetricSchema>;

export const reportSeriesPointSchema = z.object({
  date: isoDateSchema,
  sales: z.string(),
  payments: z.string(),
});

export const ordersByWeekdaySchema = z.object({
  weekday: z.number().int().min(0).max(6),
  label: z.string(),
  count: z.number().int(),
});

export const ordersByStatusSchema = z.object({
  status: orderStatusSchema,
  count: z.number().int(),
  amount: z.string(),
});

export const paymentMethodBreakdownSchema = z.object({
  method: paymentMethodSchema,
  amount: z.string(),
  count: z.number().int(),
  /** حصة مئوية من إجمالي المقبوضات (للعرض). */
  pct: z.number(),
});

export const reportTopCustomerSchema = z.object({
  id: uuidSchema,
  code: z.string(),
  name: z.string(),
  purchases: z.string(),
});

export const reportTopProductSchema = z.object({
  name: z.string(),
  quantity: z.string(),
  sales: z.string(),
});

export const employeePerformanceSchema = z.object({
  userId: uuidSchema.nullable(),
  name: z.string(),
  orders: z.number().int(),
  sales: z.string(),
  payments: z.string(),
});

/**
 * أقسام مؤجَّلة لغياب البُعد في نموذج البيانات (تُعرض بحالة صريحة لا ببيانات
 * وهمية): تصنيف المنتجات، وتقارير الفروع. `available=false` يخبر الواجهة أن
 * تعرض حالة «يتطلب …» بدل رسم فارغ يوحي بعدم وجود بيانات.
 */
export const deferredSectionSchema = z.object({
  available: z.boolean(),
  reason: z.string(),
});

export const reportsSchema = z.object({
  meta: z.object({
    storeName: z.string(),
    currency: z.string(),
    timezone: z.string(),
    generatedAt: isoDateTimeSchema,
    range: dashboardResolvedRangeSchema,
    /** الأقسام التي رشّحتها الصلاحيات. */
    scope: z.array(z.string()),
  }),

  kpis: z.object({
    outstanding: reportMetricSchema,
    payments: reportMetricSchema,
    sales: reportMetricSchema,
    ordersCount: reportMetricSchema,
    activeCustomers: reportMetricSchema,
    totalCustomers: z.number().int(),
    averageOrderValue: reportMetricSchema,
    taxes: reportMetricSchema,
    discounts: reportMetricSchema,
    /** متوسط مدة السداد بالأيام (بين إصدار الطلب وتوزيع الدفعة)، أو null. */
    avgPaymentDurationDays: z.number().nullable(),
  }),

  salesVsPayments: z.array(reportSeriesPointSchema),
  ordersByWeekday: z.array(ordersByWeekdaySchema),
  ordersByStatus: z.array(ordersByStatusSchema),
  paymentMethods: z.array(paymentMethodBreakdownSchema),
  topCustomers: z.array(reportTopCustomerSchema),
  topProducts: z.array(reportTopProductSchema),
  employeePerformance: z.array(employeePerformanceSchema),

  // أقسام مؤجَّلة بحالة صريحة.
  salesByCategory: deferredSectionSchema,
  branchReports: deferredSectionSchema,
});
export type ReportsData = z.infer<typeof reportsSchema>;

export const WEEKDAY_LABELS_AR = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
