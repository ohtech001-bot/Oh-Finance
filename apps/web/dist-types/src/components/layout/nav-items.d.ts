import { type LucideIcon } from 'lucide-react';
import { type Permission } from '@oh/config';
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
export declare const TENANT_NAV: NavItem[];
/** عناصر لوحة المدير العام. */
export declare const PLATFORM_NAV: NavItem[];
/** عناصر شريط التبويب السفلي على الموبايل (5 كحد أقصى + زر عائم). */
export declare function mobileNavItems(items: NavItem[]): NavItem[];
//# sourceMappingURL=nav-items.d.ts.map