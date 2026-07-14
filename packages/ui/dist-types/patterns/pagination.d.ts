export interface PaginationProps {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    onPageChange: (page: number) => void;
    onPageSizeChange?: (size: number) => void;
    pageSizes?: number[];
    /** اسم العنصر للعدّاد: «عرض 1 - 10 من 95 زبون». */
    itemLabel?: string;
    className?: string;
}
/**
 * الترقيم — مطابق للمرجع: العدّاد يمين، الأرقام يسار.
 *
 * ⚠️ في RTL يبقى «السابق» على اليمين و«التالي» على اليسار — أي **عكس** الترتيب
 *    البصري في LTR. هذا صحيح: اتجاه القراءة ينعكس، فـ«السابق» هو ما يسبق في
 *    اتجاه القراءة. نعتمد على flexbox في حاوية `dir=rtl` ليتكفّل بذلك تلقائيًا،
 *    ولا نُعكّس يدويًا — والمرجع البصري يؤكد هذا الترتيب.
 */
export declare function Pagination({ page, pageSize, total, totalPages, onPageChange, onPageSizeChange, pageSizes, itemLabel, className, }: PaginationProps): import("react").JSX.Element | null;
//# sourceMappingURL=pagination.d.ts.map