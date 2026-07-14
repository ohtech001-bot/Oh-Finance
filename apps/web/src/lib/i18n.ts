import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { DEFAULT_LOCALE, LOCALES, isLocaleCode, type LocaleCode } from '@oh/config';

import ar from '../locales/ar.json' with { type: 'json' };
import he from '../locales/he.json' with { type: 'json' };
import en from '../locales/en.json' with { type: 'json' };

/**
 * التوطين والاتجاه.
 *
 * ── لماذا نضبط dir على <html> وليس على حاوية داخلية؟ ─────────────────────────
 * `dir` على <html> يجعل **كل** الخصائص المنطقية في Tailwind (ps/pe/ms/me/
 * start/end/border-s) تنعكس تلقائيًا. وحده أيضًا يضبط اتجاه شريط التمرير،
 * وموضع أيقونات حقول التاريخ الأصلية، واتجاه القوائم المنسدلة للمتصفح.
 *
 * وضعه على <div> داخلي يترك كل ذلك بالاتجاه الخاطئ — وهي أخطاء تظهر متأخرة
 * وتُصلَح بترقيعات CSS يدوية.
 */
void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      ar: { translation: ar },
      he: { translation: he },
      en: { translation: en },
    },
    fallbackLng: DEFAULT_LOCALE,
    supportedLngs: Object.keys(LOCALES),
    // العربية أولًا: هي اللغة الافتراضية للنظام، لا الإنجليزية.
    lng: DEFAULT_LOCALE,

    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'oh_locale',
      caches: ['localStorage'],
    },

    interpolation: {
      // React يهرّب القيم أصلًا — التهريب المزدوج يُظهر &amp; في النص.
      escapeValue: false,
    },
  });

/** يطبّق اللغة والاتجاه على <html>. */
export function applyLocale(locale: LocaleCode): void {
  const definition = LOCALES[locale];

  document.documentElement.lang = locale;
  document.documentElement.dir = definition.dir;

  // العبرية تحتاج خطًا مختلفًا — لا يدعم IBM Plex Sans Arabic العبرية.
  document.documentElement.classList.toggle('font-he', locale === 'he');
}

export function changeLocale(locale: LocaleCode): void {
  void i18n.changeLanguage(locale);
  applyLocale(locale);
}

export function currentLocale(): LocaleCode {
  const lng = i18n.resolvedLanguage ?? i18n.language;
  return isLocaleCode(lng) ? lng : DEFAULT_LOCALE;
}

// تطبيق أولي قبل أول رسم — يمنع وميض الاتجاه الخاطئ.
applyLocale(currentLocale());

export default i18n;
