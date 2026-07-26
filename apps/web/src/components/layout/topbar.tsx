import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  CalendarClock,
  ChevronDown,
  CircleDollarSign,
  Globe,
  LogOut,
  Menu,
  Moon,
  RefreshCw,
  Search,
  Settings,
  ShoppingBag,
  Store,
  Sun,
  Undo2,
  User,
} from 'lucide-react';
import type { NotificationItem } from '@oh/contracts';
import { LOCALES, LOCALE_CODES, ROLE_LABELS, type LocaleCode, type RoleName } from '@oh/config';
import { formatMoney, type CurrencyCode } from '@oh/money';
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Input,
  cn,
  toast,
} from '@oh/ui';
import { useAuth } from '@/app/auth-context';
import { changeLocale, currentLocale } from '@/lib/i18n';
import { useTheme } from '@/app/theme-context';
import { useNotifications } from '@/features/notifications/api';
import { displayOrderNumber } from '@/features/orders/order-number';

export interface TopbarProps {
  onOpenMobileNav: () => void;
}

/**
 * الشريط العلوي — مطابق للمرجع البصري.
 *
 * التخطيط: بحث مركزي (max-w 420px) · في الطرف: قائمة المستخدم، الإشعارات،
 * المساعدة، الإعدادات، مبدّل المظهر واللغة.
 *
 * الارتفاع 72px، خلفية بيضاء، حد سفلي — مقيسة من الصور.
 */
