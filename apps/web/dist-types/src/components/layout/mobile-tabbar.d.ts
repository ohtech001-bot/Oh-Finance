import { type NavItem } from './nav-items';
export interface MobileTabBarProps {
    items: NavItem[];
    onOpenMore: () => void;
    /** الزر العائم المركزي — «طلب جديد». يُفعَّل في المرحلة 4. */
    fab?: {
        label: string;
        onClick: () => void;
        disabled?: boolean;
    };
}
/**
 * شريط التبويب السفلي — مطابق لشاشات الموبايل في المرجع.
 *
 * التخطيط: عنصران · زر عائم أخضر مركزي · عنصران · «المزيد».
 *
 * `pb-[env(safe-area-inset-bottom)]` — بدونه يختفي الشريط خلف شريط الإيماءات
 * في iPhone. تفصيل صغير، لكن أثره أن أزرار التنقّل الأساسية تصير غير قابلة
 * للنقر على أكثر الأجهزة شيوعًا.
 */
export declare function MobileTabBar({ items, onOpenMore, fab }: MobileTabBarProps): import("react").JSX.Element;
//# sourceMappingURL=mobile-tabbar.d.ts.map