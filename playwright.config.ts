import { defineConfig, devices } from '@playwright/test';

/**
 * اختبارات الدخان (E2E).
 *
 * لا تحتاج قاعدة بيانات: تختبر ما يعمل بلا خادم — عرض الصفحات، الاتجاه،
 * التوطين، التجاوب، والوصول بلوحة المفاتيح. اختبارات المسارات الكاملة
 * (دخول → لوحة → إنشاء محل) تُضاف عند توفر قاعدة الاختبار.
 */
/** منفذ حصري لاختبارات E2E — معزول عن 5173 (منفذ التطوير). */
const E2E_PORT = 5199;
const E2E_URL = `http://localhost:${E2E_PORT}`;

export default defineConfig({
  testDir: './apps/web/e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['list'], ['html', { open: 'never' }]],

  use: {
    baseURL: E2E_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    locale: 'ar',
  },

  projects: [{ name: 'desktop', use: { ...devices['Desktop Chrome'] } }],

  /**
   * ═══════════════════════════════════════════════════════════════════════
   *  ⚠️ منفذ مخصّص للاختبارات — لا 5173.
   * ═══════════════════════════════════════════════════════════════════════
   *
   *  `reuseExistingServer: true` (الافتراضي الشائع) يفترض أن **أي** شيء يستمع
   *  على المنفذ هو تطبيقك. لو كان مشروع Vite آخر يعمل على 5173، لوصلته
   *  Playwright وشغّلت اختباراتنا ضده.
   *
   *  الأثر خبيث: كل اختبار يفشل بـ«العنصر غير موجود» — تشخيص يوجّهك لمطاردة
   *  أخطاء في كود سليم تمامًا. (حدث فعلًا: التقطت الاختباراتُ خادمَ مشروع آخر.)
   *
   *  الحل: منفذ حصري للاختبارات + `reuseExistingServer: false`. الخادم يُشغَّل
   *  ويُقتل مع كل جولة، ولا يتداخل مع أي `npm run dev` قائم.
   */
  webServer: {
    command: `npm run dev -w @oh/web -- --port ${E2E_PORT} --strictPort`,
    url: E2E_URL,
    reuseExistingServer: false,
    timeout: 120_000,
    stdout: 'pipe',
  },
});
