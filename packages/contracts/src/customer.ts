import { z } from 'zod';
import {
  emailSchema,
  isoDateTimeSchema,
  moneySchema,
  nonNegativeMoneySchema,
  paginationQuerySchema,
  phoneSchema,
  sortOrderSchema,
  uuidSchema,
} from './common.js';

/**
 * عقود الزبائن.
 *
 * ⚠️ لاحظ ما **لا** يوجد في `updateCustomerSchema`: لا `balance` ولا
 *    `openingBalance`. الرصيد مشتق من دفتر الحركات ولا يُكتب مباشرة أبدًا.
 *    الرصيد الافتتاحي يُقبل عند **الإنشاء فقط**، فيولّد قيدًا في الدفتر.
 *
 *    لو قبلنا تعديله لاحقًا، لصار بابًا خلفيًا لتغيير رصيد زبون بلا أثر
 *    محاسبي — وهو بالضبط ما بُني هذا النظام لمنعه.
 */

export const customerStatusSchema = z.enum(['ACTIVE', 'INACTIVE', 'BLOCKED']);
export type CustomerStatus = z.infer<typeof customerStatusSchema>;

export const CUSTOMER_STATUS_LABELS: Record<CustomerStatus, string> = {
  ACTIVE: 'نشط',
  INACTIVE: 'غير نشط',
  BLOCKED: 'محظور',
};

/** حالة الحساب — مشتقة من الرصيد، لا مخزّنة. */
export const accountStateSchema = z.enum(['DEBIT', 'CREDIT', 'SETTLED']);
export type AccountState = z.infer<typeof accountStateSchema>;

export const ACCOUNT_STATE_LABELS: Record<AccountState, string> = {
  DEBIT: 'مدين',
  CREDIT: 'دائن',
  SETTLED: 'لا يوجد رصيد',
};

const optionalText = (max: number) => z.string().trim().max(max).optional().or(z.literal(''));

// ── القراءة ─────────────────────────────────────────────────────────────────

export const customerSchema = z.object({
  id: uuidSchema,
  code: z.string(),
  name: z.string(),
  company: z.string().nullable(),

  phone: z.string().nullable(),
  phoneAlt: z.string().nullable(),
  email: z.string().nullable(),

  address: z.string().nullable(),
  city: z.string().nullable(),
  taxNumber: z.string().nullable(),
  notes: z.string().nullable(),

  tags: z.array(z.string()),

  creditLimit: nonNegativeMoneySchema,
  paymentTermDays: z.number().int(),
  status: customerStatusSchema,

  /**
   * ⚠️ الرصيد **مشتق** — يأتي من `SUM(debit) - SUM(credit)` على دفتر الحركات.
   *    ليس عمودًا في جدول الزبائن. لا يوجد endpoint لكتابته.
   *    موجب = الزبون مدين لنا. سالب = نحن مدينون له (دفعة مقدّمة).
   */
  balance: moneySchema,
  accountState: accountStateSchema,

  /** الائتمان المتبقي = creditLimit − balance (صفر إن تجاوز). */
  availableCredit: nonNegativeMoneySchema,

  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
  archivedAt: isoDateTimeSchema.nullable(),
});
export type Customer = z.infer<typeof customerSchema>;

/** ملف الزبون — بطاقات شاشة «صفحة كل زبون». */
/**
 * صحّة الزبون — تقدير سلوكه الائتماني.
 *
 *   EXCELLENT — لا دَين (مسدَّد أو دائن)
 *   GOOD      — عليه دَين ضمن الحدود ولا متأخرات
 *   WARNING   — قارب حد الائتمان أو يسدّد متأخرًا في المتوسط
 *   AT_RISK   — عليه طلبات متأخرة أو تجاوز حد الائتمان
 */
export const customerHealthSchema = z.enum(['EXCELLENT', 'GOOD', 'WARNING', 'AT_RISK']);
export type CustomerHealth = z.infer<typeof customerHealthSchema>;

export const CUSTOMER_HEALTH_LABELS: Record<CustomerHealth, string> = {
  EXCELLENT: 'ممتاز',
  GOOD: 'جيد',
  WARNING: 'تحذير',
  AT_RISK: 'متعثّر',
};

