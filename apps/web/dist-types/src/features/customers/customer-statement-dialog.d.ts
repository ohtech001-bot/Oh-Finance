import { type Customer } from '@oh/contracts';
import { type CurrencyCode } from '@oh/money';
interface CustomerStatementDialogProps {
    customer: Customer;
    currency: CurrencyCode;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}
export declare function CustomerStatementDialog({ customer, currency, open, onOpenChange, }: CustomerStatementDialogProps): import("react").JSX.Element;
export {};
//# sourceMappingURL=customer-statement-dialog.d.ts.map