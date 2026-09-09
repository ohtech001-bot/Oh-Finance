import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronDown, Headphones, PanelRightClose, PanelRightOpen, Store } from 'lucide-react';
import { cn } from '@oh/ui';
import { useAuth } from '@/app/auth-context';
import type { NavItem } from './nav-items';
import { prefetchRoute } from '@/app/route-prefetch';

export interface SidebarProps {
  items: NavItem[];
  /** اسم المحل في الترويسة (أو «المنصة» للمدير العام). */
  title: string;
  subtitle: string;
  onNavigate?: () => void;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
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
export function Sidebar({
  items,
  title,
  subtitle,
  onNavigate,
  collapsed = false,
  onToggleCollapsed,
  className,
}: SidebarProps) {
  const { t } = useTranslation();
  const { can, user } = useAuth();
  const location = useLocation();

  const visible = items.filter((item) => !item.permission || can(item.permission));
  const initialGroup =
    visible.find((item) => item.children?.some((child) => location.pathname.startsWith(child.to)))
      ?.to ?? null;
  const [openGroup, setOpenGroup] = useState<string | null>(initialGroup);

  useEffect(() => {
    if (initialGroup) setOpenGroup(initialGroup);
  }, [initialGroup]);

  return (
    <aside
      className={cn(
        'bg-sidebar text-sidebar-fg flex h-full shrink-0 flex-col transition-[width] duration-300 ease-out',
        collapsed ? 'w-[76px]' : 'w-sidebar',
        className,
      )}
    >
      {/* ── ترويسة المحل ─────────────────────────────────────────────── */}
      <div
        className={cn('h-topbar flex items-center gap-3 px-4', collapsed && 'justify-center px-2')}
      >
        {user?.isSuperAdmin ? (
          <img
            src="/logo.png"
            alt="OH Finance"
            className={cn('rounded-icon size-11 shrink-0 object-cover', collapsed && 'hidden')}
          />
        ) : (
          <div
            className={cn(
              'rounded-icon bg-brand/15 flex size-10 shrink-0 items-center justify-center',
              collapsed && 'hidden',
            )}
            aria-hidden
          >
            <Store className="text-brand size-5" />
          </div>
        )}
        <div className={cn('min-w-0 flex-1 transition-opacity', collapsed && 'hidden')}>
          <p className="truncate text-sm font-bold text-white">{title}</p>
          {subtitle ? <p className="text-sidebar-fg truncate text-xs">{subtitle}</p> : null}
        </div>
        {onToggleCollapsed ? (
          <button
            type="button"
            onClick={onToggleCollapsed}
            className="rounded-ctrl text-sidebar-fg hidden size-9 shrink-0 items-center justify-center transition-colors hover:bg-white/10 hover:text-white lg:flex"
            aria-label={t(collapsed ? 'nav.expandSidebar' : 'nav.collapseSidebar')}
            title={t(collapsed ? 'nav.expandSidebar' : 'nav.collapseSidebar')}
          >
            {collapsed ? (
              <PanelRightOpen className="size-5" />
            ) : (
              <PanelRightClose className="size-5" />
            )}
          </button>
        ) : null}
      </div>

      {/* ── التنقّل ──────────────────────────────────────────────────── */}
      <nav
        aria-label={t('nav.mainNavigation')}
        className="flex-1 overflow-y-auto overflow-x-hidden py-2"
      >
        <ul className="space-y-1 px-2">
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
                    onClick={() => {
                      if (collapsed) {
                        onToggleCollapsed?.();
                        setOpenGroup(item.to);
                        return;
                      }
                      setOpenGroup((current) => (current === item.to ? null : item.to));
                    }}
                    onPointerEnter={() => prefetchRoute(children[0]?.to ?? item.to)}
                    className={cn(
                      'rounded-ctrl flex w-full items-center gap-3 px-3 py-2.5 text-start text-sm font-medium transition-all duration-200',
                      collapsed && 'justify-center px-2',
                      groupActive
                        ? 'bg-white/10 text-white'
                        : 'text-sidebar-fg hover:bg-white/5 hover:text-white',
                    )}
                    aria-expanded={openGroup === item.to}
                  >
                    <item.icon className="size-5 shrink-0" aria-hidden />
                    <span className={cn('flex-1 truncate', collapsed && 'sr-only')}>
                      {t(item.labelKey)}
                    </span>
                    <ChevronDown
                      className={cn(
                        'size-4 transition-transform',
                        collapsed && 'hidden',
                        openGroup === item.to && 'rotate-180',
                      )}
                      aria-hidden
                    />
                  </button>
                  {openGroup === item.to ? (
                    <ul className="sidebar-branch my-1 ms-5 space-y-1 ps-5">
                      {children.map((child) => (
                        <li key={child.to}>
                          <NavLink
                            to={child.to}
                            end
                            onClick={onNavigate}
                            onPointerEnter={() => prefetchRoute(child.to)}
                            onFocus={() => prefetchRoute(child.to)}
                            className={({ isActive }) =>
                              cn(
                                'sidebar-branch__item rounded-ctrl relative flex items-center gap-2.5 px-3 py-2.5 text-sm transition-all duration-200',
                                isActive
                                  ? 'bg-sidebar-active/90 text-white shadow-sm'
                                  : 'text-sidebar-fg hover:bg-white/5 hover:text-white',
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
                  onPointerEnter={() => prefetchRoute(item.to)}
                  onFocus={() => prefetchRoute(item.to)}
                  className={({ isActive }) =>
                    cn(
                      'rounded-ctrl flex items-center gap-3 px-3 py-2.5 text-sm font-medium transition-all duration-200',
                      collapsed && 'justify-center px-2',
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
                      <span className={cn('flex-1 truncate', collapsed && 'sr-only')}>
                        {t(item.labelKey)}
                      </span>
                    </>
                  )}
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* ── الدعم (مثبّت أسفل — كما في المرجع) ───────────────────────── */}
      {user?.role !== 'SUPER_ADMIN' && !collapsed ? (
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
