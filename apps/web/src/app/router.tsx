import { lazy } from 'react';
import { createBrowserRouter } from 'react-router-dom';
import { CreditCard, Settings } from 'lucide-react';
import {
  RedirectIfAuthenticated,
  RequireAuth,
  RequireNotGeneralManager,
  RequirePermission,
  RequireSuperAdmin,
  RequireTenant,
} from './guards';

import { LoginPage } from '@/features/auth/login-page';
import { ForgotPasswordPage } from '@/features/auth/forgot-password-page';
import { ChangeInitialPasswordPage } from '@/features/auth/change-initial-password-page';
import { ResetPasswordPage } from '@/features/auth/reset-password-page';
import { LegalPage } from '@/features/legal/legal-page';
import { PlaceholderPage } from '@/features/placeholder/placeholder-page';
import { ForbiddenPage, NotFoundPage, RouteErrorPage } from '@/features/errors/error-pages';

const AppShell = lazy(() =>
  import('@/components/layout/app-shell').then((module) => ({ default: module.AppShell })),
);
const ShortcutsLayout = lazy(() =>
  import('./shortcuts-layout').then((module) => ({ default: module.ShortcutsLayout })),
);

const DashboardPage = lazy(() =>
  import('@/features/dashboard/dashboard-page').then((module) => ({
    default: module.DashboardPage,
  })),
);
const CustomersPage = lazy(() =>
  import('@/features/customers/customers-page').then((module) => ({
    default: module.CustomersPage,
  })),
);
const CustomerArchivePage = lazy(() =>
  import('@/features/customers/customer-archive-page').then((module) => ({
    default: module.CustomerArchivePage,
  })),
);
const CustomerDetailPage = lazy(() =>
  import('@/features/customers/customer-detail-page').then((module) => ({
    default: module.CustomerDetailPage,
  })),
);
const OrdersPage = lazy(() =>
  import('@/features/orders/orders-page').then((module) => ({ default: module.OrdersPage })),
);
const OrderDetailsPage = lazy(() =>
  import('@/features/orders/order-details-page').then((module) => ({
    default: module.OrderDetailsPage,
  })),
);
const LedgerPage = lazy(() =>
  import('@/features/ledger/ledger-page').then((module) => ({ default: module.LedgerPage })),
);
const PaymentsPage = lazy(() =>
  import('@/features/payments/payments-page').then((module) => ({ default: module.PaymentsPage })),
);
const EmployeesPage = lazy(() =>
  import('@/features/employees/employees-page').then((module) => ({
    default: module.EmployeesPage,
  })),
);
const ReportsPage = lazy(() =>
  import('@/features/reports/reports-page').then((module) => ({ default: module.ReportsPage })),
);
const SettingsPage = lazy(() =>
  import('@/features/settings/settings-page').then((module) => ({ default: module.SettingsPage })),
);
const SupportPage = lazy(() =>
  import('@/features/support/support-page').then((module) => ({ default: module.SupportPage })),
);
const PlatformDashboardPage = lazy(() =>
  import('@/features/platform/platform-dashboard-page').then((module) => ({
    default: module.PlatformDashboardPage,
  })),
);
const TenantsListPage = lazy(() =>
  import('@/features/platform/tenants-list-page').then((module) => ({
    default: module.TenantsListPage,
  })),
);
const TenantFormPage = lazy(() =>
  import('@/features/platform/tenant-form-page').then((module) => ({
    default: module.TenantFormPage,
  })),
);
const StaffPage = lazy(() =>
  import('@/features/platform/staff-page').then((module) => ({ default: module.StaffPage })),
);
const PlatformSubscriptionsPage = lazy(() =>
  import('@/features/platform/subscriptions-page').then((module) => ({
    default: module.PlatformSubscriptionsPage,
  })),
);

/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  خريطة المسارات.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  ثلاث مناطق:
 *    عام            → /login, /forgot-password
 *    المحل          → /  (يتطلب مستأجرًا؛ المدير العام يُوجَّه بعيدًا)
 *    المنصة         → /platform/*  (المدير العام حصرًا)
 *
 *  الحراس هنا **تجربة مستخدم**. البيانات كلها من الـAPI، وهو من يفرض الحماية.
 *  حذف هذا الملف بالكامل لا يفتح أي بيانات — يجعل التنقّل قبيحًا فقط.
 */
