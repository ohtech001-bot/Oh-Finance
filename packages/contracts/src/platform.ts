import { z } from 'zod';
import {
  currencySchema,
  emailSchema,
  isoDateSchema,
  localeSchema,
  nonNegativeMoneySchema,
  paginationQuerySchema,
  phoneSchema,
  sortOrderSchema,
  uuidSchema,
} from './common.js';
import { passwordSchema } from './auth.js';

/**
 * عقود لوحة المدير العام: المحلات، الباقات، الاشتراكات.
 *
 * هذه هي المسارات الوحيدة المستثناة من قاعدة «لا tenantId من العميل» —
 * وهو استثناء صريح ومقصود: المدير العام يدير المستأجرين، فلا بد أن يسمّيهم.
 * لكنه محروس بـ `SuperAdminGuard`، ولا يمنحه أي وصول إلى بيانات أعمالهم
 * (زبائن، طلبات، حركات). انظر ADR-0001.
 */

// ── الباقة ───────────────────────────────────────────────────────────────────
export const planSchema = z.object({
  id: uuidSchema,
  code: z.string(),
  nameAr: z.string(),
  nameHe: z.string(),
  nameEn: z.string(),
  priceMonthly: nonNegativeMoneySchema,
  currency: currencySchema,
  maxStores: z.number().int(),
  maxUsers: z.number().int(),
  maxCustomers: z.number().int(),
  maxOrdersPerMonth: z.number().int(),
  maxStorageMb: z.number().int(),
  isActive: z.boolean(),
  createdAt: z.string(),
});
export type Plan = z.infer<typeof planSchema>;

export const createPlanSchema = z.object({
  code: z
    .string()
    .trim()
    .min(2)
    .max(32)
    .regex(/^[a-z0-9_-]+$/, 'الرمز: حروف إنجليزية صغيرة وأرقام وشرطات فقط.'),
  nameAr: z.string().trim().min(1).max(80),
  nameHe: z.string().trim().min(1).max(80),
  nameEn: z.string().trim().min(1).max(80),
  priceMonthly: nonNegativeMoneySchema,
  currency: currencySchema.default('ILS'),
  maxStores: z.number().int().min(1).max(1000),
  maxUsers: z.number().int().min(1).max(10_000),
  maxCustomers: z.number().int().min(1).max(1_000_000),
  maxOrdersPerMonth: z.number().int().min(1).max(1_000_000),
  maxStorageMb: z.number().int().min(1).max(1_000_000),
  isActive: z.boolean().default(true),
});
export type CreatePlanRequest = z.infer<typeof createPlanSchema>;

export const updatePlanSchema = createPlanSchema.partial().omit({ code: true });
export type UpdatePlanRequest = z.infer<typeof updatePlanSchema>;

// ── المستأجر (الحساب) والمحل ─────────────────────────────────────────────────
export const tenantStatusSchema = z.enum(['ACTIVE', 'TRIAL', 'SUSPENDED', 'CANCELLED']);
export type TenantStatus = z.infer<typeof tenantStatusSchema>;

export const TENANT_STATUS_LABELS: Record<TenantStatus, string> = {
  ACTIVE: 'نشط',
  TRIAL: 'تجريبي',
  SUSPENDED: 'موقوف',
  CANCELLED: 'ملغى',
};

