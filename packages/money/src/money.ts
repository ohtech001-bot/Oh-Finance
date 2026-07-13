import { Decimal, ROUNDING_MODE } from './rounding.js';
import {
  DEFAULT_CURRENCY,
  STORAGE_SCALE,
  getCurrency,
  type CurrencyCode,
} from './currency.js';

/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  @oh/money — الطبقة الوحيدة المسموح لها بلمس المبالغ في هذا النظام.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  القاعدة الحاكمة: **لا يوجد `number` في أي مسار مالي.**
 *
 *  المبلغ يعيش في ثلاث صور فقط:
 *    1. `Decimal`        — أثناء الحساب (في الذاكرة)
 *    2. `MoneyString`    — عند النقل عبر API وفي قاعدة البيانات ("1250.0000")
 *    3. نص منسّق للعرض   — "1,250.00 ₪"  (لا يُعاد تحويله إلى رقم أبدًا)
 *
 *  لماذا لا `number`؟
 *    JavaScript يمثّل الأرقام بـ IEEE-754 double:
 *      0.1 + 0.2                  → 0.30000000000000004
 *      1234.56 * 3                → 3703.6800000000003
 *      (1.005).toFixed(2)         → "1.00"   ← وليس "1.01"
 *    خطأ واحد بحجم 0.01 في قيد محاسبي يفسد رصيد الزبون إلى الأبد،
 *    لأن دفتر الحركات تراكمي: كل قيد يبني على `balance_after` السابق.
 */

/** مبلغ في صورته المنقولة/المخزّنة: نص عشري صريح. */
export type MoneyString = string;

/** أي شكل يمكن تحويله إلى مبلغ بأمان. `number` مستثنى عمدًا. */
export type MoneyInput = MoneyString | Decimal;

/** نص عشري صالح: اختياري السالب، أرقام، وكسر اختياري. */
const DECIMAL_STRING_RE = /^-?\d+(\.\d+)?$/;

export class MoneyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MoneyError';
  }
}

// ──────────────────────────────────────────────────────────────────────────────
//  التحقق والتحويل
// ──────────────────────────────────────────────────────────────────────────────

/** هل النص صالح كمبلغ عشري؟ (لا يقبل "1e5" ولا "١٢٣" ولا " 12 ") */
export function isMoneyString(value: unknown): value is MoneyString {
  return typeof value === 'string' && DECIMAL_STRING_RE.test(value);
}

/**
 * البوابة الوحيدة لدخول قيمة إلى النطاق المالي.
 * ترفض `number` صراحةً — حتى لا يتسلل خطأ عائم من طرف غافل.
 */
export function toMoney(value: MoneyInput): Decimal {
  if (value instanceof Decimal) return value;

  if (typeof value === 'number') {
    throw new MoneyError(
      'مُنع تمرير number كمبلغ مالي. الأرقام العائمة تفقد الدقة (0.1+0.2 ≠ 0.3). ' +
        'مرّر نصًا عشريًا مثل "1250.00".',
    );
  }

  if (!isMoneyString(value)) {
    throw new MoneyError(
      `نص مبلغ غير صالح: ${JSON.stringify(value)}. الصيغة المتوقّعة: "1250.00" أو "-42.5".`,
    );
  }

  return new Decimal(value);
}

/** الصفر — للأرصدة الافتتاحية وبدايات التجميع. */
export function zero(): Decimal {
  return new Decimal(0);
}

// ──────────────────────────────────────────────────────────────────────────────
//  التقريب  (المكان الوحيد في النظام الذي يقرّب مبلغًا)
// ──────────────────────────────────────────────────────────────────────────────

/**
 * تقريب إلى خانات العملة المعروضة (ILS → 2، JOD → 3).
 * يُطبَّق مرة واحدة عند حدود المستند — لا داخل كل خطوة حساب.
 */
export function roundMoney(value: MoneyInput, currency: CurrencyCode = DEFAULT_CURRENCY): Decimal {
  const { minorUnits } = getCurrency(currency);
  return toMoney(value).toDecimalPlaces(minorUnits, ROUNDING_MODE);
}

/**
 * تقريب إلى دقة التخزين (4 خانات) — قبل الكتابة في NUMERIC(18,4).
 * يمنع رفض PostgreSQL لقيمة بدقة أعلى من عمودها.
 */
export function toStorageScale(value: MoneyInput): Decimal {
  return toMoney(value).toDecimalPlaces(STORAGE_SCALE, ROUNDING_MODE);
}

// ──────────────────────────────────────────────────────────────────────────────
//  العمليات الحسابية
// ──────────────────────────────────────────────────────────────────────────────

export function add(a: MoneyInput, b: MoneyInput): Decimal {
  return toMoney(a).plus(toMoney(b));
}

export function subtract(a: MoneyInput, b: MoneyInput): Decimal {
  return toMoney(a).minus(toMoney(b));
}

/** ضرب مبلغ في كمية/نسبة (الكمية نص أيضًا — قد تكون "1.5" كجم). */
export function multiply(amount: MoneyInput, factor: MoneyInput): Decimal {
  return toMoney(amount).times(toMoney(factor));
}

