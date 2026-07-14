import { expect, test, type Page } from '@playwright/test';

/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  اختبارات الدخان — بلا قاعدة بيانات.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  تختبر ما هو صحيح بغض النظر عن الخادم: الاتجاه، التوطين، التجاوب،
 *  الوصول بلوحة المفاتيح، وأن الصفحات تُعرض بلا انهيار.
 *
 *  ⚠️ الخادم غير مُشغَّل هنا. طلبات /api ستفشل، وهذا **متوقع** — الواجهة يجب
 *     أن تتعامل معه بلا شاشة بيضاء. عرض صفحة الدخول لا يتطلب أي طلب ناجح.
 */

/** نقاط التوقف الثمانية المطلوبة. */
const BREAKPOINTS = [
  { name: '1536px — Desktop XL', width: 1536, height: 900 },
  { name: '1440px — Desktop L', width: 1440, height: 900 },
  { name: '1280px — Desktop', width: 1280, height: 800 },
  { name: '1024px — Tablet L', width: 1024, height: 768 },
  { name: '768px — Tablet', width: 768, height: 1024 },
  { name: '430px — iPhone Pro Max', width: 430, height: 932 },
  { name: '390px — iPhone', width: 390, height: 844 },
  { name: '360px — Android', width: 360, height: 800 },
] as const;

test.describe('صفحة تسجيل الدخول', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
  });

  test('تُعرض بلا انهيار', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'تسجيل الدخول' })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'البريد الإلكتروني', exact: true })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'كلمة المرور', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'دخول' })).toBeVisible();
  });

  test('الاتجاه RTL واللغة العربية على <html>', async ({ page }) => {
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
  });

  test('حقل البريد بـdir=ltr — البريد يُقرأ من اليسار حتى في واجهة عربية', async ({ page }) => {
    await expect(page.getByRole('textbox', { name: 'البريد الإلكتروني', exact: true })).toHaveAttribute('dir', 'ltr');
  });

  test('التحقق من المدخلات يمنع الإرسال الفارغ', async ({ page }) => {
    await page.getByRole('button', { name: 'دخول' }).click();
    // Zod يرفض البريد الفارغ — رسالة خطأ تظهر بلا طلب شبكة.
    await expect(page.getByRole('alert').first()).toBeVisible({ timeout: 5000 });
  });

  test('إظهار/إخفاء كلمة المرور', async ({ page }) => {
    const password = page.getByRole('textbox', { name: 'كلمة المرور', exact: true });
    await expect(password).toHaveAttribute('type', 'password');

    await page.getByRole('button', { name: 'إظهار كلمة المرور' }).click();
    await expect(password).toHaveAttribute('type', 'text');
  });

  test('الوصول بلوحة المفاتيح: ترتيب التنقّل بين الحقول سليم', async ({ page }) => {
    // نختبر **العلاقة** بين الحقول لا عددًا مطلقًا من ضغطات Tab: عدّ الضغطات
    // يجعل الاختبار هشًّا (إضافة زر واحد تكسره) ولا يقيس ما يهم فعلًا.
    await page.getByRole('textbox', { name: 'البريد الإلكتروني', exact: true }).focus();
    await expect(page.getByRole('textbox', { name: 'البريد الإلكتروني', exact: true })).toBeFocused();

    await page.keyboard.press('Tab');
    // زر «إظهار كلمة المرور» له tabIndex=-1 عمدًا — لا يعترض التسلسل.
    await expect(page.getByRole('textbox', { name: 'كلمة المرور', exact: true })).toBeFocused();

    await page.keyboard.press('Tab');
    await expect(page.getByRole('checkbox')).toBeFocused();
  });

  test('رابط التخطي أول عنصر قابل للتركيز', async ({ page }) => {
    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: 'تخطّي إلى المحتوى الرئيسي' })).toBeFocused();
  });
});

test.describe('تبديل اللغة', () => {
  test('العبرية تُبقي RTL وتغيّر النص', async ({ page }) => {
    await page.goto('/login');

    await page.getByRole('button', { name: /العربية/ }).click();
    await page.getByRole('menuitem', { name: 'עברית' }).click();

    await expect(page.locator('html')).toHaveAttribute('lang', 'he');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.getByRole('heading', { name: 'התחברות' })).toBeVisible();
  });

  test('الإنجليزية تقلب الاتجاه إلى LTR', async ({ page }) => {
    await page.goto('/login');

    await page.getByRole('button', { name: /العربية/ }).click();
    await page.getByRole('menuitem', { name: 'English' }).click();

    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  });
});

