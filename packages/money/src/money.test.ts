import { describe, expect, it } from 'vitest';
import {
  Decimal,
  MoneyError,
  add,
  allocate,
  divide,
  equals,
  formatMoney,
  greaterThan,
  isMoneyString,
  max,
  min,
  multiply,
  negate,
  percentOf,
  roundMoney,
  subtract,
  sum,
  toCurrencyString,
  toMoney,
  toMoneyString,
  toStorageScale,
  zero,
} from './index.js';

describe('toMoney — البوابة', () => {
  it('يقبل نصًا عشريًا صالحًا', () => {
    expect(toMoney('1250.00').toString()).toBe('1250');
    expect(toMoney('-42.5').toString()).toBe('-42.5');
    expect(toMoney('0').toString()).toBe('0');
  });

  it('يقبل Decimal كما هو', () => {
    const d = new Decimal('99.99');
    expect(toMoney(d)).toBe(d);
  });

  it('يرفض number صراحةً — هذا هو جوهر الحماية', () => {
    // النوع يمنع تمرير number وقت الترجمة. نختبر هنا الحارس وقت التشغيل —
    // لأن البيانات القادمة من JSON.parse أو من كود JS خالص تتجاوز الأنواع.
    // @ts-expect-error اختبار متعمّد للحارس: النوع يرفض number.
    expect(() => toMoney(1250.5)).toThrow(MoneyError);
    // @ts-expect-error اختبار متعمّد للحارس: حتى الصفر مرفوض كـnumber.
    expect(() => toMoney(0)).toThrow(/number/);
  });

  it('يرفض النصوص غير الصالحة', () => {
    expect(() => toMoney('abc')).toThrow(MoneyError);
    expect(() => toMoney('1e5')).toThrow(MoneyError); // الصيغة الأسّية تكسر NUMERIC
    expect(() => toMoney('1,250.00')).toThrow(MoneyError); // الفواصل للعرض فقط
    expect(() => toMoney(' 12 ')).toThrow(MoneyError);
    expect(() => toMoney('')).toThrow(MoneyError);
    expect(() => toMoney('١٢٣')).toThrow(MoneyError); // أرقام عربية-هندية
  });
});

describe('isMoneyString', () => {
  it.each([
    ['0', true],
    ['1250.00', true],
    ['-0.01', true],
    ['999999999999.9999', true],
    ['1.', false],
    ['.5', false],
    ['1e3', false],
    ['NaN', false],
    ['Infinity', false],
  ])('isMoneyString(%s) === %s', (input, expected) => {
    expect(isMoneyString(input)).toBe(expected);
  });
});

describe('الحساب — حيث يفشل الـ float', () => {
  it('0.1 + 0.2 === 0.3 بالضبط (بينما JS يعطي 0.30000000000000004)', () => {
    expect(add('0.1', '0.2').toString()).toBe('0.3');
    // البرهان على الخطأ الذي نتجنّبه:
    expect(0.1 + 0.2).not.toBe(0.3);
  });

  it('الضرب دقيق حيث يفشل الـfloat', () => {
    expect(multiply('1234.56', '3').toString()).toBe('3703.68');

    // البرهان: 1.1 × 3 يعطي 3.3000000000000003 في JS.
    // تخيّل هذا سعرَ وحدة × كمية في سطر فاتورة — الخطأ يدخل الدفتر ويبقى.
    expect(multiply('1.1', '3').toString()).toBe('3.3');
    expect(1.1 * 3).not.toBe(3.3);

    // و 0.07 × 100 يعطي 7.000000000000001 (نسبة ضريبة × مبلغ).
    expect(multiply('0.07', '100').toString()).toBe('7');
    expect(0.07 * 100).not.toBe(7);
  });

  it('الطرح والجمع والمجموع', () => {
    expect(subtract('1000.00', '250.50').toString()).toBe('749.5');
    expect(sum(['10.10', '20.20', '30.30']).toString()).toBe('60.6');
    expect(sum([]).toString()).toBe('0');
    expect(negate('50.25').toString()).toBe('-50.25');
  });

  it('القسمة ترفض الصفر', () => {
    expect(() => divide('100', '0')).toThrow(/صفر/);
    expect(divide('100', '4').toString()).toBe('25');
  });

  it('النسبة المئوية (ضريبة 17%)', () => {
    expect(percentOf('1000.00', '17').toString()).toBe('170');
    expect(roundMoney(percentOf('99.99', '17')).toString()).toBe('17');
  });
});

