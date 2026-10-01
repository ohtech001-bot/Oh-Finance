import { expect, test } from '@playwright/test';

for (const width of [390, 1280]) {
  test(`navigation reuses warmed data and keeps navigation visible at ${width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 844 });
    await page
      .context()
      .addCookies([{ name: 'oh_csrf', value: 'test-only', domain: 'localhost', path: '/' }]);
    const requests = new Map<string, number>();
    let ordersReady = false;
    await page.route('**/api/**', async (route) => {
      const path = new URL(route.request().url()).pathname;
      requests.set(path, (requests.get(path) ?? 0) + 1);
      let data: unknown = { items: [], total: 0, page: 1, pageSize: 10, totalPages: 0 };
      if (path === '/api/auth/me')
        data = {
          id: 'test-user',
          email: 'preview@example.com',
          name: 'Preview',
          role: 'OWNER',
          permissions: ['customers.read', 'orders.read', 'ledger.read'],
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
      else if (path === '/api/customers/stats')
        data = {
          total: 0,
          active: 0,
          totalDebt: '0.00',
          withDebt: 0,
          overCreditLimit: 0,
          overduePaymentCustomers: 0,
        };
      else if (path === '/api/orders/stats')
        data = {
          total: 0,
          confirmed: 0,
          draft: 0,
          totalDebt: '0.00',
          unpaidAmount: '0.00',
          paid: 0,
          unpaid: 0,
          partiallyPaid: 0,
          totalAmount: '0.00',
          outstandingAmount: '0.00',
          quote: 0,
          cancelled: 0,
        };
      if (path.startsWith('/api/orders')) await new Promise((resolve) => setTimeout(resolve, 400));
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify(data) });
      if (path === '/api/orders') ordersReady = true;
    });
    await page.goto('/customers');
    await expect(page.locator('#main-content h1')).toHaveText('الزبائن');
    await expect(page.locator('#main-content .animate-pulse')).toHaveCount(0);
    // Vite development uses StrictMode, which can abort/restart the initial query.
    const initialCustomers = requests.get('/api/customers');
    const initialStats = requests.get('/api/customers/stats');
    const navigation =
      width === 390
        ? page.getByRole('navigation', { name: 'التنقل السريع' })
        : page.locator('aside:visible');
    const orders = navigation.locator('a[href="/orders"]').first();
    await orders.focus();
    await expect.poll(() => ordersReady).toBe(true);
    await orders.click();
    await expect(page.locator('#main-content h1')).toHaveText('الطلبات');
    await expect(navigation).toBeVisible();
    await expect(page.locator('.startup-loader')).toHaveCount(0);
    expect(requests.get('/api/orders')).toBe(1);
    expect(requests.get('/api/orders/stats')).toBe(1);

    await navigation.locator('a[href="/customers"]').first().click();
    await expect(page.locator('#main-content h1')).toHaveText('الزبائن');
    expect(requests.get('/api/customers')).toBe(initialCustomers);
    expect(requests.get('/api/customers/stats')).toBe(initialStats);
    await page.locator('#main-content .page-enter').evaluate(async (element) => {
      await Promise.all(element.getAnimations().map((animation) => animation.finished));
    });
    await page.screenshot({ path: testInfo.outputPath(`navigation-${width}.png`), fullPage: true });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  });
}
