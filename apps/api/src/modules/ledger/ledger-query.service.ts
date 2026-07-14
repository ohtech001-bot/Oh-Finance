import { Injectable } from '@nestjs/common';
import {
  AUDIT_ACTIONS,
  type CreateAdjustmentRequest,
  type CustomerStatement,
  type LedgerEntry,
  type LedgerListQuery,
  type LedgerTotals,
  type PaginatedResult,
  type ReverseEntryRequest,
} from '@oh/contracts';
import { add, subtract, sum, toMoney, toMoneyString, zero } from '@oh/money';
import type { Prisma } from '@prisma/client';
import { AppError } from '../../core/errors/app-error.js';
import { AuditService } from '../../core/audit/audit.service.js';
import { PrismaService, type TxClient } from '../../core/prisma/prisma.service.js';
import { TenantContext } from '../../core/tenancy/tenant-context.js';
import { LedgerService } from './ledger.service.js';

type EntryRow = Prisma.LedgerEntryGetPayload<{
  include: { customer: { select: { name: true; code: true } } };
}>;

/**
 * قراءات دفتر الحركات + البوابة الوحيدة للتسويات اليدوية.
 *
 * فُصلت عن `LedgerService` عمدًا: تلك خدمة **دومين** تستقبل `tx` وتُستدعى من
 * داخل معاملات عمليات أخرى. هذه خدمة **تطبيق** تفتح معاملاتها بنفسها وتخدم
 * المتحكّم مباشرة. الخلط بينهما كان سيجعل خدمة الدومين تعتمد على HTTP.
 */
