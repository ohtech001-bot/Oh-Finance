import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Headphones, Store } from 'lucide-react';
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
  const { can } = useAuth();

  const visible = items.filter((item) => !item.permission || can(item.permission));

  return (
    <aside
      className={cn(
        'flex h-full w-sidebar shrink-0 flex-col bg-sidebar text-sidebar-fg',
        className,
      )}
    >
      {/* ── ترويسة المحل ─────────────────────────────────────────────── */}
      <div className="flex h-topbar items-center gap-3 px-5">
        <div
          className="flex size-10 shrink-0 items-center justify-center rounded-icon bg-brand/15"
          aria-hidden
        >
          <Store className="size-5 text-brand" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-white">{title}</p>
          <p className="truncate text-xs text-sidebar-fg">{subtitle}</p>
        </div>
      </div>

      {/* ── التنقّل ──────────────────────────────────────────────────── */}
      <nav aria-label="التنقّل الرئيسي" className="flex-1 overflow-y-auto py-2">
        <ul className="space-y-0.5">
          {visible.map((item) => (
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

                    {/* شارة «قريبًا» — صادقة: الشاشة موجودة، البيانات لم تُربط بعد. */}
                    {item.phase ? (
                      <span
                        className="rounded-pill bg-white/10 px-1.5 py-0.5 text-[10px] font-medium text-white/60"
                        title={`تُفعَّل في ${item.phase}`}
                      >
                        قريبًا
                      </span>
                    ) : null}
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {/* ── الدعم (مثبّت أسفل — كما في المرجع) ───────────────────────── */}
      <div className="p-3">
        <a
          href="mailto:support@oh-finance.app"
          className={cn(
            'flex items-center gap-3 rounded-card bg-white/5 px-4 py-3 text-sm text-sidebar-fg',
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
        </a>
      </div>
    </aside>
  );
}
