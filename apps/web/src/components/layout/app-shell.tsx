import { useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { Drawer, DrawerContent } from '@oh/ui';
import { useAuth } from '@/app/auth-context';
import { PLATFORM_NAV, TENANT_NAV } from './nav-items';
import { MobileTabBar } from './mobile-tabbar';
import { Sidebar } from './sidebar';
import { Topbar } from './topbar';
import { currentLocale } from '@/lib/i18n';

/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  الهيكل العام — مطابق للمرجع البصري.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  ديسكتوب (≥1024px):  شريط جانبي ثابت 260px + شريط علوي 72px + محتوى.
 *  موبايل/تابلت:        شريط علوي + درج منزلق + شريط تبويب سفلي.
 *
 *  ── لماذا `flex-row` بلا تحديد اليمين/اليسار؟ ────────────────────────────
 *  الحاوية داخل `<html dir="rtl">`. ترتيب flex الطبيعي يضع أول عنصر في جهة
 *  **البداية** — أي اليمين في RTL واليسار في LTR. فيقع الشريط الجانبي في
 *  مكانه الصحيح في اللغات الثلاث، بلا سطر CSS شرطي واحد.
 *
 *  لو كتبنا `position: fixed; right: 0` لبقي على اليمين في الإنجليزية أيضًا،
 *  فوق النص — وهو خطأ شائع في التطبيقات التي تُضيف RTL لاحقًا.
 */
export function AppShell() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const isPlatform = user?.isSuperAdmin ?? false;
  const items = isPlatform ? PLATFORM_NAV : TENANT_NAV;

  const title = isPlatform ? 'OH Finance' : (user?.store?.name ?? user?.tenant?.name ?? '—');

  const subtitle = isPlatform ? 'المدير العام' : '';
  const newOrderLabel = {
    ar: 'إضافة طلبية',
    he: 'הזמנה חדשה',
    en: 'New order',
  }[currentLocale()];

  return (
    <div className="bg-bg flex h-dvh overflow-hidden">
      {/* الشريط الجانبي — ديسكتوب */}
      <Sidebar items={items} title={title} subtitle={subtitle} className="hidden lg:flex" />

      {/* الدرج — موبايل */}
      <Drawer open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <DrawerContent side="start" className="w-sidebar bg-sidebar p-0">
          <Sidebar
            items={items}
            title={title}
            subtitle={subtitle}
            onNavigate={() => setMobileNavOpen(false)}
            className="w-full"
          />
        </DrawerContent>
      </Drawer>

      {/* العمود الرئيسي */}
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onOpenMobileNav={() => setMobileNavOpen(true)} />

        <main
          id="main-content"
          className="min-h-0 flex-1 overflow-y-auto overscroll-y-none p-3 pb-[calc(84px+env(safe-area-inset-bottom))] sm:p-6 lg:pb-6"
          tabIndex={-1}
        >
          <Outlet />
        </main>
      </div>

      {/* شريط التبويب السفلي — موبايل */}
      <MobileTabBar
        items={items}
        onOpenMore={() => setMobileNavOpen(true)}
        fab={
          isPlatform
            ? undefined
            : {
                label: newOrderLabel,
                disabled: !user?.permissions.includes('orders.create'),
                onClick: () => navigate('/orders?new=1'),
              }
        }
      />
    </div>
  );
}
