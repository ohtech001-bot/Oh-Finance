import { describe, expect, it } from 'vitest';
import {
  formatOrderDate,
  formatOrderTime,
  inclusiveTaxBreakdown,
  orderSettlementDate,
} from './print-order';

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

describe('orderSettlementDate', () => {
  it('يستخدم تاريخ آخر دفعة عندما يكون الطلب مسددًا بالكامل', () => {
    const settledAt = orderSettlementDate({
      remainingAmount: '0.00',
      confirmedAt: '2026-08-01T08:00:00.000Z',
      allocations: [
        {
          paymentId: '00000000-0000-4000-8000-000000000001',
          paymentNumber: '1',
          paidAt: '2026-08-02T09:00:00.000Z',
          method: 'CASH',
          amount: '20.00',
        },
        {
          paymentId: '00000000-0000-4000-8000-000000000002',
          paymentNumber: '2',
          paidAt: '2026-08-03T10:30:00.000Z',
          method: 'CASH',
          amount: '80.00',
        },
      ],
    });

    expect(settledAt?.toISOString()).toBe('2026-08-03T10:30:00.000Z');
  });

  it('لا يعرض تاريخ سداد للطلب غير المسدد بالكامل', () => {
    expect(
      orderSettlementDate({
        remainingAmount: '10.00',
        confirmedAt: '2026-08-01T08:00:00.000Z',
        allocations: [],
      }),
    ).toBeNull();
  });
});

describe('order date formatting', () => {
  it('يعرض التاريخ والساعة بأرقام مرتبة لا تتأثر باتجاه العربية', () => {
    const date = new Date(2026, 7, 5, 5, 42);
    expect(formatOrderDate(date)).toBe('2026-08-05');
    expect(formatOrderTime(date)).toBe('05:42');
  });
});
