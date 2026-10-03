import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Customer, CustomerStatement, OrderDetail } from '@oh/contracts';
import { printCustomerStatement } from './print-customer-statement';

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe.each(['ar', 'he'] as const)('statement order links (%s)', (locale) => {
  it('links order numbers to the application without making payment references into order links', () => {
    const write = vi.fn();
    const target = {
      document: { write, close: vi.fn(), querySelector: vi.fn() },
      focus: vi.fn(),
      addEventListener: vi.fn(),
      print: vi.fn(),
    } as unknown as Window;
    vi.useFakeTimers();
    const date = '2026-09-30T10:00:00Z';
    const orderId = 'order"<id>';
    const entry = {
      entryType: 'ORDER_DEBIT',
      refType: 'ORDER',
      refId: orderId,
      refNumber: 'ORD-00001',
      occurredAt: date,
      debit: '100.00',
      credit: '0.00',
      runningBalance: '100.00',
    };
    printCustomerStatement({
      targetWindow: target,
      locale,
      currency: 'ILS',
      store: null,
      customer: {
        id: 'customer',
        name: 'Customer',
        creditLimit: '1000.00',
        paymentDueDay: 15,
      } as Customer,
      statement: {
        generatedAt: date,
        totals: { currentBalance: '100.00' },
        orders: [],
        entries: [
          entry,
          {
            ...entry,
            entryType: 'PAYMENT_CREDIT',
            refType: 'PAYMENT',
            refId: 'payment',
            refNumber: 'PAY-00001',
          },
        ],
      } as unknown as CustomerStatement,
      orders: [
        {
          id: orderId,
          number: 'ORD-00001',
          issuedAt: date,
          items: [],
          total: '100.00',
          netTotal: '100.00',
          returnedAmount: '0.00',
          paidAmount: '0.00',
          creditAppliedAmount: '0.00',
          remainingAmount: '100.00',
          status: 'CONFIRMED',
        } as unknown as OrderDetail,
      ],
    });
    const html = document.createElement('div');
    html.innerHTML = write.mock.calls[0]![0] as string;
    const links = [...html.querySelectorAll<HTMLAnchorElement>('.order-link')];
    expect(links).toHaveLength(2);
    for (const link of links) {
      expect(link.href).toBe(
        new URL(`/orders/${encodeURIComponent(orderId)}`, window.location.origin).href,
      );
      expect(link.textContent).toBe('00001');
      expect(link.rel).toBe('noopener noreferrer');
    }
    expect(html.textContent).toContain('PAY-00001');
    expect(html.querySelector('a[href*="/orders/payment"]')).toBeNull();
    if (locale === 'he') {
      expect(write.mock.calls[0]![0]).toContain('lang="he"');
      expect(html.textContent).toContain('פירוט חשבון');
      expect(html.textContent).not.toMatch(/[\u0600-\u06ff]/u);
    }
  });
});
