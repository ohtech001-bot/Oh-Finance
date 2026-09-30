import { describe, expect, it, vi } from 'vitest';
import { Decimal } from '@oh/money';
import type { CreatePaymentRequest } from '@oh/contracts';
import type { PrismaService, TxClient } from '../../core/prisma/prisma.service.js';
import type { AuditService } from '../../core/audit/audit.service.js';
import type { NumberingService } from '../../core/numbering/numbering.service.js';
import { TenantContext } from '../../core/tenancy/tenant-context.js';
import type { LedgerService } from '../ledger/ledger.service.js';
import { PaymentsService } from './payments.service.js';

function inContext<T>(fn: () => T): T {
  return TenantContext.run(
    {
      requestId: 'test',
      tenantId: 'tenant',
      storeId: 'store',
      userId: 'user',
      isSuperAdmin: false,
      supportMode: false,
      permissions: [],
      mustChangePassword: false,
      ip: null,
      userAgent: null,
    },
    fn,
  );
}

function fixture() {
  const row = {
    id: 'payment',
    number: 'PAY-1',
    customerId: 'customer',
    customer: { name: 'Customer', code: 'C1' },
    amount: new Decimal(100),
    method: 'CASH',
    status: 'POSTED',
    paidAt: new Date(),
    createdAt: new Date(),
    reference: null,
    notes: null,
    reversedAt: null,
    reverseReason: null,
    createdBy: 'user',
    allocations: [],
  };
  const complete = vi.fn().mockResolvedValue({ count: 1 });
  const tx = {
    $executeRaw: vi.fn(),
    customer: {
      findFirst: vi.fn().mockResolvedValue({ id: 'customer', name: 'Customer', code: 'C1' }),
    },
    order: {
      findMany: vi.fn().mockResolvedValue([]),
      aggregate: vi.fn().mockResolvedValue({ _sum: { creditAppliedAmount: new Decimal(100) } }),
    },
    payment: {
      create: vi.fn().mockResolvedValue({ id: 'payment' }),
      findFirst: vi.fn().mockResolvedValue(row),
      aggregate: vi.fn().mockResolvedValue({ _sum: { amount: new Decimal(100) } }),
    },
    paymentAllocation: { aggregate: vi.fn().mockResolvedValue({ _sum: { amount: null } }) },
    ledgerEntry: { aggregate: vi.fn().mockResolvedValue({ _sum: { credit: null } }) },
    $queryRaw: vi.fn().mockResolvedValue([{ amount: '0' }]),
    idempotencyKey: { updateMany: complete },
  };
  let committed = false;
  const prisma = {
    runInTenant: vi.fn(async (_tenant: string, fn: (tx: TxClient) => Promise<unknown>) => {
      const result = await fn(tx as unknown as TxClient);
      committed = true;
      return result;
    }),
  };
  const ledger = {
    append: vi
      .fn()
      .mockResolvedValue({ openingBalance: new Decimal(0), runningBalance: new Decimal(-100) }),
    reverse: vi.fn(),
  };
  const service = new PaymentsService(
    prisma as unknown as PrismaService,
    ledger as unknown as LedgerService,
    { next: vi.fn().mockResolvedValue('PAY-1') } as unknown as NumberingService,
    { record: vi.fn() } as unknown as AuditService,
  );
  return { service, tx, row, complete, ledger, committed: () => committed };
}

const receipt = {
  customerId: 'customer',
  amount: '100',
  method: 'CASH',
  strategy: 'AUTO_OLDEST_FIRST',
} as CreatePaymentRequest;

describe('financial request safety', () => {
  it('saves the receipt response before committing the financial transaction', async () => {
    const f = fixture();
    f.complete.mockImplementation(async () => {
      expect(f.committed()).toBe(false);
      return { count: 1 };
    });
    const result = await inContext(() => f.service.create(receipt, 'test-request-key'));
    expect(result.amount).toBe('100.00');
    expect(f.complete).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: 'tenant', key: 'test-request-key', status: 'IN_PROGRESS' },
        data: expect.objectContaining({ status: 'COMPLETED', responseBody: result }),
      }),
    );
    expect(f.committed()).toBe(true);
  });

  it('does not commit when saving the replay response fails', async () => {
    const f = fixture();
    f.complete.mockRejectedValue(new Error('response persistence failed'));
    await expect(inContext(() => f.service.create(receipt, 'test-request-key'))).rejects.toThrow(
      'response persistence failed',
    );
    expect(f.committed()).toBe(false);
  });

  it('rejects reversal of a prepayment whose credit was already spent', async () => {
    const f = fixture();
    f.tx.payment.findFirst.mockResolvedValue({ ...f.row, customerId: 'customer' });
    await expect(inContext(() => f.service.reverse('payment', { reason: 'test' }))).rejects.toThrow(
      'استُخدم رصيدها',
    );
    expect(f.ledger.reverse).not.toHaveBeenCalled();
    expect(f.committed()).toBe(false);
  });
});
