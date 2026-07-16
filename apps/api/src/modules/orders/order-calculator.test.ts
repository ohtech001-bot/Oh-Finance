import { describe, expect, it } from 'vitest';
import type { OrderItemInput } from '@oh/contracts';
import { OrderCalculator } from './order-calculator.js';

const calc = new OrderCalculator();

function item(over: Partial<OrderItemInput> = {}): OrderItemInput {
  return {
    sourceType: 'MANUAL',
    name: 'بند',
    description: '',
    quantity: '1',
    unitPrice: '100.00',
    discount: '0',
    taxRate: '0',
    ...over,
  } as OrderItemInput;
}

describe('OrderCalculator — الأساسيات', () => {
  it('بند واحد بلا خصم ولا ضريبة', () => {
    const r = calc.calculate([item({ quantity: '2', unitPrice: '50.00' })]);
    expect(r.subtotal.toFixed(2)).toBe('100.00');
    expect(r.taxAmount.toFixed(2)).toBe('0.00');
    expect(r.total.toFixed(2)).toBe('100.00');
  });

  it('عدة بنود تُجمَع', () => {
    const r = calc.calculate([
      item({ quantity: '2', unitPrice: '50.00' }),
      item({ quantity: '3', unitPrice: '25.00' }),
    ]);
    expect(r.subtotal.toFixed(2)).toBe('175.00');
    expect(r.total.toFixed(2)).toBe('175.00');
  });

  it('كمية عشرية (1.5 كجم)', () => {
    const r = calc.calculate([item({ quantity: '1.5', unitPrice: '10.00' })]);
    expect(r.total.toFixed(2)).toBe('15.00');
  });

  it('كمية صغيرة جدًا (0.25 ساعة)', () => {
    const r = calc.calculate([item({ quantity: '0.25', unitPrice: '400.00' })]);
    expect(r.total.toFixed(2)).toBe('100.00');
  });
});

describe('⚠️ الضريبة تُحسب بعد الخصم — لا قبله', () => {
  /**
   * هذا أهم اختبار في الملف.
   *
   * حساب الضريبة قبل الخصم يجعل الزبون يدفع ضريبة على مبلغ لم يدفعه.
   * خطأ محاسبي وقانوني، ويمر بصمت لأن الفارق صغير في كل سطر.
   */
  it('100 − خصم 20 = 80، والضريبة 17% على 80 = 13.60 (لا 17.00)', () => {
    const r = calc.calculate([
      item({ unitPrice: '100.00', discount: '20.00', taxRate: '17' }),
    ]);

    expect(r.subtotal.toFixed(2)).toBe('80.00');
    expect(r.taxAmount.toFixed(2)).toBe('13.60'); // 80 × 17%
    expect(r.total.toFixed(2)).toBe('93.60');

    // لو حُسبت الضريبة قبل الخصم لكانت 17.00 والإجمالي 97.00 — أعلى بـ3.40.
    expect(r.taxAmount.toFixed(2)).not.toBe('17.00');
  });

  it('الخصم على كامل السطر ⇒ لا ضريبة', () => {
    const r = calc.calculate([
      item({ unitPrice: '100.00', discount: '100.00', taxRate: '17' }),
    ]);
    expect(r.subtotal.toFixed(2)).toBe('0.00');
    expect(r.taxAmount.toFixed(2)).toBe('0.00');
    expect(r.total.toFixed(2)).toBe('0.00');
  });

  it('خصم يتجاوز السطر لا يُنتج سطرًا سالبًا', () => {
    const r = calc.calculate([
      item({ unitPrice: '100.00', discount: '150.00', taxRate: '17' }),
    ]);
    expect(r.subtotal.toFixed(2)).toBe('0.00');
    expect(r.total.toFixed(2)).toBe('0.00');
    expect(r.total.isNegative()).toBe(false);
  });
});

