/**
 * هيكل تحميل.
 *
 * `aria-hidden` + `role="status"` على الحاوية: قارئ الشاشة يُعلن «جارٍ
 * التحميل» مرة واحدة، بدل أن يقرأ عشرين مستطيلًا فارغًا.
 */
export declare function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>): import("react").JSX.Element;
/**
 * هيكل يطابق شكل الجدول.
 *
 * ⚠️ لا نستخدم spinner عامًا: الهيكل الذي يطابق التخطيط النهائي يمنع «قفزة
 *    التخطيط» عند وصول البيانات، ويُشعر المستخدم بأن الصفحة تُبنى لا أنها
 *    معلّقة. الفارق في الإحساس بالسرعة حقيقي ومقيس.
 */
export declare function TableSkeleton({ rows, columns }: {
    rows?: number;
    columns?: number;
}): import("react").JSX.Element;
export declare function StatCardsSkeleton({ count }: {
    count?: number;
}): import("react").JSX.Element;
export declare function CardSkeleton({ className }: {
    className?: string;
}): import("react").JSX.Element;
//# sourceMappingURL=skeleton.d.ts.map