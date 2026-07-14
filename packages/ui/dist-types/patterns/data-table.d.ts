export interface Column<T> {
    /** مفتاح الفرز — يُرسل للخادم. `undefined` = غير قابل للفرز. */
    key?: string;
    header: string;
    /** محاذاة المحتوى. المبالغ دائمًا `end`. */
    align?: 'start' | 'center' | 'end';
    width?: string;
    render: (row: T, index: number) => React.ReactNode;
    /** إخفاء العمود تحت هذا العرض (أعمدة ثانوية على الشاشات الضيقة). */
    hideBelow?: 'sm' | 'md' | 'lg' | 'xl';
}
export interface DataTableProps<T> {
    columns: Column<T>[];
    rows: T[];
    rowKey: (row: T) => string;
    loading?: boolean;
    error?: {
        message: string;
        requestId?: string;
    } | null;
    onRetry?: () => void;
    /** حالة «لا بيانات أصلًا». */
    empty?: {
        title: string;
        description?: string;
        action?: {
            label: string;
            onClick: () => void;
        };
    };
    /** هل الفلاتر مُفعَّلة؟ يقرّر: NoResults أم Empty. */
    isFiltered?: boolean;
    onResetFilters?: () => void;
    sort?: {
        key: string;
        order: 'asc' | 'desc';
    };
    onSortChange?: (key: string) => void;
    onRowClick?: (row: T) => void;
    /** وصف الجدول لقارئ الشاشة — إلزامي للوصول. */
    caption: string;
    className?: string;
}
/**
 * أساس الجداول — مطابق للمرجع البصري.
 *
 * رأس `#F8FAFC` بارتفاع 48px · صفوف 56px · فواصل `#EEF2F6` · hover خفيف.
 *
 * ── الوصول ────────────────────────────────────────────────────────────────
 *  • `<caption>` مخفي بصريًا: قارئ الشاشة يُعلن ما هذا الجدول قبل قراءته.
 *  • `scope="col"` على الرؤوس: يربط كل خلية برأس عمودها، فيقرأ المستخدم
 *    «الرصيد الحالي: 1,250.00» بدل «1,250.00» مجرّدة.
 *  • `aria-sort` على العمود المفروز.
 *  • التمرير الأفقي في حاوية مستقلة — الصفحة نفسها لا تتمرّر أفقيًا أبدًا.
 */
export declare function DataTable<T>({ columns, rows, rowKey, loading, error, onRetry, empty, isFiltered, onResetFilters, sort, onSortChange, onRowClick, caption, className, }: DataTableProps<T>): import("react").JSX.Element;
//# sourceMappingURL=data-table.d.ts.map