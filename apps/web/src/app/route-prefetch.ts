const loaders = {
  dashboard: () => import('@/features/dashboard/dashboard-page'),
  customers: () => import('@/features/customers/customers-page'),
  customerArchive: () => import('@/features/customers/customer-archive-page'),
  orders: () => import('@/features/orders/orders-page'),
  payments: () => import('@/features/payments/payments-page'),
  ledger: () => import('@/features/ledger/ledger-page'),
  reports: () => import('@/features/reports/reports-page'),
  employees: () => import('@/features/employees/employees-page'),
  settings: () => import('@/features/settings/settings-page'),
  platform: () => import('@/features/platform/platform-dashboard-page'),
  tenants: () => import('@/features/platform/tenants-list-page'),
  subscriptions: () => import('@/features/platform/subscriptions-page'),
  staff: () => import('@/features/platform/staff-page'),
} as const;

function loaderFor(path: string): (() => Promise<unknown>) | undefined {
  if (path === '/') return loaders.dashboard;
  if (path === '/platform') return loaders.platform;
  if (path.startsWith('/customers/archive')) return loaders.customerArchive;
  if (path.startsWith('/customers')) return loaders.customers;
  if (path.startsWith('/orders')) return loaders.orders;
  if (path.startsWith('/payments')) return loaders.payments;
  if (path.startsWith('/ledger')) return loaders.ledger;
  if (path.startsWith('/reports')) return loaders.reports;
  if (path.startsWith('/employees')) return loaders.employees;
  if (path.startsWith('/settings')) return loaders.settings;
  if (path.startsWith('/platform/tenants')) return loaders.tenants;
  if (path.startsWith('/platform/subscriptions')) return loaders.subscriptions;
  if (path.startsWith('/platform/staff')) return loaders.staff;
  return undefined;
}

export function prefetchRoute(path: string): void {
  void loaderFor(path)?.();
}

export function prefetchPrimaryRoutes(platform: boolean): void {
  const targets = platform
    ? [loaders.platform, loaders.tenants, loaders.subscriptions, loaders.staff]
    : [
        loaders.dashboard,
        loaders.customers,
        loaders.customerArchive,
        loaders.orders,
        loaders.payments,
        loaders.ledger,
        loaders.reports,
        loaders.employees,
        loaders.settings,
      ];
  for (const load of targets) void load();
}
