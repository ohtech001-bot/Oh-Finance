export interface Crumb {
    label: string;
    href?: string;
}
export interface BreadcrumbsProps {
    items: Crumb[];
    /** مكوّن الرابط — يُمرَّر من التطبيق (React Router Link). */
    linkAs?: React.ComponentType<{
        to: string;
        className?: string;
        children: React.ReactNode;
    }>;
    className?: string;
}
/**
 * فُتات الخبز — «الرئيسية / الزبائن / أحمد محمود».
 *
 * الفاصل `ChevronLeft` في RTL يشير إلى **اليسار** أي إلى الأمام في اتجاه
 * القراءة (من اليمين لليسار). لو استخدمنا ChevronRight لأشار إلى الخلف
 * وبدا مقلوبًا. هذا مطابق للمرجع البصري.
 *
 * `aria-current="page"` على العنصر الأخير — قارئ الشاشة يعلن أنه الصفحة
 * الحالية بدل قراءته كرابط قابل للنقر.
 */
export declare function Breadcrumbs({ items, linkAs: Link, className }: BreadcrumbsProps): import("react").JSX.Element;
export interface PageHeaderProps {
    title: string;
    icon?: React.ComponentType<{
        className?: string;
    }>;
    breadcrumbs?: Crumb[];
    linkAs?: BreadcrumbsProps['linkAs'];
    description?: string;
    /** أزرار الإجراءات — تظهر في الطرف المقابل للعنوان. */
    actions?: React.ReactNode;
    className?: string;
}
/**
 * ترويسة الصفحة — مطابقة للمرجع:
 * العنوان + الأيقونة في جهة البداية، فُتات الخبز تحته، الإجراءات في المقابل.
 */
export declare function PageHeader({ title, icon: Icon, breadcrumbs, linkAs, description, actions, className, }: PageHeaderProps): import("react").JSX.Element;
//# sourceMappingURL=breadcrumbs.d.ts.map