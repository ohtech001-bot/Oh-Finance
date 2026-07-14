import { Injectable } from '@nestjs/common';
import {
  AUDIT_ACTIONS,
  type AccountState,
  type CreateCustomerRequest,
  type Customer,
  type CustomerListQuery,
  type CustomerStats,
  type CustomerSummary,
  type PaginatedResult,
  type UpdateCustomerRequest,
} from '@oh/contracts';
import {
  Decimal,
  isNegative,
  isZero,
  max,
  subtract,
  sum,
  toMoney,
  toMoneyString,
  zero,
} from '@oh/money';
import type { Prisma } from '@prisma/client';
import { AppError } from '../../core/errors/app-error.js';
import { AuditService } from '../../core/audit/audit.service.js';
import { NumberingService } from '../../core/numbering/numbering.service.js';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import { TenantContext } from '../../core/tenancy/tenant-context.js';
import { LedgerService } from '../ledger/ledger.service.js';

/** صف الزبون كما نقرأه من Prisma. */
type CustomerRow = Prisma.CustomerGetPayload<Record<string, never>>;

@Injectable()
export class CustomersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
    private readonly numbering: NumberingService,
    private readonly audit: AuditService,
  ) {}

  /**
   * إنشاء زبون.
   *
   * الرصيد الافتتاحي (إن وُجد) يصير **قيدًا في الدفتر**، لا عمودًا.
   * كل شيء في معاملة واحدة: زبون بلا قيده الافتتاحي = رصيد خاطئ صامت.
   */
  async create(dto: CreateCustomerRequest): Promise<Customer> {
    const { tenantId, storeId, userId } = this.context();

    const customerId = await this.prisma.runInTenant(tenantId, async (tx) => {
      const code = await this.numbering.next(tx, tenantId, storeId, 'customer');

      const customer = await tx.customer.create({
        data: {
          tenantId,
          storeId,
          code,
          name: dto.name,
          company: dto.company || null,
          phone: dto.phone || null,
          phoneAlt: dto.phoneAlt || null,
          email: dto.email || null,
          address: dto.address || null,
          city: dto.city || null,
          taxNumber: dto.taxNumber || null,
          notes: dto.notes || null,
          tags: dto.tags,
          creditLimit: dto.creditLimit,
          paymentTermDays: dto.paymentTermDays,
          status: dto.status,
          createdBy: userId,
        },
      });

      // ── الرصيد الافتتاحي → قيد محاسبي ──────────────────────────────────
      const opening = toMoney(dto.openingBalance);
      if (!isZero(opening)) {
        const isDebit = !isNegative(opening);

        await this.ledger.append(tx, {
          tenantId,
          storeId,
          customerId: customer.id,
          entryType: 'OPENING_BALANCE',
          direction: isDebit ? 'DEBIT' : 'CREDIT',
          amount: toMoneyString(opening.abs()),
          refType: 'CUSTOMER',
          refId: customer.id,
          notes: 'رصيد افتتاحي عند إنشاء الزبون.',
          createdBy: userId,
        });
      }

      await this.audit.record(tx, {
        action: AUDIT_ACTIONS.CUSTOMER_CREATED,
        summary: `إضافة زبون "${dto.name}" (${code})`,
        entityType: 'Customer',
        entityId: customer.id,
        after: {
          code,
          name: dto.name,
          creditLimit: dto.creditLimit,
          openingBalance: dto.openingBalance,
        },
      });

      return customer.id;
    });

    const created = await this.findOne(customerId);
    if (!created) throw AppError.internal('تعذّر قراءة الزبون بعد إنشائه.');
    return created;
  }

  async list(query: CustomerListQuery): Promise<PaginatedResult<Customer>> {
    const { tenantId } = this.context();

    return this.prisma.runInTenant(tenantId, async (tx) => {
      const where: Prisma.CustomerWhereInput = {
        ...(query.includeArchived ? {} : { archivedAt: null }),
        ...(query.status ? { status: query.status } : {}),
        ...(query.city ? { city: { equals: query.city, mode: 'insensitive' } } : {}),
        ...(query.tag ? { tags: { has: query.tag } } : {}),
        ...(query.search
          ? {
              OR: [
                { name: { contains: query.search, mode: 'insensitive' } },
                { code: { contains: query.search, mode: 'insensitive' } },
                { company: { contains: query.search, mode: 'insensitive' } },
                { phone: { contains: query.search } },
                { taxNumber: { contains: query.search } },
              ],
            }
          : {}),
      };

      /**
       * ⚠️ الفرز والفلترة بالرصيد لا يمكنان في Prisma — الرصيد ليس عمودًا.
       *
       * الحل: نجلب المرشّحين، نحسب أرصدتهم دفعة واحدة (DISTINCT ON — لا N+1)،
       * ثم نفلتر ونرتّب في الذاكرة، ثم نُرقّم.
       *
       * الثمن: عند الفرز/الفلترة بالرصيد نجلب أكثر من صفحة. مقبول لعشرات
       * الآلاف من الزبائن (سقف الباقة 100 ألف). لو تجاوزناه، الحل هو
       * MATERIALIZED VIEW على الأرصدة تُحدَّث بـtrigger — لا عمود قابل للكتابة.
       */
      const needsBalanceSort =
        query.sortBy === 'balance' ||
        query.accountState !== undefined ||
        query.overCreditLimit === true;

      if (!needsBalanceSort) {
        const [total, rows] = await Promise.all([
          tx.customer.count({ where }),
          tx.customer.findMany({
            where,
            orderBy: this.orderBy(query.sortBy, query.sortOrder),
            skip: (query.page - 1) * query.pageSize,
            take: query.pageSize,
          }),
        ]);

        const balances = await this.ledger.getBalances(
          tx,
          tenantId,
          rows.map((r) => r.id),
        );

        return {
          items: rows.map((row) => this.toDto(row, balances.get(row.id) ?? zero())),
          page: query.page,
          pageSize: query.pageSize,
          total,
          totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
        };
      }

      // ── مسار الرصيد ───────────────────────────────────────────────────
      const candidates = await tx.customer.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 20_000, // سقف صلب — يمنع استنزاف الذاكرة
      });

      const balances = await this.ledger.getBalances(
        tx,
        tenantId,
        candidates.map((c) => c.id),
      );

      let enriched = candidates.map((row) => ({
        row,
        balance: balances.get(row.id) ?? zero(),
      }));

      if (query.accountState) {
        enriched = enriched.filter((e) => this.accountState(e.balance) === query.accountState);
      }

      if (query.overCreditLimit) {
        enriched = enriched.filter((e) => {
          const limit = toMoney(e.row.creditLimit.toString());
          return !isZero(limit) && e.balance.greaterThan(limit);
        });
      }

      if (query.sortBy === 'balance') {
        enriched.sort((a, b) =>
          query.sortOrder === 'asc'
            ? a.balance.comparedTo(b.balance)
            : b.balance.comparedTo(a.balance),
        );
      }

      const total = enriched.length;
      const start = (query.page - 1) * query.pageSize;
      const page = enriched.slice(start, start + query.pageSize);

      return {
        items: page.map((e) => this.toDto(e.row, e.balance)),
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
      };
    });
  }

  async findOne(id: string): Promise<Customer | null> {
    const { tenantId } = this.context();

    return this.prisma.runInTenant(tenantId, async (tx) => {
      const row = await tx.customer.findFirst({ where: { id } });
      if (!row) return null;

      const balance = await this.ledger.getBalance(tx, tenantId, id);
      return this.toDto(row, balance);
    });
  }

  /** بطاقات شاشة «صفحة كل زبون». */
  async summary(id: string): Promise<CustomerSummary> {
    const { tenantId } = this.context();

    return this.prisma.runInTenant(tenantId, async (tx) => {
      const row = await tx.customer.findFirst({ where: { id } });
      if (!row) throw AppError.notFound('الزبون');

      const balance = await this.ledger.getBalance(tx, tenantId, id);
      const now = new Date();

      const [orderAgg, paymentAgg, lastOrder, lastPayment, overdue] = await Promise.all([
        tx.order.aggregate({
          where: { tenantId, customerId: id, status: { not: 'CANCELLED' } },
          _count: true,
          _sum: { total: true },
        }),
        tx.payment.aggregate({
          where: { tenantId, customerId: id, status: 'POSTED' },
          _count: true,
          _sum: { amount: true },
        }),
        tx.order.findFirst({
          where: { tenantId, customerId: id, status: { not: 'CANCELLED' } },
          orderBy: { issuedAt: 'desc' },
          select: { issuedAt: true },
        }),
        tx.payment.findFirst({
          where: { tenantId, customerId: id, status: 'POSTED' },
          orderBy: { paidAt: 'desc' },
          select: { paidAt: true },
        }),
        tx.order.findMany({
          where: {
            tenantId,
            customerId: id,
            status: { in: ['CONFIRMED', 'PARTIALLY_PAID'] },
            dueAt: { lt: now },
          },
          select: { total: true, paidAmount: true },
        }),
      ]);

      const overdueAmount = overdue.length
        ? sum(
            overdue.map((o) =>
              toMoneyString(
                subtract(toMoney(o.total.toString()), toMoney(o.paidAmount.toString())),
              ),
            ),
          )
        : zero();

      return {
        customer: this.toDto(row, balance),
        totalOrders: orderAgg._count,
        totalOrdersAmount: toMoneyString(orderAgg._sum.total?.toString() ?? '0', 2),
        totalPayments: paymentAgg._count,
        totalPaymentsAmount: toMoneyString(paymentAgg._sum.amount?.toString() ?? '0', 2),
        lastOrderAt: lastOrder?.issuedAt.toISOString() ?? null,
        lastPaymentAt: lastPayment?.paidAt.toISOString() ?? null,
        overdueOrders: overdue.length,
        overdueAmount: toMoneyString(overdueAmount, 2),
      } as CustomerSummary;
    });
  }

  async update(id: string, dto: UpdateCustomerRequest): Promise<Customer> {
    const { tenantId } = this.context();

    await this.prisma.runInTenant(tenantId, async (tx) => {
      const before = await tx.customer.findFirst({ where: { id } });
      if (!before) throw AppError.notFound('الزبون');

      const after = await tx.customer.update({
        where: { id },
        data: {
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          ...(dto.company !== undefined ? { company: dto.company || null } : {}),
          ...(dto.phone !== undefined ? { phone: dto.phone || null } : {}),
          ...(dto.phoneAlt !== undefined ? { phoneAlt: dto.phoneAlt || null } : {}),
          ...(dto.email !== undefined ? { email: dto.email || null } : {}),
          ...(dto.address !== undefined ? { address: dto.address || null } : {}),
          ...(dto.city !== undefined ? { city: dto.city || null } : {}),
          ...(dto.taxNumber !== undefined ? { taxNumber: dto.taxNumber || null } : {}),
          ...(dto.notes !== undefined ? { notes: dto.notes || null } : {}),
          ...(dto.tags !== undefined ? { tags: dto.tags } : {}),
          ...(dto.creditLimit !== undefined ? { creditLimit: dto.creditLimit } : {}),
          ...(dto.paymentTermDays !== undefined
            ? { paymentTermDays: dto.paymentTermDays }
            : {}),
          ...(dto.status !== undefined ? { status: dto.status } : {}),
        },
      });

      await this.audit.record(tx, {
        action: AUDIT_ACTIONS.CUSTOMER_UPDATED,
        summary: `تعديل بيانات الزبون "${after.name}" (${after.code})`,
        entityType: 'Customer',
        entityId: id,
        before: {
          name: before.name,
          creditLimit: before.creditLimit.toString(),
          status: before.status,
        },
        after: {
          name: after.name,
          creditLimit: after.creditLimit.toString(),
          status: after.status,
        },
      });
    });

    const updated = await this.findOne(id);
    if (!updated) throw AppError.notFound('الزبون');
    return updated;
  }

  /**
   * أرشفة — لا حذف.
   *
   * ⚠️ الحذف الحقيقي مستحيل بنيويًا: `ledger_entries.customer_id` مرجع
   *    `onDelete: Restrict`. حذف زبون له قيود محاسبية سيُلغي جزءًا من
   *    الدفتر — وهذا ممنوع بالتصميم.
   *
   *    زبون بلا أي قيد يمكن حذفه نظريًا، لكننا نأرشفه أيضًا: التوحيد أبسط،
   *    والأرشفة قابلة للتراجع.
   */
  async archive(id: string): Promise<void> {
    const { tenantId } = this.context();

    await this.prisma.runInTenant(tenantId, async (tx) => {
      const customer = await tx.customer.findFirst({ where: { id } });
      if (!customer) throw AppError.notFound('الزبون');
      if (customer.archivedAt) throw AppError.conflict('الزبون مؤرشف مسبقًا.');

      const balance = await this.ledger.getBalance(tx, tenantId, id);
      if (!isZero(balance)) {
        throw AppError.conflict(
          `لا يمكن أرشفة زبون له رصيد قائم (${toMoneyString(balance, 2)}). ` +
            'سدّد الحساب أو أنشئ قيد إعدام دَين أولًا.',
        );
      }

      const openOrders = await tx.order.count({
        where: { tenantId, customerId: id, status: { in: ['DRAFT', 'QUOTE', 'CONFIRMED', 'PARTIALLY_PAID'] } },
      });
      if (openOrders > 0) {
        throw AppError.conflict(`للزبون ${openOrders} طلب مفتوح. أغلقها أو ألغِها أولًا.`);
      }

      await tx.customer.update({
        where: { id },
        data: { archivedAt: new Date(), status: 'INACTIVE' },
      });

      await this.audit.record(tx, {
        action: AUDIT_ACTIONS.CUSTOMER_ARCHIVED,
        summary: `أرشفة الزبون "${customer.name}" (${customer.code})`,
        entityType: 'Customer',
        entityId: id,
      });
    });
  }

  /** إحصاءات رأس الشاشة. */
  async stats(): Promise<CustomerStats> {
    const { tenantId } = this.context();

    return this.prisma.runInTenant(tenantId, async (tx) => {
      const [total, active] = await Promise.all([
        tx.customer.count({ where: { archivedAt: null } }),
        tx.customer.count({ where: { archivedAt: null, status: 'ACTIVE' } }),
      ]);

      /**
       * إجمالي الديون — من الدفتر مباشرة، بـSQL.
       *
       * نجمع فقط الأرصدة **الموجبة**: زبون له رصيد دائن (دفعة مقدّمة) ليس
       * دَينًا لنا، وطرحه من الإجمالي كان سيُخفي حجم الديون الحقيقي.
       */
      const rows = await tx.$queryRaw<
        { with_debt: bigint; total_debt: string; over_limit: bigint }[]
      >`
        WITH balances AS (
          SELECT DISTINCT ON (le.customer_id)
                 le.customer_id,
                 le.running_balance,
                 c.credit_limit
          FROM ledger_entries le
          JOIN customers c ON c.id = le.customer_id
          WHERE le.tenant_id = ${tenantId}::uuid
            AND c.archived_at IS NULL
          ORDER BY le.customer_id, le.seq DESC
        )
        SELECT
          COUNT(*) FILTER (WHERE running_balance > 0)                       AS with_debt,
          COALESCE(SUM(running_balance) FILTER (WHERE running_balance > 0), 0)::text AS total_debt,
          COUNT(*) FILTER (WHERE credit_limit > 0 AND running_balance > credit_limit) AS over_limit
        FROM balances
      `;

      const row = rows[0];

      return {
        total,
        active,
        withDebt: Number(row?.with_debt ?? 0),
        totalDebt: toMoneyString(row?.total_debt ?? '0', 2),
        overCreditLimit: Number(row?.over_limit ?? 0),
      } as CustomerStats;
    });
  }

  // ── مساعدات ──────────────────────────────────────────────────────────────

  private context(): { tenantId: string; storeId: string; userId: string } {
    const ctx = TenantContext.get();
    const tenantId = TenantContext.requireTenantId();
    const userId = TenantContext.requireUserId();

    if (!ctx?.storeId) {
      throw AppError.forbidden('لا يوجد محل مرتبط بحسابك.');
    }

    return { tenantId, storeId: ctx.storeId, userId };
  }

  private orderBy(
    sortBy: CustomerListQuery['sortBy'],
    order: 'asc' | 'desc',
  ): Prisma.CustomerOrderByWithRelationInput {
    // 'balance' و'lastOrderAt' لا يُفرزان في SQL — يُعالجان في الذاكرة.
    if (sortBy === 'balance' || sortBy === 'lastOrderAt') {
      return { createdAt: order };
    }
    return { [sortBy]: order } as Prisma.CustomerOrderByWithRelationInput;
  }

  /** حالة الحساب — **مشتقة** من الرصيد، لا مخزّنة. */
  private accountState(balance: Decimal): AccountState {
    if (isZero(balance)) return 'SETTLED';
    return balance.greaterThan(0) ? 'DEBIT' : 'CREDIT';
  }

  private toDto(row: CustomerRow, balance: Decimal): Customer {
    const creditLimit = toMoney(row.creditLimit.toString());

    // الائتمان المتاح = الحد − الرصيد. لا ينزل تحت صفر.
    const availableCredit = max(subtract(creditLimit, balance), zero());

    return {
      id: row.id,
      code: row.code,
      name: row.name,
      company: row.company,
      phone: row.phone,
      phoneAlt: row.phoneAlt,
      email: row.email,
      address: row.address,
      city: row.city,
      taxNumber: row.taxNumber,
      notes: row.notes,
      tags: row.tags,
      creditLimit: toMoneyString(creditLimit, 2),
      paymentTermDays: row.paymentTermDays,
      status: row.status,

      balance: toMoneyString(balance, 2),
      accountState: this.accountState(balance),
      availableCredit: toMoneyString(availableCredit, 2),

      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      archivedAt: row.archivedAt?.toISOString() ?? null,
    } as Customer;
  }
}
