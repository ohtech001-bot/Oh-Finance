export interface RecordPaymentDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** إن مُرّر: الزبون مثبّت (من صفحة الزبون). */
    fixedCustomerId?: string;
}
/**
 * تسجيل دفعة جديدة — مطابق لتدفق `ui/other screens/الدفعات.jpeg`.
 *
 * ── ثلاث نقاط أمان في الواجهة ──────────────────────────────────────────────
 * 1. `Idempotency-Key` يُولَّد **مرة واحدة** عند فتح النموذج. أي إعادة إرسال
 *    (نقرة ثانية، إعادة محاولة) تحمل نفس المفتاح ⇒ دفعة واحدة.
 * 2. معاينة التوزيع تُظهر **أين ستذهب الدفعة** قبل الحفظ.
 * 3. لا Optimistic UI — الرصيد الجديد يظهر بعد رد الخادم فقط.
 */
export declare function RecordPaymentDialog({ open, onOpenChange, fixedCustomerId }: RecordPaymentDialogProps): import("react").JSX.Element;
//# sourceMappingURL=record-payment-dialog.d.ts.map