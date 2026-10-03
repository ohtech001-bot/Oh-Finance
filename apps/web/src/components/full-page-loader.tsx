import { copy, useCopy } from '@/lib/copy';
import { Loader2 } from 'lucide-react';

/**
 * شاشة تحميل كاملة — تُعرض أثناء التحقق من الجلسة عند فتح التطبيق.
 *
 * `role="status"` + `aria-live="polite"`: قارئ الشاشة يُعلن «جارٍ التحقق من
 * الجلسة» بدل أن يترك المستخدم في صمت لا يعرف إن كانت الصفحة تعمل.
 */
export function FullPageLoader() {
  useCopy();

  return (
    <div
      role="status"
      aria-live="polite"
      className="bg-bg flex min-h-dvh flex-col items-center justify-center gap-3"
    >
      <Loader2 className="text-brand size-8 animate-spin" aria-hidden />
      <p className="text-fg-muted text-sm">{copy('جارٍ التحقق من الجلسة…')}</p>
    </div>
  );
}