describe('roundMoney — سياسة HALF_UP التجارية', () => {
  it('1.005 → 1.01 (وليس 1.00 كما يعطي toFixed العائم)', () => {
    expect(roundMoney('1.005').toFixed(2)).toBe('1.01');
    // البرهان: طريقة JS الشائعة تخطئ هنا.
    expect((1.005).toFixed(2)).toBe('1.00');
  });

  it('لا يستخدم التقريب المصرفي (half-even)', () => {
    // half-even كان سيعطي 1.02 و 1.02؛ HALF_UP يعطي 1.02 و 1.03.
    expect(roundMoney('1.015').toFixed(2)).toBe('1.02');
    expect(roundMoney('1.025').toFixed(2)).toBe('1.03');
  });

  it('يحترم خانات العملة — الدينار الأردني 3 خانات', () => {
    expect(roundMoney('1.2345', 'JOD').toFixed(3)).toBe('1.235');
    expect(roundMoney('1.2345', 'ILS').toFixed(2)).toBe('1.23');
  });

  it('السالب يقرّب بعيدًا عن الصفر', () => {
    expect(roundMoney('-1.005').toFixed(2)).toBe('-1.01');
  });

  it('toStorageScale يقصّ إلى 4 خانات (حدود NUMERIC(18,4))', () => {
    expect(toStorageScale('1.234567').toFixed(4)).toBe('1.2346');
  });
});

describe('المقارنات', () => {
  it('تعمل على النصوص مباشرة', () => {
    expect(equals('10.00', '10')).toBe(true);
    expect(greaterThan('10.01', '10.00')).toBe(true);
    expect(min('5.00', '3.00').toString()).toBe('3');
    expect(max('5.00', '3.00').toString()).toBe('5');
  });
});

describe('التسلسل', () => {
  it('toMoneyString يخرج بدقة التخزين (4 خانات)', () => {
    expect(toMoneyString('1250')).toBe('1250.0000');
    expect(toMoneyString('0.1')).toBe('0.1000');
  });

  it('toCurrencyString يخرج بخانات العملة', () => {
    expect(toCurrencyString('1250', 'ILS')).toBe('1250.00');
    expect(toCurrencyString('1250', 'JOD')).toBe('1250.000');
  });

  it('لا يُنتج صيغة أسّية (تكسر NUMERIC في Postgres)', () => {
    expect(toMoneyString('0.0001')).toBe('0.0001');
    expect(toMoneyString('999999999999.9999')).not.toMatch(/e/i);
  });

  it('يحافظ على الدقة في المبالغ الضخمة (فوق MAX_SAFE_INTEGER)', () => {
    const huge = '9007199254740993.55'; // أكبر من 2^53
    expect(toMoneyString(huge, 2)).toBe('9007199254740993.55');
  });
});

