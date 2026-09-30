import { greaterThan, isNegative, negate, toMoneyString, zero } from '@oh/money';

// The ledger stores debt as positive; the customer's displayed balance uses the opposite sign.
export function ledgerBalanceDisplay(balance: string) {
  return {
    debt: greaterThan(balance, zero()) ? toMoneyString(balance, 2) : '0.00',
    credit: isNegative(balance) ? toMoneyString(negate(balance), 2) : '0.00',
    signedBalance: toMoneyString(negate(balance), 2),
  };
}
