import { afterEach, describe, expect, it, vi } from 'vitest';
import type { OrderDetail } from '@oh/contracts';
import i18n from '@/lib/i18n';
import {
  formatOrderDate,
  formatOrderTime,
  inclusiveTaxBreakdown,
  orderSettlementDate,
  printOrder,
} from './print-order';

afterEach(async () => {
  vi.useRealTimers();
  await i18n.changeLanguage('ar');
});

describe('localized receipt', () => {
  it('prints Hebrew labels without translating customer data or changing tax amounts', async () => {
    await i18n.changeLanguage('he');
    vi.useFakeTimers();
    const write = vi.fn();
    const target = {
      document: { write, close: vi.fn(), querySelector: vi.fn() },
      focus: vi.fn(),
      addEventListener: vi.fn(),
      print: vi.fn(),
    } as unknown as Window;
    printOrder(
      {
        id: 'test-order',
        number: 'ORD-00001',
        customerName: 'محمد',
        issuedAt: '2026-09-30T10:00:00Z',
        confirmedAt: null,
        allocations: [],
        total: '100.00',
        netTotal: '100.00',
        returnedAmount: '0.00',
        discountAmount: '0.00',
        paidAmount: '0.00',
        creditAppliedAmount: '0.00',
        remainingAmount: '100.00',
        status: 'CONFIRMED',
        items: [
          {
            name: 'رمل',
            quantity: '1',
            unitPrice: '100.00',
            lineTotal: '100.00',
            discount: '0.00',
          },
        ],
      } as unknown as OrderDetail,
      'ILS',
      {
        targetWindow: target,
        store: { name: 'OH Finance', logoUrl: null, taxEnabled: true, taxRate: 18 },
      },
    );
    const html = document.createElement('div');
    html.innerHTML = write.mock.calls[0]![0] as string;
    expect(write.mock.calls[0]![0]).toContain('lang="he"');
    expect(html.textContent).toContain('محمد');
    expect(html.textContent).toContain('رمل');
    expect(html.textContent).toContain('לא שולם');
    expect(html.textContent).toContain('82.00');
    expect(html.textContent).toContain('18.00');
    expect(html.textContent).toContain('100.00');
    expect(html.textContent?.replaceAll('محمد', '').replaceAll('رمل', '')).not.toMatch(
      /[\u0600-\u06ff]/u,
    );
  });
});

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
