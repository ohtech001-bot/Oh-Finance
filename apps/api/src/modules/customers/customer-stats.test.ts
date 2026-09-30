import { describe, expect, it, vi } from 'vitest';
import type { PrismaService, TxClient } from '../../core/prisma/prisma.service.js';
import type { AuditService } from '../../core/audit/audit.service.js';
import type { NumberingService } from '../../core/numbering/numbering.service.js';
import { TenantContext } from '../../core/tenancy/tenant-context.js';
import type { LedgerService } from '../ledger/ledger.service.js';
import { CustomersService } from './customers.service.js';

describe('customer statistics', () => {
  it('exposes the payment due date in the balances CTE before checking overdue customers', async () => {
    const query = vi.fn().mockImplementation(async (strings: TemplateStringsArray) => {
      const sql = strings.join('?');
      const balances = sql.slice(
        sql.indexOf('WITH balances AS'),
        sql.indexOf('\n        SELECT\n'),
      );
      expect(balances).toContain('c.payment_due_date');
      expect(sql).toContain('EXTRACT(DAY FROM payment_due_date)');
      expect(sql).toContain('c.archived_at IS NULL');
      return [
        { with_debt: 2n, total_debt: '150.00', over_limit: 1n, overdue_payment_customers: 1n },
      ];
    });
    const tx = {
      customer: { count: vi.fn().mockResolvedValue(3) },
      tenant: { findUnique: vi.fn().mockResolvedValue({ timezone: 'Asia/Jerusalem' }) },
      $queryRaw: query,
    } as unknown as TxClient;
    const prisma = {
      runInTenant: async (_tenant: string, fn: (tx: TxClient) => Promise<unknown>) => fn(tx),
    };
    const service = new CustomersService(
      prisma as unknown as PrismaService,
      {} as LedgerService,
      {} as NumberingService,
      {} as AuditService,
    );
    const result = await TenantContext.run(
      {
        requestId: 'stats-test',
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
      () => service.stats(),
    );
    expect(query).toHaveBeenCalledOnce();
    expect(result).toMatchObject({
      withDebt: 2,
      totalDebt: '150.00',
      overCreditLimit: 1,
      overduePaymentCustomers: 1,
    });
  });
});
