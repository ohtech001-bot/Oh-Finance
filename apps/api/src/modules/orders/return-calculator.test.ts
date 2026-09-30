import { describe, expect, it } from 'vitest';
import { returnBalance, returnValues, selectedReturnAmount } from './return-calculator.js';

describe('order returns', () => {
  it('allocates the order discount across products rather than refunding their gross prices', () => {
    const values = returnValues(
      '270',
      [
        { id: 'a', lineTotal: '100' },
        { id: 'b', lineTotal: '200' },
      ],
      'ILS',
    );
    expect(selectedReturnAmount(values, ['a']).toFixed(2)).toBe('90.00');
    expect(selectedReturnAmount(values, ['a', 'b']).toFixed(2)).toBe('270.00');
  });
  it('preserves every minor currency unit across repeated partial returns', () => {
    const values = returnValues(
      '100',
      ['a', 'b', 'c'].map((id) => ({ id, lineTotal: '40' })),
      'ILS',
    );
    expect([...values.values()].sort()).toEqual(['33.3300', '33.3300', '33.3400']);
    expect(selectedReturnAmount(values, ['a', 'b', 'c']).toFixed(2)).toBe('100.00');
  });
  it('reduces outstanding debt and leaves historical payments unchanged', () => {
    const result = returnBalance('500', '200', '100');
    expect(result.net.toFixed(2)).toBe('300.00');
    expect(result.remaining.toFixed(2)).toBe('200.00');
    expect(result.releasedCredit.toFixed(2)).toBe('0.00');
  });
  it('releases overpayment as customer credit without a negative remaining amount', () => {
    const result = returnBalance('500', '400', '300');
    expect(result.remaining.toFixed(2)).toBe('0.00');
    expect(result.releasedCredit.toFixed(2)).toBe('200.00');
  });
  it('returns all previously paid money as credit for a full return', () => {
    const result = returnBalance('500', '500', '300');
    expect(result.net.toFixed(2)).toBe('0.00');
    expect(result.releasedCredit.toFixed(2)).toBe('300.00');
  });
  it('rejects duplicate and foreign product selections', () => {
    const values = new Map([['a', '100']]);
    expect(() => selectedReturnAmount(values, ['a', 'a'])).toThrow();
    expect(() => selectedReturnAmount(values, ['b'])).toThrow();
  });
  it('supports free products and three-decimal currencies', () => {
    const values = returnValues(
      '1.001',
      [
        { id: 'a', lineTotal: '1' },
        { id: 'b', lineTotal: '0' },
      ],
      'JOD',
    );
    expect(selectedReturnAmount(values, ['a', 'b']).toFixed(3)).toBe('1.001');
    expect(selectedReturnAmount(values, ['b']).isZero()).toBe(true);
  });
});
