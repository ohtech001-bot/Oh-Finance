import { ListOrdered, Pencil } from 'lucide-react';
/**
 * تفاصيل الطلب — مطابقة لتصميم `ui`.
 *
 * تبويبات: البنود · الدفعات · قيود الدفتر · النشاط.
 * شريط إجراءات حسب الحالة والصلاحية: تأكيد · تعديل · نسخ · حذف · إلغاء ·
 * أرشفة · إرجاع لمسودة. كل عملية محكومة بالخادم أيضًا.
 */
export declare function OrderDetailsPage(): import("react").JSX.Element;
/** خط زمني للنشاط — مشترك مع ملف الزبون. */
export declare function ActivityTimeline({ items, loading, }: {
    items: {
        id: string;
        action: string;
        summary: string;
        actorName: string | null;
        createdAt: string;
    }[];
    loading?: boolean;
}): import("react").JSX.Element;
export { ListOrdered, Pencil };
//# sourceMappingURL=order-details-page.d.ts.map