export const storeSummarySchema = z.object({
  id: uuidSchema,
  code: z.string(),
  name: z.string(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  address: z.string().nullable(),
  city: z.string().nullable(),
  logoUrl: z.string().nullable(),
  websiteUrl: z.string().nullable(),
  currency: currencySchema,
  isActive: z.boolean(),
  branchCount: z.number().int(),
});
export type StoreSummary = z.infer<typeof storeSummarySchema>;

export const tenantSchema = z.object({
  id: uuidSchema,
  slug: z.string(),
  name: z.string(),
  status: tenantStatusSchema,
  locale: localeSchema,
  currency: currencySchema,
  timezone: z.string(),
  ownerEmail: emailSchema.nullable(),
  ownerName: z.string().nullable(),
  storeCount: z.number().int(),
  userCount: z.number().int(),
  planName: z.string().nullable(),
  subscriptionStatus: z.string().nullable(),
  subscriptionEndsAt: z.string().nullable(),
  createdAt: z.string(),
});
export type Tenant = z.infer<typeof tenantSchema>;

export const tenantDetailSchema = tenantSchema.extend({
  stores: z.array(storeSummarySchema),
});
export type TenantDetail = z.infer<typeof tenantDetailSchema>;

/**
 * إنشاء محل جديد من لوحة المدير العام (المتطلب 1).
 *
 * عملية واحدة ذرّية تُنشئ: المستأجر + المحل + الفرع الرئيسي + الأدوار
 * النظامية + مستخدم صاحب المحل + الاشتراك. كلها داخل معاملة واحدة:
 * فشل أي خطوة يُلغي الكل — لا مستأجر بلا صاحب، ولا اشتراك بلا محل.
 */
export const createTenantSchema = z
  .object({
    // المستأجر
    name: z.string().trim().min(2, 'اسم المحل مطلوب.').max(120),
    locale: localeSchema.default('ar'),
    currency: currencySchema.default('ILS'),
    timezone: z.string().default('Asia/Jerusalem'),

    // المحل الأول
    storePhone: phoneSchema.optional().or(z.literal('')),
    storeEmail: emailSchema.optional().or(z.literal('')),
    storeAddress: z.string().trim().max(240).optional().or(z.literal('')),
    storeCity: z.string().trim().max(80).optional().or(z.literal('')),
    websiteUrl: z.string().trim().url('رابط الموقع غير صحيح.').max(512).optional().or(z.literal('')),
    logoDataUrl: z
      .string()
      .max(7_000_000, 'حجم الشعار كبير جدًا.')
      .regex(/^data:image\/(png|jpeg|webp);base64,/, 'صيغة الشعار غير مدعومة.')
      .optional()
      .or(z.literal('')),

    // صاحب المحل
    ownerName: z.string().trim().min(2, 'اسم صاحب المحل مطلوب.').max(120),
    ownerEmail: emailSchema,
    ownerPassword: passwordSchema,
    ownerPhone: phoneSchema.optional().or(z.literal('')),

    // الاشتراك
    planId: uuidSchema,
    subscriptionStartDate: isoDateSchema,
    subscriptionEndDate: isoDateSchema,
    agreedMonthlyAmount: nonNegativeMoneySchema,
    paymentStatus: z.enum(['UNPAID', 'PARTIAL', 'PAID']).default('UNPAID'),
    paidAmount: nonNegativeMoneySchema.default('0.00'),
  })
  .superRefine((data, ctx) => {
    if (data.subscriptionEndDate <= data.subscriptionStartDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['subscriptionEndDate'],
        message: 'تاريخ النهاية يجب أن يكون بعد تاريخ البداية.',
      });
    }
    const agreed = Number(data.agreedMonthlyAmount);
    const paid = Number(data.paidAmount);
    const valid =
      (data.paymentStatus === 'UNPAID' && paid === 0) ||
      (data.paymentStatus === 'PAID' && paid === agreed) ||
      (data.paymentStatus === 'PARTIAL' && paid > 0 && paid < agreed);
    if (!valid)
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['paidAmount'],
        message: 'المبلغ المدفوع لا يطابق حالة السداد.',
      });
  });
export type CreateTenantRequest = z.infer<typeof createTenantSchema>;

export const updateTenantSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  status: tenantStatusSchema.optional(),
  locale: localeSchema.optional(),
  currency: currencySchema.optional(),
  timezone: z.string().optional(),
  storePhone: phoneSchema.optional().or(z.literal('')),
  storeEmail: emailSchema.optional().or(z.literal('')),
  storeAddress: z.string().trim().max(240).optional().or(z.literal('')),
  storeCity: z.string().trim().max(80).optional().or(z.literal('')),
  websiteUrl: z.string().trim().url('رابط الموقع غير صحيح.').max(512).optional().or(z.literal('')),
  logoDataUrl: z
    .string()
    .max(7_000_000, 'حجم الشعار كبير جدًا.')
    .regex(/^data:image\/(png|jpeg|webp);base64,/, 'صيغة الشعار غير مدعومة.')
    .optional()
    .or(z.literal('')),
});
export type UpdateTenantRequest = z.infer<typeof updateTenantSchema>;

