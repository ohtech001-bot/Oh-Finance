import { z } from 'zod';
import { ALL_PERMISSIONS, PLATFORM_ROLES, TENANT_ROLES } from '@oh/config';
import { emailSchema, localeSchema, uuidSchema } from './common.js';

/**
 * عقود المصادقة.
 *
 * ⚠️ لاحظ ما **لا** يوجد هنا: لا `tenantId` في أي طلب.
 *    المستأجر يُستخرج من رمز الجلسة الموقّع على الخادم حصرًا.
 *    قبول tenantId من العميل = السماح له باختيار المحل الذي يقرأ بياناته.
 */

// ── كلمة المرور ──────────────────────────────────────────────────────────────
/**
 * سياسة كلمة المرور: 12 حرفًا كحد أدنى.
 *
 * فضّلنا الطول على تعقيد الرموز (شرطة، رقم، رمز خاص): NIST SP 800-63B
 * تنصح صراحةً بترك قواعد التعقيد لأنها تدفع المستخدمين لأنماط متوقعة
 * مثل "Password1!" — الطول أقوى فعليًا ضد التخمين.
 */
export const passwordSchema = z
  .string()
  .min(12, 'كلمة المرور يجب أن تكون 12 حرفًا على الأقل.')
  .max(128, 'كلمة المرور طويلة جدًا.');

// ── تسجيل الدخول ─────────────────────────────────────────────────────────────
export const loginRequestSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'كلمة المرور مطلوبة.'),
  /** رمز TOTP — يُرسل في محاولة ثانية بعد TWO_FACTOR_REQUIRED. */
  totpCode: z
    .string()
    .regex(/^\d{6}$/, 'رمز التحقق يتكوّن من 6 أرقام.')
    .optional(),
  rememberMe: z.boolean().default(false),
});
export type LoginRequest = z.infer<typeof loginRequestSchema>;

export const roleSchema = z.enum([...PLATFORM_ROLES, ...TENANT_ROLES] as [string, ...string[]]);
export const permissionSchema = z.enum(ALL_PERMISSIONS as [string, ...string[]]);

/** المستخدم الحالي — ما تعرفه الواجهة عن الجلسة. */
export const sessionUserSchema = z.object({
  id: uuidSchema,
  email: emailSchema,
  name: z.string(),
  avatarUrl: z.string().url().nullable(),
  role: roleSchema,
  permissions: z.array(permissionSchema),
  locale: localeSchema,
  isSuperAdmin: z.boolean(),
  supportMode: z.boolean().default(false),
  mustChangePassword: z.boolean(),
  twoFactorEnabled: z.boolean(),
  /** null للمدير العام — لا ينتمي إلى أي مستأجر. */
  tenant: z
    .object({
      id: uuidSchema,
      name: z.string(),
      slug: z.string(),
      status: z.enum(['ACTIVE', 'TRIAL', 'SUSPENDED', 'CANCELLED']),
    })
    .nullable(),
  /** المحل النشط ضمن المستأجر (قد يملك المستأجر عدة محلات). */
  store: z
    .object({
      id: uuidSchema,
      code: z.string(),
      name: z.string(),
      currency: z.string(),
      logoUrl: z.string().nullable(),
    })
    .nullable(),
});
export type SessionUser = z.infer<typeof sessionUserSchema>;

/**
 * رد تسجيل الدخول.
 *
 * ⚠️ لا يحتوي على أي رمز. رموز الوصول والتجديد تُرسل في كوكيز HttpOnly
 *    لا يستطيع JavaScript قراءتها — فحتى ثغرة XSS لا تستطيع سرقتها.
 *    `csrfToken` وحده مقروء، وهو غير سرّي بطبيعته (انظر ADR-0007).
 */
export const loginResponseSchema = z.object({
  user: sessionUserSchema,
  csrfToken: z.string(),
});
export type LoginResponse = z.infer<typeof loginResponseSchema>;

export const twoFactorRequiredSchema = z.object({
  requiresTwoFactor: z.literal(true),
});

// ── استعادة كلمة المرور ──────────────────────────────────────────────────────
export const forgotPasswordRequestSchema = z.object({
  email: emailSchema,
});
export type ForgotPasswordRequest = z.infer<typeof forgotPasswordRequestSchema>;

/**
 * الرد **دائمًا** ناجح ومطابق — سواء وُجد البريد أم لا.
 *
 * لو أعدنا 404 عند عدم وجود البريد، لصار هذا المسار أداة مجانية لتعداد
 * المستخدمين (user enumeration): يجرّب المهاجم قائمة بريد ويعرف من مسجّل
 * عندنا. الرد الموحّد يغلق هذا الباب.
 * (وحتى التوقيت يجب أن يتماثل — نُنفّذ ذلك في الخادم.)
 */
export const forgotPasswordResponseSchema = z.object({
  message: z.string(),
});

export const resetPasswordRequestSchema = z
  .object({
    token: z.string().min(1),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'كلمتا المرور غير متطابقتين.',
    path: ['confirmPassword'],
  });
export type ResetPasswordRequest = z.infer<typeof resetPasswordRequestSchema>;

export const changePasswordRequestSchema = z
  .object({
    currentPassword: z.string().min(1, 'كلمة المرور الحالية مطلوبة.'),
    newPassword: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: 'كلمتا المرور غير متطابقتين.',
    path: ['confirmPassword'],
  })
  .refine((d) => d.currentPassword !== d.newPassword, {
    message: 'كلمة المرور الجديدة يجب أن تختلف عن الحالية.',
    path: ['newPassword'],
  });
export type ChangePasswordRequest = z.infer<typeof changePasswordRequestSchema>;

// ── الجلسات ──────────────────────────────────────────────────────────────────
export const sessionSchema = z.object({
  id: uuidSchema,
  userAgent: z.string().nullable(),
  ipAddress: z.string().nullable(),
  createdAt: z.string(),
  lastUsedAt: z.string().nullable(),
  expiresAt: z.string(),
  isCurrent: z.boolean(),
});
export type Session = z.infer<typeof sessionSchema>;