export function Topbar({ onOpenMobileNav }: TopbarProps) {
  const { t } = useTranslation();
  const { user, logout, exitTenantSupport, can } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [exitingSupport, setExitingSupport] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const locale = currentLocale();
  const canSearchCustomers = Boolean(user && !user.isSuperAdmin);
  const notificationsEnabled = Boolean(
    notificationsOpen && user && !user.isSuperAdmin && can('dashboard.read'),
  );
  const notifications = useNotifications(notificationsEnabled);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await logout();
      navigate('/login', { replace: true });
    } catch {
      toast.error('تعذّر تسجيل الخروج. حاول مجددًا.');
    } finally {
      setLoggingOut(false);
    }
  };

  const handleSearchSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const term = search.trim();
    if (!term || !canSearchCustomers) return;
    navigate(`/customers?search=${encodeURIComponent(term)}`);
  };

  const handleExitSupport = async () => {
    setExitingSupport(true);
    try {
      await exitTenantSupport();
      navigate('/platform/tenants', { replace: true });
    } catch {
      toast.error(t('platform.exitSupportFailed'));
    } finally {
      setExitingSupport(false);
    }
  };

  const roleLabel = user?.role ? (ROLE_LABELS[user.role as RoleName]?.[locale] ?? user.role) : '';

  return (
    <header className="border-border bg-card lg:h-topbar relative flex h-[124px] shrink-0 items-center gap-1 border-b px-3 pb-[52px] lg:gap-3 lg:px-6 lg:pb-0">
      {/* زر القائمة — موبايل فقط */}
      <Button
        variant="ghost"
        size="icon"
        onClick={onOpenMobileNav}
        className="shrink-0 lg:hidden"
        aria-label="فتح القائمة"
      >
        <Menu />
      </Button>

      {/* ── البحث المركزي ────────────────────────────────────────────── */}
      <div className="flex min-w-0 flex-1 justify-center">
        <div className="flex min-w-0 items-center gap-2 lg:hidden">
          {user?.store?.logoUrl ? (
            <img
              src={user.store.logoUrl}
              alt=""
              className="border-border rounded-icon size-10 shrink-0 border object-cover"
            />
          ) : (
            <span
              className="bg-brand-soft text-brand rounded-icon flex size-10 shrink-0 items-center justify-center"
              aria-hidden
            >
              <Store className="size-5" />
            </span>
          )}
          <div className="min-w-0">
            <p className="text-fg truncate text-sm font-bold">
              {user?.store?.name ?? (user?.isSuperAdmin ? 'OH Finance' : user?.tenant?.name)}
            </p>
          </div>
        </div>
        <form className="hidden w-full max-w-[420px] lg:block" onSubmit={handleSearchSubmit}>
          <Input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('common.searchPlaceholder')}
            startIcon={<Search className="size-4" />}
            disabled={!canSearchCustomers}
            aria-label={t('common.search')}
          />
        </form>
      </div>

      {/* ── الإجراءات ────────────────────────────────────────────────── */}
      <div className="flex shrink-0 items-center gap-0 lg:gap-1">
        {user?.supportMode ? (
          <Button variant="brand" size="sm" loading={exitingSupport} onClick={handleExitSupport}>
            <Undo2 aria-hidden />
            <span className="hidden sm:inline">{t('platform.exitSupport')}</span>
          </Button>
        ) : null}

        {/* الإشعارات */}
        <DropdownMenu open={notificationsOpen} onOpenChange={setNotificationsOpen}>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label={t('common.notifications')}
              className="relative"
            >
              <Bell />
              {(notifications.data?.total ?? 0) > 0 ? (
                <span className="bg-danger text-on-danger absolute -end-0.5 -top-0.5 flex min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold leading-4">
                  {(notifications.data?.total ?? 0) > 9 ? '9+' : notifications.data?.total}
                </span>
              ) : null}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="max-h-[70vh] w-80 overflow-y-auto">
            <DropdownMenuLabel>{t('common.notifications')}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {notifications.isLoading ? (
              <div className="text-fg-muted px-3 py-8 text-center text-sm">
                {t('common.loading')}
              </div>
            ) : notifications.isError ? (
              <div className="px-3 py-6 text-center">
                <p className="text-danger text-sm">{t('notificationFeed.loadError')}</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => void notifications.refetch()}
                >
                  <RefreshCw aria-hidden />
                  {t('common.retry')}
                </Button>
              </div>
            ) : (notifications.data?.items.length ?? 0) === 0 ? (
              <div className="px-3 py-8 text-center">
                <Bell className="text-fg-subtle mx-auto size-8" aria-hidden />
                <p className="text-fg mt-2 text-sm font-medium">{t('notificationFeed.empty')}</p>
              </div>
            ) : (
              notifications.data?.items.map((notification) => {
                const content = notificationText(
                  notification,
                  t,
                  (user?.store?.currency ?? 'ILS') as CurrencyCode,
                );
                return (
                  <DropdownMenuItem
                    key={notification.id}
                    className="items-start gap-3 px-3 py-3"
                    onClick={() => navigate(notification.href)}
                  >
                    <NotificationMark notification={notification} />
                    <div className="min-w-0 flex-1">
                      <p className="text-fg text-sm font-semibold">{content.title}</p>
                      <p className="text-fg-muted mt-0.5 line-clamp-2 text-xs">
                        {content.description}
                      </p>
                      <p className="text-fg-subtle mt-1 text-[11px]">
                        {formatNotificationTime(notification.occurredAt, locale)}
                      </p>
                    </div>
                  </DropdownMenuItem>
                );
              })
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* المظهر */}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          aria-label={theme === 'dark' ? 'الوضع النهاري' : 'الوضع الليلي'}
          className="hidden lg:inline-flex"
        >
          {theme === 'dark' ? <Sun /> : <Moon />}
        </Button>

        {/* اللغة */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="size-9 gap-1.5 p-0 lg:size-auto lg:px-3"
              aria-label={t('common.language')}
            >
              <Globe className="size-4" />
              <span className="hidden lg:inline">{LOCALES[locale].nameNative}</span>
              <ChevronDown className="hidden size-3.5 lg:block" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {LOCALE_CODES.map((code) => (
              <DropdownMenuItem
                key={code}
                onClick={() => changeLocale(code as LocaleCode)}
                className={cn(code === locale && 'bg-accent-soft text-accent font-semibold')}
              >
                {LOCALES[code].nameNative}
                <span className="text-fg-subtle ms-auto text-xs">
                  {LOCALES[code].dir.toUpperCase()}
                </span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          onClick={handleLogout}
          loading={loggingOut}
          aria-label={t('auth.logout')}
          title={t('auth.logout')}
        >
          <LogOut />
        </Button>

        {/* قائمة المستخدم */}
        {user ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className={cn(
                  'rounded-ctrl hover:bg-card-muted ms-1 hidden items-center gap-2.5 p-1 transition-colors lg:flex',
                  'focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-2',
                )}
              >
                <div className="hidden text-start md:block">
                  <p className="text-fg text-sm font-semibold leading-tight">{user.name}</p>
                  <p className="text-fg-muted text-xs leading-tight">{roleLabel}</p>
                </div>
                <ChevronDown className="text-fg-muted hidden size-4 md:block" aria-hidden />
              </button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel>
                <p className="text-fg text-sm font-semibold">{user.name}</p>
                <p className="text-fg-muted mt-0.5 truncate text-xs font-normal" dir="ltr">
                  {user.email}
                </p>
              </DropdownMenuLabel>

              <DropdownMenuSeparator />

              {user.role !== 'SUPER_ADMIN' ? (
                <DropdownMenuItem onClick={() => navigate('/profile')}>
                  <User />
                  {t('common.profile')}
                </DropdownMenuItem>
              ) : null}

              {!user.isSuperAdmin ? (
                <DropdownMenuItem onClick={() => navigate('/settings')}>
                  <Settings />
                  {t('nav.settings')}
                </DropdownMenuItem>
              ) : null}

              <DropdownMenuSeparator />

              <DropdownMenuItem destructive onClick={handleLogout}>
                <LogOut />
                {t('auth.logout')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>

      {canSearchCustomers ? (
        <form
          className="absolute inset-x-3 bottom-2 flex justify-center lg:hidden"
          onSubmit={handleSearchSubmit}
        >
          <Input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t('common.searchPlaceholder')}
            startIcon={<Search className="size-4" />}
            aria-label={t('common.search')}
            className="h-10 w-full max-w-md"
          />
        </form>
      ) : null}
    </header>
  );
}

function NotificationMark({ notification }: { notification: NotificationItem }) {
  const Icon =
    notification.kind === 'PAYMENT_RECEIVED'
      ? CircleDollarSign
      : notification.kind === 'ORDER_CREATED'
        ? ShoppingBag
        : CalendarClock;
  return (
    <span
      className={cn(
        'rounded-icon flex size-9 shrink-0 items-center justify-center',
        notification.severity === 'success' && 'bg-success-soft text-success',
        notification.severity === 'info' && 'bg-info-soft text-info',
        notification.severity === 'warning' && 'bg-warning-soft text-warning',
        notification.severity === 'danger' && 'bg-danger-soft text-danger',
      )}
      aria-hidden
    >
      <Icon className="size-4.5" />
    </span>
  );
}

function notificationText(
  notification: NotificationItem,
  t: (key: string, options?: Record<string, unknown>) => string,
  currency: CurrencyCode,
) {
  const amount = notification.amount
    ? formatMoney(notification.amount, { currency })
    : notification.description;
  if (notification.kind === 'ORDER_CREATED') {
    return {
      title: t('notificationFeed.orderCreated'),
      description:
        notification.customerName && notification.orderNumber && notification.amount
          ? t('notificationFeed.orderDescription', {
              customer: notification.customerName,
              number: displayOrderNumber(notification.orderNumber),
              amount,
            })
          : notification.description,
    };
  }
  if (notification.kind === 'PAYMENT_RECEIVED') {
    return {
      title: t('notificationFeed.paymentReceived'),
      description:
        notification.customerName && notification.amount
          ? t('notificationFeed.paymentDescription', {
              customer: notification.customerName,
              amount,
            })
          : notification.description,
    };
  }

  const dueToday = notification.kind === 'PAYMENT_DUE_TODAY';
  return {
    title: t(dueToday ? 'notificationFeed.dueTodayTitle' : 'notificationFeed.dueSoonTitle', {
      name: notification.customerName ?? '',
    }),
    description: t(
      dueToday ? 'notificationFeed.dueTodayDescription' : 'notificationFeed.dueSoonDescription',
      { balance: notification.balance ?? '' },
    ),
  };
}

function formatNotificationTime(value: string, locale: LocaleCode): string {
  const date = new Date(value);
  return new Intl.DateTimeFormat(locale, {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}