describe('formatMoney — العرض', () => {
  it('يبني نص العملة بموضع الرمز الصحيح', () => {
    expect(formatMoney('1250', { currency: 'ILS' })).toBe('1,250.00 ₪');
    expect(formatMoney('1250', { currency: 'SAR' })).toBe('1,250.00 ر.س');
    expect(formatMoney('1250', { currency: 'USD' })).toBe('$1,250.00');
  });

  it('فواصل الآلاف', () => {
    expect(formatMoney('1234567.891', { currency: 'ILS' })).toBe('1,234,567.89 ₪');
    expect(formatMoney('999', { currency: 'ILS' })).toBe('999.00 ₪');
    expect(formatMoney('1234', { grouping: false, withSymbol: false })).toBe('1234.00');
  });

  it('السالب — الإشارة قبل الرقم', () => {
    expect(formatMoney('-200', { currency: 'ILS' })).toBe('-200.00 ₪');
  });

  it('signDisplay يُظهر + للموجب فقط', () => {
    expect(formatMoney('50', { signDisplay: true, withSymbol: false })).toBe('+50.00');
    expect(formatMoney('0', { signDisplay: true, withSymbol: false })).toBe('0.00');
    expect(formatMoney('-50', { signDisplay: true, withSymbol: false })).toBe('-50.00');
  });

  it('بدون رمز', () => {
    expect(formatMoney('1250', { withSymbol: false })).toBe('1,250.00');
  });
});

describe('allocate — التوزيع بلا فقدان فلس', () => {
  it('توزيع 100 على 3 بالتساوي: 33.34 + 33.33 + 33.33 = 100.00 بالضبط', () => {
    const parts = allocate('100.00', ['1', '1', '1'], 'ILS');
    expect(parts.map((p) => p.toFixed(2))).toEqual(['33.34', '33.33', '33.33']);
    expect(sum(parts).toFixed(2)).toBe('100.00');
    // الطريقة الساذجة كانت ستعطي 99.99 — أي فلس مفقود.
  });

  it('التوزيع بالوزن (مبالغ متبقية على طلبات)', () => {
    const parts = allocate('1000.00', ['500', '300', '200'], 'ILS');
    expect(parts.map((p) => p.toFixed(2))).toEqual(['500.00', '300.00', '200.00']);
  });

  it('توزيع جزئي بأوزان غير متساوية يبقى متزنًا', () => {
    const parts = allocate('333.33', ['700', '200', '100'], 'ILS');
    expect(sum(parts).toFixed(2)).toBe('333.33');
  });

  it('أوزان كلها صفر → توزيع متساوٍ (حالة حافة)', () => {
    const parts = allocate('10.00', ['0', '0'], 'ILS');
    expect(sum(parts).toFixed(2)).toBe('10.00');
  });

  it('مبلغ صفر → أصفار', () => {
    const parts = allocate('0', ['5', '5'], 'ILS');
    expect(parts.map((p) => p.toFixed(2))).toEqual(['0.00', '0.00']);
  });

  it('يرفض المبلغ السالب والوزن السالب', () => {
    expect(() => allocate('-1', ['1'])).toThrow(RangeError);
    expect(() => allocate('1', ['-1'])).toThrow(RangeError);
  });

  it('يحترم خانات العملة (JOD = 3 خانات)', () => {
    const parts = allocate('10.000', ['1', '1', '1'], 'JOD');
    expect(sum(parts).toFixed(3)).toBe('10.000');
  });

  it('خاصية: مجموع التوزيعات = المبلغ بالضبط (500 حالة عشوائية)', () => {
    // اختبار خاصية — يصطاد حالات الحافة التي لا يفكر فيها كاتب الاختبار.
    for (let i = 0; i < 500; i += 1) {
      const cents = Math.floor(Math.random() * 1_000_000);
      const amount = toMoneyString(divide(String(cents), '100'), 2);

      const bucketCount = 1 + Math.floor(Math.random() * 8);
      const weights = Array.from({ length: bucketCount }, () =>
        String(Math.floor(Math.random() * 10_000)),
      );

      const parts = allocate(amount, weights, 'ILS');

      expect(sum(parts).toFixed(2)).toBe(toMoney(amount).toFixed(2));
      expect(parts.every((p) => !p.isNegative())).toBe(true);
      expect(parts).toHaveLength(bucketCount);
    }
  });
});

describe('zero', () => {
  it('يعطي صفرًا جديدًا', () => {
    expect(zero().isZero()).toBe(true);
  });
});