@Injectable()
export class LedgerQueryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
    private readonly audit: AuditService,
  ) {}

  async list(query: LedgerListQuery): Promise<PaginatedResult<LedgerEntry> & { totals: LedgerTotals }> {
    const { tenantId } = this.context();

    return this.prisma.runInTenant(tenantId, async (tx) => {
      const where = this.buildWhere(query);

      const [total, rows, agg] = await Promise.all([
        tx.ledgerEntry.count({ where }),
        tx.ledgerEntry.findMany({
          where,
          orderBy: [{ occurredAt: 'desc' }, { seq: 'desc' }],
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
          include: { customer: { select: { name: true, code: true } } },
        }),
        tx.ledgerEntry.aggregate({ where, _sum: { debit: true, credit: true } }),
      ]);

      // القيود المعكوسة — لعرض شارة «معكوس» في الجدول.
      const reversedIds = await this.fetchReversedIds(
        tx,
        tenantId,
        rows.map((r) => r.id),
      );

      const refNumbers = await this.fetchRefNumbers(tx, tenantId, rows);

      const totalDebit = toMoney(agg._sum.debit?.toString() ?? '0');
      const totalCredit = toMoney(agg._sum.credit?.toString() ?? '0');

      // الرصيد الحالي: لزبون محدد = آخر قيد له. بلا فلتر زبون = بلا معنى.
      const currentBalance = query.customerId
        ? await this.ledger.getBalance(tx, tenantId, query.customerId)
        : subtract(totalDebit, totalCredit);

      return {
        items: rows.map((row) =>
          this.toDto(row, reversedIds.has(row.id), refNumbers.get(row.id) ?? null),
        ),
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
        totals: {
          totalDebit: toMoneyString(totalDebit, 2),
          totalCredit: toMoneyString(totalCredit, 2),
          currentBalance: toMoneyString(currentBalance, 2),
          entryCount: total,
        } as LedgerTotals,
      };
    });
  }

  /**
   * كشف حساب زبون.
   *
   * `openingBalance` = الرصيد **قبل** بداية الفترة — لا صفر.
   * كشف حساب يبدأ من صفر بينما على الزبون دَين قديم يضلّل القارئ تمامًا:
   * يظن أن ما يراه هو كل ما عليه.
   */
  async statement(
    customerId: string,
    from?: string,
    to?: string,
  ): Promise<CustomerStatement> {
    const { tenantId } = this.context();

    return this.prisma.runInTenant(tenantId, async (tx) => {
      const customer = await tx.customer.findFirst({
        where: { id: customerId },
        select: { id: true, name: true, code: true },
      });
      if (!customer) throw AppError.notFound('الزبون');

      const fromDate = from ? new Date(from) : null;
      const toDate = to ? new Date(`${to}T23:59:59.999Z`) : null;

      // الرصيد الافتتاحي للفترة = آخر runningBalance قبل بدايتها.
      let openingBalance = zero();
      if (fromDate) {
        const previous = await tx.ledgerEntry.findFirst({
          where: { tenantId, customerId, occurredAt: { lt: fromDate } },
          orderBy: [{ occurredAt: 'desc' }, { seq: 'desc' }],
          select: { runningBalance: true },
        });
        openingBalance = previous ? toMoney(previous.runningBalance.toString()) : zero();
      }

      const entries = await tx.ledgerEntry.findMany({
        where: {
          tenantId,
          customerId,
          ...(fromDate || toDate
            ? {
                occurredAt: {
                  ...(fromDate ? { gte: fromDate } : {}),
                  ...(toDate ? { lte: toDate } : {}),
                },
              }
            : {}),
        },
        orderBy: [{ seq: 'asc' }],
        include: { customer: { select: { name: true, code: true } } },
      });

      const reversedIds = await this.fetchReversedIds(
        tx,
        tenantId,
        entries.map((e) => e.id),
      );
      const refNumbers = await this.fetchRefNumbers(tx, tenantId, entries);

      const totalDebit = entries.length
        ? sum(entries.map((e) => e.debit.toString()))
        : zero();
      const totalCredit = entries.length
        ? sum(entries.map((e) => e.credit.toString()))
        : zero();

      const closingBalance = entries.length
        ? toMoney(entries[entries.length - 1]?.runningBalance.toString() ?? '0')
        : openingBalance;

      return {
        customerId: customer.id,
        customerName: customer.name,
        customerCode: customer.code,

        openingBalance: toMoneyString(openingBalance, 2),
        closingBalance: toMoneyString(closingBalance, 2),

        entries: entries.map((row) =>
          this.toDto(row, reversedIds.has(row.id), refNumbers.get(row.id) ?? null),
        ),

        totals: {
          totalDebit: toMoneyString(totalDebit, 2),
          totalCredit: toMoneyString(totalCredit, 2),
          currentBalance: toMoneyString(closingBalance, 2),
          entryCount: entries.length,
        },

        from: from ?? null,
        to: to ?? null,
        generatedAt: new Date().toISOString(),
      } as CustomerStatement;
    });
  }

  /**
   * ═══════════════════════════════════════════════════════════════════════
   *  قيد تسوية يدوي — البوابة الوحيدة لتغيير رصيد بلا طلب أو دفعة.
   * ═══════════════════════════════════════════════════════════════════════
   *
   *  محصورة بصلاحية `ledger.adjust` (صاحب المحل وحده — يفرضها الحارس).
   *  السبب إلزامي. القيد يظهر في الدفتر وفي سجل التدقيق.
   *
   *  لا توجد بوابة أخرى في النظام كله. لا endpoint لكتابة `balance`، لأن
   *  `balance` ليس عمودًا يمكن كتابته.
   */
  async createAdjustment(dto: CreateAdjustmentRequest): Promise<LedgerEntry> {
    const { tenantId, storeId, userId } = this.context();

    const entryId = await this.prisma.runInTenant(tenantId, async (tx) => {
      const customer = await tx.customer.findFirst({
        where: { id: dto.customerId, archivedAt: null },
        select: { id: true, name: true, code: true },
      });
      if (!customer) throw AppError.notFound('الزبون');

      const entry = await this.ledger.append(tx, {
        tenantId,
        storeId,
        customerId: dto.customerId,
        entryType: dto.direction === 'DEBIT' ? 'ADJUSTMENT_DEBIT' : 'ADJUSTMENT_CREDIT',
        direction: dto.direction,
        amount: dto.amount,
        refType: 'ADJUSTMENT',
        refId: null,
        notes: dto.reason,
        occurredAt: dto.occurredAt ? new Date(dto.occurredAt) : new Date(),
        createdBy: userId,
      });

      await this.audit.record(tx, {
        action: AUDIT_ACTIONS.LEDGER_ADJUSTMENT,
        summary:
          `قيد تسوية ${dto.direction === 'DEBIT' ? 'مدين' : 'دائن'} بمبلغ ${dto.amount} ` +
          `على حساب "${customer.name}" (${customer.code}). ` +
          `الرصيد ${toMoneyString(entry.openingBalance, 2)} → ${toMoneyString(entry.runningBalance, 2)}. ` +
          `السبب: ${dto.reason}`,
        entityType: 'LedgerEntry',
        entityId: entry.id,
        after: {
          direction: dto.direction,
          amount: dto.amount,
          reason: dto.reason,
          balanceBefore: toMoneyString(entry.openingBalance, 2),
          balanceAfter: toMoneyString(entry.runningBalance, 2),
        },
      });

      return entry.id;
    });

    const created = await this.findOne(entryId);
    if (!created) throw AppError.internal('تعذّر قراءة القيد بعد إنشائه.');
    return created;
  }

  /** عكس قيد — يُنشئ قيدًا مضادًا، ولا يحذف شيئًا. */
  async reverseEntry(id: string, dto: ReverseEntryRequest): Promise<LedgerEntry> {
    const { tenantId, storeId, userId } = this.context();

    const reversalId = await this.prisma.runInTenant(tenantId, async (tx) => {
      const original = await tx.ledgerEntry.findFirst({
        where: { id },
        include: { customer: { select: { name: true, code: true } } },
      });
      if (!original) throw AppError.notFound('القيد');

      /**
       * قيود الطلبات والدفعات تُعكَس من وحداتها، لا من هنا.
       *
       * السبب: عكس قيد دفعة يجب أن يُعيد `paidAmount` على الطلبات أيضًا.
       * لو سمحنا بعكسه هنا مباشرة، لصار الرصيد صحيحًا بينما الطلبات تظن
       * أنها مدفوعة — تناقض صامت. الوحدة المسؤولة تعرف كيف تُنظّف أثرها.
       */
      if (original.entryType === 'PAYMENT_CREDIT') {
        throw AppError.conflict(
          'قيد دفعة يُعكس من شاشة الدفعات (عكس الدفعة)، لا من دفتر الحركات — ' +
            'كي تُعاد الطلبات المرتبطة إلى حالتها.',
        );
      }
      if (original.entryType === 'ORDER_DEBIT') {
        throw AppError.conflict(
          'قيد طلب يُعكس بإلغاء الطلب من شاشة الطلبات، لا من دفتر الحركات.',
        );
      }

      const reversal = await this.ledger.reverse(tx, {
        tenantId,
        storeId,
        entryId: id,
        reason: dto.reason,
        createdBy: userId,
      });

      await this.audit.record(tx, {
        action: AUDIT_ACTIONS.LEDGER_ENTRY_REVERSED,
        summary:
          `عكس القيد #${original.seq} (${original.entryType}) ` +
          `على حساب "${original.customer.name}". ` +
          `الرصيد بعد العكس: ${toMoneyString(reversal.runningBalance, 2)}. ` +
          `السبب: ${dto.reason}`,
        entityType: 'LedgerEntry',
        entityId: reversal.id,
        after: { reversedEntryId: id, reason: dto.reason },
      });

      return reversal.id;
    });

    const created = await this.findOne(reversalId);
    if (!created) throw AppError.internal('تعذّر قراءة قيد العكس.');
    return created;
  }

  /** فحص سلامة دفتر زبون — أداة تدقيق. */
  async verify(customerId: string) {
    const { tenantId } = this.context();

    return this.prisma.runInTenant(tenantId, (tx) =>
      this.ledger.verifyIntegrity(tx, tenantId, customerId),
    );
  }

  async findOne(id: string): Promise<LedgerEntry | null> {
    const { tenantId } = this.context();

    return this.prisma.runInTenant(tenantId, async (tx) => {
      const row = await tx.ledgerEntry.findFirst({
        where: { id },
        include: { customer: { select: { name: true, code: true } } },
      });
      if (!row) return null;

      const reversed = await this.fetchReversedIds(tx, tenantId, [id]);
      const refs = await this.fetchRefNumbers(tx, tenantId, [row]);

      return this.toDto(row, reversed.has(id), refs.get(id) ?? null);
    });
  }

  // ── مساعدات ──────────────────────────────────────────────────────────────

  private buildWhere(query: LedgerListQuery): Prisma.LedgerEntryWhereInput {
    return {
      ...(query.customerId ? { customerId: query.customerId } : {}),
      ...(query.entryType ? { entryType: query.entryType } : {}),
      ...(query.refType ? { refType: query.refType } : {}),
      ...(query.search
        ? {
            OR: [
              { notes: { contains: query.search, mode: 'insensitive' } },
              { customer: { name: { contains: query.search, mode: 'insensitive' } } },
              { customer: { code: { contains: query.search, mode: 'insensitive' } } },
            ],
          }
        : {}),
      ...(query.from || query.to
        ? {
            occurredAt: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(`${query.to}T23:59:59.999Z`) } : {}),
            },
          }
        : {}),
    };
  }

  /** أي من هذه القيود عُكس بقيد لاحق؟ */
  private async fetchReversedIds(
    tx: TxClient,
    tenantId: string,
    entryIds: string[],
  ): Promise<Set<string>> {
    if (entryIds.length === 0) return new Set();

    const reversals = await tx.ledgerEntry.findMany({
      where: { tenantId, reversesEntryId: { in: entryIds } },
      select: { reversesEntryId: true },
    });

    return new Set(
      reversals.map((r) => r.reversesEntryId).filter((id): id is string => id !== null),
    );
  }

  /**
   * أرقام المراجع (ORD-00087 / PAY-00045) — استعلامان اثنان لا N+1.
   *
   * الجدول يعرض «رقم المرجع» لكل قيد. جلبه بـinclude مستحيل: `refId` مرجع
   * متعدد الأشكال (طلب أو دفعة). فنجمع المعرّفات ونستعلم مرة لكل نوع.
   */
  private async fetchRefNumbers(
    tx: TxClient,
    tenantId: string,
    entries: { id: string; refType: string; refId: string | null }[],
  ): Promise<Map<string, string>> {
    const result = new Map<string, string>();

    const orderIds = entries
      .filter((e) => e.refType === 'ORDER' && e.refId)
      .map((e) => e.refId as string);
    const paymentIds = entries
      .filter((e) => e.refType === 'PAYMENT' && e.refId)
      .map((e) => e.refId as string);

    const [orders, payments] = await Promise.all([
      orderIds.length
        ? tx.order.findMany({
            where: { tenantId, id: { in: orderIds } },
            select: { id: true, number: true },
          })
        : Promise.resolve([]),
      paymentIds.length
        ? tx.payment.findMany({
            where: { tenantId, id: { in: paymentIds } },
            select: { id: true, number: true },
          })
        : Promise.resolve([]),
    ]);

    const numbers = new Map<string, string>();
    for (const o of orders) numbers.set(o.id, o.number);
    for (const p of payments) numbers.set(p.id, p.number);

    for (const entry of entries) {
      if (entry.refId) {
        const number = numbers.get(entry.refId);
        if (number) result.set(entry.id, number);
      }
    }

    return result;
  }

  private toDto(row: EntryRow, isReversed: boolean, refNumber: string | null): LedgerEntry {
    return {
      id: row.id,
      seq: row.seq,

      customerId: row.customerId,
      customerName: row.customer.name,
      customerCode: row.customer.code,

      entryType: row.entryType,

      openingBalance: toMoneyString(row.openingBalance.toString(), 2),
      debit: toMoneyString(row.debit.toString(), 2),
      credit: toMoneyString(row.credit.toString(), 2),
      runningBalance: toMoneyString(row.runningBalance.toString(), 2),

      refType: row.refType,
      refId: row.refId,
      refNumber,

      reversesEntryId: row.reversesEntryId,
      isReversed,

      notes: row.notes,

      occurredAt: row.occurredAt.toISOString(),
      createdAt: row.createdAt.toISOString(),
      createdBy: row.createdBy,
      createdByName: null,
    } as LedgerEntry;
  }

  private context(): { tenantId: string; storeId: string; userId: string } {
    const ctx = TenantContext.get();
    const tenantId = TenantContext.requireTenantId();
    const userId = TenantContext.requireUserId();
    if (!ctx?.storeId) throw AppError.forbidden('لا يوجد محل مرتبط بحسابك.');
    return { tenantId, storeId: ctx.storeId, userId };
  }
}

export { add };