describe('الدقة العشرية — حيث يفشل الـfloat', () => {
  it('0.1 × 3 = 0.30 لا 0.30000000000000004', () => {
    const r = calc.calculate([item({ quantity: '3', unitPrice: '0.10' })]);
    expect(r.total.toFixed(2)).toBe('0.30');
    expect(0.1 * 3).not.toBe(0.3); // برهان الخطأ الذي نتجنّبه
  });

  it('ضريبة 17% على 99.99 = 17.00 (تقريب HALF_UP)', () => {
    const r = calc.calculate([item({ unitPrice: '99.99', taxRate: '17' })]);
    // 99.99 × 0.17 = 16.9983 → 17.00
    expect(r.taxAmount.toFixed(2)).toBe('17.00');
    expect(r.total.toFixed(2)).toBe('116.99');
  });

  it('مبلغ ضخم يحافظ على دقته (فوق MAX_SAFE_INTEGER)', () => {
    const r = calc.calculate([item({ quantity: '1', unitPrice: '9007199254740993.55' })]);
    expect(r.total.toFixed(2)).toBe('9007199254740993.55');
  });

  it('التقريب مرة واحدة لكل سطر — لا يتراكم عبر 100 بند', () => {
    // 100 بند بقيمة 0.005 لكل واحد. التقريب في كل خطوة وسيطة يراكم الخطأ.
    const items = Array.from({ length: 100 }, () =>
      item({ quantity: '1', unitPrice: '0.005' }),
    );
    const r = calc.calculate(items);

    // كل سطر يُقرَّب إلى 0.01 (HALF_UP) ⇒ 100 × 0.01 = 1.00
    expect(r.total.toFixed(2)).toBe('1.00');
  });
});

describe('خصم الطلب (فوق خصومات البنود)', () => {
  it('يُطرح من الإجمالي بعد الضريبة', () => {
    const r = calc.calculate([item({ unitPrice: '100.00', taxRate: '17' })], '17.00');
    expect(r.subtotal.toFixed(2)).toBe('100.00');
    expect(r.taxAmount.toFixed(2)).toBe('17.00');
    expect(r.discountAmount.toFixed(2)).toBe('17.00');
    expect(r.total.toFixed(2)).toBe('100.00'); // 117 − 17
  });

  it('خصم يتجاوز الإجمالي يُقصَّ عند الإجمالي — لا طلب سالب', () => {
    const r = calc.calculate([item({ unitPrice: '100.00' })], '500.00');
    expect(r.total.toFixed(2)).toBe('0.00');
    expect(r.discountAmount.toFixed(2)).toBe('100.00'); // قُصَّ
    expect(r.total.isNegative()).toBe(false);
  });
});

describe('حالات حافة', () => {
  it('سعر صفر مسموح (بند مجاني)', () => {
    const r = calc.calculate([item({ unitPrice: '0' })]);
    expect(r.total.toFixed(2)).toBe('0.00');
  });

  it('نسبة ضريبة 100%', () => {
    const r = calc.calculate([item({ unitPrice: '100.00', taxRate: '100' })]);
    expect(r.taxAmount.toFixed(2)).toBe('100.00');
    expect(r.total.toFixed(2)).toBe('200.00');
  });

  it('نسبة ضريبة كسرية (17.5%)', () => {
    const r = calc.calculate([item({ unitPrice: '200.00', taxRate: '17.5' })]);
    expect(r.taxAmount.toFixed(2)).toBe('35.00');
  });

  it('مجموع أسطر المخرَج = عدد البنود', () => {
    const r = calc.calculate([item(), item(), item()]);
    expect(r.lines).toHaveLength(3);
  });

  it('مجموع lineTotals = subtotal + tax (قبل خصم الطلب)', () => {
    const r = calc.calculate([
      item({ unitPrice: '33.33', taxRate: '17' }),
      item({ unitPrice: '66.67', taxRate: '17' }),
    ]);

    const sumLines = r.lines.reduce((acc, l) => acc.plus(l.lineTotal), r.lines[0]!.lineTotal.minus(r.lines[0]!.lineTotal));
    expect(sumLines.toFixed(2)).toBe(r.subtotal.plus(r.taxAmount).toFixed(2));
  });
});

describe('toTotals — صيغة النقل', () => {
  it('كل المبالغ نصوص، لا أرقام', () => {
    const r = calc.calculate([item({ unitPrice: '100.00', taxRate: '17' })]);
    const totals = calc.toTotals(r);

    expect(typeof totals.total).toBe('string');
    expect(typeof totals.subtotal).toBe('string');
    expect(totals.lineTotals.every((t) => typeof t === 'string')).toBe(true);

    expect(totals.total).toBe('117.00');
  });

  it('الدينار الأردني بثلاث خانات', () => {
    const r = calc.calculate([item({ unitPrice: '10.555' })], '0', 'JOD');
    const totals = calc.toTotals(r, 'JOD');
    expect(totals.total).toBe('10.555');
  });
});
