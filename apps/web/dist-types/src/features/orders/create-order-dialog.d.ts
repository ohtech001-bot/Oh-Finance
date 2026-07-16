export interface CreateOrderDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    fixedCustomerId?: string;
}
/**
 * إنشاء طلب — إدخال بنود يدوي (المتطلب 5)، مع معاينة حيّة.
 *
 * ⚠️ الواجهة **لا تحسب الإجمالي**. ترسل البنود إلى `/orders/preview` ويعيد
 *    الخادم الأرقام. فما يراه المستخدم هو بالضبط ما سيُحفظ — لا فرق تقريب،
 *    ولا مبلغ يمكن تزويره.
 *
 * الحفظ: مسودة أو تأكيد مباشر (يولّد قيدًا مدينًا).
 */
export declare function CreateOrderDialog({ open, onOpenChange, fixedCustomerId }: CreateOrderDialogProps): import("react").JSX.Element;
//# sourceMappingURL=create-order-dialog.d.ts.map