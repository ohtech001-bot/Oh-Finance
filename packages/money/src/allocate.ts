import { Decimal } from './rounding.js';
import { toMoney, roundMoney, sum, zero, type MoneyInput } from './money.js';
import { DEFAULT_CURRENCY, getCurrency, type CurrencyCode } from './currency.js';

/**
 * توزيع مبلغ على عدة أوعية دون فقدان أو خلق فلس واحد.
 *
 * ── المشكلة ──────────────────────────────────────────────────────────────────
 * توزيع 100.00 ₪ على 3 طلبات بالتساوي:
 *   100 / 3 = 33.333...  → تقريب كل واحد → 33.33 × 3 = 99.99
 *   ضاع 0.01 ₪.
 *
 * في نظام محاسبي هذا غير مقبول: مجموع التوزيعات **يجب** أن يساوي الدفعة
 * بالضبط، وإلا انكسرت المعادلة  amount = Σ allocations  وصار الدفتر غير متزن.
 *
 * ── الحل: خوارزمية أكبر البواقي (Largest Remainder) ──────────────────────────
 * 1. احسب الحصة المثالية لكل وعاء (بدقة كاملة).
 * 2. قرّب كل حصة لأسفل (floor) إلى خانات العملة.
 * 3. البواقي المتبقية (بالفلوس) توزَّع فلسًا فلسًا على الأوعية ذات أكبر
 *    كسر مهدور — الأعدل والأكثر استقرارًا.
 *
 * النتيجة: Σ allocations === amount  دائمًا وبالضبط.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * تُستخدم في المرحلة 5 لتوزيع الدفعة على الطلبات، وفي التقارير النسبية.
 * موضوعة هنا الآن لأنها منطق مالي بحت ومكانها هذه الحزمة، ومُختبَرة بالكامل.
 *
 * @param amount  المبلغ الكلي المراد توزيعه (يجب أن يكون ≥ 0)
 * @param weights أوزان الأوعية (مثلاً: المبالغ المتبقية على كل طلب)
 * @returns       مصفوفة بنفس طول الأوزان، مجموعها = amount بالضبط
 */
export function allocate(
  amount: MoneyInput,
  weights: readonly MoneyInput[],
  currency: CurrencyCode = DEFAULT_CURRENCY,
): Decimal[] {
  const total = toMoney(amount);
  if (total.isNegative()) {
    throw new RangeError('لا يمكن توزيع مبلغ سالب.');
  }
  if (weights.length === 0) {
    if (total.isZero()) return [];
    throw new RangeError('لا توجد أوعية لتوزيع المبلغ عليها.');
  }

  const { minorUnits } = getCurrency(currency);
  const decimalWeights = weights.map((w) => toMoney(w));

  if (decimalWeights.some((w) => w.isNegative())) {
    throw new RangeError('لا يُسمح بوزن سالب في التوزيع.');
  }

  const totalWeight = sum(decimalWeights);

  // كل الأوزان صفر: نوزّع بالتساوي (حالة حافة نادرة لكنها تُسقط النظام لو أُهملت).
  const effectiveWeights = totalWeight.isZero()
    ? decimalWeights.map(() => new Decimal(1))
    : decimalWeights;
  const effectiveTotal = totalWeight.isZero()
    ? new Decimal(decimalWeights.length)
    : totalWeight;

  // الوحدة الذرية للعملة: 0.01 لـ ILS، 0.001 لـ JOD.
  const unit = new Decimal(10).pow(-minorUnits);

  // 1) الحصة المثالية، و 2) التقريب لأسفل.
  const ideal = effectiveWeights.map((w) => total.times(w).dividedBy(effectiveTotal));
  const floored = ideal.map((v) => v.toDecimalPlaces(minorUnits, Decimal.ROUND_FLOOR));

  // 3) كم فلسًا تبقّى بعد التقريب لأسفل؟
  const distributed = sum(floored);
  const remainder = roundMoney(total.minus(distributed), currency);
  const unitsLeft = remainder.dividedBy(unit).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber();

  // رتّب الفهارس بأكبر كسر مهدور أولًا (وعند التعادل: الأكبر وزنًا، ثم الأسبق).
  const order = ideal
    .map((v, index) => ({
      index,
      fraction: v.minus(floored[index] ?? zero()),
      weight: effectiveWeights[index] ?? zero(),
    }))
    .sort((a, b) => {
      const byFraction = b.fraction.comparedTo(a.fraction);
      if (byFraction !== 0) return byFraction;
      const byWeight = b.weight.comparedTo(a.weight);
      if (byWeight !== 0) return byWeight;
      return a.index - b.index;
    });

  const result = [...floored];
  for (let i = 0; i < unitsLeft; i += 1) {
    const target = order[i % order.length];
    if (!target) break;
    const current = result[target.index] ?? zero();
    result[target.index] = current.plus(unit);
  }

  return result;
}
