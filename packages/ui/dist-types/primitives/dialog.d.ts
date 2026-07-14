import * as DialogPrimitive from '@radix-ui/react-dialog';
/**
 * الحوارات والدرج — مبنية على Radix.
 *
 * ── لماذا Radix وليس <dialog> أو تنفيذ يدوي؟ ─────────────────────────────────
 * الحوار الصحيح يتطلب: حبس التركيز داخله، إعادة التركيز إلى الزر المُطلِق عند
 * الإغلاق، إغلاق بـEsc، `aria-modal`، إخفاء بقية الصفحة عن قارئ الشاشة، ومنع
 * تمرير الخلفية. كل بند منها يُنسى بسهولة في تنفيذ يدوي، والنتيجة حوار لا
 * يستطيع مستخدم لوحة المفاتيح الخروج منه — سجن.
 */
export declare const Dialog: import("react").FC<DialogPrimitive.DialogProps>;
export declare const DialogTrigger: import("react").ForwardRefExoticComponent<DialogPrimitive.DialogTriggerProps & import("react").RefAttributes<HTMLButtonElement>>;
export declare const DialogClose: import("react").ForwardRefExoticComponent<DialogPrimitive.DialogCloseProps & import("react").RefAttributes<HTMLButtonElement>>;
export declare const DialogPortal: import("react").FC<DialogPrimitive.DialogPortalProps>;
export declare const DialogOverlay: import("react").ForwardRefExoticComponent<Omit<DialogPrimitive.DialogOverlayProps & import("react").RefAttributes<HTMLDivElement>, "ref"> & import("react").RefAttributes<HTMLDivElement>>;
export declare const DialogContent: import("react").ForwardRefExoticComponent<Omit<DialogPrimitive.DialogContentProps & import("react").RefAttributes<HTMLDivElement>, "ref"> & {
    size?: "sm" | "md" | "lg" | "xl";
} & import("react").RefAttributes<HTMLDivElement>>;
export declare function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>): import("react").JSX.Element;
export declare function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>): import("react").JSX.Element;
export declare function DialogBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>): import("react").JSX.Element;
export declare const DialogTitle: import("react").ForwardRefExoticComponent<Omit<DialogPrimitive.DialogTitleProps & import("react").RefAttributes<HTMLHeadingElement>, "ref"> & import("react").RefAttributes<HTMLHeadingElement>>;
export declare const DialogDescription: import("react").ForwardRefExoticComponent<Omit<DialogPrimitive.DialogDescriptionProps & import("react").RefAttributes<HTMLParagraphElement>, "ref"> & import("react").RefAttributes<HTMLParagraphElement>>;
/**
 * درج منزلق من حافة البداية (يمين في RTL، يسار في LTR).
 * يُستخدم للقائمة الجانبية على الموبايل ولنماذج الفلترة المتقدمة.
 */
export declare const Drawer: import("react").FC<DialogPrimitive.DialogProps>;
export declare const DrawerTrigger: import("react").ForwardRefExoticComponent<DialogPrimitive.DialogTriggerProps & import("react").RefAttributes<HTMLButtonElement>>;
export declare const DrawerClose: import("react").ForwardRefExoticComponent<DialogPrimitive.DialogCloseProps & import("react").RefAttributes<HTMLButtonElement>>;
export declare const DrawerContent: import("react").ForwardRefExoticComponent<Omit<DialogPrimitive.DialogContentProps & import("react").RefAttributes<HTMLDivElement>, "ref"> & {
    side?: "start" | "end";
} & import("react").RefAttributes<HTMLDivElement>>;
export interface ConfirmDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title: string;
    description: string;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: 'danger' | 'brand';
    loading?: boolean;
    onConfirm: () => void;
}
/**
 * حوار التأكيد — إلزامي قبل كل عملية غير قابلة للتراجع.
 *
 * في هذا النظام: إلغاء طلب مؤكد، عكس دفعة، إغلاق دورة حساب، إيقاف محل.
 *
 * ⚠️ زر التأكيد **ليس** المُركَّز افتراضيًا. المستخدم الذي يضغط Enter بعادةٍ
 *    لا ينفّذ الإجراء الخطر بالخطأ — عليه أن يصل إليه بوعي.
 */
export declare function ConfirmDialog({ open, onOpenChange, title, description, confirmLabel, cancelLabel, variant, loading, onConfirm, }: ConfirmDialogProps): import("react").JSX.Element;
//# sourceMappingURL=dialog.d.ts.map