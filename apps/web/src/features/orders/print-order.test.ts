import { describe, expect, it } from 'vitest';
import { inclusiveTaxBreakdown } from './print-order';

describe('inclusiveTaxBreakdown', () => {
  it('يستخرج ضريبة 18% من السعر النهائي دون زيادته', () => {
    expect(inclusiveTaxBreakdown('100.00', true, 18, 'ILS')).toEqual({
      beforeTax: '82.00',
      taxAmount: '18.00',
    });
  });

  it('يعرض السعر كاملًا قبل الضريبة عندما تكون الضريبة معطلة', () => {
    expect(inclusiveTaxBreakdown('100.00', false, 18, 'ILS')).toEqual({
      beforeTax: '100.00',
      taxAmount: '0.00',
    });
  });
});
