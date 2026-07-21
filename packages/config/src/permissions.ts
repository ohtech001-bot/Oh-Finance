/**
 * كتالوج الصلاحيات — المصدر الوحيد للحقيقة.
 *
 * الخادم يفرضها في `PermissionsGuard`، والواجهة تُخفي/تُعطّل بها العناصر.
 * كونها في حزمة مشتركة يعني: إضافة صلاحية جديدة تظهر فورًا على الطرفين،
 * ويستحيل أن تتحقق الواجهة من صلاحية لا يعرفها الخادم (أو العكس).
 *
 * ⚠️ إخفاء زر في الواجهة ليس حماية. الحماية الحقيقية على الخادم دائمًا.
 *    الواجهة تستخدم هذا لتحسين التجربة فقط.
 */

export const PERMISSIONS = {
  // الزبائن
  CUSTOMERS_READ: 'customers.read',
  CUSTOMERS_WRITE: 'customers.write',
  CUSTOMERS_DELETE: 'customers.delete',

  // الطلبات
  ORDERS_READ: 'orders.read',
  ORDERS_CREATE: 'orders.create',
  ORDERS_UPDATE: 'orders.update',
  ORDERS_CONFIRM: 'orders.confirm',
  ORDERS_CANCEL: 'orders.cancel',

  // الدفعات
  PAYMENTS_READ: 'payments.read',
  PAYMENTS_CREATE: 'payments.create',
  PAYMENTS_REVERSE: 'payments.reverse',

  // دفتر الحركات
  LEDGER_READ: 'ledger.read',
  LEDGER_ADJUST: 'ledger.adjust',

  // التقارير
  REPORTS_READ: 'reports.read',
  REPORTS_EXPORT: 'reports.export',

  // المستندات
  DOCUMENTS_PRINT: 'documents.print',

  // الرسائل
  MESSAGES_READ: 'messages.read',
  MESSAGES_SEND: 'messages.send',

  // الموظفون
  EMPLOYEES_READ: 'employees.read',
  EMPLOYEES_MANAGE: 'employees.manage',

  // الإعدادات
  SETTINGS_READ: 'settings.read',
  SETTINGS_MANAGE: 'settings.manage',

  // الاشتراك
  SUBSCRIPTION_READ: 'subscription.read',
  SUBSCRIPTION_MANAGE: 'subscription.manage',

  // التدقيق
  AUDIT_READ: 'audit.read',

  // موجز نشاط المحل (store-wide) — صلاحية إشراف مستقلة عن قراءة الزبائن.
  ACTIVITY_READ: 'activity.read',

  // لوحة التحكم — بوابة فتح اللوحة (الصفحة الرئيسية). الأقسام تُرشَّح بصلاحيات
  // القراءة التفصيلية (طلبات/دفعات/حركات) فوق هذه البوابة.
  DASHBOARD_READ: 'dashboard.read',

  // ── المنصة (المدير العام حصرًا) ──────────────────────────────────────────
  PLATFORM_TENANTS_READ: 'platform.tenants.read',
  PLATFORM_TENANTS_MANAGE: 'platform.tenants.manage',
  PLATFORM_PLANS_READ: 'platform.plans.read',
  PLATFORM_PLANS_MANAGE: 'platform.plans.manage',
  PLATFORM_SUBSCRIPTIONS_READ: 'platform.subscriptions.read',
  PLATFORM_SUBSCRIPTIONS_MANAGE: 'platform.subscriptions.manage',
  PLATFORM_AUDIT_READ: 'platform.audit.read',
  PLATFORM_STAFF_READ: 'platform.staff.read',
  PLATFORM_STAFF_MANAGE: 'platform.staff.manage',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ALL_PERMISSIONS = Object.values(PERMISSIONS) as Permission[];

/** صلاحيات المنصة — لا تُمنح أبدًا لمستخدم داخل محل. */
export const PLATFORM_PERMISSIONS = ALL_PERMISSIONS.filter((p) =>
  p.startsWith('platform.'),
) as Permission[];

/** صلاحيات المحل — لا تُمنح أبدًا للمدير العام (لا يرى بيانات الأعمال). */
export const TENANT_PERMISSIONS = ALL_PERMISSIONS.filter(
  (p) => !p.startsWith('platform.'),
) as Permission[];

export function isPermission(value: unknown): value is Permission {
  return typeof value === 'string' && (ALL_PERMISSIONS as string[]).includes(value);
}

/** وصف عربي لكل صلاحية — يُستخدم في شاشة إدارة الموظفين. */
export const PERMISSION_LABELS: Record<Permission, string> = {
  'customers.read': 'عرض الزبائن',
  'customers.write': 'إضافة وتعديل الزبائن',
  'customers.delete': 'حذف الزبائن',
  'orders.read': 'عرض الطلبات',
  'orders.create': 'إنشاء طلب',
  'orders.update': 'تعديل مسودة أو عرض سعر',
  'orders.confirm': 'تأكيد الطلب (يولّد حركة مدينة)',
  'orders.cancel': 'إلغاء الطلب',
  'payments.read': 'عرض الدفعات',
  'payments.create': 'تسجيل دفعة',
  'payments.reverse': 'عكس دفعة (حسّاس)',
  'ledger.read': 'عرض الحساب والحركات',
  'ledger.adjust': 'قيود تصحيح وإغلاق دورة (حسّاس)',
  'reports.read': 'عرض التقارير',
  'reports.export': 'تصدير التقارير',
  'documents.print': 'الطباعة وكشوف الحساب',
  'messages.read': 'عرض الرسائل',
  'messages.send': 'إرسال رسائل للزبائن',
  'employees.read': 'عرض الموظفين',
  'employees.manage': 'إدارة الموظفين والصلاحيات',
  'settings.read': 'عرض الإعدادات',
  'settings.manage': 'تعديل الإعدادات',
  'subscription.read': 'عرض الاشتراك',
  'subscription.manage': 'إدارة الاشتراك',
  'audit.read': 'عرض سجل النشاط',
  'activity.read': 'عرض موجز نشاط المحل',
  'dashboard.read': 'فتح لوحة التحكم',
  'platform.tenants.read': 'عرض المحلات',
  'platform.tenants.manage': 'إدارة المحلات',
  'platform.plans.read': 'عرض الباقات',
  'platform.plans.manage': 'إدارة الباقات',
  'platform.subscriptions.read': 'عرض الاشتراكات',
  'platform.subscriptions.manage': 'إدارة الاشتراكات',
  'platform.audit.read': 'سجل تدقيق المنصة',
  'platform.staff.read': 'عرض مدراء وموظفي المنصة',
  'platform.staff.manage': 'إضافة وإدارة مدراء وموظفي المنصة',
};
