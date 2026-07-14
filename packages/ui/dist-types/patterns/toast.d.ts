/**
 * الإشعارات (Toasts).
 *
 * الموضع `top-left` في RTL: مقابل جهة البداية، حيث لا يحجب أزرار الإجراءات
 * التي تقع في الطرف المقابل للعنوان.
 *
 * ⚠️ الإشعار **ليس** بديلًا عن تأكيد العملية المالية. الدفعة تُؤكَّد بتحديث
 *    الرصيد الظاهر بعد رد الخادم — لا بـ«تم الحفظ» يومض ويختفي. المستخدم
 *    الذي يفوته الإشعار يجب أن يرى الأثر في البيانات نفسها.
 */
export declare function Toaster({ dir }: {
    dir?: 'rtl' | 'ltr';
}): import("react").JSX.Element;
export declare const toast: {
    success: (message: string, description?: string) => string | number;
    error: (message: string, description?: string) => string | number;
    warning: (message: string, description?: string) => string | number;
    info: (message: string, description?: string) => string | number;
    /**
     * خطأ من الخادم — يعرض `requestId` كي يستطيع المستخدم إعطاءه للدعم.
     * بدونه يقول المستخدم «ظهر خطأ» ولا نجد سطره في ملايين أسطر السجل.
     */
    apiError: (message: string, requestId?: string) => string | number;
    promise: <ToastData>(promise: Promise<ToastData> | (() => Promise<ToastData>), data?: {
        icon?: import("react").ReactNode;
        className?: string | undefined;
        id?: number | string | undefined;
        style?: React.CSSProperties | undefined;
        onDismiss?: ((toast: import("sonner").ToastT) => void) | undefined;
        action?: import("react").ReactNode | import("sonner").Action;
        position?: ("top-left" | "top-right" | "bottom-left" | "bottom-right" | "top-center" | "bottom-center") | undefined;
        duration?: number | undefined;
        closeButton?: boolean | undefined;
        richColors?: boolean | undefined;
        invert?: boolean | undefined;
        dismissible?: boolean | undefined;
        cancel?: import("react").ReactNode | import("sonner").Action;
        onAutoClose?: ((toast: import("sonner").ToastT) => void) | undefined;
        cancelButtonStyle?: React.CSSProperties | undefined;
        actionButtonStyle?: React.CSSProperties | undefined;
        unstyled?: boolean | undefined;
        classNames?: import("sonner").ToastClassnames | undefined;
        descriptionClassName?: string | undefined;
    } & {
        loading?: string | React.ReactNode;
        success?: import("react").ReactNode | ((data: ToastData) => React.ReactNode | string | Promise<React.ReactNode | string>);
        error?: import("react").ReactNode | ((data: any) => React.ReactNode | string | Promise<React.ReactNode | string>);
        description?: import("react").ReactNode | ((data: any) => React.ReactNode | string | Promise<React.ReactNode | string>);
        finally?: () => void | Promise<void>;
    }) => (string & {
        unwrap: () => Promise<ToastData>;
    }) | (number & {
        unwrap: () => Promise<ToastData>;
    }) | {
        unwrap: () => Promise<ToastData>;
    };
    dismiss: (id?: number | string) => string | number;
};
//# sourceMappingURL=toast.d.ts.map