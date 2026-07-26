import type { OrderDetail } from '@oh/contracts';
interface DraftItem {
    name: string;
    quantity: string;
    unitPrice: string;
    discount: string;
    collapsed: boolean;
}
export interface CreateOrderDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    fixedCustomerId?: string;
    order?: OrderDetail;
}
/**
 * إنشاء طلب — إدخال منتجات يدويًا مع مجموع حيّ باستخدام طبقة المال العشرية.
 * يعيد الخادم الحساب نفسه عند الحفظ، ويبقى المرجع النهائي للمبالغ المحفوظة.
 *
 * الحفظ: مسودة أو تأكيد مباشر (يولّد قيدًا مدينًا).
 */
export declare function CreateOrderDialog({ open, onOpenChange, fixedCustomerId, order, }: CreateOrderDialogProps): import("react").JSX.Element;
export declare function calculateLineTotal(item: Pick<DraftItem, 'quantity' | 'unitPrice' | 'discount'>): string | undefined;
export declare function calculateOrderTotal(lineTotals: Array<string | undefined>, discount: string): string | undefined;
export {};
//# sourceMappingURL=create-order-dialog.d.ts.map