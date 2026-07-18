import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * اختصارات لوحة المفاتيح العامة.
 *
 *   Ctrl/⌘ + N → طلب جديد
 *   Ctrl/⌘ + P → دفعة جديدة   (نمنع طباعة المتصفح الافتراضية)
 *   Ctrl/⌘ + F أو K → تركيز البحث في الصفحة الحالية
 *   Esc        → إغلاق الحوار (يعالجه مكوّن الحوار نفسه — لا نكرّره هنا)
 *
 * ── لماذا `?new=1` بدل حالة عامة؟ ─────────────────────────────────────────
 * حوارات الإنشاء تملكها صفحاتها (Orders/Payments). بدل رفع حالتها إلى الجذر،
 * ننتقل إلى الصفحة مع مَعلمة، وتفتح الصفحة حوارها ثم تمسح المَعلمة. هذا يبقي
 * ملكية الحالة محلية ويجعل الاختصار مجرد تنقّل.
 */
export function useGlobalShortcuts(): void {
  const navigate = useNavigate();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (!mod || e.altKey || e.shiftKey) return;

      const key = e.key.toLowerCase();

      if (key === 'n') {
        e.preventDefault();
        navigate('/orders?new=1');
      } else if (key === 'p') {
        e.preventDefault();
        navigate('/payments?new=1');
      } else if (key === 'f' || key === 'k') {
        // تركيز أول حقل بحث في الصفحة، إن وُجد.
        const search = document.querySelector<HTMLInputElement>('input[type="search"]');
        if (search) {
          e.preventDefault();
          search.focus();
          search.select();
        }
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navigate]);
}
