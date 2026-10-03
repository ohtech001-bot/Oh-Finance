import { expect, test, type Page } from '@playwright/test';
import { PERMISSIONS } from '@oh/config';

const owner = {
  id: 'test-owner',
  email: 'preview@example.com',
  name: 'Preview',
  role: 'OWNER',
  permissions: Object.values(PERMISSIONS),
  locale: 'ar',
  isSuperAdmin: false,
  supportMode: false,
  mustChangePassword: false,
  twoFactorEnabled: false,
  avatarUrl: null,
  tenant: { id: 'test-tenant', name: 'Preview Store', slug: 'preview', status: 'ACTIVE' },
  store: {
    id: 'test-store',
    code: 'preview',
    name: 'Preview Store',
    currency: 'ILS',
    logoUrl: null,
    phone: '0506446682',
    taxEnabled: true,
    taxRate: 18,
    timezone: 'Asia/Jerusalem',
  },
};
const list = { items: [], total: 0, page: 1, pageSize: 20, totalPages: 0 };

async function mockOwner(page: Page, platform = false) {
  await page
    .context()
    .addCookies([{ name: 'oh_csrf', value: 'test-only', domain: 'localhost', path: '/' }]);
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    let data: unknown = list;
    if (path === '/api/auth/me')
      data = platform
        ? { ...owner, role: 'SUPER_ADMIN', isSuperAdmin: true, tenant: null, store: null }
        : owner;
    if (path === '/api/employees') data = [];
    if (path === '/api/platform/staff' || path === '/api/platform/plans') data = [];
    if (path === '/api/platform/stats')
      data = {
        totalTenants: 0,
        activeTenants: 0,
        trialTenants: 0,
        suspendedTenants: 0,
        totalUsers: 0,
        newTenantsThisMonth: 0,
        mrr: '0.00',
        currency: 'ILS',
      };
    if (path === '/api/reports')
      data = {
        kpis: { outstanding: { value: '0.00' }, ordersCount: { value: '0' }, totalCustomers: 0 },
        salesVsPayments: [],
        ordersByWeekday: [],
        topDebtors: [],
        urgentCustomers: [],
        paymentMethods: [],
        topCustomers: [],
        topProducts: [],
        employeePerformance: [],
      };
    if (path === '/api/customers/stats')
      data = {
        total: 0,
        active: 0,
        withDebt: 0,
        totalDebt: '0.00',
        overCreditLimit: 0,
        overduePaymentCustomers: 0,
      };
    if (path === '/api/orders/stats')
      data = {
        total: 0,
        draft: 0,
        quote: 0,
        confirmed: 0,
        partiallyPaid: 0,
        paid: 0,
        cancelled: 0,
        totalAmount: '0.00',
        outstandingAmount: '0.00',
      };
    if (path === '/api/payments/stats')
      data = { totalCount: 0, totalAmount: '0.00', dailyAverage: '0.00', byMethod: {} };
    if (path === '/api/dashboard')
      data = {
        kpis: [],
        trends: [],
        alerts: [],
        recentOrders: [],
        recentPayments: [],
        meta: { storeName: 'Preview Store', scope: { lists: [] } },
      };
    if (path === '/api/settings')
      data = {
        general: {
          name: 'Preview Store',
          logoUrl: null,
          phone: '0506446682',
          email: 'preview@example.com',
          address: '',
          city: '',
          website: '',
        },
        financial: {
          currency: 'ILS',
          country: 'Test',
          numberFormat: '1,234.56',
          dateFormat: 'YYYY-MM-DD',
          tax: { enabled: true, rate: 18, text: '' },
        },
        messaging: { enabled: false, automaticReminders: false, defaultOrderMessage: '' },
      };
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(data) });
  });
}

async function expectHebrewUi(page: Page) {
  const remaining = await page.locator('body').evaluate((body) => {
    const walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT);
    const result: string[] = [];
    let node: Node | null;
    while ((node = walker.nextNode())) {
      const element = node.parentElement;
      if (!element || !element.getClientRects().length || element.closest('script,style')) continue;
      const text = node.textContent?.trim() ?? '';
      if (/[\u0600-\u06ff]/u.test(text) && text !== 'العربية') result.push(text);
    }
    return result;
  });
  expect(remaining).toEqual([]);
}

for (const width of [390, 1440]) {
  test(`landing changes every live label and WhatsApp message at ${width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    await page.goto('/');
    await page.getByRole('button', { name: 'עברית', exact: true }).click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'he');
    await expect(page.locator('.oh-landing')).toHaveAttribute('lang', 'he');
    await expectHebrewUi(page);
    const href = await page.locator('.oh-hero__actions a').first().getAttribute('href');
    expect(new URL(href!).searchParams.get('text')).toContain('מעוניין להצטרף');
    await expect(page).toHaveTitle('OH Finance | ניהול עסק חכם');
    await page.screenshot({
      path: testInfo.outputPath(`he-landing-${width}.png`),
      animations: 'disabled',
    });
    await page.getByRole('button', { name: 'العربية', exact: true }).click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
    await expect(page.locator('.oh-hero__headline')).toContainText('إدارة مالك');
  });

  test(`owner pages and open customer forms are fully localized at ${width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    await page.addInitScript(() => localStorage.setItem('oh_locale', 'he'));
    await mockOwner(page);
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    for (const path of [
      '/customers',
      '/customers/archive',
      '/orders',
      '/payments',
      '/ledger',
      '/employees',
      '/settings',
      '/reports',
    ]) {
      await page.goto(path);
      await expect(page.locator('#main-content h1')).toBeVisible();
      await expect(page.locator('html')).toHaveAttribute('lang', 'he');
      await expectHebrewUi(page);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
    }
    await page.goto('/customers');
    await page.getByRole('button', { name: 'הוספת לקוח חדש', exact: true }).first().click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(
      page.getByRole('dialog').getByRole('textbox', { name: 'טלפון', exact: true }),
    ).toBeVisible();
    await expectHebrewUi(page);
    await page.screenshot({
      path: testInfo.outputPath(`he-customer-form-${width}.png`),
      animations: 'disabled',
    });
    await page.keyboard.press('Escape');
    expect(errors).toEqual([]);
  });

  test(`platform pages and tenant creation use Hebrew at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    await page.addInitScript(() => localStorage.setItem('oh_locale', 'he'));
    await mockOwner(page, true);
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    for (const path of [
      '/platform',
      '/platform/tenants',
      '/platform/tenants/new',
      '/platform/subscriptions',
      '/platform/staff',
      '/platform/plans',
    ]) {
      await page.goto(path);
      if (path === '/platform/tenants/new') await expect(page.getByRole('dialog')).toBeVisible();
      else await expect(page.locator('#main-content h1')).toBeVisible();
      await expectHebrewUi(page);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
    }
    expect(errors).toEqual([]);
  });
}