export function divide(amount: MoneyInput, divisor: MoneyInput): Decimal {
  const d = toMoney(divisor);
  if (d.isZero()) throw new MoneyError('قسمة مبلغ على صفر.');
  return toMoney(amount).dividedBy(d);
}

export function sum(values: readonly MoneyInput[]): Decimal {
  return values.reduce<Decimal>((acc, v) => acc.plus(toMoney(v)), zero());
}

export function negate(value: MoneyInput): Decimal {
  return toMoney(value).negated();
}

export function abs(value: MoneyInput): Decimal {
  return toMoney(value).abs();
}

/**
 * نسبة مئوية من مبلغ (ضريبة، خصم).
 * `percent` نص: "17" تعني 17%.
 */
export function percentOf(amount: MoneyInput, percent: MoneyInput): Decimal {
  return toMoney(amount).times(toMoney(percent)).dividedBy(100);
}

// ──────────────────────────────────────────────────────────────────────────────
//  المقارنات
// ──────────────────────────────────────────────────────────────────────────────

export function isZero(value: MoneyInput): boolean {
  return toMoney(value).isZero();
}
export function isPositive(value: MoneyInput): boolean {
  return toMoney(value).greaterThan(0);
}
export function isNegative(value: MoneyInput): boolean {
  return toMoney(value).lessThan(0);
}
export function equals(a: MoneyInput, b: MoneyInput): boolean {
  return toMoney(a).equals(toMoney(b));
}
export function greaterThan(a: MoneyInput, b: MoneyInput): boolean {
  return toMoney(a).greaterThan(toMoney(b));
}
export function greaterThanOrEqual(a: MoneyInput, b: MoneyInput): boolean {
  return toMoney(a).greaterThanOrEqualTo(toMoney(b));
}
export function lessThan(a: MoneyInput, b: MoneyInput): boolean {
  return toMoney(a).lessThan(toMoney(b));
}
export function lessThanOrEqual(a: MoneyInput, b: MoneyInput): boolean {
  return toMoney(a).lessThanOrEqualTo(toMoney(b));
}

/** أصغر قيمة — مفيد لتحديد كم يُخصم من دفعة على طلب. */
export function min(a: MoneyInput, b: MoneyInput): Decimal {
  return lessThan(a, b) ? toMoney(a) : toMoney(b);
}
export function max(a: MoneyInput, b: MoneyInput): Decimal {
  return greaterThan(a, b) ? toMoney(a) : toMoney(b);
}

// ──────────────────────────────────────────────────────────────────────────────
//  التسلسل (النقل والتخزين)
// ──────────────────────────────────────────────────────────────────────────────

/**
 * إلى نص للنقل عبر API / الكتابة في قاعدة البيانات.
 * `toFixed` هنا من decimal.js (دقيق) وليس `Number.prototype.toFixed` (عائم).
 */
export function toMoneyString(value: MoneyInput, scale: number = STORAGE_SCALE): MoneyString {
  return toMoney(value).toDecimalPlaces(scale, ROUNDING_MODE).toFixed(scale);
}

/** إلى نص بخانات العملة — الصيغة التي تراها الواجهة في الحقول. */
export function toCurrencyString(
  value: MoneyInput,
  currency: CurrencyCode = DEFAULT_CURRENCY,
): MoneyString {
  const { minorUnits } = getCurrency(currency);
  return roundMoney(value, currency).toFixed(minorUnits);
}

// ──────────────────────────────────────────────────────────────────────────────
//  العرض
// ──────────────────────────────────────────────────────────────────────────────

export interface FormatMoneyOptions {
  currency?: CurrencyCode;
  /** إظهار رمز العملة. الافتراضي: true */
  withSymbol?: boolean;
  /** فواصل الآلاف. الافتراضي: true */
  grouping?: boolean;
  /** إظهار + للموجب. الافتراضي: false */
  signDisplay?: boolean;
}

/**
 * تنسيق للعرض: "1,250.00 ₪".
 *
 * نبني النص يدويًا بدل `Intl.NumberFormat` لأن الأخير يتطلب `number`
 * كمُدخل — وهو ما يعيد المشكلة من الباب الخلفي مع المبالغ الكبيرة
 * (أكبر من Number.MAX_SAFE_INTEGER تفقد دقتها).
 */
export function formatMoney(value: MoneyInput, options: FormatMoneyOptions = {}): string {
  const {
    currency = DEFAULT_CURRENCY,
    withSymbol = true,
    grouping = true,
    signDisplay = false,
  } = options;

  const def = getCurrency(currency);
  const rounded = roundMoney(value, currency);
  const negative = rounded.isNegative();

  const fixed = rounded.abs().toFixed(def.minorUnits);
  const [intPartRaw, fracPart] = fixed.split('.');
  const intPart = intPartRaw ?? '0';

  const grouped = grouping ? intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',') : intPart;
  const numeric = fracPart ? `${grouped}.${fracPart}` : grouped;

  let sign = '';
  if (negative) sign = '-';
  else if (signDisplay && !rounded.isZero()) sign = '+';

  if (!withSymbol) return `${sign}${numeric}`;

  return def.symbolPosition === 'before'
    ? `${sign}${def.symbol}${numeric}`
    : `${sign}${numeric} ${def.symbol}`;
}

export { Decimal } from './rounding.js';
