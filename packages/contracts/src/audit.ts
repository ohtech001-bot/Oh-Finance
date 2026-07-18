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

  // ── المرحلة 2: النواة المالية ──
  CUSTOMER_CREATED: 'customer.created',
  CUSTOMER_UPDATED: 'customer.updated',
  CUSTOMER_ARCHIVED: 'customer.archived',

  ORDER_CREATED: 'order.created',
  ORDER_UPDATED: 'order.updated',
  ORDER_CONFIRMED: 'order.confirmed',
  ORDER_CANCELLED: 'order.cancelled',
  ORDER_CREDIT_LIMIT_OVERRIDDEN: 'order.credit_limit_overridden',
  ORDER_DUPLICATED: 'order.duplicated',
  ORDER_DELETED: 'order.deleted',
  ORDER_ARCHIVED: 'order.archived',
  ORDER_REVERTED_DRAFT: 'order.reverted_draft',

  PAYMENT_CREATED: 'payment.created',
  PAYMENT_REVERSED: 'payment.reversed',

  LEDGER_ADJUSTMENT: 'ledger.adjustment',
  LEDGER_ENTRY_REVERSED: 'ledger.entry_reversed',
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

  'customer.created': 'إضافة زبون',
  'customer.updated': 'تعديل زبون',
  'customer.archived': 'أرشفة زبون',

  'order.created': 'إنشاء طلب',
  'order.updated': 'تعديل طلب',
  'order.confirmed': 'تأكيد طلب',
  'order.cancelled': 'إلغاء طلب',
  'order.credit_limit_overridden': '⚠ تجاوز حد الائتمان',
  'order.duplicated': 'نسخ طلب',
  'order.deleted': 'حذف مسودة',
  'order.archived': 'أرشفة طلب',
  'order.reverted_draft': 'إرجاع إلى مسودة',

  'payment.created': 'تسجيل دفعة',
  'payment.reversed': '⚠ عكس دفعة',

  'ledger.adjustment': '⚠ قيد تسوية يدوي',
  'ledger.entry_reversed': '⚠ عكس قيد محاسبي',
};