export const customerSummarySchema = z.object({
  customer: customerSchema,

  totalOrders: z.number().int(),
  totalOrdersAmount: nonNegativeMoneySchema,
  totalPayments: z.number().int(),
  totalPaymentsAmount: nonNegativeMoneySchema,

  lastOrderAt: isoDateTimeSchema.nullable(),
  lastPaymentAt: isoDateTimeSchema.nullable(),

  /** عدد الطلبات المتأخرة عن تاريخ الاستحقاق. */
  overdueOrders: z.number().int(),
  overdueAmount: nonNegativeMoneySchema,

  /** متوسط أيام السداد (من إصدار الطلب إلى استلام الدفعة). null إن لا دفعات. */
  avgPaymentDays: z.number().int().nullable(),

  /** نسبة استخدام حد الائتمان (%). null إن لم يُحدَّد حد. */
  creditUsagePct: z.number().int().nullable(),

  customerHealth: customerHealthSchema,
});
export type CustomerSummary = z.infer<typeof customerSummarySchema>;

// ── الكتابة ─────────────────────────────────────────────────────────────────

export const createCustomerSchema = z.object({
  name: z.string().trim().min(2, 'اسم الزبون مطلوب.').max(160),
  company: optionalText(160),

  phone: phoneSchema.optional().or(z.literal('')),
  phoneAlt: phoneSchema.optional().or(z.literal('')),
  email: emailSchema.optional().or(z.literal('')),

  address: optionalText(240),
  city: optionalText(80),
  taxNumber: optionalText(32),
  notes: z.string().trim().max(2000).optional().or(z.literal('')),

  tags: z.array(z.string().trim().min(1).max(32)).max(20).default([]),

  creditLimit: nonNegativeMoneySchema.default('1500'),
  paymentTermDays: z.number().int().min(0).max(365).default(30),
  status: customerStatusSchema.default('ACTIVE'),

  /**
   * الرصيد الافتتاحي — **عند الإنشاء فقط**.
   *
   * موجب = للزبون رصيد دائن عندنا (יתרה).
   * سالب = الزبون مدين لنا مسبقًا (دَين قديم مُرحَّل).
   *
   * لا يُخزَّن كعمود: يولّد قيد `OPENING_BALANCE` في الدفتر. هذا يجعله
   * جزءًا من التاريخ المحاسبي المُدقَّق، لا رقمًا معلّقًا يمكن تغييره.
   */
  openingBalance: moneySchema.default('0'),
});
export type CreateCustomerRequest = z.infer<typeof createCustomerSchema>;

/**
 * التعديل.
 *
 * `openingBalance` **مستثنى عمدًا** (`.omit`). تعديله بعد الإنشاء يعني تغيير
 * الرصيد بلا قيد محاسبي. من أراد تصحيح رصيد افتتاحي خاطئ، فليُنشئ قيد تسوية
 * (`POST /ledger/adjustments`) — فيبقى الخطأ والتصحيح كلاهما مرئيين.
 */
export const updateCustomerSchema = createCustomerSchema
  .omit({ openingBalance: true })
  .partial();
export type UpdateCustomerRequest = z.infer<typeof updateCustomerSchema>;

// ── الاستعلام ───────────────────────────────────────────────────────────────

export const customerSortSchema = z.enum([
  'code',
  'name',
  'createdAt',
  'balance',
  'lastOrderAt',
]);

export const customerListQuerySchema = paginationQuerySchema.extend({
  /** بحث في الاسم أو الرقم أو الهاتف أو الشركة. */
  search: z.string().trim().max(120).optional(),
  status: customerStatusSchema.optional(),
  city: z.string().trim().max(80).optional(),
  tag: z.string().trim().max(32).optional(),

  /** فلترة حسب حالة الحساب — تعمل على الرصيد المشتق. */
  accountState: accountStateSchema.optional(),
  /** الزبائن المتجاوزون لحد الائتمان فقط. */
  overCreditLimit: z.coerce.boolean().optional(),

  includeArchived: z.coerce.boolean().default(false),

  sortBy: customerSortSchema.default('createdAt'),
  sortOrder: sortOrderSchema,
});
export type CustomerListQuery = z.infer<typeof customerListQuerySchema>;

/** إحصاءات رأس شاشة الزبائن. */
export const customerStatsSchema = z.object({
  total: z.number().int(),
  active: z.number().int(),
  withDebt: z.number().int(),
  totalDebt: nonNegativeMoneySchema,
  overCreditLimit: z.number().int(),
});
export type CustomerStats = z.infer<typeof customerStatsSchema>;
