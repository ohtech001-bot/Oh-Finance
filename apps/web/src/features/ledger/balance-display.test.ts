import { describe, expect, it } from 'vitest';
import { ledgerBalanceDisplay } from './balance-display';

describe('ledger customer balance display', () => {
  it('shows outstanding debt as a negative customer balance', () => {
    expect(ledgerBalanceDisplay('500.00')).toEqual({
      debt: '500.00',
      credit: '0.00',
      signedBalance: '-500.00',
    });
  });
  it('shows an overpayment as available positive credit', () => {
    expect(ledgerBalanceDisplay('-200.00')).toEqual({
      debt: '0.00',
      credit: '200.00',
      signedBalance: '200.00',
    });
  });
  it('shows no debt after full settlement', () => {
    expect(ledgerBalanceDisplay('0.00')).toEqual({
      debt: '0.00',
      credit: '0.00',
      signedBalance: '0.00',
    });
  });
});