export const router = createBrowserRouter([
  { path: '/privacy', element: <LegalPage kind="privacy" />, errorElement: <RouteErrorPage /> },
  { path: '/reset-password', element: <ResetPasswordPage />, errorElement: <RouteErrorPage /> },
  {
    path: '/site-policy',
    element: <LegalPage kind="sitePolicy" />,
    errorElement: <RouteErrorPage />,
  },

  // ── عام ─────────────────────────────────────────────────────────────────
  {
    element: <RedirectIfAuthenticated />,
    errorElement: <RouteErrorPage />,
    children: [
      { path: '/change-initial-password', element: <ChangeInitialPasswordPage /> },
      { path: '/login', element: <LoginPage /> },
      { path: '/forgot-password', element: <ForgotPasswordPage /> },
    ],
  },

  // ── موثّق ───────────────────────────────────────────────────────────────
  {
    element: <RequireAuth />,
    errorElement: <RouteErrorPage />,
    children: [
      // ── المحل ───────────────────────────────────────────────────────────
      {
        element: <RequireTenant />,
        children: [
          {
            element: <ShortcutsLayout />,
            children: [
              {
                element: <AppShell />,
                children: [
                  { index: true, element: <DashboardPage /> },
                  {
                    path: 'support',
                    element: <RequireNotGeneralManager />,
                    children: [{ index: true, element: <SupportPage /> }],
                  },

                  // ── أقسام المراحل القادمة ─────────────────────────────────
                  // موجودة كمسارات حقيقية، بترويسات حقيقية، وحالة «قيد التطوير»
                  // صريحة. لا بيانات وهمية ولا أزرار ميتة.
                  // ── المرحلة 2: موصولة ببيانات حقيقية ──
                  { path: 'customers', element: <CustomersPage /> },
                  { path: 'customers/archive', element: <CustomerArchivePage /> },
                  { path: 'customers/:id', element: <CustomerDetailPage /> },
                  { path: 'orders', element: <OrdersPage /> },
                  { path: 'orders/:id', element: <OrderDetailsPage /> },
                  { path: 'payments', element: <PaymentsPage /> },
                  { path: 'ledger', element: <LedgerPage /> },
                  {
                    path: 'reports',
                    element: <RequirePermission permission="reports.read" />,
                    children: [{ index: true, element: <ReportsPage /> }],
                  },
                  {
                    path: 'employees',
                    element: <RequirePermission permission="employees.read" />,
                    children: [{ index: true, element: <EmployeesPage /> }],
                  },
                  {
                    path: 'settings',
                    element: <RequirePermission permission="settings.read" />,
                    children: [{ index: true, element: <SettingsPage /> }],
                  },
                  {
                    path: 'profile',
                    element: (
                      <PlaceholderPage
                        titleKey="common.profile"
                        icon={Settings}
                        description="الملف الشخصي، تغيير كلمة المرور، التحقق بخطوتين، الجلسات النشطة."
                        phase="المرحلة 8"
                      />
                    ),
                  },
                ],
              },
            ],
          },
        ],
      },

      // ── المنصة (المدير العام) ───────────────────────────────────────────
      {
        path: 'platform',
        element: <RequireSuperAdmin />,
        children: [
          {
            element: <AppShell />,
            children: [
              { index: true, element: <PlatformDashboardPage /> },
              { path: 'tenants', element: <TenantsListPage /> },
              { path: 'tenants/new', element: <TenantFormPage /> },
              { path: 'tenants/:id', element: <TenantFormPage /> },
              { path: 'subscriptions', element: <PlatformSubscriptionsPage /> },
              { path: 'staff', element: <StaffPage /> },
              {
                path: 'support',
                element: <RequireNotGeneralManager />,
                children: [{ index: true, element: <SupportPage /> }],
              },
              {
                path: 'plans',
                element: (
                  <PlaceholderPage
                    titleKey="nav.plans"
                    icon={CreditCard}
                    description="إنشاء وتعديل الباقات وحدودها وأسعارها."
                    phase="المرحلة 9"
                  />
                ),
              },
            ],
          },
        ],
      },
    ],
  },

  // ── صفحات الأخطاء ───────────────────────────────────────────────────────
  { path: '/403', element: <ForbiddenPage /> },
  { path: '*', element: <NotFoundPage /> },
]);
