const loaders = {
  dashboard: () => import('@/features/dashboard/dashboard-page'),
  customers: () => import('@/features/customers/customers-page'),
  customerArchive: () => import('@/features/customers/customer-archive-page'),
  customerDetail: () => import('@/features/customers/customer-detail-page'),
  orders: () => import('@/features/orders/orders-page'),
  orderDetail: () => import('@/features/orders/order-details-page'),
  payments: () => import('@/features/payments/payments-page'),
  ledger: () => import('@/features/ledger/ledger-page'),
  reports: () => import('@/features/reports/reports-page'),
  employees: () => import('@/features/employees/employees-page'),
  settings: () => import('@/features/settings/settings-page'),
  platform: () => import('@/features/platform/platform-dashboard-page'),
  tenants: () => import('@/features/platform/tenants-list-page'),
  tenantDetail: () => import('@/features/platform/tenant-form-page'),
  subscriptions: () => import('@/features/platform/subscriptions-page'),
  staff: () => import('@/features/platform/staff-page'),
} as const;

function loaderFor(path: string): (() => Promise<unknown>) | undefined {
  if (path === '/') return loaders.dashboard;
  if (path === '/platform') return loaders.platform;
  if (path.startsWith('/customers/archive')) return loaders.customerArchive;
  if (path === '/customers') return loaders.customers;
  if (path.startsWith('/customers/')) return loaders.customerDetail;
  if (path === '/orders') return loaders.orders;
  if (path.startsWith('/orders/')) return loaders.orderDetail;
  if (path.startsWith('/payments')) return loaders.payments;
  if (path.startsWith('/ledger')) return loaders.ledger;
  if (path.startsWith('/reports')) return loaders.reports;
  if (path.startsWith('/employees')) return loaders.employees;
  if (path.startsWith('/settings')) return loaders.settings;
  if (path === '/platform/tenants') return loaders.tenants;
  if (path.startsWith('/platform/tenants/')) return loaders.tenantDetail;
  if (path.startsWith('/platform/subscriptions')) return loaders.subscriptions;
  if (path.startsWith('/platform/staff')) return loaders.staff;
  return undefined;
}

export function prefetchRoute(path: string): void {
  void loaderFor(path.split('?')[0] ?? path)?.().catch(() => {
    // Speculative loading must not prevent normal navigation/retry.
  });
}

export function prefetchPrimaryRoutes(platform: boolean): () => void {
  const connection = (
    navigator as Navigator & {
      connection?: { saveData?: boolean; effectiveType?: string };
    }
  ).connection;
  if (connection?.saveData || /(^|-)2g$/.test(connection?.effectiveType ?? '')) return () => {};

  const targets = platform ? [loaders.tenants] : [loaders.customers, loaders.orders];
  let cancelled = false;
  let timer: number;
  const loadNext = async (index: number) => {
    if (cancelled || index >= targets.length) return;
    await targets[index]?.().catch(() => {});
    if (!cancelled) timer = window.setTimeout(() => void loadNext(index + 1), 1_000);
  };
  // Let the visible page's requests and rendering finish before warming other chunks.
  timer = window.setTimeout(() => void loadNext(0), 2_500);
  return () => {
    cancelled = true;
    window.clearTimeout(timer);
  };
}
