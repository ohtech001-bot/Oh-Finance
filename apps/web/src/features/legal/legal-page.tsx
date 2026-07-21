import { ArrowLeft, Mail, ScrollText, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { currentLocale } from '@/lib/i18n';

type LegalPageKind = 'privacy' | 'sitePolicy';

const SECTION_KEYS: Record<LegalPageKind, string[]> = {
  privacy: ['information', 'use', 'protection', 'rights'],
  sitePolicy: ['use', 'accounts', 'availability', 'liability'],
};

export function LegalPage({ kind }: { kind: LegalPageKind }) {
  const { t } = useTranslation();
  const locale = currentLocale();
  const Icon = kind === 'privacy' ? ShieldCheck : ScrollText;

  return (
    <main className="min-h-dvh bg-[#090a08] text-white">
      <header className="border-b border-amber-400/20 bg-black/70">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link to="/login" className="flex items-center gap-2 text-sm text-white/75 transition-colors hover:text-amber-300">
            <ArrowLeft className={locale === 'en' ? 'size-4' : 'size-4 rotate-180'} aria-hidden />
            {t('legal.backToLogin')}
          </Link>
          <span className="text-base font-semibold text-amber-300">OH Finance</span>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="mb-8 flex items-center gap-4">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-icon border border-amber-400/30 bg-amber-400/10">
            <Icon className="size-6 text-amber-300" aria-hidden />
          </div>
          <div>
            <h1 className="text-2xl font-bold sm:text-3xl">{t(`legal.${kind}.title`)}</h1>
            <p className="mt-1 text-sm leading-6 text-white/65">{t(`legal.${kind}.intro`)}</p>
          </div>
        </div>

        <div className="divide-y divide-amber-400/15 border-y border-amber-400/20">
          {SECTION_KEYS[kind].map((section) => (
            <section key={section} className="py-6">
              <h2 className="text-base font-semibold text-amber-200">{t(`legal.${kind}.${section}Title`)}</h2>
              <p className="mt-2 text-sm leading-7 text-white/70">{t(`legal.${kind}.${section}Body`)}</p>
            </section>
          ))}
        </div>

        <a
          href="mailto:info@oh-tech.co"
          className="mt-8 flex w-fit items-center gap-2 text-sm text-white/70 transition-colors hover:text-amber-300"
        >
          <Mail className="size-4" aria-hidden />
          <span>{t('legal.support')}</span>
          <span dir="ltr">info@oh-tech.co</span>
        </a>
      </div>
    </main>
  );
}
