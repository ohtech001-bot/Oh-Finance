import { StrictMode } from 'react';
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

/**
 * إعداد TanStack Query.
 *
 * ── قرار مقصود: `refetchOnWindowFocus` مفعّل ─────────────────────────────
 * في نظام مالي، بيانات قديمة على الشاشة خطرة: صاحب المحل يعود إلى التبويب
 * بعد ساعة فيرى رصيد زبون كما كان — بينما سجّل موظف دفعة في هذه الأثناء.
 * لو اتخذ قرارًا بناءً على الرقم القديم (منحه بضاعة جديدة مثلًا)، فالضرر حقيقي.
 * إعادة الجلب عند العودة للتبويب تكلّف طلبًا، وتشتري صحة البيانات.
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
          if (error.isUnauthenticated || error.isForbidden || error.status === 404) {
            return false;
          }
        }
        return failureCount < 2;
      },
      staleTime: 30_000,
      refetchOnWindowFocus: true,
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
            <RouterProvider router={router} />
            <Toaster dir={LOCALES[currentLocale()].dir} />
          </AuthProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </AppErrorBoundary>
  </StrictMode>,
);
