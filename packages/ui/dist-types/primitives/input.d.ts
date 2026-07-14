export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    /** أيقونة في بداية الحقل (RTL: على اليمين — تلقائيًا). */
    startIcon?: React.ReactNode;
    endIcon?: React.ReactNode;
    error?: boolean;
}
export declare const Input: import("react").ForwardRefExoticComponent<InputProps & import("react").RefAttributes<HTMLInputElement>>;
export interface FieldRenderProps {
    id: string;
    'aria-describedby'?: string;
    'aria-invalid'?: boolean;
    'aria-required'?: boolean;
}
export interface FieldProps {
    label: string;
    error?: string;
    hint?: string;
    required?: boolean;
    children: (props: FieldRenderProps) => React.ReactNode;
}
/**
 * حقل نموذج موصول بالكامل للوصول.
 *
 * الربط بـ`aria-describedby` ليس تجميلًا: قارئ الشاشة يجب أن يُعلن رسالة
 * الخطأ عند الوصول للحقل. حقل أحمر بلا هذا الربط لا يعني شيئًا لمستخدم كفيف
 * — يسمع «حقل نصي» فقط، ولا يعرف لماذا رُفض نموذجه.
 */
export declare function Field({ label, error, hint, required, children }: FieldProps): import("react").JSX.Element;
//# sourceMappingURL=input.d.ts.map