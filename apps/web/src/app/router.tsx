import { createBrowserRouter } from 'react-router-dom';
import {
  BarChart3,
  CreditCard,
  FileText,
  ListOrdered,
  MessageCircle,
  Package,
  Settings,
  ShoppingBag,
  Users,
  Wallet,
} from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { RedirectIfAuthenticated, RequireAuth, RequireSuperAdmin, RequireTenant } from './guards';

import { LoginPage } from '@/features/auth/login-page';
import { ForgotPasswordPage } from '@/features/auth/forgot-password-page';
import { DashboardPage } from '@/features/dashboard/dashboard-page';
import { SubscriptionPage } from '@/features/subscription/subscription-page';
import { PlatformDashboardPage } from '@/features/platform/platform-dashboard-page';
import { TenantsListPage } from '@/features/platform/tenants-list-page';
import { TenantFormPage } from '@/features/platform/tenant-form-page';
import { PlaceholderPage } from '@/features/placeholder/placeholder-page';
import { ForbiddenPage, NotFoundPage, RouteErrorPage } from '@/features/errors/error-pages';

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
  // ── عام ─────────────────────────────────────────────────────────────────
  {
    element: <RedirectIfAuthenticated />,
    errorElement: <RouteErrorPage />,
    children: [
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
            element: <AppShell />,
            children: [
              { index: true, element: <DashboardPage /> },

              { path: 'subscription', element: <SubscriptionPage /> },

              // ── أقسام المراحل القادمة ─────────────────────────────────
              // موجودة كمسارات حقيقية، بترويسات حقيقية، وحالة «قيد التطوير»
              // صريحة. لا بيانات وهمية ولا أزرار ميتة.
              {
                path: 'customers',
                element: (
                  <PlaceholderPage
                    titleKey="nav.customers"
                    icon={Users}
                    description="إضافة الزبائن، ملفاتهم، أرصدتهم، وحدودهم الائتمانية."
                    phase="المرحلة 4"
                  />
                ),
              },
              {
                path: 'orders',
                element: (
                  <PlaceholderPage
                    titleKey="nav.orders"
                    icon={ShoppingBag}
                    description="الطلبات: مسودة، عرض سعر، مؤكد. كل طلب مؤكد يولّد حركة مدينة."
                    phase="المرحلة 4"
                  />
                ),
              },
              {
                path: 'payments',
                element: (
                  <PlaceholderPage
                    titleKey="nav.payments"
                    icon={Wallet}
                    description="الدفع الكامل والجزئي، توزيع الدفعة على عدة طلبات، ومنع التسجيل المزدوج."
                    phase="المرحلة 5"
                  />
                ),
              },
              {
                path: 'ledger',
                element: (
                  <PlaceholderPage
                    titleKey="nav.ledger"
                    icon={ListOrdered}
                    description="دفتر الحركات المالية: الرصيد قبل، المبلغ، الرصيد بعد — بلا حذف ولا تعديل."
                    phase="المرحلة 5"
                  />
                ),
              },
              {
                path: 'reports',
                element: (
                  <PlaceholderPage
                    titleKey="nav.reports"
                    icon={BarChart3}
                    description="تقارير مالية وتشغيلية مع رسوم بيانية وتصدير."
                    phase="المرحلة 6"
                  />
                ),
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
                element: (
                  <PlaceholderPage
                    titleKey="nav.settings"
                    icon={Settings}
                    description="سبعة تبويبات: عام، المالية، الفواتير، الطباعة، الرسائل، سجل النشاط، الاشتراك."
                    phase="المرحلة 8"
                  />
                ),
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
