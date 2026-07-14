import { Injectable } from '@nestjs/common';
import {
  AUDIT_ACTIONS,
  type AllocationPreview,
  type AllocationPreviewRequest,
  type AllocationStrategy,
  type CreatePaymentRequest,
  type OpenOrder,
  type PaginatedResult,
  type Payment,
  type PaymentListQuery,
  type PaymentStats,
  type ReversePaymentRequest,
} from '@oh/contracts';
import {
  Decimal,
  add,
  equals,
  greaterThan,
  isZero,
  min,
  subtract,
  sum,
  toMoney,
  toMoneyString,
  zero,
  type MoneyString,
} from '@oh/money';
import type { Prisma } from '@prisma/client';
import { AppError } from '../../core/errors/app-error.js';
import { AuditService } from '../../core/audit/audit.service.js';
import { NumberingService } from '../../core/numbering/numbering.service.js';
import { PrismaService, type TxClient } from '../../core/prisma/prisma.service.js';
import { TenantContext } from '../../core/tenancy/tenant-context.js';
import { LedgerService } from '../ledger/ledger.service.js';

interface OpenOrderRow {
  id: string;
  number: string;
  issuedAt: Date;
  dueAt: Date | null;
  total: Decimal;
  paidAmount: Decimal;
}

interface PlannedAllocation {
  orderId: string;
  orderNumber: string;
  orderTotal: Decimal;
  alreadyPaid: Decimal;
  remaining: Decimal;
  willAllocate: Decimal;
}

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
    private readonly numbering: NumberingService,
    private readonly audit: AuditService,
  ) {}

  /**
   * ═══════════════════════════════════════════════════════════════════════
   *  تسجيل دفعة.
   * ═══════════════════════════════════════════════════════════════════════
   *
   *  ⚠️ تُستدعى **بعد** حجز مفتاح منع التكرار (`IdempotencyInterceptor`).
   *     الوصول إلى هنا يعني: هذا الطلب فريد، لم يُنفَّذ من قبل.
   *
   *  كل شيء في معاملة واحدة:
   *    1. قفل الزبون (داخل ledger.append) — يُسلسِل الدفعات المتزامنة
   *    2. حساب التوزيع
   *    3. إنشاء الدفعة
   *    4. القيد الدائن  ← يُغيّر الرصيد
   *    5. توزيع على الطلبات + تحديث حالاتها
   *    6. التدقيق
   *
   *  فشل أي خطوة ⇒ تراجع الكل. لا دفعة بلا قيد، ولا قيد بلا دفعة.
   */
  async create(dto: CreatePaymentRequest, idempotencyKey: string): Promise<Payment> {
    const { tenantId, storeId, userId } = this.context();

    const paymentId = await this.prisma.runInTenant(tenantId, async (tx) => {
      const customer = await tx.customer.findFirst({
        where: { id: dto.customerId, archivedAt: null },
        select: { id: true, name: true, code: true },
      });
      if (!customer) throw AppError.notFound('الزبون');

      const amount = toMoney(dto.amount);

      // ── 2. التوزيع ─────────────────────────────────────────────────────
      const planned = await this.planAllocations(
        tx,
        tenantId,
        dto.customerId,
        amount,
        dto.strategy,
        dto.allocations,
      );

      const allocatedTotal = sum(planned.map((p) => p.willAllocate));
      const unallocated = subtract(amount, allocatedTotal);

      /**
       * ثابت حاسم: مجموع التوزيعات لا يتجاوز الدفعة أبدًا.
       * لو تجاوزها، لصار مجموع `paidAmount` عبر الطلبات أكبر من المقبوض فعلًا
       * — أي أموال تظهر في النظام ولم تدخل الصندوق.
       */
      if (greaterThan(allocatedTotal, amount)) {
        throw AppError.internal(
          `خطأ في التوزيع: المجموع ${toMoneyString(allocatedTotal, 2)} ` +
            `يتجاوز الدفعة ${toMoneyString(amount, 2)}.`,
        );
      }

      // ── 3. الدفعة ──────────────────────────────────────────────────────
      const number = await this.numbering.next(tx, tenantId, storeId, 'payment');
      const paidAt = dto.paidAt ? new Date(dto.paidAt) : new Date();

      const payment = await tx.payment.create({
        data: {
          tenantId,
          storeId,
          customerId: dto.customerId,
          number,
          amount: toMoneyString(amount),
          method: dto.method,
          status: 'POSTED',
          paidAt,
          reference: dto.reference || null,
          notes: dto.notes || null,
          idempotencyKey,
          createdBy: userId,
        },
        select: { id: true },
      });

      // ── 4. القيد الدائن ────────────────────────────────────────────────
      const entry = await this.ledger.append(tx, {
        tenantId,
        storeId,
        customerId: dto.customerId,
        entryType: 'PAYMENT_CREDIT',
        direction: 'CREDIT',
        amount: toMoneyString(amount),
        refType: 'PAYMENT',
        refId: payment.id,
        notes: `دفعة رقم ${number} (${dto.method})`,
        createdBy: userId,
        // خط دفاع أخير: لو تسلّل طلب مكرر رغم كل شيء، القيد نفسه يرفضه.
        idempotencyKey,
        occurredAt: paidAt,
      });

      // ── 5. التوزيع على الطلبات ─────────────────────────────────────────
      for (const allocation of planned) {
        if (isZero(allocation.willAllocate)) continue;

        await tx.paymentAllocation.create({
          data: {
            tenantId,
            paymentId: payment.id,
            orderId: allocation.orderId,
            amount: toMoneyString(allocation.willAllocate),
          },
        });

        const newPaid = add(allocation.alreadyPaid, allocation.willAllocate);
        const fullyPaid = equals(newPaid, allocation.orderTotal);

        /**
         * تحديث الطلب: `paidAmount` و`status` فقط.
         *
         * الـtrigger `orders_lock_confirmed` يسمح بهذين تحديدًا ويرفض أي
         * تغيير على المبالغ الأصلية — فحتى لو أخطأ هذا الكود، لا يستطيع
         * تحريف إجمالي طلب مؤكد.
         */
        await tx.order.update({
          where: { id: allocation.orderId },
          data: {
            paidAmount: toMoneyString(newPaid),
            status: fullyPaid ? 'PAID' : 'PARTIALLY_PAID',
            version: { increment: 1 },
          },
        });
      }

      // ── 6. التدقيق ─────────────────────────────────────────────────────
      const allocationSummary = planned
        .filter((p) => !isZero(p.willAllocate))
        .map((p) => `${p.orderNumber}: ${toMoneyString(p.willAllocate, 2)}`)
        .join('، ');

      await this.audit.record(tx, {
        action: AUDIT_ACTIONS.PAYMENT_CREATED,
        summary:
          `تسجيل دفعة ${number} بمبلغ ${toMoneyString(amount, 2)} من "${customer.name}" (${dto.method}). ` +
          `الرصيد ${toMoneyString(entry.openingBalance, 2)} → ${toMoneyString(entry.runningBalance, 2)}. ` +
          (allocationSummary ? `التوزيع: ${allocationSummary}` : 'دفعة مقدّمة بلا توزيع.'),
        entityType: 'Payment',
        entityId: payment.id,
        after: {
          number,
          amount: toMoneyString(amount, 2),
          method: dto.method,
          balanceBefore: toMoneyString(entry.openingBalance, 2),
          balanceAfter: toMoneyString(entry.runningBalance, 2),
          allocations: planned
            .filter((p) => !isZero(p.willAllocate))
            .map((p) => ({ order: p.orderNumber, amount: toMoneyString(p.willAllocate, 2) })),
          unallocated: toMoneyString(unallocated, 2),
        },
      });

      return payment.id;
    });

    const created = await this.findOne(paymentId);
    if (!created) throw AppError.internal('تعذّر قراءة الدفعة بعد إنشائها.');
    return created;
  }

  /**
   * ═══════════════════════════════════════════════════════════════════════
   *  خطة التوزيع.
   * ═══════════════════════════════════════════════════════════════════════
   *
   *  AUTO_OLDEST_FIRST — العرف المحاسبي: أقدم دَين يُسدَّد أولًا. يقلّل تقادم
   *                      الذمم ويطابق توقّع الزبون («سدّدت القديم»).
   *  MANUAL            — المستخدم يقرر. نتحقق أن كل طلب يخصّ الزبون، وأن
   *                      المبلغ لا يتجاوز متبقّي الطلب.
   *  NONE              — دفعة مقدّمة: تُخفّض الرصيد بلا ربطها بطلب.
   *
   *  ⚠️ لا نستخدم `allocate()` من @oh/money هنا: تلك للتوزيع **النسبي**
   *     (قسمة مبلغ على أوزان). هنا التوزيع **تسلسلي** — نملأ كل طلب حتى
   *     سقفه ثم ننتقل للتالي. لا كسور تضيع، فلا حاجة لأكبر البواقي.
   */
  private async planAllocations(
    tx: TxClient,
    tenantId: string,
    customerId: string,
    amount: Decimal,
    strategy: AllocationStrategy,
    manual?: { orderId: string; amount: MoneyString }[],
  ): Promise<PlannedAllocation[]> {
    if (strategy === 'NONE') return [];

    const openOrders = await this.fetchOpenOrders(tx, tenantId, customerId);

    // ── يدوي ────────────────────────────────────────────────────────────
    if (strategy === 'MANUAL') {
      if (!manual || manual.length === 0) {
        throw AppError.validation('التوزيع اليدوي يتطلب تحديد طلب واحد على الأقل.');
      }

      const byId = new Map(openOrders.map((o) => [o.id, o]));
      const planned: PlannedAllocation[] = [];
      let remaining = amount;

      for (const entry of manual) {
        const order = byId.get(entry.orderId);
        if (!order) {
          throw AppError.validation(
            `الطلب المحدد غير موجود أو مسدَّد أو لا يخص هذا الزبون.`,
          );
        }

        const orderTotal = toMoney(order.total.toString());
        const alreadyPaid = toMoney(order.paidAmount.toString());
        const orderRemaining = subtract(orderTotal, alreadyPaid);
        const requested = toMoney(entry.amount);

        // لا نسمح بدفع أكثر من المتبقي على الطلب. الفائض ⇒ رصيد دائن، لا دفع زائد.
        if (greaterThan(requested, orderRemaining)) {
          throw AppError.validation(
            `المبلغ ${toMoneyString(requested, 2)} يتجاوز المتبقي على الطلب ` +
              `${order.number} (${toMoneyString(orderRemaining, 2)}).`,
          );
        }

        remaining = subtract(remaining, requested);
        if (remaining.isNegative()) {
          throw AppError.validation('مجموع التوزيعات يتجاوز مبلغ الدفعة.');
        }

        planned.push({
          orderId: order.id,
          orderNumber: order.number,
          orderTotal,
          alreadyPaid,
          remaining: orderRemaining,
          willAllocate: requested,
        });
      }

      return planned;
    }

    // ── تلقائي: الأقدم أولًا ────────────────────────────────────────────
    const planned: PlannedAllocation[] = [];
    let remaining = amount;

    for (const order of openOrders) {
      if (!greaterThan(remaining, zero())) break;

      const orderTotal = toMoney(order.total.toString());
      const alreadyPaid = toMoney(order.paidAmount.toString());
      const orderRemaining = subtract(orderTotal, alreadyPaid);

      if (!greaterThan(orderRemaining, zero())) continue;

      // نملأ الطلب حتى سقفه، أو نصرف ما تبقى من الدفعة — أيهما أقل.
      const willAllocate = min(remaining, orderRemaining);

      planned.push({
        orderId: order.id,
        orderNumber: order.number,
        orderTotal,
        alreadyPaid,
        remaining: orderRemaining,
        willAllocate,
      });

      remaining = subtract(remaining, willAllocate);
    }

    return planned;
  }

  /** الطلبات غير المسدَّدة — الأقدم أولًا. */
  private async fetchOpenOrders(
    tx: TxClient,
    tenantId: string,
    customerId: string,
  ): Promise<OpenOrderRow[]> {
    return tx.order.findMany({
      where: {
        tenantId,
        customerId,
        status: { in: ['CONFIRMED', 'PARTIALLY_PAID'] },
      },
      orderBy: [{ issuedAt: 'asc' }, { number: 'asc' }],
      select: { id: true, number: true, issuedAt: true, dueAt: true, total: true, paidAmount: true },
    });
  }

  /** معاينة التوزيع — يرى الكاشير أين ستذهب الدفعة قبل التسجيل. */
  async previewAllocation(dto: AllocationPreviewRequest): Promise<AllocationPreview> {
    const { tenantId } = this.context();

    return this.prisma.runInTenant(tenantId, async (tx) => {
      const amount = toMoney(dto.amount);

      const planned = await this.planAllocations(
        tx,
        tenantId,
        dto.customerId,
        amount,
        dto.strategy,
      );

      const allocatedTotal = sum(planned.map((p) => p.willAllocate));
      const unallocated = subtract(amount, allocatedTotal);

      const balanceBefore = await this.ledger.getBalance(tx, tenantId, dto.customerId);
      const balanceAfter = subtract(balanceBefore, amount);

      return {
        allocations: planned
          .filter((p) => !isZero(p.willAllocate))
          .map((p) => ({
            orderId: p.orderId,
            orderNumber: p.orderNumber,
            orderTotal: toMoneyString(p.orderTotal, 2),
            alreadyPaid: toMoneyString(p.alreadyPaid, 2),
            remaining: toMoneyString(p.remaining, 2),
            willAllocate: toMoneyString(p.willAllocate, 2),
            remainingAfter: toMoneyString(subtract(p.remaining, p.willAllocate), 2),
          })),
        unallocatedAmount: toMoneyString(unallocated, 2),
        balanceBefore: toMoneyString(balanceBefore, 2),
        balanceAfter: toMoneyString(balanceAfter, 2),
      } as AllocationPreview;
    });
  }

  /** الطلبات المفتوحة لزبون — لشاشة التوزيع اليدوي. */
  async openOrders(customerId: string): Promise<OpenOrder[]> {
    const { tenantId } = this.context();
    const now = Date.now();

    return this.prisma.runInTenant(tenantId, async (tx) => {
      const rows = await this.fetchOpenOrders(tx, tenantId, customerId);

      return rows
        .map((row) => {
          const total = toMoney(row.total.toString());
          const paid = toMoney(row.paidAmount.toString());
          const remaining = subtract(total, paid);

          return {
            id: row.id,
            number: row.number,
            issuedAt: row.issuedAt.toISOString(),
            dueAt: row.dueAt?.toISOString() ?? null,
            total: toMoneyString(total, 2),
            paidAmount: toMoneyString(paid, 2),
            remaining: toMoneyString(remaining, 2),
            isOverdue: row.dueAt !== null && row.dueAt.getTime() < now,
            _remaining: remaining,
          };
        })
        .filter((o) => greaterThan(o._remaining, zero()))
        .map(({ _remaining, ...rest }) => rest as OpenOrder);
    });
  }

  /**
   * ═══════════════════════════════════════════════════════════════════════
   *  عكس دفعة.
   * ═══════════════════════════════════════════════════════════════════════
   *
   *  لا حذف. نُنشئ قيدًا مضادًا، ونُعيد الطلبات إلى حالتها السابقة.
   *  الدفعة وتوزيعاتها **تبقى** في السجل بحالة REVERSED.
   *
   *  ⚠️ توزيعات الدفعة محمية بـtrigger (append-only) — لا نستطيع حذفها
   *     ولا تعديلها حتى لو أردنا. نطرح مبالغها من `paidAmount` بدلًا من ذلك.
   *
   *  محصورة بصلاحية `payments.reverse` (صاحب المحل) — يفرضها الحارس.
   */
  async reverse(id: string, dto: ReversePaymentRequest): Promise<Payment> {
    const { tenantId, storeId, userId } = this.context();

    await this.prisma.runInTenant(tenantId, async (tx) => {
      const payment = await tx.payment.findFirst({
        where: { id },
        include: {
          customer: { select: { name: true } },
          allocations: { include: { order: { select: { id: true, number: true, total: true, paidAmount: true } } } },
        },
      });
      if (!payment) throw AppError.notFound('الدفعة');

      if (payment.status === 'REVERSED') {
        throw AppError.conflict('الدفعة معكوسة مسبقًا.');
      }

      // القيد الدائن الأصلي.
      const creditEntry = await tx.ledgerEntry.findFirst({
        where: {
          tenantId,
          refType: 'PAYMENT',
          refId: id,
          entryType: 'PAYMENT_CREDIT',
        },
        select: { id: true },
      });
      if (!creditEntry) {
        throw AppError.internal('الدفعة بلا قيد محاسبي — بيانات غير متسقة.');
      }

      const reversal = await this.ledger.reverse(tx, {
        tenantId,
        storeId,
        entryId: creditEntry.id,
        reason: `عكس الدفعة ${payment.number}: ${dto.reason}`,
        createdBy: userId,
      });

      // ── إعادة الطلبات إلى حالتها ───────────────────────────────────────
      for (const allocation of payment.allocations) {
        const order = allocation.order;
        const allocated = toMoney(allocation.amount.toString());
        const currentPaid = toMoney(order.paidAmount.toString());
        const total = toMoney(order.total.toString());

        const newPaid = subtract(currentPaid, allocated);

        // الحالة الجديدة: مؤكد (لا دفع) أو مدفوع جزئيًا.
        const newStatus = isZero(newPaid)
          ? 'CONFIRMED'
          : equals(newPaid, total)
            ? 'PAID'
            : 'PARTIALLY_PAID';

        await tx.order.update({
          where: { id: order.id },
          data: {
            paidAmount: toMoneyString(newPaid),
            status: newStatus,
            version: { increment: 1 },
          },
        });
      }

      await tx.payment.update({
        where: { id },
        data: {
          status: 'REVERSED',
          reversedAt: new Date(),
          reversedBy: userId,
          reverseReason: dto.reason,
        },
      });

      await this.audit.record(tx, {
        action: AUDIT_ACTIONS.PAYMENT_REVERSED,
        summary:
          `عكس الدفعة ${payment.number} (${toMoneyString(payment.amount.toString(), 2)}) ` +
          `للزبون "${payment.customer.name}". الرصيد بعد العكس: ${toMoneyString(reversal.runningBalance, 2)}. ` +
          `السبب: ${dto.reason}`,
        entityType: 'Payment',
        entityId: id,
        before: { status: 'POSTED' },
        after: {
          status: 'REVERSED',
          reason: dto.reason,
          reversalEntryId: reversal.id,
          restoredOrders: payment.allocations.map((a) => a.order.number),
        },
      });
    });

    const reversed = await this.findOne(id);
    if (!reversed) throw AppError.notFound('الدفعة');
    return reversed;
  }

  async list(query: PaymentListQuery): Promise<PaginatedResult<Payment>> {
    const { tenantId } = this.context();

    return this.prisma.runInTenant(tenantId, async (tx) => {
      const where = this.buildWhere(query);

      const [total, rows] = await Promise.all([
        tx.payment.count({ where }),
        tx.payment.findMany({
          where,
          orderBy: { [query.sortBy]: query.sortOrder } as Prisma.PaymentOrderByWithRelationInput,
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
          include: this.include(),
        }),
      ]);

      const entries = await this.fetchLedgerSnapshots(
        tx,
        tenantId,
        rows.map((r) => r.id),
      );

      return {
        items: rows.map((row) => this.toDto(row, entries.get(row.id))),
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
      };
    });
  }

  async findOne(id: string): Promise<Payment | null> {
    const { tenantId } = this.context();

    return this.prisma.runInTenant(tenantId, async (tx) => {
      const row = await tx.payment.findFirst({ where: { id }, include: this.include() });
      if (!row) return null;

      const entries = await this.fetchLedgerSnapshots(tx, tenantId, [id]);
      return this.toDto(row, entries.get(id));
    });
  }

  async stats(query: PaymentListQuery): Promise<PaymentStats> {
    const { tenantId } = this.context();

    return this.prisma.runInTenant(tenantId, async (tx) => {
      const where = { ...this.buildWhere(query), status: 'POSTED' as const };

      const [agg, grouped] = await Promise.all([
        tx.payment.aggregate({ where, _count: true, _sum: { amount: true } }),
        tx.payment.groupBy({ by: ['method'], where, _count: true, _sum: { amount: true } }),
      ]);

      const byMethod = {
        CASH: { count: 0, amount: '0.00' },
        BANK_TRANSFER: { count: 0, amount: '0.00' },
        CARD: { count: 0, amount: '0.00' },
        CHECK: { count: 0, amount: '0.00' },
      };

      for (const group of grouped) {
        byMethod[group.method] = {
          count: group._count,
          amount: toMoneyString(group._sum.amount?.toString() ?? '0', 2),
        };
      }

      // المتوسط اليومي هذا الشهر.
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);

      const monthAgg = await tx.payment.aggregate({
        where: { tenantId, status: 'POSTED', paidAt: { gte: monthStart } },
        _sum: { amount: true },
      });

      const daysElapsed = Math.max(1, new Date().getDate());
      const monthTotal = toMoney(monthAgg._sum.amount?.toString() ?? '0');
      const dailyAverage = monthTotal.dividedBy(daysElapsed);

      return {
        totalCount: agg._count,
        totalAmount: toMoneyString(agg._sum.amount?.toString() ?? '0', 2),
        byMethod,
        dailyAverage: toMoneyString(dailyAverage, 2),
      } as PaymentStats;
    });
  }

  // ── مساعدات ──────────────────────────────────────────────────────────────

  private include() {
    return {
      customer: { select: { name: true, code: true } },
      allocations: {
        include: { order: { select: { id: true, number: true, total: true } } },
        orderBy: { createdAt: 'asc' as const },
      },
    } satisfies Prisma.PaymentInclude;
  }

  /**
   * لقطة الرصيد لحظة الدفع — من القيد المحاسبي.
   *
   * ⚠️ **لا نحسب الرصيد الآن**. دفعة سُجّلت الشهر الماضي يجب أن تعرض الرصيد
   *    **كما كان حينها** (openingBalance/runningBalance من قيدها)، لا كما هو
   *    اليوم. هذا ما تعرضه شاشة الدفعات في المرجع: «المبلغ قبل الدفع».
   */
  private async fetchLedgerSnapshots(
    tx: TxClient,
    tenantId: string,
    paymentIds: string[],
  ): Promise<Map<string, { openingBalance: Decimal; runningBalance: Decimal }>> {
    const result = new Map<string, { openingBalance: Decimal; runningBalance: Decimal }>();
    if (paymentIds.length === 0) return result;

    const entries = await tx.ledgerEntry.findMany({
      where: {
        tenantId,
        entryType: 'PAYMENT_CREDIT',
        refType: 'PAYMENT',
        refId: { in: paymentIds },
      },
      select: { refId: true, openingBalance: true, runningBalance: true },
    });

    for (const entry of entries) {
      if (!entry.refId) continue;
      result.set(entry.refId, {
        openingBalance: toMoney(entry.openingBalance.toString()),
        runningBalance: toMoney(entry.runningBalance.toString()),
      });
    }

    return result;
  }

  private buildWhere(query: PaymentListQuery): Prisma.PaymentWhereInput {
    return {
      ...(query.customerId ? { customerId: query.customerId } : {}),
      ...(query.method ? { method: query.method } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? {
            OR: [
              { number: { contains: query.search, mode: 'insensitive' } },
              { reference: { contains: query.search, mode: 'insensitive' } },
              { customer: { name: { contains: query.search, mode: 'insensitive' } } },
              { customer: { code: { contains: query.search, mode: 'insensitive' } } },
            ],
          }
        : {}),
      ...(query.from || query.to
        ? {
            paidAt: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(`${query.to}T23:59:59.999Z`) } : {}),
            },
          }
        : {}),
    };
  }

  private toDto(
    row: Prisma.PaymentGetPayload<{
      include: {
        customer: { select: { name: true; code: true } };
        allocations: { include: { order: { select: { id: true; number: true; total: true } } } };
      };
    }>,
    snapshot: { openingBalance: Decimal; runningBalance: Decimal } | undefined,
  ): Payment {
    const amount = toMoney(row.amount.toString());
    const allocated = row.allocations.length
      ? sum(row.allocations.map((a) => a.amount.toString()))
      : zero();

    return {
      id: row.id,
      number: row.number,

      customerId: row.customerId,
      customerName: row.customer.name,
      customerCode: row.customer.code,

      amount: toMoneyString(amount, 2),
      method: row.method,
      status: row.status,

      paidAt: row.paidAt.toISOString(),
      reference: row.reference,
      notes: row.notes,

      // لقطة تاريخية — لا حساب لحظي.
      balanceBefore: toMoneyString(snapshot?.openingBalance ?? zero(), 2),
      balanceAfter: toMoneyString(snapshot?.runningBalance ?? zero(), 2),

      allocations: row.allocations.map((a) => ({
        orderId: a.order.id,
        orderNumber: a.order.number,
        orderTotal: toMoneyString(a.order.total.toString(), 2),
        amount: toMoneyString(a.amount.toString(), 2),
      })),
      unallocatedAmount: toMoneyString(subtract(amount, allocated), 2),

      reversedAt: row.reversedAt?.toISOString() ?? null,
      reverseReason: row.reverseReason,

      createdAt: row.createdAt.toISOString(),
      createdBy: row.createdBy,
      createdByName: null,
    } as Payment;
  }

  private context(): { tenantId: string; storeId: string; userId: string } {
    const ctx = TenantContext.get();
    const tenantId = TenantContext.requireTenantId();
    const userId = TenantContext.requireUserId();
    if (!ctx?.storeId) throw AppError.forbidden('لا يوجد محل مرتبط بحسابك.');
    return { tenantId, storeId: ctx.storeId, userId };
  }
}
