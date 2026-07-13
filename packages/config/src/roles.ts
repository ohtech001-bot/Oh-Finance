import { PERMISSIONS, PLATFORM_PERMISSIONS, type Permission } from './permissions.js';

/**
 * الأدوار النظامية وصلاحياتها الافتراضية.
 *
 * تُزرع في جدول `roles` لكل مستأجر عند إنشائه (`isSystem = true`).
 * يمكن لصاحب المحل منح/سحب صلاحيات فردية فوق الدور عبر `user_permissions`،
 * لكن لا يمكنه حذف الأدوار النظامية ولا رفع نفسه فوق OWNER.
 */

export const ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  OWNER: 'OWNER',
  MANAGER: 'MANAGER',
  CASHIER: 'CASHIER',
  VIEWER: 'VIEWER',
} as const;

export type RoleName = (typeof ROLES)[keyof typeof ROLES];

/** أدوار داخل المحل (المدير العام ليس منها). */
export const TENANT_ROLES: RoleName[] = [
  ROLES.OWNER,
  ROLES.MANAGER,
  ROLES.CASHIER,
  ROLES.VIEWER,
];

const P = PERMISSIONS;

/**
 * صاحب المحل — كل صلاحيات المحل، ولا شيء من صلاحيات المنصة.
 * العمليات المالية العكسية (عكس دفعة، قيد تصحيح) محصورة به وحده:
 * هي الأبواب الوحيدة لتغيير رصيد مُثبَّت.
 */
const OWNER_PERMISSIONS: Permission[] = [
  P.CUSTOMERS_READ, P.CUSTOMERS_WRITE, P.CUSTOMERS_DELETE,
  P.ORDERS_READ, P.ORDERS_CREATE, P.ORDERS_UPDATE, P.ORDERS_CONFIRM, P.ORDERS_CANCEL,
  P.PAYMENTS_READ, P.PAYMENTS_CREATE, P.PAYMENTS_REVERSE,
  P.LEDGER_READ, P.LEDGER_ADJUST,
  P.REPORTS_READ, P.REPORTS_EXPORT,
  P.DOCUMENTS_PRINT,
  P.MESSAGES_READ, P.MESSAGES_SEND,
  P.EMPLOYEES_READ, P.EMPLOYEES_MANAGE,
  P.SETTINGS_READ, P.SETTINGS_MANAGE,
  P.SUBSCRIPTION_READ, P.SUBSCRIPTION_MANAGE,
  P.AUDIT_READ,
];

/** مدير — تشغيل يومي كامل، بلا عمليات مالية عكسية ولا إدارة موظفين/إعدادات. */
const MANAGER_PERMISSIONS: Permission[] = [
  P.CUSTOMERS_READ, P.CUSTOMERS_WRITE,
  P.ORDERS_READ, P.ORDERS_CREATE, P.ORDERS_UPDATE, P.ORDERS_CONFIRM, P.ORDERS_CANCEL,
  P.PAYMENTS_READ, P.PAYMENTS_CREATE,
  P.LEDGER_READ,
  P.REPORTS_READ, P.REPORTS_EXPORT,
  P.DOCUMENTS_PRINT,
  P.MESSAGES_READ, P.MESSAGES_SEND,
  P.EMPLOYEES_READ,
  P.SETTINGS_READ,
  P.SUBSCRIPTION_READ,
  P.AUDIT_READ,
];

/** كاشير — يبيع ويقبض، ولا يلغي ولا يعكس ولا يرى التقارير. */
const CASHIER_PERMISSIONS: Permission[] = [
  P.CUSTOMERS_READ, P.CUSTOMERS_WRITE,
  P.ORDERS_READ, P.ORDERS_CREATE, P.ORDERS_UPDATE, P.ORDERS_CONFIRM,
  P.PAYMENTS_READ, P.PAYMENTS_CREATE,
  P.LEDGER_READ,
  P.DOCUMENTS_PRINT,
  P.MESSAGES_READ, P.MESSAGES_SEND,
];

/** مُطّلع — قراءة فقط. */
const VIEWER_PERMISSIONS: Permission[] = [
  P.CUSTOMERS_READ,
  P.ORDERS_READ,
  P.PAYMENTS_READ,
  P.LEDGER_READ,
  P.REPORTS_READ,
  P.DOCUMENTS_PRINT,
];

export const ROLE_PERMISSIONS: Record<RoleName, Permission[]> = {
  SUPER_ADMIN: [...PLATFORM_PERMISSIONS],
  OWNER: OWNER_PERMISSIONS,
  MANAGER: MANAGER_PERMISSIONS,
  CASHIER: CASHIER_PERMISSIONS,
  VIEWER: VIEWER_PERMISSIONS,
};

export const ROLE_LABELS: Record<RoleName, { ar: string; he: string; en: string }> = {
  SUPER_ADMIN: { ar: 'المدير العام', he: 'מנהל ראשי', en: 'Super Admin' },
  OWNER: { ar: 'صاحب المحل', he: 'בעל החנות', en: 'Owner' },
  MANAGER: { ar: 'مدير', he: 'מנהל', en: 'Manager' },
  CASHIER: { ar: 'كاشير', he: 'קופאי', en: 'Cashier' },
  VIEWER: { ar: 'مُطّلع', he: 'צופה', en: 'Viewer' },
};

export const ROLE_DESCRIPTIONS: Record<RoleName, string> = {
  SUPER_ADMIN: 'يدير المحلات والباقات والاشتراكات. لا يصل إلى بيانات أعمال أي محل.',
  OWNER: 'صلاحيات كاملة داخل المحل، بما فيها عكس الدفعات وقيود التصحيح.',
  MANAGER: 'تشغيل كامل بلا عمليات مالية عكسية ولا إدارة موظفين أو إعدادات.',
  CASHIER: 'إنشاء الطلبات وتسجيل الدفعات. لا يلغي ولا يعكس ولا يرى التقارير.',
  VIEWER: 'قراءة فقط.',
};

export function permissionsForRole(role: RoleName): Permission[] {
  return ROLE_PERMISSIONS[role] ?? [];
}

/** هل هذا الدور دور منصة (خارج أي مستأجر)؟ */
export function isPlatformRole(role: RoleName): boolean {
  return role === ROLES.SUPER_ADMIN;
}