export const tenantListQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().max(120).optional(),
  status: tenantStatusSchema.optional(),
  planId: uuidSchema.optional(),
  sortBy: z.enum(['name', 'createdAt', 'status']).default('createdAt'),
  sortOrder: sortOrderSchema,
});
export type TenantListQuery = z.infer<typeof tenantListQuerySchema>;

// ── الاشتراك ─────────────────────────────────────────────────────────────────
export const subscriptionStatusSchema = z.enum([
  'TRIALING',
  'ACTIVE',
  'PAST_DUE',
  'CANCELLED',
  'EXPIRED',
]);
export type SubscriptionStatus = z.infer<typeof subscriptionStatusSchema>;

export const SUBSCRIPTION_STATUS_LABELS: Record<SubscriptionStatus, string> = {
  TRIALING: 'تجريبي',
  ACTIVE: 'نشط',
  PAST_DUE: 'متأخر السداد',
  CANCELLED: 'ملغى',
  EXPIRED: 'منتهٍ',
};

/** عدّادات «استخدام الباقة» في شاشة إدارة الاشتراك. */
export const subscriptionUsageSchema = z.object({
  stores: z.object({ used: z.number().int(), limit: z.number().int() }),
  users: z.object({ used: z.number().int(), limit: z.number().int() }),
  customers: z.object({ used: z.number().int(), limit: z.number().int() }),
  ordersThisMonth: z.object({ used: z.number().int(), limit: z.number().int() }),
  storageMb: z.object({ used: z.number().int(), limit: z.number().int() }),
});
export type SubscriptionUsage = z.infer<typeof subscriptionUsageSchema>;

export const subscriptionSchema = z.object({
  id: uuidSchema,
  tenantId: uuidSchema,
  tenantName: z.string(),
  contactPhone: z.string().nullable(),
  plan: planSchema,
  status: subscriptionStatusSchema,
  startedAt: z.string(),
  currentPeriodStart: z.string(),
  currentPeriodEnd: z.string(),
  trialEndsAt: z.string().nullable(),
  cancelledAt: z.string().nullable(),
  agreedMonthlyAmount: nonNegativeMoneySchema,
  paidAmount: nonNegativeMoneySchema,
  remainingAmount: nonNegativeMoneySchema,
  paymentStatus: z.enum(['UNPAID', 'PARTIAL', 'PAID']),
  usage: subscriptionUsageSchema,
});
export type Subscription = z.infer<typeof subscriptionSchema>;

export const changeSubscriptionPlanSchema = z.object({
  planId: uuidSchema,
  /** يسري فورًا أم في بداية الدورة التالية. */
  effective: z.enum(['IMMEDIATE', 'NEXT_PERIOD']).default('NEXT_PERIOD'),
});
export type ChangeSubscriptionPlanRequest = z.infer<typeof changeSubscriptionPlanSchema>;

export const subscriptionListQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().max(120).optional(),
  paymentStatus: z.enum(['UNPAID', 'PARTIAL', 'PAID']).optional(),
});
export type SubscriptionListQuery = z.infer<typeof subscriptionListQuerySchema>;

