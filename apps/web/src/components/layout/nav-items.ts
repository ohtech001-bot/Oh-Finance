import {
  BarChart3,
  CreditCard,
  FileText,
  History,
  LayoutDashboard,
  ListOrdered,
  MessageCircle,
  Package,
  Settings,
  ShoppingBag,
  Users,
  Wallet,
  Building2,
  Layers,
  UserCog,
  type LucideIcon,
} from 'lucide-react';
import { PERMISSIONS, type Permission } from '@oh/config';

export interface NavItem {
  to: string;
  labelKey: string;
  icon: LucideIcon;
  /** الصلاحية اللازمة لرؤية العنصر — إخفاء تجميلي، والحماية على الخادم. */
  permission?: Permission;
  /** المرحلة التي تُفعّل هذه الشاشة — تُعرض كشارة «قريبًا». */
  phase?: string;
  /** يظهر في شريط التبويب السفلي على الموبايل. */
  mobile?: boolean;
  children?: NavItem[];
}

/**
 * عناصر الشريط الجانبي — بالترتيب الظاهر في المرجع البصري.
 *
 * ملاحظة: المرجع يعرض «لوحة التحكم» و«الرئيسية» كعنصرين. هذا تكرار في
 * الموك‌أب (كلاهما يشير لنفس الشاشة). أبقينا عنصرًا واحدًا — موثّق في
 * docs/00-architecture-plan.md (تناقضات المرجع البصري).
 */
export const TENANT_NAV: NavItem[] = [
  {
    to: '/',
    labelKey: 'nav.dashboard',
    icon: LayoutDashboard,
    mobile: true,
  },
  {
    to: '/customers',
    labelKey: 'nav.customers',
    icon: Users,
    permission: PERMISSIONS.CUSTOMERS_READ,
    phase: 'المرحلة 4',
    mobile: true,
  },
  {
    to: '/activity',
    labelKey: 'nav.activity',
    icon: History,
    permission: PERMISSIONS.ACTIVITY_READ,
  },
  {
    to: '/orders',
    labelKey: 'nav.orders',
    icon: ShoppingBag,
    permission: PERMISSIONS.ORDERS_READ,
    phase: 'المرحلة 4',
  },
  {
    to: '/payments',
    labelKey: 'nav.payments',
    icon: Wallet,
    permission: PERMISSIONS.PAYMENTS_READ,
    phase: 'المرحلة 5',
  },
  {
    to: '/ledger',
    labelKey: 'nav.ledger',
    icon: ListOrdered,
    permission: PERMISSIONS.LEDGER_READ,
    phase: 'المرحلة 5',
  },
  {
    to: '/reports',
    labelKey: 'nav.reports',
    icon: BarChart3,
    permission: PERMISSIONS.REPORTS_READ,
    phase: 'المرحلة 6',
    mobile: true,
  },
  {
    to: '/documents',
    labelKey: 'nav.documents',
    icon: FileText,
    permission: PERMISSIONS.DOCUMENTS_PRINT,
    phase: 'المرحلة 6',
  },
  {
    to: '/messages',
    labelKey: 'nav.messages',
    icon: MessageCircle,
    permission: PERMISSIONS.MESSAGES_READ,
    phase: 'المرحلة 7',
  },
  {
    to: '/products',
    labelKey: 'nav.products',
    icon: Package,
    phase: 'المرحلة 4',
  },
  {
    to: '/employees',
    labelKey: 'nav.employees',
    icon: Users,
    permission: PERMISSIONS.EMPLOYEES_READ,
    phase: 'المرحلة 8',
  },
  {
    to: '/settings',
    labelKey: 'nav.settings',
    icon: Settings,
    permission: PERMISSIONS.SETTINGS_READ,
    phase: 'المرحلة 8',
  },
  {
    to: '/subscription',
    labelKey: 'nav.subscription',
    icon: CreditCard,
    permission: PERMISSIONS.SUBSCRIPTION_READ,
  },
];

/** عناصر لوحة المدير العام. */
export const PLATFORM_NAV: NavItem[] = [
  { to: '/platform', labelKey: 'nav.platform', icon: LayoutDashboard, mobile: true },
  {
    to: '/platform/tenants',
    labelKey: 'nav.tenants',
    icon: Building2,
    permission: PERMISSIONS.PLATFORM_TENANTS_READ,
    mobile: true,
    children: [
      {
        to: '/platform/tenants',
        labelKey: 'platform.tenantsList',
        icon: Building2,
        permission: PERMISSIONS.PLATFORM_TENANTS_READ,
      },
      {
        to: '/platform/subscriptions',
        labelKey: 'nav.subscriptions',
        icon: CreditCard,
        permission: PERMISSIONS.PLATFORM_SUBSCRIPTIONS_READ,
      },
    ],
  },
  {
    to: '/platform/staff',
    labelKey: 'nav.platformStaff',
    icon: UserCog,
    permission: PERMISSIONS.PLATFORM_STAFF_READ,
  },
  {
    to: '/platform/plans',
    labelKey: 'nav.plans',
    icon: Layers,
    permission: PERMISSIONS.PLATFORM_PLANS_READ,
    mobile: true,
  },
];

/** عناصر شريط التبويب السفلي على الموبايل (5 كحد أقصى + زر عائم). */
export function mobileNavItems(items: NavItem[]): NavItem[] {
  return items.filter((item) => item.mobile).slice(0, 4);
}
