import { StrictMode, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@oh/ui';

import './lib/i18n';
import './styles/globals.css';

import { router } from './app/router';
import { AuthProvider } from './app/auth-context';
import { ThemeProvider } from './app/theme-context';
import { AppErrorBoundary } from './features/errors/error-pages';
import { ApiRequestError } from './lib/api';
import { currentLocale } from './lib/i18n';
import { LOCALES } from '@oh/config';
import { StartupLoader } from './features/loading/startup-loader';
import { FullPageLoader } from './components/full-page-loader';

function LocalizedToaster() {
  useTranslation();
  return <Toaster dir={LOCALES[currentLocale()].dir} />;
}

/**
 * إعداد TanStack Query.
 *
 * ── التنقل السريع دون طلبات متكررة ───────────────────────────────────────
 * العمليات المالية تُبطل الاستعلامات المتأثرة فور نجاحها، لذلك لا حاجة
 * لإعادة جلب كل بيانات الصفحة عند كل تبديل لنافذة المتصفح. نحتفظ بالصفحات
 * الحديثة في الذاكرة ونحدّث البيانات القديمة عند فتحها، مع إبقاء النسخة
 * المخزنة ظاهرة أثناء التحديث بدل إعادة شاشة التحميل.
 *
 * ── لا إعادة محاولة على 401/403 ──────────────────────────────────────────
 * الجلسة المنتهية أو الصلاحية الناقصة لا تُصلحها إعادة المحاولة — تضيف
 * ضجيجًا فقط، وقد تُشغّل قفل الحساب.
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        if (error instanceof ApiRequestError) {
          if (error.status >= 400 && error.status < 500) {
            return false;
          }
        }
        return failureCount < 2;
      },
      // Mutations invalidate their affected data explicitly. A longer cache
      // keeps navigation instant while still refreshing stale screens later.
      staleTime: 5 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
      refetchOnWindowFocus: false,
    },
    mutations: {
      // ⚠️ لا إعادة محاولة تلقائية للطفرات إطلاقًا.
      //    إعادة إرسال POST /payments تلقائيًا = دفعة مزدوجة محتملة.
      //    الحماية الحقيقية هي Idempotency-Key (المرحلة 5)، لكن حتى معها
      //    لا نعيد المحاولة صامتين — المستخدم يقرّر.
      retry: false,
    },
  },
});

const root = document.getElementById('root');
if (!root) {
  throw new Error('عنصر #root غير موجود في index.html');
}

createRoot(root).render(
  <StrictMode>
    <AppErrorBoundary>
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <StartupLoader>
              <Suspense fallback={<FullPageLoader />}>
                <RouterProvider router={router} />
              </Suspense>
              <LocalizedToaster />
            </StartupLoader>
          </AuthProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </AppErrorBoundary>
  </StrictMode>,
);
