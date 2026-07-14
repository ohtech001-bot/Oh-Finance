export interface FilterBarProps {
    children?: React.ReactNode;
    className?: string;
}
/**
 * شريط الفلاتر — بطاقة بيضاء أفقية، مطابقة للمرجع.
 *
 * على الموبايل: يتحوّل إلى بحث + زر «تصفية» يفتح درجًا. لا نضغط ستة عناصر
 * في شاشة 360px — تصير كلها غير قابلة للاستخدام.
 */
export declare function FilterBar({ children, className }: FilterBarProps): import("react").JSX.Element;
export interface SearchFilterProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    className?: string;
}
export declare function SearchFilter({ value, onChange, placeholder, className, }: SearchFilterProps): import("react").JSX.Element;
export interface SelectFilterProps {
    value: string;
    onChange: (value: string) => void;
    options: {
        value: string;
        label: string;
    }[];
    /** الخيار الافتراضي: «كل الحالات» · «كل الزبائن». */
    allLabel: string;
    label: string;
    className?: string;
}
export declare function SelectFilter({ value, onChange, options, allLabel, label, className, }: SelectFilterProps): import("react").JSX.Element;
export interface DateRangeFilterProps {
    from: string;
    to: string;
    onFromChange: (value: string) => void;
    onToChange: (value: string) => void;
    className?: string;
}
/**
 * مدى تاريخي — «من تاريخ» / «إلى تاريخ».
 *
 * `type="date"` يعطي منتقي التاريخ الأصلي للمتصفح: يعمل بلوحة المفاتيح،
 * ومترجم للغة النظام، ويحترم إعدادات التقويم — كلها أشياء يخسرها المنتقي
 * المخصّص عادةً.
 */
export declare function DateRangeFilter({ from, to, onFromChange, onToChange, className, }: DateRangeFilterProps): import("react").JSX.Element;
export declare function AdvancedFilterButton({ onClick, activeCount, }: {
    onClick: () => void;
    activeCount?: number;
}): import("react").JSX.Element;
//# sourceMappingURL=filter-bar.d.ts.map