test.describe('استعادة كلمة المرور', () => {
  test('تُعرض وتربط بالعودة لتسجيل الدخول', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('link', { name: 'نسيت كلمة المرور؟' }).click();

    await expect(page).toHaveURL(/\/forgot-password/);
    await expect(page.getByRole('heading', { name: 'استعادة كلمة المرور' })).toBeVisible();

    await page.getByRole('link', { name: 'العودة لتسجيل الدخول' }).click();
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe('صفحات الأخطاء', () => {
  test('404 لمسار غير موجود', async ({ page }) => {
    await page.goto('/this-route-does-not-exist');
    await expect(page.getByText('404')).toBeVisible();
    // النص «العودة للرئيسية» — لام الجر تندمج مع أداة التعريف، فلا يطابقه /الرئيسية/.
    await expect(page.getByRole('link', { name: 'العودة للرئيسية' })).toBeVisible();
  });

  test('403 تعرض مخرجًا', async ({ page }) => {
    await page.goto('/403');
    await expect(page.getByText('403')).toBeVisible();
  });
});

/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  التجاوب — نقاط التوقف الثمانية.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  الفحص الحاسم: **لا تمرير أفقي للصفحة**. تمرير أفقي على الموبايل هو أوضح
 *  علامة على تخطيط مكسور، ويجعل التطبيق غير قابل للاستخدام فعليًا.
 *
 *  نتحقق أن `document.body.scrollWidth <= viewport.width` عند كل عرض.
 */
test.describe('التجاوب على نقاط التوقف', () => {
  for (const bp of BREAKPOINTS) {
    test(`${bp.name} — بلا تمرير أفقي`, async ({ page }) => {
      await page.setViewportSize({ width: bp.width, height: bp.height });
      await page.goto('/login');

      await expect(page.getByRole('heading', { name: 'تسجيل الدخول' })).toBeVisible();

      const overflow = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));

      // نسمح ببكسل واحد للتقريب.
      expect(
        overflow.scrollWidth,
        `تمرير أفقي عند ${bp.width}px: المحتوى ${overflow.scrollWidth}px > الشاشة ${overflow.clientWidth}px`,
      ).toBeLessThanOrEqual(overflow.clientWidth + 1);
    });
  }

  test('لوحة العلامة تظهر على الديسكتوب وتختفي على الموبايل', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/login');
    await expect(page.getByText('عزل كامل لبيانات كل محل')).toBeVisible();

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByText('عزل كامل لبيانات كل محل')).not.toBeVisible();
  });

  test('حقول النموذج قابلة للنقر عند 360px (أصغر شاشة مدعومة)', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto('/login');

    const email = page.getByRole('textbox', { name: 'البريد الإلكتروني', exact: true });
    await email.click();
    await email.fill('owner@test.com');
    await expect(email).toHaveValue('owner@test.com');

    // الزر يجب أن يكون داخل الشاشة — لا مقتطعًا.
    const button = page.getByRole('button', { name: 'دخول' });
    const box = await button.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(361);
  });
});

test.describe('السمة', () => {
  test('data-theme مضبوط على <html>', async ({ page }) => {
    await page.goto('/login');
    const theme = await page.locator('html').getAttribute('data-theme');
    expect(['light', 'dark']).toContain(theme);
  });
});

/** الوصول: لا أخطاء وحدة تحكّم عند التحميل. */
test('لا أخطاء JavaScript عند تحميل صفحة الدخول', async ({ page }: { page: Page }) => {
  const errors: string[] = [];

  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() !== 'error') return;

    const text = message.text();

    /**
     * فشل طلبات الشبكة **متوقع** هنا: خادم الـAPI غير مُشغَّل في اختبارات
     * الدخان (وهذا مقصود — نختبر أن الواجهة تصمد بلا خادم).
     *
     * وكيل Vite يردّ 500 عند غياب الخادم الخلفي، والمتصفح يطبع:
     *   "Failed to load resource: the server responded with a status of 500"
     * وهي رسالة لا تحمل المسار — لذا نرشّحها بنصّها لا بـ'/api/'.
     */
    const isExpectedNetworkFailure =
      text.includes('/api/') ||
      text.includes('Failed to fetch') ||
      text.includes('Failed to load resource');

    if (isExpectedNetworkFailure) return;

    errors.push(text);
  });

  await page.goto('/login');
  await page.waitForLoadState('networkidle');

  expect(errors).toEqual([]);
});
