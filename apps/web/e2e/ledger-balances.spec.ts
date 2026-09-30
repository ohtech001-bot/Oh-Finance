import { expect, test } from '@playwright/test';

for (const width of [390, 1280]) {
  test(`ledger distinguishes debt and credit at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 844 });
    await page.context().addCookies([
      { name: 'oh_csrf', value: 'test-only', domain: 'localhost', path: '/' },
    ]);
    const balances = ['500.00', '0.00', '-200.00'];
    await page.route('**/api/**', async (route) => {
      const path = new URL(route.request().url()).pathname;
      let data: unknown = { items: [], total: 0, totalPages: 1, page: 1, pageSize: 10 };
      if (path === '/api/auth/me') {
        data = {
          id: 'test-user',
          email: 'preview@example.com',
          name: 'Preview owner',
          role: 'OWNER',
          permissions: ['ledger.read'],
          locale: 'ar',
          isSuperAdmin: false,
          supportMode: false,
          mustChangePassword: false,
          twoFactorEnabled: false,
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
      } else if (path === '/api/notifications') data = { items: [], unreadCount: 0 };
      else if (path === '/api/ledger') {
        data = {
          items: balances.map((balance, index) => ({
            id: `entry-${index}`,
            seq: index + 1,
            customerId: `customer-${index}`,
            customerName: ['زبون مديون', 'زبون مسدد', 'زبون لديه رصيد'][index],
            customerCode: `CUS-${index}`,
            entryType: 'PAYMENT_CREDIT',
            openingBalance: index === 0 ? '1000.00' : '500.00',
            debit: '0.00',
            credit: index === 2 ? '700.00' : '500.00',
            runningBalance: balance,
            refType: 'PAYMENT',
            refNumber: `PAY-${index}`,
            refId: null,
            relatedOrderNumbers: ['ORD-00001'],
            reversesEntryId: null,
            isReversed: false,
            notes: null,
            occurredAt: '2026-09-30T10:00:00.000Z',
            createdAt: '2026-09-30T10:00:00.000Z',
            createdBy: null,
            createdByName: null,
          })),
          total: 3,
          totalPages: 1,
          page: 1,
          pageSize: 10,
          totals: {
            totalDebit: '0.00',
            totalCredit: '1700.00',
            currentBalance: '-1700.00',
            entryCount: 3,
          },
        };
      }
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify(data) });
    });
    await page.goto('/ledger');
    const view = width === 390 ? page.locator('article') : page.getByRole('table');
    await expect(view.getByText('غير مديون').first()).toBeVisible();
    await expect(view.getByText('الحساب مسدد').first()).toBeVisible();
    await expect(view.getByText('-500.00', { exact: true }).first()).toBeVisible();
    await expect(view.getByText('+200.00', { exact: true }).first()).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      width,
    );
    await page.screenshot({ path: testInfo.outputPath(`ledger-${width}.png`), fullPage: true });
  });
}
