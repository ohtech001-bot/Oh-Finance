import { useTranslation } from 'react-i18next';
import { Globe } from 'lucide-react';
import { LOCALES, LOCALE_CODES, type LocaleCode } from '@oh/config';
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  cn,
} from '@oh/ui';
import { changeLocale, currentLocale } from '@/lib/i18n';

export interface AuthLayoutProps {
  title: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}

/**
 * تخطيط شاشات المصادقة.
 *
 * لوحان: البطاقة (المحتوى) + لوحة العلامة. تنهار إلى عمود واحد تحت 1024px.
 *
 * مبدّل اللغة حاضر **قبل** تسجيل الدخول عمدًا: مستخدم يتحدث العبرية يجب أن
 * يستطيع قراءة شاشة الدخول نفسها. وضعه داخل التطبيق فقط يعني أن أول شاشة
 * يراها بلغة لا يفهمها.
 */
export function AuthLayout({ title, subtitle, icon: Icon, children }: AuthLayoutProps) {
  const { t } = useTranslation();
  const locale = currentLocale();

  return (
    <div className="flex min-h-dvh bg-bg">
      {/* ── لوحة النموذج ─────────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col p-6 sm:p-10">
        <div className="flex justify-end">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-1.5">
                <Globe className="size-4" />
                {LOCALES[locale].nameNative}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {LOCALE_CODES.map((code) => (
                <DropdownMenuItem
                  key={code}
                  onClick={() => changeLocale(code as LocaleCode)}
                  className={cn(code === locale && 'bg-accent-soft font-semibold text-accent')}
                >
                  {LOCALES[code].nameNative}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-md">
            <div className="mb-8 text-center">
              <div
                className="mx-auto flex size-14 items-center justify-center rounded-icon bg-brand-soft"
                aria-hidden
              >
                <Icon className="size-7 text-brand" />
              </div>
              <h1 className="mt-4 text-page-title text-fg">{title}</h1>
              <p className="mt-1.5 text-sm text-fg-muted">{subtitle}</p>
            </div>

            <div className="rounded-card border border-border bg-card p-6 shadow-card sm:p-8">
              {children}
            </div>

            <p className="mt-6 text-center text-xs text-fg-subtle">
              © {new Date().getFullYear()} {t('app.name')}
            </p>
          </div>
        </div>
      </div>

      {/* ── لوحة العلامة — ديسكتوب فقط ──────────────────────────────── */}
      <div className="relative hidden w-[45%] max-w-2xl overflow-hidden bg-sidebar lg:block">
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            // نمط شبكي مبني برمجيًا — لا صور خارجية (سياسة CSP + الأداء).
            backgroundImage:
              'linear-gradient(hsl(var(--sidebar-fg)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--sidebar-fg)) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }}
          aria-hidden
        />

        <div className="relative flex h-full flex-col justify-center px-14">
          <h2 className="text-3xl font-bold leading-tight text-white">{t('app.name')}</h2>
          <p className="mt-3 max-w-sm text-base text-sidebar-fg">{t('app.tagline')}</p>

          <ul className="mt-10 space-y-4">
            {[
              'دفتر حركات مالية غير قابل للتلاعب',
              'دفع كامل وجزئي مع تتبّع الرصيد',
              'كشوف حساب وطباعة بالعربية والعبرية',
              'عزل كامل لبيانات كل محل',
            ].map((feature) => (
              <li key={feature} className="flex items-center gap-3 text-sm text-sidebar-fg">
                <span
                  className="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand/20 text-brand"
                  aria-hidden
                >
                  ✓
                </span>
                {feature}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
