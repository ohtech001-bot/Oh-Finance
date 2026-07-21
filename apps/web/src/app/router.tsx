import { createBrowserRouter } from 'react-router-dom';
import { CreditCard, FileText, MessageCircle, Package, Settings, Users } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import {
  RedirectIfAuthenticated,
  RequireAuth,
  RequireNotGeneralManager,
  RequirePermission,
  RequireSuperAdmin,
  RequireTenant,
} from './guards';
import { ReportsPage } from '@/features/reports/reports-page';
import { SettingsPage } from '@/features/settings/settings-page';
import { ShortcutsLayout } from './shortcuts-layout';

import { LoginPage } from '@/features/auth/login-page';
import { ForgotPasswordPage } from '@/features/auth/forgot-password-page';
import { ChangeInitialPasswordPage } from '@/features/auth/change-initial-password-page';
import { DashboardPage } from '@/features/dashboard/dashboard-page';
import { ActivityPage } from '@/features/activity/activity-page';
import { SubscriptionPage } from '@/features/subscription/subscription-page';
import { PlatformDashboardPage } from '@/features/platform/platform-dashboard-page';
import { TenantsListPage } from '@/features/platform/tenants-list-page';
import { TenantFormPage } from '@/features/platform/tenant-form-page';
import { StaffPage } from '@/features/platform/staff-page';
import { PlatformSubscriptionsPage } from '@/features/platform/subscriptions-page';
import { SupportPage } from '@/features/support/support-page';
import { LegalPage } from '@/features/legal/legal-page';
import { PlaceholderPage } from '@/features/placeholder/placeholder-page';
import { ForbiddenPage, NotFoundPage, RouteErrorPage } from '@/features/errors/error-pages';

// ── المرحلة 2: النواة المالية ──
import { CustomersPage } from '@/features/customers/customers-page';
import { CustomerDetailPage } from '@/features/customers/customer-detail-page';
import { OrdersPage } from '@/features/orders/orders-page';
import { OrderDetailsPage } from '@/features/orders/order-details-page';
import { LedgerPage } from '@/features/ledger/ledger-page';
import { PaymentsPage } from '@/features/payments/payments-page';

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
                    path: 'activity',
                    element: <RequirePermission permission="activity.read" />,
                    children: [{ index: true, element: <ActivityPage /> }],
                  },

                  { path: 'subscription', element: <SubscriptionPage /> },
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
                    path: 'documents',
                    element: (
                      <PlaceholderPage
                        titleKey="nav.documents"
                        icon={FileText}
                        description="طباعة الطلبات وعروض الأسعار وكشوف الحساب بالعربية والعبرية."
                        phase="المرحلة 6"
                      />
                    ),
                  },
                  {
                    path: 'messages',
                    element: (
                      <PlaceholderPage
                        titleKey="nav.messages"
                        icon={MessageCircle}
                        description="إرسال الرصيد الحالي للزبون عبر واتساب أو SMS أو البريد."
                        phase="المرحلة 7"
                      />
                    ),
                  },
                  {
                    path: 'products',
                    element: (
                      <PlaceholderPage
                        titleKey="nav.products"
                        icon={Package}
                        description="كتالوج منتجات اختياري. إدخال بنود الطلب يدويًا يعمل بدونه."
                        phase="المرحلة 4"
                      />
                    ),
                  },
                  {
                    path: 'employees',
                    element: (
                      <PlaceholderPage
                        titleKey="nav.employees"
                        icon={Users}
                        description="الموظفون والأدوار والصلاحيات."
                        phase="المرحلة 8"
                      />
                    ),
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
