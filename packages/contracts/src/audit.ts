import { z } from 'zod';
import { paginationQuerySchema, uuidSchema } from './common.js';

/**
 * عقود سجل التدقيق (شاشة «سجل النشاط» في الإعدادات).
 *
 * السجل للقراءة فقط عبر الـAPI — لا يوجد endpoint للكتابة أو التعديل أو الحذف.
 * الكتابة تحدث داخل الخادم فقط، ضمن نفس معاملة العملية التي تُسجَّل.
 */

export const auditActionSchema = z.string().max(64);

export const auditLogSchema = z.object({
  id: uuidSchema,
  seq: z.string(), // BigInt يُنقل كنص — يتجاوز حدود Number
  action: auditActionSchema,
  entityType: z.string().nullable(),
  entityId: z.string().nullable(),
  actorId: uuidSchema.nullable(),
  actorName: z.string().nullable(),
  actorIp: z.string().nullable(),
  summary: z.string(),
  createdAt: z.string(),
});
export type AuditLog = z.infer<typeof auditLogSchema>;

export const auditListQuerySchema = paginationQuerySchema.extend({
  action: z.string().max(64).optional(),
  actorId: uuidSchema.optional(),
  entityType: z.string().max(64).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});
export type AuditListQuery = z.infer<typeof auditListQuerySchema>;

/**
 * نتيجة التحقق من سلامة سلسلة الهاش.
 *
 * كل قيد يحمل `hash = sha256(prevHash + payload)`. تعديل صف قديم يكسر
 * كل الهاشات التي بعده — وهذا الفحص يكشف أول موضع انكسار.
 * (انظر ADR-0005)
 */
export const auditVerifyResultSchema = z.object({
  valid: z.boolean(),
  entriesChecked: z.number().int(),
  firstBrokenSeq: z.string().nullable(),
  message: z.string(),
});
export type AuditVerifyResult = z.infer<typeof auditVerifyResultSchema>;

/** أفعال التدقيق المعروفة — تُستخدم لفلترة الشاشة وترجمة النصوص. */
export const AUDIT_ACTIONS = {
  AUTH_LOGIN: 'auth.login',
  AUTH_LOGIN_FAILED: 'auth.login_failed',
  AUTH_LOGOUT: 'auth.logout',
  AUTH_TOKEN_REUSE_DETECTED: 'auth.token_reuse_detected',
  AUTH_PASSWORD_CHANGED: 'auth.password_changed',
  AUTH_ACCOUNT_LOCKED: 'auth.account_locked',

  TENANT_CREATED: 'tenant.created',
  TENANT_UPDATED: 'tenant.updated',
  TENANT_STATUS_CHANGED: 'tenant.status_changed',

  PLAN_CREATED: 'plan.created',
  PLAN_UPDATED: 'plan.updated',

  SUBSCRIPTION_CREATED: 'subscription.created',
  SUBSCRIPTION_PLAN_CHANGED: 'subscription.plan_changed',

  USER_CREATED: 'user.created',
  USER_UPDATED: 'user.updated',
  USER_PERMISSIONS_CHANGED: 'user.permissions_changed',

  SETTINGS_UPDATED: 'settings.updated',
} as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];

export const AUDIT_ACTION_LABELS: Record<string, string> = {
  'auth.login': 'تسجيل دخول',
  'auth.login_failed': 'محاولة دخول فاشلة',
  'auth.logout': 'تسجيل خروج',
  'auth.token_reuse_detected': '⚠ كشف إعادة استخدام رمز تجديد',
  'auth.password_changed': 'تغيير كلمة المرور',
  'auth.account_locked': 'قفل حساب',
  'tenant.created': 'إنشاء محل',
  'tenant.updated': 'تعديل محل',
  'tenant.status_changed': 'تغيير حالة محل',
  'plan.created': 'إنشاء باقة',
  'plan.updated': 'تعديل باقة',
  'subscription.created': 'إنشاء اشتراك',
  'subscription.plan_changed': 'تغيير باقة',
  'user.created': 'إضافة مستخدم',
  'user.updated': 'تعديل مستخدم',
  'user.permissions_changed': 'تعديل صلاحيات',
  'settings.updated': 'تعديل إعدادات',
};
