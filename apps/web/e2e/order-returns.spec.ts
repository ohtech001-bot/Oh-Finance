import { expect, test } from '@playwright/test';

const customerId = 'b48fa377-0643-4b5f-b8c4-8c80ff078c70';
const orderId = '74d4f6a4-1aa6-4e13-b94e-e3f9ad034f35';
const date = '2026-09-30T10:00:00.000Z';
const customer = {
  id: customerId,
  code: 'CUS-0001',
  name: 'زبون اختبار المرتجعات',
  phone: '0506446682',
  balance: '270.00',
  creditLimit: '1000.00',
  availableCredit: '730.00',
  accountState: 'DEBIT',
  city: 'صندلة',
  status: 'ACTIVE',
  tags: [],
  paymentDueDay: 15,
  paymentTermDays: 0,
  paymentDueDate: null,
  createdAt: date,
  updatedAt: date,
  archivedAt: null,
};
const original = {
  id: orderId,
  number: 'ORD-00001',
  status: 'CONFIRMED',
  customerId,
  customerName: customer.name,
  customerCode: customer.code,
  issuedAt: date,
  dueAt: null,
  subtotal: '300.00',
  discountAmount: '30.00',
  taxAmount: '0.00',
  total: '270.00',
  netTotal: '270.00',
  returnedAmount: '0.00',
  paidAmount: '0.00',
  creditAppliedAmount: '0.00',
  remainingAmount: '270.00',
  isLocked: true,
  isOverdue: false,
  isArchived: false,
  itemCount: 2,
  version: 1,
  confirmedAt: date,
  cancelledAt: null,
  cancelReason: null,
  createdAt: date,
  notes: null,
  allocations: [],
  returns: [],
  items: [
    {
      id: '88d41dc9-131c-4554-9499-3d5794893b76',
      name: 'شوال رمل',
      quantity: '1',
      unitPrice: '100.00',
      lineTotal: '100.00',
      discount: '0.00',
      taxRate: '0',
      sortOrder: 0,
      sourceType: 'MANUAL',
      sourceId: null,
      description: null,
      returned: false,
      returnableAmount: '90.00',
    },
    {
      id: 'b43c98f0-099a-4ed3-8b7b-b10596258525',
      name: 'دهان',
      quantity: '1',
      unitPrice: '200.00',
      lineTotal: '200.00',
      discount: '0.00',
      taxRate: '0',
      sortOrder: 1,
      sourceType: 'MANUAL',
      sourceId: null,
      description: null,
      returned: false,
      returnableAmount: '180.00',
    },
  ],
};

for (const width of [390, 1280]) {
  test(`customer return flow at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 844 });
    await page
      .context()
      .addCookies([{ name: 'oh_csrf', value: 'test-only', domain: 'localhost', path: '/' }]);
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    let current = structuredClone(original);
    let submitted: { itemIds: string[]; version: number; requestId: string } | undefined;
    await page.route('**/api/**', async (route) => {
      const url = new URL(route.request().url());
      const path = url.pathname;
      let data: unknown = { items: [], total: 0, totalPages: 1, page: 1, pageSize: 10 };
      if (path === '/api/auth/me')
        data = {
          id: 'test-user',
          email: 'preview@example.com',
          name: 'Preview owner',
          role: 'OWNER',
          permissions: ['customers.read', 'orders.read', 'orders.cancel'],
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
      else if (path === `/api/customers/${customerId}`) data = customer;
      else if (path === `/api/customers/${customerId}/summary`) data = null;
      else if (path === '/api/notifications') data = { items: [], unreadCount: 0 };
      else if (path === `/api/orders/${orderId}/returns`) {
        submitted = route.request().postDataJSON();
        const fullReturn = submitted?.itemIds.length === 2;
        current = {
          ...current,
          returnedAmount: fullReturn ? '270.00' : '90.00',
          netTotal: fullReturn ? '0.00' : '180.00',
          remainingAmount: fullReturn ? '0.00' : '180.00',
          status: fullReturn ? 'PAID' : 'CONFIRMED',
          version: 2,
          items: current.items.map((item) =>
            submitted?.itemIds.includes(item.id)
              ? { ...item, returned: true, returnableAmount: '0.00' }
              : item,
          ),
        };
        data = current;
      } else if (path === `/api/orders/${orderId}`) data = current;
      else if (path === '/api/orders')
        data = { items: [current], total: 1, totalPages: 1, page: 1, pageSize: 10 };
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify(data) });
    });
    await page.goto(`/customers/${customerId}`);
    await page.getByRole('button', { name: 'إرجاع طلبية', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: /00001/ }).click();
    await dialog
      .getByRole('checkbox', { name: width === 390 ? /شوال رمل/ : /إرجاع جميع المنتجات/ })
      .check();
    await expect(dialog.getByText('قيمة الإرجاع')).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'إرجاع طلبية', exact: true })).toBeEnabled();
    await page.screenshot({ path: testInfo.outputPath(`returns-${width}.png`), fullPage: true });
    const bounds = await dialog.boundingBox();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width + 1);
    await dialog.getByRole('button', { name: 'إرجاع طلبية', exact: true }).click();
    const confirmation = page.getByRole('dialog', {
      name: 'هل تريد إرجاع الطلبية أو المنتجات المحددة منها؟',
    });
    await expect(confirmation).toContainText('هل تريد إرجاع');
    await confirmation.getByRole('button', { name: 'إرجاع طلبية', exact: true }).click();
    await expect
      .poll(() => submitted?.itemIds)
      .toEqual(width === 390 ? [original.items[0]!.id] : original.items.map((item) => item.id));
    expect(submitted?.version).toBe(1);
    expect(submitted?.requestId).toMatch(/^[0-9a-f-]{36}$/);
    await expect(page.getByText('تم الإرجاع وتحديث حساب الزبون.')).toBeVisible();
    await dialog.getByRole('button', { name: 'إلغاء', exact: true }).click();
    await page.getByText('00001', { exact: true }).click();
    await expect(dialog.getByText('شوال رمل', { exact: true })).toBeVisible();
    await expect(dialog.getByText('قيمة المرتجعات', { exact: true })).toBeVisible();
    await expect(dialog.getByText('الصافي بعد الإرجاع', { exact: true })).toBeVisible();
    expect(errors).toEqual([]);
  });
}
