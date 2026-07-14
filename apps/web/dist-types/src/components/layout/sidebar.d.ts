import type { NavItem } from './nav-items';
export interface SidebarProps {
    items: NavItem[];
    /** اسم المحل + رقمه في الترويسة (أو «المنصة» للمدير العام). */
    title: string;
    subtitle: string;
    onNavigate?: () => void;
    className?: string;
}
/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  الشريط الجانبي الداكن — النمط المعتمد للنظام كله.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  مقيس من المرجع البصري:
 *    • العرض 260px · الخلفية #0B1220
 *    • العنصر النشط: كتلة زرقاء #1D4ED8 بعرض كامل + نص أبيض
 *    • الخامل: #94A3B8 · عند التحويم: خلفية بيضاء 5%
 *    • ترويسة المحل أعلى · «الدعم والمساعدة» مثبّت أسفل
 *
 *  ⚠️ في RTL يقع الشريط على **اليمين** تلقائيًا لأننا نستخدم ترتيب flex
 *     العادي داخل حاوية `dir=rtl` — لا نحدد `right: 0` يدويًا. لو فعلنا،
 *     لبقي على اليمين في الإنجليزية أيضًا وانكسر التخطيط.
 */
export declare function Sidebar({ items, title, subtitle, onNavigate, className }: SidebarProps): import("react").JSX.Element;
//# sourceMappingURL=sidebar.d.ts.map