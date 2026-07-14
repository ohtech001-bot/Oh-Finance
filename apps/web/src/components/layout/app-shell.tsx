import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Drawer, DrawerContent } from '@oh/ui';
import { useAuth } from '@/app/auth-context';
import { PLATFORM_NAV, TENANT_NAV } from './nav-items';
import { MobileTabBar } from './mobile-tabbar';
import { Sidebar } from './sidebar';
import { Topbar } from './topbar';

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
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const isPlatform = user?.isSuperAdmin ?? false;
  const items = isPlatform ? PLATFORM_NAV : TENANT_NAV;

  const title = isPlatform ? 'منصة أوه فاينانس' : (user?.store?.name ?? user?.tenant?.name ?? '—');

  const subtitle = isPlatform
    ? 'المدير العام'
    : user?.store?.code
      ? `رقم المحل: ${user.store.code}`
      : (user?.tenant?.name ?? '');

  return (
    <div className="flex h-dvh overflow-hidden bg-bg">
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
          className="flex-1 overflow-y-auto p-4 pb-24 sm:p-6 lg:pb-6"
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
                label: 'طلب جديد',
                // مُعطَّل بصدق: شاشة الطلبات تُبنى في المرحلة 4.
                // زر يفتح شاشة فارغة أسوأ من زر يقول «قريبًا».
                disabled: true,
                onClick: () => undefined,
              }
        }
      />
    </div>
  );
}
