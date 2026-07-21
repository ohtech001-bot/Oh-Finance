import { useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronDown, Headphones, Store } from 'lucide-react';
import { cn } from '@oh/ui';
import { useAuth } from '@/app/auth-context';
import type { NavItem } from './nav-items';

export interface SidebarProps {
  items: NavItem[];
  /** اسم المحل + رقمه في الترويسة (أو «المنصة» للمدير العام). */
  title: string;
  subtitle: string;
  onNavigate?: () => void;
  className?: string;
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  الشريط الجانبي الداكن — النمط المعتمد للنظام كله.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  مقيس من المرجع البصري:
 *    • العرض 260px · الخلفية #0B1220
 *    • العنصر النشط: كتلة زرقاء #1D4ED8 بعرض كامل + نص أبيض
 *    • الخامل: #94A3B8 · عند التحويم: خلفية بيضاء 5%
 *    • ترويسة المحل أعلى · «الدعم والمساعدة» مثبّت أسفل
 *
 *  ⚠️ في RTL يقع الشريط على **اليمين** تلقائيًا لأننا نستخدم ترتيب flex
 *     العادي داخل حاوية `dir=rtl` — لا نحدد `right: 0` يدويًا. لو فعلنا،
 *     لبقي على اليمين في الإنجليزية أيضًا وانكسر التخطيط.
 */
export function Sidebar({ items, title, subtitle, onNavigate, className }: SidebarProps) {
  const { t } = useTranslation();
  const { can, user } = useAuth();
  const location = useLocation();

  const visible = items.filter((item) => !item.permission || can(item.permission));
  const initialGroup =
    visible.find((item) => item.children?.some((child) => location.pathname.startsWith(child.to)))
      ?.to ?? null;
  const [openGroup, setOpenGroup] = useState<string | null>(initialGroup);

  return (
    <aside
      className={cn(
        'w-sidebar bg-sidebar text-sidebar-fg flex h-full shrink-0 flex-col',
        className,
      )}
    >
      {/* ── ترويسة المحل ─────────────────────────────────────────────── */}
      <div className="h-topbar flex items-center gap-3 px-5">
        {user?.isSuperAdmin ? (
          <img
            src="/logo.png"
            alt="OH Finance"
            className="rounded-icon size-11 shrink-0 object-cover"
          />
        ) : (
          <div
            className="rounded-icon bg-brand/15 flex size-10 shrink-0 items-center justify-center"
            aria-hidden
          >
            <Store className="text-brand size-5" />
          </div>
        )}
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-white">{title}</p>
          <p className="text-sidebar-fg truncate text-xs">{subtitle}</p>
        </div>
      </div>

      {/* ── التنقّل ──────────────────────────────────────────────────── */}
      <nav aria-label="التنقّل الرئيسي" className="flex-1 overflow-y-auto py-2">
        <ul className="space-y-0.5">
          {visible.map((item) => {
            const children = item.children?.filter(
              (child) => !child.permission || can(child.permission),
            );
            const groupActive =
              children?.some(
                (child) =>
                  location.pathname === child.to || location.pathname.startsWith(`${child.to}/`),
              ) ?? false;
            if (children?.length)
              return (
                <li key={item.to}>
                  <button
                    type="button"
                    onClick={() =>
                      setOpenGroup((current) => (current === item.to ? null : item.to))
                    }
                    className={cn(
                      'flex w-full items-center gap-3 px-5 py-3 text-start text-sm font-medium transition-colors',
                      groupActive
                        ? 'bg-white/10 text-white'
                        : 'text-sidebar-fg hover:bg-white/5 hover:text-white',
                    )}
                    aria-expanded={openGroup === item.to}
                  >
                    <item.icon className="size-5 shrink-0" aria-hidden />
                    <span className="flex-1 truncate">{t(item.labelKey)}</span>
                    <ChevronDown
                      className={cn(
                        'size-4 transition-transform',
                        openGroup === item.to && 'rotate-180',
                      )}
                      aria-hidden
                    />
                  </button>
                  {openGroup === item.to ? (
                    <ul className="my-1 ms-7 space-y-0.5 border-s border-white/10">
                      {children.map((child) => (
                        <li key={child.to}>
                          <NavLink
                            to={child.to}
                            end
                            onClick={onNavigate}
                            className={({ isActive }) =>
                              cn(
                                'flex items-center gap-2.5 py-2.5 pe-4 ps-5 text-sm transition-colors',
                                isActive ? 'text-white' : 'text-sidebar-fg hover:text-white',
                              )
                            }
                          >
                            <child.icon className="size-4 shrink-0" aria-hidden />
                            <span>{t(child.labelKey)}</span>
                          </NavLink>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              );

            return (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.to === '/' || item.to === '/platform'}
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 px-5 py-3 text-sm font-medium transition-colors',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/40',
                      isActive
                        ? 'bg-sidebar-active text-sidebar-fg-active'
                        : 'text-sidebar-fg hover:bg-white/5 hover:text-white',
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      <item.icon
                        className={cn('size-5 shrink-0', isActive ? 'text-white' : 'text-current')}
                        aria-hidden
                      />
                      <span className="flex-1 truncate">{t(item.labelKey)}</span>
                    </>
                  )}
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* ── الدعم (مثبّت أسفل — كما في المرجع) ───────────────────────── */}
      {user?.role !== 'SUPER_ADMIN' ? (
        <div className="p-3">
          <Link
            to={user?.isSuperAdmin ? '/platform/support' : '/support'}
            onClick={onNavigate}
            className={cn(
              'rounded-card text-sidebar-fg flex items-center gap-3 bg-white/5 px-4 py-3 text-sm',
              'transition-colors hover:bg-white/10 hover:text-white',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40',
            )}
          >
            <span
              className="flex size-8 items-center justify-center rounded-full bg-white/10"
              aria-hidden
            >
              <Headphones className="size-4" />
            </span>
            {t('nav.support')}
          </Link>
        </div>
      ) : null}
    </aside>
  );
}
