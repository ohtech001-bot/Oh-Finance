import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MoreHorizontal, Plus } from 'lucide-react';
import { cn } from '@oh/ui';
import { useAuth } from '@/app/auth-context';
import { mobileNavItems, type NavItem } from './nav-items';

export interface MobileTabBarProps {
  items: NavItem[];
  onOpenMore: () => void;
  /** الزر العائم المركزي — «طلب جديد». يُفعَّل في المرحلة 4. */
  fab?: { label: string; onClick: () => void; disabled?: boolean };
}

/**
 * شريط التبويب السفلي — مطابق لشاشات الموبايل في المرجع.
 *
 * التخطيط: عنصران · زر عائم أخضر مركزي · عنصران · «المزيد».
 *
 * `pb-[env(safe-area-inset-bottom)]` — بدونه يختفي الشريط خلف شريط الإيماءات
 * في iPhone. تفصيل صغير، لكن أثره أن أزرار التنقّل الأساسية تصير غير قابلة
 * للنقر على أكثر الأجهزة شيوعًا.
 */
export function MobileTabBar({ items, onOpenMore, fab }: MobileTabBarProps) {
  const { t } = useTranslation();
  const { can } = useAuth();

  const visible = mobileNavItems(items).filter(
    (item) => !item.permission || can(item.permission),
  );

  const half = Math.ceil(visible.length / 2);
  const start = visible.slice(0, half);
  const end = visible.slice(half);

  return (
    <nav
      aria-label="التنقّل السريع"
      className={cn(
        'fixed inset-x-0 bottom-0 z-40 lg:hidden',
        'flex h-mobile-tabbar items-center justify-around',
        'border-t border-border bg-card',
        'pb-[env(safe-area-inset-bottom)]',
      )}
    >
      {start.map((item) => (
        <TabItem key={item.to} item={item} label={t(item.labelKey)} />
      ))}

      {/* الزر العائم — دائرة خضراء 64px بارزة فوق الشريط */}
      {fab ? (
        <button
          type="button"
          onClick={fab.onClick}
          disabled={fab.disabled}
          title={fab.disabled ? 'يُفعَّل في المرحلة 4' : fab.label}
          className={cn(
            'relative -top-5 flex size-16 shrink-0 flex-col items-center justify-center rounded-full',
            'bg-brand text-white shadow-pop transition-transform',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            fab.disabled ? 'opacity-50' : 'active:scale-95 hover:bg-brand-hover',
          )}
        >
          <Plus className="size-7" aria-hidden />
          <span className="sr-only">{fab.label}</span>
        </button>
      ) : null}

      {end.map((item) => (
        <TabItem key={item.to} item={item} label={t(item.labelKey)} />
      ))}

      <button
        type="button"
        onClick={onOpenMore}
        className={cn(
          'flex h-full flex-1 flex-col items-center justify-center gap-1 text-fg-muted',
          'transition-colors hover:text-fg',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
        )}
      >
        <MoreHorizontal className="size-5" aria-hidden />
        <span className="text-[11px] font-medium">{t('nav.more')}</span>
      </button>
    </nav>
  );
}

function TabItem({ item, label }: { item: NavItem; label: string }) {
  return (
    <NavLink
      to={item.to}
      end={item.to === '/' || item.to === '/platform'}
      className={({ isActive }) =>
        cn(
          'flex h-full flex-1 flex-col items-center justify-center gap-1',
          'transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
          isActive ? 'text-brand' : 'text-fg-muted hover:text-fg',
        )
      }
    >
      {({ isActive }) => (
        <>
          <span
            className={cn(
              'flex size-8 items-center justify-center rounded-ctrl transition-colors',
              isActive && 'bg-brand-soft',
            )}
            aria-hidden
          >
            <item.icon className="size-5" />
          </span>
          <span className="text-[11px] font-medium">{label}</span>
        </>
      )}
    </NavLink>
  );
}
