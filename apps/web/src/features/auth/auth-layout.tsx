import { useTranslation } from 'react-i18next';
import { Globe, Mail } from 'lucide-react';
import { Link } from 'react-router-dom';
import { LOCALES, LOCALE_CODES, type LocaleCode } from '@oh/config';
import { Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, cn } from '@oh/ui';
import { changeLocale, currentLocale } from '@/lib/i18n';

export interface AuthLayoutProps {
  title: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}

export function AuthLayout({ title, subtitle, icon: Icon, children }: AuthLayoutProps) {
  const { t } = useTranslation();
  const locale = currentLocale();
  return <div className="relative min-h-dvh overflow-hidden bg-black">
    <picture className="absolute inset-0">
      <source media="(min-width: 1024px)" srcSet="/images/login-desktop.png" />
      <img
        src="/images/login-mobile.png"
        alt=""
        className="h-full w-full object-cover object-center lg:object-fill"
        aria-hidden
      />
    </picture>
    <div className="absolute inset-0 bg-black/20 lg:bg-transparent" aria-hidden />

    <div className="relative z-10 flex min-h-dvh flex-col p-4 sm:p-6 lg:p-8">
      <div className="flex justify-end">
        <DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline" size="sm" className="border-amber-400/40 bg-black/60 text-white hover:bg-black/80 hover:text-white"><Globe className="size-4" />{LOCALES[locale].nameNative}</Button></DropdownMenuTrigger>
          <DropdownMenuContent align="end">{LOCALE_CODES.map((code) => <DropdownMenuItem key={code} onClick={() => changeLocale(code as LocaleCode)} className={cn(code === locale && 'bg-accent-soft font-semibold text-accent')}>{LOCALES[code].nameNative}</DropdownMenuItem>)}</DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div
        dir="ltr"
        className="flex flex-1 items-start justify-center pt-[31vh] sm:pt-[34vh] lg:fixed lg:start-[49.5vw] lg:top-[9.5vh] lg:h-[69.5vh] lg:w-[43vw] lg:items-center lg:p-6 lg:pt-6"
      >
        <div dir={locale === 'en' ? 'ltr' : 'rtl'} className="w-full max-w-md lg:max-w-[500px]">
          <div className="rounded-card border border-amber-400/35 bg-black/80 p-5 shadow-2xl backdrop-blur-sm sm:p-7">
            <div className="mb-6 text-center">
              <div className="mx-auto flex size-12 items-center justify-center rounded-icon border border-amber-400/30 bg-amber-400/10" aria-hidden><Icon className="size-6 text-amber-300" /></div>
              <h1 className="mt-3 text-xl font-bold text-white">{title}</h1>
              <p className="mt-1.5 text-sm text-white/70">{subtitle}</p>
            </div>
            <div className="auth-dark-form">{children}</div>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-xs text-white/75">
            <Link to="/privacy" className="transition-colors hover:text-amber-300 hover:underline">
              {t('legal.privacyLink')}
            </Link>
            <span className="text-amber-400/45" aria-hidden>•</span>
            <Link to="/site-policy" className="transition-colors hover:text-amber-300 hover:underline">
              {t('legal.sitePolicyLink')}
            </Link>
          </div>
          <a
            href="mailto:info@oh-tech.co"
            className="mt-2 flex items-center justify-center gap-1.5 text-xs text-white/75 transition-colors hover:text-amber-300"
          >
            <Mail className="size-3.5" aria-hidden />
            <span>{t('legal.support')}</span>
            <span dir="ltr">info@oh-tech.co</span>
          </a>
        </div>
      </div>
    </div>
  </div>;
}
