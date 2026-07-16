import { type Customer } from '@oh/contracts';
export interface CustomerFormDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** موجود = تعديل. غائب = إضافة. */
    customer?: Customer;
}
/**
 * نموذج إضافة/تعديل زبون.
 *
 * ⚠️ الرصيد الافتتاحي يظهر **عند الإضافة فقط**. عند التعديل يُخفى — تغييره
 *    بعد الإنشاء يعني تعديل الرصيد بلا قيد محاسبي، وهو ما يمنعه العقد نفسه
 *    (`.omit` في updateCustomerSchema).
 */
export declare function CustomerFormDialog({ open, onOpenChange, customer }: CustomerFormDialogProps): import("react").JSX.Element;
//# sourceMappingURL=customer-form-dialog.d.ts.map