import { expect, test } from '@playwright/test';

const viewports = [
  { width: 360, height: 640 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1366, height: 600 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
];

const owner = {
  id: 'test-owner',
  email: 'preview@example.com',
  name: 'Preview',
  role: 'OWNER',
  permissions: ['customers.read', 'orders.read'],
  locale: 'ar',
  isSuperAdmin: false,
  supportMode: false,
  mustChangePassword: false,
  twoFactorEnabled: false,
  avatarUrl: null,
  tenant: { id: 'test-tenant', name: 'محل الاختبار', slug: 'test', status: 'ACTIVE' },
  store: {
    id: 'test-store',
    code: 'test',
    name: 'محل الاختبار',
    currency: 'ILS',
    logoUrl: null,
    phone: null,
    taxEnabled: false,
    taxRate: 18,
    timezone: 'Asia/Jerusalem',
  },
};
const dashboard = {
  kpis: [],
  trends: [],
  alerts: [],
  recentOrders: [],
  recentPayments: [],
  meta: { storeName: 'محل الاختبار', scope: { lists: [] } },
};

for (const viewport of viewports) {
  test(`public landing displays real project assets without overflow at ${viewport.width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize(viewport);
    const apiRequests: string[] = [];
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.route('**/api/**', async (route) => {
      apiRequests.push(route.request().url());
      await route.abort();
    });
    await page.goto('/');
    await expect(page.locator('.oh-hero h1')).toHaveText('OH Finance');
    if (viewport.width > 850)
      await expect(page.locator('.oh-header__actions .oh-login-link')).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('.oh-hero__actions a').first()).toHaveAttribute(
      'href',
      /^https:\/\/wa.me\/972552616622\?text=/,
    );
    await expect
      .poll(() =>
        page.locator('.oh-hero__image').evaluate((img) => (img as HTMLImageElement).naturalWidth),
      )
      .toBe(960);
    await expect
      .poll(() =>
        page
          .locator('.oh-hero__copy')
          .evaluate((el) => getComputedStyle(el.querySelector('h1')!).opacity),
      )
      .toBe('1');
    await page.locator('#about').evaluate(async (element) => {
      await Promise.all(
        element.getAnimations({ subtree: true }).map((animation) => animation.finished),
      );
    });
    const about = await page.locator('#about').boundingBox();
    expect(about!.y).toBeLessThan(viewport.height);
    await page.screenshot({ path: testInfo.outputPath(`landing-hero-${viewport.width}.png`) });
    await page.locator('#system').scrollIntoViewIfNeeded();
    const visibleImage = page.locator(viewport.width < 600 ? '.oh-phone img' : '.oh-laptop img');
    await expect
      .poll(() => visibleImage.evaluate((img) => (img as HTMLImageElement).naturalWidth))
      .toBeGreaterThan(0);
    await expect(page.getByRole('tab', { name: 'الزبائن', exact: true })).toBeVisible();
    await page.getByRole('tab', { name: 'الزبائن', exact: true }).click();
    await expect(visibleImage).toHaveAttribute('src', /customers-/);
    await expect
      .poll(() =>
        visibleImage.evaluate(
          (img) => (img as HTMLImageElement).complete && (img as HTMLImageElement).naturalWidth > 0,
        ),
      )
      .toBe(true);
    await expect(page.locator('#oh-screen-panel')).toHaveAttribute(
      'aria-labelledby',
      'oh-screen-tab-1',
    );
    await page.getByRole('tab', { name: 'الزبائن', exact: true }).press('ArrowLeft');
    await expect(page.getByRole('tab', { name: 'الطلبات', exact: true })).toBeFocused();
    await expect(page.getByRole('tab', { name: 'الطلبات', exact: true })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await page.locator('.oh-phone img').evaluate(async (img) => {
      if ((img as HTMLImageElement).complete) return;
      await new Promise((resolve) => img.addEventListener('load', resolve, { once: true }));
    });
    await expect(page.locator('#oh-screen-panel')).toHaveAttribute('data-visible', 'true');
    await page.locator('#system').evaluate(async (element) => {
      await Promise.all(
        element.getAnimations({ subtree: true }).map((animation) => animation.finished),
      );
      await Promise.all(
        Array.from(element.querySelectorAll('img'))
          .filter((img) => img.offsetParent !== null)
          .map((img) => img.decode().catch(() => undefined)),
      );
    });
    await page.screenshot({ path: testInfo.outputPath(`landing-gallery-${viewport.width}.png`) });
    await page.getByRole('button', { name: 'عرض الصورة' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(
      page.getByRole('dialog').getByRole('img', { name: 'واجهة الطلبات', exact: true }),
    ).toHaveAttribute('src', /orders-mobile/);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await expect(page.locator('a[href^="/platform"]')).toHaveCount(0);
    expect(apiRequests).toEqual([]);
    expect(errors).toEqual([]);
  });
}

test('mobile menu closes, links correctly and restores focus', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const trigger = page.getByRole('button', { name: 'فتح القائمة' });
  await trigger.click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();
  await trigger.click();
  await page.getByRole('dialog').getByRole('link', { name: 'المميزات', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page).toHaveURL(/#features$/);
  await expect(page.locator('.oh-landing')).toHaveAttribute('data-scrolled', 'true');
  await trigger.click();
  await page.getByRole('dialog').getByRole('link', { name: 'تسجيل الدخول', exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { name: 'تسجيل الدخول' })).toBeVisible();
});

test('reduced motion is respected and the public page does not overwrite the saved app language', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'dark' });
  await page.addInitScript(() => localStorage.setItem('oh_locale', 'he'));
  await page.goto('/');
  await expect(page.locator('.oh-hero h1')).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'he');
  expect(await page.evaluate(() => localStorage.getItem('oh_locale'))).toBe('he');
  expect(
    await page
      .locator('.oh-hero__symbols > span')
      .first()
      .evaluate((el) => getComputedStyle(el).animationName),
  ).toBe('none');
  for (const counter of await page.locator('[data-counter]').all()) {
    expect(await counter.textContent()).toBe(await counter.getAttribute('data-counter'));
  }
  await page.locator('.oh-hero__actions a[href="/login"]').click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'he');
  await expect(page.getByRole('heading', { name: 'התחברות' })).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow');
});

test('private routes remain protected and reset routes remain accessible', async ({ page }) => {
  await page.goto('/customers');
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { name: 'تسجيل الدخول' })).toBeVisible();
  await page.goto('/forgot-password');
  await expect(page.locator('form')).toBeVisible();
  await expect(page.locator('.oh-landing')).toHaveCount(0);
  await page.goto('/reset-password');
  await expect(page.locator('.oh-landing')).toHaveCount(0);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow');
});

test('an authenticated owner still sees the current dashboard at the root', async ({ page }) => {
  await page
    .context()
    .addCookies([{ name: 'oh_csrf', value: 'test-only', domain: 'localhost', path: '/' }]);
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    let data: unknown = { items: [], total: 0, unreadCount: 0 };
    if (path === '/api/auth/me') data = owner;
    if (path === '/api/dashboard') data = dashboard;
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(data) });
  });
  await page.goto('/');
  await expect(page.locator('#main-content h1')).toHaveText('لوحة التحكم');
  await expect(page.locator('.oh-landing')).toHaveCount(0);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow');
});

test('login and logout preserve the existing authentication flow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  let loggedIn = false;
  const calls: string[] = [];
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    calls.push(path);
    let data: unknown = {};
    let headers: Record<string, string> = {};
    if (path === '/api/auth/login') {
      loggedIn = true;
      data = { user: owner };
      headers = { 'set-cookie': 'oh_csrf=test-only; Path=/; SameSite=Lax' };
    } else if (path === '/api/auth/logout') {
      loggedIn = false;
      headers = { 'set-cookie': 'oh_csrf=; Path=/; Max-Age=0; SameSite=Lax' };
    } else if (path === '/api/auth/me') data = loggedIn ? owner : null;
    else if (path === '/api/dashboard') data = dashboard;
    await route.fulfill({ headers, contentType: 'application/json', body: JSON.stringify(data) });
  });
  await page.goto('/');
  await page.locator('.oh-hero__actions a[href="/login"]').click();
  await page
    .getByRole('textbox', { name: 'البريد الإلكتروني', exact: true })
    .fill('preview@example.com');
  await page.getByRole('textbox', { name: 'كلمة المرور', exact: true }).fill('test-only-password');
  await page.getByRole('button', { name: 'دخول', exact: true }).click();
  await expect(page.locator('#main-content h1')).toHaveText('لوحة التحكم');
  await expect(page.locator('.oh-landing')).toHaveCount(0);
  await page.getByRole('button', { name: 'تسجيل الخروج', exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { name: 'تسجيل الدخول' })).toBeVisible();
  await page.goto('/');
  await expect(page.locator('.oh-hero h1')).toHaveText('OH Finance');
  expect(calls.filter((path) => path === '/api/auth/login')).toHaveLength(1);
  expect(calls.filter((path) => path === '/api/auth/logout')).toHaveLength(1);
});

test('a platform administrator keeps the existing platform redirect', async ({ page }) => {
  await page
    .context()
    .addCookies([{ name: 'oh_csrf', value: 'test-only', domain: 'localhost', path: '/' }]);
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    const data =
      path === '/api/auth/me'
        ? {
            ...owner,
            role: 'SUPER_ADMIN',
            isSuperAdmin: true,
            tenant: null,
            store: null,
            permissions: [],
          }
        : {
            totalTenants: 0,
            activeTenants: 0,
            totalUsers: 0,
            trialTenants: 0,
            newTenantsThisMonth: 0,
            suspendedTenants: 0,
            mrr: '0.00',
            currency: 'ILS',
          };
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(data) });
  });
  await page.goto('/');
  await expect(page).toHaveURL(/\/platform$/);
  await expect(page.locator('#main-content h1')).toHaveText('لوحة المنصة');
  await expect(page.locator('.oh-landing')).toHaveCount(0);
});

test('landing dialogs remain readable with a saved dark app theme', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => localStorage.setItem('oh_theme', 'dark'));
  await page.goto('/');
  await page.getByRole('button', { name: 'فتح القائمة' }).click();
  const title = page.getByRole('dialog').getByRole('heading', { name: 'OH Finance' });
  await expect(title).toBeVisible();
  const titleStyle = await title.evaluate((element) => ({
    color: getComputedStyle(element).color,
    background: getComputedStyle(element.closest('[role="dialog"]')!).backgroundColor,
  }));
  expect(titleStyle.background).toBe('rgb(255, 255, 255)');
  expect(titleStyle.color).not.toBe('rgb(241, 245, 249)');
  await page.keyboard.press('Escape');
  expect(await page.evaluate(() => localStorage.getItem('oh_theme'))).toBe('dark');
});
