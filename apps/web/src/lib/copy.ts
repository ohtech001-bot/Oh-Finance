import { useTranslation } from 'react-i18next';
import i18n, { currentLocale, type AppLocaleCode } from './i18n';
import hebrew from '../locales/copy-he.json';

type CopyValues = Record<string, string | number | null | undefined>;

const validationTemplates = [
  {
    pattern: /^String must contain at least (\d+) character\(s\)$/,
    key: 'يجب أن يحتوي النص على {{count}} أحرف على الأقل.',
  },
  {
    pattern: /^String must contain at most (\d+) character\(s\)$/,
    key: 'يجب ألا يتجاوز النص {{count}} حرفًا.',
  },
  {
    pattern: /^String must contain exactly (\d+) character\(s\)$/,
    key: 'يجب أن يحتوي النص على {{count}} أحرف بالضبط.',
  },
  {
    pattern: /^Number must be greater than or equal to (.+)$/,
    key: 'يجب ألا تقل القيمة عن {{count}}.',
  },
  {
    pattern: /^Number must be less than or equal to (.+)$/,
    key: 'يجب ألا تتجاوز القيمة {{count}}.',
  },
  {
    pattern: /^Array must contain at least (\d+) element\(s\)$/,
    key: 'يجب اختيار {{count}} عناصر على الأقل.',
  },
  {
    pattern: /^Array must contain at most (\d+) element\(s\)$/,
    key: 'يجب ألا يزيد عدد العناصر عن {{count}}.',
  },
] as const;

const systemTemplates = Object.keys(hebrew)
  .filter((key) => key.includes('{{'))
  .map((key) => {
    const names: string[] = [];
    const parts = key.split(/(\{\{[^}]+\}\})/u);
    const pattern = parts
      .map((part) => {
        if (part.startsWith('{{')) {
          names.push(part.slice(2, -2));
          return '(.+?)';
        }
        return part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      })
      .join('');
    return {
      key,
      names,
      pattern: new RegExp(`^${pattern}$`, 'u'),
      specificity: key.length - names.length * 10,
    };
  })
  .sort((first, second) => second.specificity - first.specificity);

/** Translate UI copy, never customer names or other user-entered data. */
export function copy(message: string, values: CopyValues = {}, locale = currentLocale()): string {
  const key = message.replace(/\s+/g, ' ').trim();
  for (const template of validationTemplates) {
    const match = template.pattern.exec(key);
    if (match) return copy(template.key, { count: match[1] }, locale);
  }
  if (
    locale === 'he' &&
    !i18n.exists(key, { ns: 'copy', lng: locale }) &&
    /[\u0600-\u06ff]/u.test(key)
  ) {
    for (const template of systemTemplates) {
      const match = template.pattern.exec(message.trim());
      if (!match) continue;
      const captured = Object.fromEntries(
        template.names.map((name, index) => [name, match[index + 1]]),
      );
      // These two templates contain controlled action/entity labels, not customer data.
      if (
        template.key === '{{value0}} الطلب {{value1}}' ||
        template.key === '{{value0}} غير موجود.'
      ) {
        captured.value0 = copy(captured.value0 ?? '', {}, locale);
      }
      return copy(template.key, captured, locale);
    }
  }
  return i18n.t(key, {
    ns: 'copy',
    lng: locale,
    keySeparator: false,
    nsSeparator: false,
    defaultValue: key,
    ...values,
  });
}

export function useCopy(): typeof copy {
  useTranslation(['translation', 'copy']);
  return copy;
}

export function localizedError(message: string, locale: AppLocaleCode = currentLocale()): string {
  if (locale === 'ar' || !/[\u0600-\u06ff]/u.test(message)) return copy(message, {}, locale);
  const translated = copy(message, {}, locale);
  return translated === message.replace(/\s+/g, ' ').trim()
    ? copy('حدث خطأ أثناء الاتصال بالخادم.', {}, locale)
    : translated;
}
