import { Toaster as SonnerToaster, toast as sonnerToast } from 'sonner';

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
export function Toaster({ dir = 'rtl' }: { dir?: 'rtl' | 'ltr' }) {
  return (
    <SonnerToaster
      dir={dir}
      position={dir === 'rtl' ? 'top-left' : 'top-right'}
      // مدة أطول من الافتراضي: قراءة العربية تستغرق وقتًا، ورسائل الأخطاء
      // المالية يجب أن تُقرأ لا أن تُلمح.
      duration={5000}
      closeButton
      richColors
      toastOptions={{
        classNames: {
          toast: 'rounded-card border border-border bg-card shadow-pop font-sans',
          title: 'text-sm font-semibold text-fg',
          description: 'text-[13px] text-fg-muted',
        },
      }}
    />
  );
}

export const toast = {
  success: (message: string, description?: string) => sonnerToast.success(message, { description }),

  error: (message: string, description?: string) => sonnerToast.error(message, { description }),

  warning: (message: string, description?: string) => sonnerToast.warning(message, { description }),

  info: (message: string, description?: string) => sonnerToast.info(message, { description }),

  /**
   * خطأ من الخادم — يعرض `requestId` كي يستطيع المستخدم إعطاءه للدعم.
   * بدونه يقول المستخدم «ظهر خطأ» ولا نجد سطره في ملايين أسطر السجل.
   */
  apiError: (message: string, requestId?: string) =>
    sonnerToast.error(message, {
      description: requestId ? `الرقم المرجعي: ${requestId}` : undefined,
    }),

  promise: sonnerToast.promise,
  dismiss: sonnerToast.dismiss,
};
