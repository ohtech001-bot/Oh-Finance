/**
 * تعريف العملات المدعومة.
 *
 * `minorUnits` = عدد الخانات العشرية المعروضة والمقرَّبة إليها.
 * `scale`      = عدد الخانات المخزَّنة في قاعدة البيانات (NUMERIC(18,4)).
 *
 * الفارق مقصود: نخزّن بدقة 4 خانات كي لا تُفقد الكسور أثناء حسابات وسيطة
 * (ضريبة على سطر، خصم نسبي، توزيع دفعة على عدة طلبات)، ونقرّب إلى
 * `minorUnits` مرة واحدة فقط عند حدود المستند.
 */

export const STORAGE_SCALE = 4 as const;

export interface CurrencyDefinition {
  readonly code: CurrencyCode;
  readonly symbol: string;
  readonly nameAr: string;
  readonly nameHe: string;
  readonly nameEn: string;
  /** خانات العرض والتقريب النهائي. */
  readonly minorUnits: number;
  /** موضع الرمز بالنسبة للرقم في نص RTL. */
  readonly symbolPosition: 'before' | 'after';
}

export const CURRENCIES = {
  ILS: {
    code: 'ILS',
    symbol: '₪',
    nameAr: 'شيكل',
    nameHe: 'שקל',
    nameEn: 'Shekel',
    minorUnits: 2,
    symbolPosition: 'after',
  },
  SAR: {
    code: 'SAR',
    symbol: 'ر.س',
    nameAr: 'ريال سعودي',
    nameHe: 'ריאל סעודי',
    nameEn: 'Saudi Riyal',
    minorUnits: 2,
    symbolPosition: 'after',
  },
  USD: {
    code: 'USD',
    symbol: '$',
    nameAr: 'دولار',
    nameHe: 'דולר',
    nameEn: 'US Dollar',
    minorUnits: 2,
    symbolPosition: 'before',
  },
  EUR: {
    code: 'EUR',
    symbol: '€',
    nameAr: 'يورو',
    nameHe: 'אירו',
    nameEn: 'Euro',
    minorUnits: 2,
    symbolPosition: 'before',
  },
  JOD: {
    code: 'JOD',
    symbol: 'د.أ',
    nameAr: 'دينار أردني',
    nameHe: 'דינר ירדני',
    nameEn: 'Jordanian Dinar',
    // الدينار الأردني ذو 3 خانات عشرية — دليل حي على أن minorUnits ليست دائمًا 2.
    minorUnits: 3,
    symbolPosition: 'after',
  },
} as const satisfies Record<string, Omit<CurrencyDefinition, 'code'> & { code: string }>;

export type CurrencyCode = keyof typeof CURRENCIES;

export const DEFAULT_CURRENCY: CurrencyCode = 'ILS';

export const CURRENCY_CODES = Object.keys(CURRENCIES) as CurrencyCode[];

export function isCurrencyCode(value: unknown): value is CurrencyCode {
  return typeof value === 'string' && value in CURRENCIES;
}

export function getCurrency(code: CurrencyCode): CurrencyDefinition {
  const found = CURRENCIES[code];
  if (!found) {
    throw new RangeError(`عملة غير مدعومة: ${String(code)}`);
  }
  return found as CurrencyDefinition;
}
