import { allocate, max, subtract, sum, toMoneyString, zero, type CurrencyCode } from '@oh/money';

export function returnValues(
  total: string,
  items: readonly { id: string; lineTotal: { toString(): string } }[],
  currency: CurrencyCode,
): Map<string, string> {
  const shares = allocate(
    total,
    items.map((item) => item.lineTotal.toString()),
    currency,
  );
  return new Map(items.map((item, index) => [item.id, toMoneyString(shares[index] ?? zero())]));
}

export function returnBalance(total: string, returned: string, paid: string) {
  const net = subtract(total, returned);
  return {
    net,
    remaining: max(subtract(net, paid), zero()),
    releasedCredit: max(subtract(paid, net), zero()),
  };
}

export function selectedReturnAmount(values: Map<string, string>, ids: readonly string[]) {
  if (new Set(ids).size !== ids.length || ids.some((id) => !values.has(id))) {
    throw new Error('Invalid return selection');
  }
  return sum(ids.map((id) => values.get(id) ?? '0'));
}
