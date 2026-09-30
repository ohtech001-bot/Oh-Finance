import { describe, expect, it, vi } from 'vitest';
import type { TxClient } from '../../core/prisma/prisma.service.js';
import { LedgerService } from './ledger.service.js';

describe('return ledger protection', () => {
  it('rejects an independent reversal of an order return credit before any write', async () => {
    const findFirst = vi.fn().mockResolvedValue({
      id: 'entry',
      customerId: 'customer',
      entryType: 'ADJUSTMENT_CREDIT',
      refType: 'ORDER',
      refId: 'order',
    });
    const service = new LedgerService();
    const append = vi.spyOn(service, 'append');
    const tx = { ledgerEntry: { findFirst } } as unknown as TxClient;

    await expect(
      service.reverse(tx, {
        tenantId: 'tenant',
        storeId: 'store',
        entryId: 'entry',
        reason: 'test',
        createdBy: null,
      }),
    ).rejects.toThrow();
    expect(findFirst).toHaveBeenCalledTimes(1);
    expect(append).not.toHaveBeenCalled();
  });
});