export const updateSubscriptionBillingSchema = z
  .object({
    currentPeriodStart: isoDateSchema,
    currentPeriodEnd: isoDateSchema,
    agreedMonthlyAmount: nonNegativeMoneySchema,
    paymentStatus: z.enum(['UNPAID', 'PARTIAL', 'PAID']),
    paidAmount: nonNegativeMoneySchema,
  })
  .superRefine((data, ctx) => {
    if (data.currentPeriodEnd <= data.currentPeriodStart) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['currentPeriodEnd'],
        message: 'تاريخ النهاية يجب أن يكون بعد تاريخ البداية.',
      });
    }
    const agreed = Number(data.agreedMonthlyAmount);
    const paid = Number(data.paidAmount);
    const valid =
      (data.paymentStatus === 'UNPAID' && paid === 0) ||
      (data.paymentStatus === 'PAID' && paid === agreed) ||
      (data.paymentStatus === 'PARTIAL' && paid > 0 && paid < agreed);
    if (!valid)
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['paidAmount'],
        message: 'المبلغ المدفوع لا يطابق حالة السداد.',
      });
  });
export type UpdateSubscriptionBillingRequest = z.infer<typeof updateSubscriptionBillingSchema>;

export const platformRoleSchema = z.enum(['GENERAL_MANAGER', 'MANAGER', 'EMPLOYEE']);
export type PlatformRole = z.infer<typeof platformRoleSchema>;

export const createPlatformStaffInviteSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: emailSchema,
  phone: z.string().regex(/^05\d{8}$/, 'رقم الهاتف يجب أن يتكون من 10 أرقام ويبدأ بـ05.'),
  dateOfBirth: isoDateSchema,
  identityNumber: z.string().trim().min(1).max(32),
  jobTitle: z.string().trim().min(2).max(80),
  platformRole: platformRoleSchema,
  locale: localeSchema.default('ar'),
});
export type CreatePlatformStaffInviteRequest = z.infer<typeof createPlatformStaffInviteSchema>;

export const updatePlatformStaffSchema = createPlatformStaffInviteSchema;
export type UpdatePlatformStaffRequest = z.infer<typeof updatePlatformStaffSchema>;

export const setPlatformStaffStatusSchema = z.object({
  status: z.enum(['ACTIVE', 'INACTIVE']),
});
export type SetPlatformStaffStatusRequest = z.infer<typeof setPlatformStaffStatusSchema>;

export const verifyPlatformStaffInviteSchema = z.object({
  inviteId: uuidSchema,
  code: z.string().regex(/^\d{6}$/, 'رمز التحقق يتكون من 6 أرقام.'),
});
export type VerifyPlatformStaffInviteRequest = z.infer<typeof verifyPlatformStaffInviteSchema>;

export const platformStaffSchema = z.object({
  id: uuidSchema,
  name: z.string(),
  email: emailSchema,
  phone: z.string(),
  dateOfBirth: z.string(),
  identityNumber: z.string(),
  jobTitle: z.string(),
  locale: localeSchema,
  platformRole: z.enum(['GENERAL_MANAGER', 'MANAGER', 'EMPLOYEE']),
  status: z.enum(['ACTIVE', 'INACTIVE']),
  emailVerifiedAt: z.string().nullable(),
  mustChangePassword: z.boolean(),
  createdAt: z.string(),
});
export type PlatformStaff = z.infer<typeof platformStaffSchema>;

export const setTenantStatusSchema = z.object({
  status: tenantStatusSchema,
  /** سبب إلزامي عند الإيقاف — يُسجَّل في سجل التدقيق. */
  reason: z.string().trim().min(3, 'السبب مطلوب ويُسجَّل في سجل التدقيق.').max(500),
});
export type SetTenantStatusRequest = z.infer<typeof setTenantStatusSchema>;

// ── لوحة المدير العام ────────────────────────────────────────────────────────
export const platformStatsSchema = z.object({
  totalTenants: z.number().int(),
  activeTenants: z.number().int(),
  trialTenants: z.number().int(),
  suspendedTenants: z.number().int(),
  totalUsers: z.number().int(),
  mrr: nonNegativeMoneySchema,
  currency: currencySchema,
  newTenantsThisMonth: z.number().int(),
});
export type PlatformStats = z.infer<typeof platformStatsSchema>;

export const platformDateRangeSchema = z.object({
  from: isoDateSchema.optional(),
  to: isoDateSchema.optional(),
});
