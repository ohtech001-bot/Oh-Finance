import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OrdersService } from './orders.service.js';
import type { PrismaService } from '../../core/prisma/prisma.service.js';
import type { LedgerService } from '../ledger/ledger.service.js';
import type { OrderCalculator } from './order-calculator.js';
import type { NumberingService } from '../../core/numbering/numbering.service.js';
import type { AuditService } from '../../core/audit/audit.service.js';
import { TenantContext } from '../../core/tenancy/tenant-context.js';

describe('return transaction service', () => {
  const order = {
    id: 'order',
    tenantId: 'tenant',
    storeId: 'store',
    customerId: 'customer',
    number: 'ORD-1',
    version: 2,
    status: 'PARTIALLY_PAID',
    total: '270',
    returnedAmount: '0',
    paidAmount: '200',
    store: { currency: 'ILS' },
    items: [
      { id: 'a', lineTotal: '100', returnItem: null },
      { id: 'b', lineTotal: '200', returnItem: null },
    ],
  };
  let tx: {
    $executeRaw: ReturnType<typeof vi.fn>;
    order: { findFirst: ReturnType<typeof vi.fn>; updateMany: ReturnType<typeof vi.fn> };
    orderReturn: { findUnique: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn> };
  };
  let service: OrdersService;
  let append: ReturnType<typeof vi.fn>;
  let audit: ReturnType<typeof vi.fn>;
  const body = { version: 2, requestId: 'request', itemIds: ['b'] };
  const run = (fn: () => Promise<unknown>) =>
    TenantContext.run(
      {
        requestId: 'test',
        tenantId: 'tenant',
        storeId: 'store',
        userId: 'user',
        permissions: [],
        isSuperAdmin: false,
        supportMode: false,
        mustChangePassword: false,
        ip: null,
        userAgent: null,
      },
      fn,
    );

  beforeEach(() => {
    tx = {
      $executeRaw: vi.fn().mockResolvedValue(1),
      order: {
        findFirst: vi.fn().mockResolvedValue(order),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      orderReturn: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ id: 'return' }),
      },
    };
    append = vi.fn().mockResolvedValue({});
    audit = vi.fn().mockResolvedValue(undefined);
    service = new OrdersService(
      {
        runInTenant: (_id: string, fn: (value: typeof tx) => Promise<unknown>) => fn(tx),
      } as unknown as PrismaService,
      { append } as unknown as LedgerService,
      {} as OrderCalculator,
      {} as NumberingService,
      { record: audit } as unknown as AuditService,
    );
    vi.spyOn(service, 'findOne').mockResolvedValue(null);
  });

  it('locks before rereading financial state and credits the ledger without rewriting the original total or paid amount', async () => {
    await run(() => service.returnItems('order', body));
    expect(tx.$executeRaw.mock.invocationCallOrder[0]).toBeLessThan(
      tx.order.findFirst.mock.invocationCallOrder[1]!,
    );
    expect(append).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ amount: '180.0000', direction: 'CREDIT', refId: 'order' }),
    );
    const data = tx.order.updateMany.mock.calls[0]![0].data;
    expect(data).toMatchObject({ returnedAmount: '180.0000', status: 'PAID' });
    expect(data).not.toHaveProperty('total');
    expect(data).not.toHaveProperty('paidAmount');
    expect(audit).toHaveBeenCalledOnce();
  });

  it.each(['DRAFT', 'QUOTE', 'PAID', 'CANCELLED'])(
    'rejects %s orders before any write',
    async (status) => {
      tx.order.findFirst.mockResolvedValue({ ...order, status });
      await expect(run(() => service.returnItems('order', body))).rejects.toThrow();
      expect(tx.orderReturn.create).not.toHaveBeenCalled();
      expect(append).not.toHaveBeenCalled();
    },
  );

  it('rejects stale versions and foreign items', async () => {
    await expect(
      run(() => service.returnItems('order', { ...body, version: 1 })),
    ).rejects.toThrow();
    await expect(
      run(() => service.returnItems('order', { ...body, itemIds: ['foreign'] })),
    ).rejects.toThrow();
    expect(tx.orderReturn.create).not.toHaveBeenCalled();
  });

  it('replays a committed request without writing a second credit', async () => {
    tx.orderReturn.findUnique.mockResolvedValue({
      orderId: 'order',
      reason: null,
      items: [{ orderItemId: 'b' }],
    });
    await run(() => service.returnItems('order', body));
    expect(tx.orderReturn.create).not.toHaveBeenCalled();
    expect(append).not.toHaveBeenCalled();
  });

  it('rejects reusing a request ID for different products', async () => {
    tx.orderReturn.findUnique.mockResolvedValue({
      orderId: 'order',
      reason: null,
      items: [{ orderItemId: 'a' }],
    });
    await expect(run(() => service.returnItems('order', body))).rejects.toThrow();
    expect(append).not.toHaveBeenCalled();
  });

  it('propagates ledger failures to the surrounding transaction instead of updating the order', async () => {
    append.mockRejectedValue(new Error('ledger unavailable'));
    await expect(run(() => service.returnItems('order', body))).rejects.toThrow(
      'ledger unavailable',
    );
    expect(tx.order.updateMany).not.toHaveBeenCalled();
    expect(audit).not.toHaveBeenCalled();
  });
});
