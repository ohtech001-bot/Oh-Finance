import { useEffect, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from './auth-context';
import type { router as AppRouter } from './router';
import { applyLocale, currentLocale } from '@/lib/i18n';
import { copy } from '@/lib/copy';

export const PUBLIC_TITLE = 'OH Finance | إدارة أعمالك بذكاء';
export const PUBLIC_DESCRIPTION =
  'نظّم زبائن محلك وطلباتك ودفعاتك وحساباتك وتقاريرك مع OH Finance من O&H Tech. تواصل معنا لإعداد حساب عملك.';

function meta(selector: string, attribute: 'name' | 'property', key: string, value: string) {
  let element = document.head.querySelector<HTMLMetaElement>(selector);
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attribute, key);
    document.head.append(element);
  }
  element.content = value;
}

export function RouteMetadata({ router }: { router: typeof AppRouter }) {
  const { user } = useAuth();
  useTranslation();
  const pathname = useSyncExternalStore(
    (changed) => router.subscribe(() => changed()),
    () => router.state.location.pathname,
  );
  const publicHome = pathname === '/' && !user;
  const locale = currentLocale();
  useEffect(() => {
    document.title = publicHome ? copy(PUBLIC_TITLE) : 'OH Finance';
    meta(
      'meta[name="robots"]',
      'name',
      'robots',
      publicHome ? 'index, follow' : 'noindex, nofollow',
    );
    meta('meta[name="description"]', 'name', 'description', copy(PUBLIC_DESCRIPTION));
    meta('meta[property="og:title"]', 'property', 'og:title', copy(PUBLIC_TITLE));
    meta('meta[property="og:description"]', 'property', 'og:description', copy(PUBLIC_DESCRIPTION));
    meta(
      'meta[property="og:image"]',
      'property',
      'og:image',
      `${window.location.origin}/landing/brand-hero.webp`,
    );
    meta('meta[property="og:url"]', 'property', 'og:url', `${window.location.origin}/`);
    applyLocale(locale);
  }, [publicHome, locale]);
  return null;
}
