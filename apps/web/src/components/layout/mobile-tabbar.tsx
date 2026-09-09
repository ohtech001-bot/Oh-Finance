import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MoreHorizontal, Plus } from 'lucide-react';
import { cn } from '@oh/ui';
import { useAuth } from '@/app/auth-context';
import { mobileNavItems, type NavItem } from './nav-items';
import { prefetchRoute } from '@/app/route-prefetch';

export interface MobileTabBarProps {
  items: NavItem[];
  onOpenMore: () => void;
  /** الزر العائم المركزي — «طلب جديد». يُفعَّل في المرحلة 4. */
  fab?: { label: string; onClick: () => void; disabled?: boolean };
}

/**
 * شريط التبويب السفلي — مطابق لشاشات الموبايل في المرجع.
 *
 * التخطيط: لوحة التحكم · الزبائن · إضافة طلبية · الطلبات · المزيد.
 *
 * `pb-[env(safe-area-inset-bottom)]` — بدونه يختفي الشريط خلف شريط الإيماءات
 * في iPhone. تفصيل صغير، لكن أثره أن أزرار التنقّل الأساسية تصير غير قابلة
 * للنقر على أكثر الأجهزة شيوعًا.
 */
export function MobileTabBar({ items, onOpenMore, fab }: MobileTabBarProps) {
  const { t } = useTranslation();
  const { can } = useAuth();

  const visible = mobileNavItems(items).filter((item) => !item.permission || can(item.permission));

  const half = Math.ceil(visible.length / 2);
  const start = visible.slice(0, half);
  const end = visible.slice(half);

  return (
    <nav
      aria-label={t('nav.quickNavigation')}
      className={cn(
        'fixed inset-x-0 bottom-0 z-40 lg:hidden',
        'flex h-[calc(72px+env(safe-area-inset-bottom))] items-center justify-around',
        'border-border bg-card border-t',
        'pb-[env(safe-area-inset-bottom)]',
      )}
    >
      {start.map((item) => (
        <TabItem key={item.to} item={item} label={t(item.labelKey)} />
      ))}

      {/* الزر المركزي — دائرة خضراء بارزة مع تسمية ثابتة أسفلها. */}
      {fab ? (
        <div className="relative flex h-full flex-1 items-end justify-center pb-1.5">
          <button
            type="button"
            onClick={fab.onClick}
            disabled={fab.disabled}
            title={fab.label}
            aria-label={fab.label}
            className={cn(
              'absolute -top-5 flex size-16 items-center justify-center rounded-full',
              'bg-brand shadow-pop text-white transition-transform',
              'focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
              fab.disabled ? 'opacity-50' : 'hover:bg-brand-hover active:scale-95',
            )}
          >
            <Plus className="size-8" aria-hidden />
          </button>
          <span className="text-fg-muted text-[11px] font-medium">{fab.label}</span>
        </div>
      ) : null}

      {end.map((item) => (
        <TabItem key={item.to} item={item} label={t(item.labelKey)} />
      ))}

      <button
        type="button"
        onClick={onOpenMore}
        className={cn(
          'text-fg-muted flex h-full flex-1 flex-col items-center justify-center gap-1',
          'hover:text-fg transition-colors',
          'focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset',
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
      onPointerEnter={() => prefetchRoute(item.to)}
      onFocus={() => prefetchRoute(item.to)}
      className={({ isActive }) =>
        cn(
          'flex h-full flex-1 flex-col items-center justify-center gap-1',
          'transition-colors',
          'focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset',
          isActive ? 'text-brand' : 'text-fg-muted hover:text-fg',
        )
      }
    >
      {({ isActive }) => (
        <>
          <span
            className={cn(
              'rounded-ctrl flex size-8 items-center justify-center transition-colors',
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
