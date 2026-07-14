import { type VariantProps } from 'class-variance-authority';
/**
 * الأزرار — مطابقة للمرجع البصري.
 *
 *   brand   (أخضر)  → «إضافة طلب جديد» · «حفظ التغييرات» · «تسجيل دفعة جديدة»
 *   accent  (أزرق)  → «إضافة زبون جديد» · «تسجيل دفعة»
 *   outline (أبيض)  → «تصدير» · «طباعة كشف حساب»
 *   danger  (أحمر)  → «إلغاء الطلب» (بحوار تأكيد دائمًا)
 *
 * الارتفاع 44px والزوايا 10px — مقيسان من الصور.
 */
declare const buttonVariants: (props?: ({
    variant?: "brand" | "accent" | "outline" | "ghost" | "danger" | "link" | null | undefined;
    size?: "sm" | "md" | "lg" | "icon" | null | undefined;
} & import("class-variance-authority/types").ClassProp) | undefined) => string;
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
    asChild?: boolean;
    loading?: boolean;
}
export declare const Button: import("react").ForwardRefExoticComponent<ButtonProps & import("react").RefAttributes<HTMLButtonElement>>;
export { buttonVariants };
//# sourceMappingURL=button.d.ts.map