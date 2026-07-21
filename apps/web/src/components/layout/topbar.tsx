import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  ChevronDown,
  Globe,
  LogOut,
  Menu,
  Moon,
  Search,
  Settings,
  Sun,
  Undo2,
  User,
} from 'lucide-react';
import { LOCALES, LOCALE_CODES, ROLE_LABELS, type LocaleCode, type RoleName } from '@oh/config';
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
  const { user, logout, exitTenantSupport } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [exitingSupport, setExitingSupport] = useState(false);

  const locale = currentLocale();

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login', { replace: true });
    } catch {
      toast.error('تعذّر تسجيل الخروج. حاول مجددًا.');
    }
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

  /**
   * البحث الشامل.
   *
   * ⚠️ لا يُفعَّل حتى المرحلة 4: لا توجد زبائن ولا طلبات ليُبحث فيها بعد.
   *    عرض حقل بحث «يعمل» ثم لا يعيد شيئًا أسوأ من قول الحقيقة.
   *    الحقل ظاهر لأن المرجع البصري يفرضه، لكنه مُعطَّل بوضوح.
   */
  const searchEnabled = false;

  const roleLabel = user?.role ? (ROLE_LABELS[user.role as RoleName]?.[locale] ?? user.role) : '';

  return (
    <header className="h-topbar border-border bg-card flex shrink-0 items-center gap-3 border-b px-4 lg:px-6">
      {/* زر القائمة — موبايل فقط */}
      <Button
        variant="ghost"
        size="icon"
        onClick={onOpenMobileNav}
        className="lg:hidden"
        aria-label="فتح القائمة"
      >
        <Menu />
      </Button>

      {/* ── البحث المركزي ────────────────────────────────────────────── */}
      <div className="flex flex-1 justify-center">
        <div className="w-full max-w-[420px]">
          <Input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('common.searchPlaceholder')}
            startIcon={<Search className="size-4" />}
            disabled={!searchEnabled}
            title={searchEnabled ? undefined : 'البحث الشامل يُفعَّل في المرحلة 4'}
            aria-label={t('common.search')}
            className="hidden sm:flex"
          />
        </div>
      </div>

      {/* ── الإجراءات ────────────────────────────────────────────────── */}
      <div className="flex items-center gap-1">
        {user?.supportMode ? (
          <Button variant="brand" size="sm" loading={exitingSupport} onClick={handleExitSupport}>
            <Undo2 aria-hidden />
            <span className="hidden sm:inline">{t('platform.exitSupport')}</span>
          </Button>
        ) : null}

        {/* الإشعارات */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label={t('common.notifications')}
              className="relative"
            >
              <Bell />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <DropdownMenuLabel>{t('common.notifications')}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {/*
              لا شارة عدد ولا إشعارات وهمية.
              الشارة الحمراء «5» في المرجع كانت بيانات موك‌أب — عرضها الآن كذب:
              لا يوجد نظام إشعارات بعد، والرقم لن يتغيّر أبدًا مهما فعل المستخدم.
            */}
            <div className="px-3 py-8 text-center">
              <Bell className="text-fg-subtle mx-auto size-8" aria-hidden />
              <p className="text-fg mt-2 text-sm font-medium">لا توجد إشعارات</p>
              <p className="text-fg-muted mt-1 text-xs">نظام الإشعارات يُفعَّل في المرحلة 7.</p>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* المظهر */}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          aria-label={theme === 'dark' ? 'الوضع النهاري' : 'الوضع الليلي'}
        >
          {theme === 'dark' ? <Sun /> : <Moon />}
        </Button>

        {/* اللغة */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-1.5" aria-label={t('common.language')}>
              <Globe className="size-4" />
              <span className="hidden md:inline">{LOCALES[locale].nameNative}</span>
              <ChevronDown className="size-3.5" />
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

        {/* قائمة المستخدم */}
        {user ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className={cn(
                  'rounded-ctrl hover:bg-card-muted ms-1 flex items-center gap-2.5 p-1 transition-colors',
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
    </header>
  );
}
