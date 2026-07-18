import { useEffect } from 'react';

/**
 * تحذير «تغييرات غير محفوظة».
 *
 * يمنع فقدان إدخال المستخدم عند إغلاق التبويب أو تحديث الصفحة بينما هناك
 * تعديل غير محفوظ. يعتمد على حدث المتصفح `beforeunload` — وهو الوسيلة
 * الوحيدة الموثوقة لاعتراض إغلاق التبويب.
 *
 * ⚠️ لا يعترض تنقّل React Router الداخلي (ذاك يُعالَج بتأكيد إغلاق الحوار).
 *    هذا للخروج من التطبيق كليًا: إغلاق التبويب، تحديث، إغلاق النافذة.
 *
 * @param when فعّل الحارس فقط حين يكون النموذج متسخًا (dirty).
 */
export function useUnsavedChangesWarning(when: boolean): void {
  useEffect(() => {
    if (!when) return;

    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // المتصفحات الحديثة تتجاهل النص المخصّص وتعرض رسالتها القياسية،
      // لكن ضبط returnValue إلزامي لتفعيل الحوار أصلًا.
      e.returnValue = '';
    };

    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [when]);
}
