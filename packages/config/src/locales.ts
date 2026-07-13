/**
 * اللغات المدعومة واتجاهها.
 *
 * العربية افتراضية. العربية والعبرية RTL، الإنجليزية LTR.
 * `dir` يُطبَّق على `<html>` ويقود كل الخصائص المنطقية في Tailwind
 * (ps/pe/ms/me/start/end)، فينعكس التخطيط بالكامل بلا CSS إضافي.
 */

export const LOCALES = {
  ar: {
    code: 'ar',
    dir: 'rtl',
    nameNative: 'العربية',
    nameEn: 'Arabic',
    fontFamily: "'IBM Plex Sans Arabic'",
    dateLocale: 'ar',
  },
  he: {
    code: 'he',
    dir: 'rtl',
    nameNative: 'עברית',
    nameEn: 'Hebrew',
    fontFamily: "'Noto Sans Hebrew'",
    dateLocale: 'he',
  },
  en: {
    code: 'en',
    dir: 'ltr',
    nameNative: 'English',
    nameEn: 'English',
    fontFamily: "'Inter'",
    dateLocale: 'en',
  },
} as const;

export type LocaleCode = keyof typeof LOCALES;
export type Direction = 'rtl' | 'ltr';

export const DEFAULT_LOCALE: LocaleCode = 'ar';
export const LOCALE_CODES = Object.keys(LOCALES) as LocaleCode[];

export function isLocaleCode(value: unknown): value is LocaleCode {
  return typeof value === 'string' && value in LOCALES;
}

export function directionOf(locale: LocaleCode): Direction {
  return LOCALES[locale].dir;
}

export function isRtl(locale: LocaleCode): boolean {
  return directionOf(locale) === 'rtl';
}

/** المناطق الزمنية الشائعة في السوق المستهدف. */
export const TIMEZONES = [
  'Asia/Jerusalem',
  'Asia/Hebron',
  'Asia/Amman',
  'Asia/Beirut',
  'Asia/Riyadh',
  'Asia/Dubai',
  'Europe/Istanbul',
  'UTC',
] as const;

export type Timezone = (typeof TIMEZONES)[number];
export const DEFAULT_TIMEZONE: Timezone = 'Asia/Jerusalem';

export const DATE_FORMATS = ['YYYY-MM-DD', 'DD/MM/YYYY', 'MM/DD/YYYY', 'DD-MM-YYYY'] as const;
export type DateFormat = (typeof DATE_FORMATS)[number];
export const DEFAULT_DATE_FORMAT: DateFormat = 'YYYY-MM-DD';
