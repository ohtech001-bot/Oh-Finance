import { describe, expect, it } from 'vitest';
import { calculateLineTotal, calculateOrderTotal } from './create-order-dialog';

describe('الحساب الحي للطلب', () => {
  it('يحسب الكمية في سعر الوحدة فورًا', () => {
    expect(calculateLineTotal({ quantity: '20', unitPrice: '5', discount: '' })).toBe('100.00');
  });

  it('يطرح خصم المنتج وخصم الطلب', () => {
    const first = calculateLineTotal({ quantity: '20', unitPrice: '5', discount: '10' });
    const second = calculateLineTotal({ quantity: '2', unitPrice: '25', discount: '' });

    expect(first).toBe('90.00');
    expect(calculateOrderTotal([first, second], '15')).toBe('125.00');
  });
});
