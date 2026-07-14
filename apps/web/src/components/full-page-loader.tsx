import { Loader2 } from 'lucide-react';

/**
 * شاشة تحميل كاملة — تُعرض أثناء التحقق من الجلسة عند فتح التطبيق.
 *
 * `role="status"` + `aria-live="polite"`: قارئ الشاشة يُعلن «جارٍ التحقق من
 * الجلسة» بدل أن يترك المستخدم في صمت لا يعرف إن كانت الصفحة تعمل.
 */
export function FullPageLoader() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-bg"
    >
      <Loader2 className="size-8 animate-spin text-brand" aria-hidden />
      <p className="text-sm text-fg-muted">جارٍ التحقق من الجلسة…</p>
    </div>
  );
}
