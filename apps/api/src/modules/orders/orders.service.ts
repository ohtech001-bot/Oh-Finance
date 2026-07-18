import { Injectable } from '@nestjs/common';
import {
  AUDIT_ACTIONS,
  EDITABLE_ORDER_STATUSES,
  type CancelOrderRequest,
  type ConfirmOrderRequest,
  type CreateOrderRequest,
  type Order,
  type OrderDetail,
  type OrderListQuery,
  type OrderPreviewRequest,
  type OrderStats,
  type OrderTotals,
  type PaginatedResult,
  type UpdateOrderRequest,
} from '@oh/contracts';
import {
  add,
  greaterThan,
  isZero,
  subtract,
  toMoney,
  toMoneyString,
  zero,
  type CurrencyCode,
} from '@oh/money';
import { PERMISSIONS } from '@oh/config';
import type { Prisma } from '@prisma/client';
import { AppError } from '../../core/errors/app-error.js';
import { AuditService } from '../../core/audit/audit.service.js';
import { NumberingService } from '../../core/numbering/numbering.service.js';
import { PrismaService, type TxClient } from '../../core/prisma/prisma.service.js';
import { TenantContext } from '../../core/tenancy/tenant-context.js';
import { LedgerService } from '../ledger/ledger.service.js';
import { OrderCalculator } from './order-calculator.js';

type OrderRow = Prisma.OrderGetPayload<{
  include: { customer: { select: { name: true; code: true } }; _count: { select: { items: true } } };
}>;

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
    private readonly calculator: OrderCalculator,
    private readonly numbering: NumberingService,
    private readonly audit: AuditService,
  ) {}

  /** معاينة الحساب — الواجهة تعرض ما سيحفظه الخادم بالضبط. */
  preview(dto: OrderPreviewRequest): OrderTotals {
    const calculated = this.calculator.calculate(dto.items, dto.discountAmount);
    return this.calculator.toTotals(calculated);
  }

  /**
   * إنشاء طلب.
   *
   * `status: CONFIRMED` عند الإنشاء يؤكده فورًا — أي **يولّد قيدًا مدينًا**
   * في نفس المعاملة. مسودة أو عرض سعر: لا قيد، لا أثر مالي.
   */
  async create(dto: CreateOrderRequest): Promise<OrderDetail> {
    const { tenantId, storeId, userId } = this.context();

    const orderId = await this.prisma.runInTenant(tenantId, async (tx) => {
      const customer = await tx.customer.findFirst({
        where: { id: dto.customerId, archivedAt: null },
        select: { id: true, name: true, code: true, status: true, paymentTermDays: true, creditLimit: true },
      });
      if (!customer) throw AppError.notFound('الزبون');

      if (customer.status === 'BLOCKED') {
        throw AppError.conflict(`الزبون "${customer.name}" محظور. لا يمكن إنشاء طلبات له.`);
      }

      const calculated = this.calculator.calculate(dto.items, dto.discountAmount);
      const number = await this.numbering.next(tx, tenantId, storeId, 'order');

      const issuedAt = dto.issuedAt ? new Date(dto.issuedAt) : new Date();
      const dueAt = dto.dueAt
        ? new Date(dto.dueAt)
        : this.addDays(issuedAt, customer.paymentTermDays);

      const willConfirm = dto.status === 'CONFIRMED';

      const order = await tx.order.create({
        data: {
          tenantId,
          storeId,
          customerId: dto.customerId,
          number,
          status: dto.status,
          issuedAt,
          dueAt: willConfirm ? dueAt : null,
          subtotal: toMoneyString(calculated.subtotal),
          discountAmount: toMoneyString(calculated.discountAmount),
          taxAmount: toMoneyString(calculated.taxAmount),
          total: toMoneyString(calculated.total),
          paidAmount: '0',
          notes: dto.notes || null,
          createdBy: userId,
          items: {
            create: dto.items.map((item, index) => ({
              tenantId,
              sourceType: item.sourceType,
              sourceId: item.sourceId ?? null,
              name: item.name,
              description: item.description || null,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              discount: item.discount,
              taxRate: item.taxRate,
              lineTotal: toMoneyString(calculated.lines[index]?.lineTotal ?? zero()),
              sortOrder: index,
            })),
          },
        },
        select: { id: true },
      });

      await this.audit.record(tx, {
        action: AUDIT_ACTIONS.ORDER_CREATED,
        summary: `إنشاء طلب ${number} للزبون "${customer.name}" بمبلغ ${toMoneyString(calculated.total, 2)} (${dto.status})`,
        entityType: 'Order',
        entityId: order.id,
        after: {
          number,
          status: dto.status,
          customerId: dto.customerId,
          total: toMoneyString(calculated.total, 2),
          itemCount: dto.items.length,
        },
      });

      // ── التأكيد الفوري ─────────────────────────────────────────────────
      if (willConfirm) {
        await this.postConfirmation(tx, {
          tenantId,
          storeId,
          orderId: order.id,
          orderNumber: number,
          customerId: dto.customerId,
          customerName: customer.name,
          customerCreditLimit: customer.creditLimit.toString(),
          total: toMoneyString(calculated.total),
          dueAt,
          userId,
          overrideCreditLimit: false,
          overrideReason: undefined,
        });
      }

      return order.id;
    });

    const created = await this.findOne(orderId);
    if (!created) throw AppError.internal('تعذّر قراءة الطلب بعد إنشائه.');
    return created;
  }

  /**
   * ═══════════════════════════════════════════════════════════════════════
   *  تأكيد الطلب — أخطر عملية في الوحدة.
   * ═══════════════════════════════════════════════════════════════════════
   *
   *  يولّد قيدًا مدينًا دائمًا. لا رجعة فيه إلا بقيد عكس.
   *
   *  ثلاث حمايات:
   *    1. **قفل متفائل** (`version`) — يمنع تأكيدين متزامنين لنفس الطلب
   *    2. **حد الائتمان** — يُفحص قبل القيد، لا بعده
   *    3. **القفل الفعلي** (`lockedAt`) — يمنع أي تعديل لاحق على المبالغ
   */
  async confirm(id: string, dto: ConfirmOrderRequest): Promise<OrderDetail> {
    const { tenantId, storeId, userId } = this.context();
    const permissions = TenantContext.get()?.permissions ?? [];

    await this.prisma.runInTenant(tenantId, async (tx) => {
      const order = await tx.order.findFirst({
        where: { id },
        include: {
          customer: { select: { id: true, name: true, creditLimit: true, paymentTermDays: true, status: true } },
        },
      });
      if (!order) throw AppError.notFound('الطلب');

      if (order.status === 'CANCELLED') {
        throw AppError.conflict('الطلب ملغي. لا يمكن تأكيده.');
      }
      if (order.status !== 'DRAFT' && order.status !== 'QUOTE') {
        throw AppError.conflict(`الطلب ${order.number} مؤكد مسبقًا.`);
      }
      if (order.customer.status === 'BLOCKED') {
        throw AppError.conflict(`الزبون "${order.customer.name}" محظور.`);
      }

      // ── 1. القفل المتفائل ────────────────────────────────────────────
      // نسخة قديمة ⇒ عدّل شخصٌ آخر الطلب بيننا. نرفض بدل الكتابة فوقه.
      if (order.version !== dto.version) {
        throw AppError.conflict(
          'عُدِّل هذا الطلب من جلسة أخرى. حدّث الصفحة وراجع البيانات قبل التأكيد.',
        );
      }

      const dueAt = dto.dueAt
        ? new Date(dto.dueAt)
        : (order.dueAt ?? this.addDays(order.issuedAt, order.customer.paymentTermDays));

      // ── 2. حد الائتمان ───────────────────────────────────────────────
      const canOverride = permissions.includes(PERMISSIONS.LEDGER_ADJUST);
      if (dto.overrideCreditLimit && !canOverride) {
        throw AppError.forbidden('تجاوز حد الائتمان يتطلب صلاحية صاحب المحل.');
      }
      if (dto.overrideCreditLimit && (dto.overrideReason ?? '').trim().length < 5) {
        throw AppError.validation('تجاوز حد الائتمان يتطلب سببًا مكتوبًا.');
      }

      await this.postConfirmation(tx, {
        tenantId,
        storeId,
        orderId: order.id,
        orderNumber: order.number,
        customerId: order.customerId,
        customerName: order.customer.name,
        customerCreditLimit: order.customer.creditLimit.toString(),
        total: order.total.toString(),
        dueAt,
        userId,
        overrideCreditLimit: dto.overrideCreditLimit,
        overrideReason: dto.overrideReason,
        expectedVersion: dto.version,
      });
    });

    const confirmed = await this.findOne(id);
    if (!confirmed) throw AppError.notFound('الطلب');
    return confirmed;
  }

  /**
   * منطق التأكيد المشترك — يستدعيه `create` (بحالة CONFIRMED) و`confirm`.
   *
   * التسلسل مقصود: **افحص الحد قبل كتابة القيد**. لو كتبنا القيد ثم فحصنا،
   * لتركنا قيدًا يجب عكسه — أثر دائم لعملية لم تنجح.
   */
  private async postConfirmation(
    tx: TxClient,
    params: {
      tenantId: string;
      storeId: string;
      orderId: string;
      orderNumber: string;
      customerId: string;
      customerName: string;
      customerCreditLimit: string;
      total: string;
      dueAt: Date;
      userId: string;
      overrideCreditLimit: boolean;
      overrideReason?: string | undefined;
      expectedVersion?: number;
    },
  ): Promise<void> {
    const total = toMoney(params.total);

    if (isZero(total)) {
      throw AppError.validation('لا يُؤكَّد طلب بإجمالي صفر.');
    }

    // ── فحص حد الائتمان — قبل القيد ────────────────────────────────────
    const creditLimit = toMoney(params.customerCreditLimit);

    if (!isZero(creditLimit)) {
      const currentBalance = await this.ledger.getBalance(tx, params.tenantId, params.customerId);
      const balanceAfter = add(currentBalance, total);

      if (greaterThan(balanceAfter, creditLimit)) {
        if (!params.overrideCreditLimit) {
          throw AppError.conflict(
            `تأكيد هذا الطلب يرفع رصيد "${params.customerName}" إلى ` +
              `${toMoneyString(balanceAfter, 2)} — متجاوزًا حد الائتمان ` +
              `${toMoneyString(creditLimit, 2)}. ` +
              'يلزم تجاوز صريح من صاحب المحل، أو تحصيل دفعة أولًا.',
          );
        }

        // التجاوز مسموح لكنه **حدث مُدقَّق**: من تجاوز، ولماذا، وبكم.
        await this.audit.record(tx, {
          action: AUDIT_ACTIONS.ORDER_CREDIT_LIMIT_OVERRIDDEN,
          summary:
            `تجاوز حد الائتمان للزبون "${params.customerName}" عند تأكيد ${params.orderNumber}. ` +
            `الحد ${toMoneyString(creditLimit, 2)}، الرصيد بعد التأكيد ${toMoneyString(balanceAfter, 2)}. ` +
            `السبب: ${params.overrideReason}`,
          entityType: 'Order',
          entityId: params.orderId,
          after: {
            creditLimit: toMoneyString(creditLimit, 2),
            balanceAfter: toMoneyString(balanceAfter, 2),
            reason: params.overrideReason,
          },
        });
      }
    }

    // ── القيد المدين ───────────────────────────────────────────────────
    const entry = await this.ledger.append(tx, {
      tenantId: params.tenantId,
      storeId: params.storeId,
      customerId: params.customerId,
      entryType: 'ORDER_DEBIT',
      direction: 'DEBIT',
      amount: toMoneyString(total),
      refType: 'ORDER',
      refId: params.orderId,
      notes: `طلب رقم ${params.orderNumber}`,
      createdBy: params.userId,
    });

    // ── قفل الطلب ──────────────────────────────────────────────────────
    const now = new Date();
    const where: Prisma.OrderWhereUniqueInput =
      params.expectedVersion !== undefined
        ? { id: params.orderId, version: params.expectedVersion }
        : { id: params.orderId };

    const updated = await tx.order.updateMany({
      where,
      data: {
        status: 'CONFIRMED',
        confirmedAt: now,
        confirmedBy: params.userId,
        lockedAt: now,
        dueAt: params.dueAt,
        version: { increment: 1 },
      },
    });

    // القفل المتفائل مرة أخرى — على مستوى الكتابة هذه المرة.
    if (updated.count === 0) {
      throw AppError.conflict('تغيّر الطلب أثناء التأكيد. أعد المحاولة.');
    }

    await this.audit.record(tx, {
      action: AUDIT_ACTIONS.ORDER_CONFIRMED,
      summary:
        `تأكيد الطلب ${params.orderNumber} بمبلغ ${toMoneyString(total, 2)} — ` +
        `قيد مدين #${entry.seq}، الرصيد ${toMoneyString(entry.openingBalance, 2)} → ${toMoneyString(entry.runningBalance, 2)}`,
      entityType: 'Order',
      entityId: params.orderId,
      after: {
        status: 'CONFIRMED',
        ledgerEntryId: entry.id,
        ledgerSeq: entry.seq,
        balanceAfter: toMoneyString(entry.runningBalance, 2),
      },
    });
  }

  /** تعديل — للمسودات وعروض الأسعار فقط. */
  async update(id: string, dto: UpdateOrderRequest): Promise<OrderDetail> {
    const { tenantId } = this.context();

    await this.prisma.runInTenant(tenantId, async (tx) => {
      const order = await tx.order.findFirst({ where: { id } });
      if (!order) throw AppError.notFound('الطلب');

      // القفل مفروض في القاعدة بـtrigger أيضًا — هنا رسالة أوضح.
      if (!EDITABLE_ORDER_STATUSES.includes(order.status)) {
        throw AppError.conflict(
          `الطلب ${order.number} (${order.status}) مقفل. ` +
            'تعديل طلب مؤكد يتم بقيد تسوية في دفتر الحركات، لا بتغيير مبالغه.',
        );
      }

      if (order.version !== dto.version) {
        throw AppError.conflict('عُدِّل هذا الطلب من جلسة أخرى. حدّث الصفحة.');
      }

      const items = dto.items;
      const discount = dto.discountAmount ?? order.discountAmount.toString();

      const data: Prisma.OrderUpdateInput = {
        version: { increment: 1 },
        ...(dto.customerId ? { customer: { connect: { id: dto.customerId } } } : {}),
        ...(dto.issuedAt ? { issuedAt: new Date(dto.issuedAt) } : {}),
        ...(dto.dueAt ? { dueAt: new Date(dto.dueAt) } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes || null } : {}),
      };

      // البنود تغيّرت ⇒ نعيد الحساب ونستبدلها كلها.
      if (items) {
        const calculated = this.calculator.calculate(items, discount);

        data.subtotal = toMoneyString(calculated.subtotal);
        data.discountAmount = toMoneyString(calculated.discountAmount);
        data.taxAmount = toMoneyString(calculated.taxAmount);
        data.total = toMoneyString(calculated.total);

        await tx.orderItem.deleteMany({ where: { orderId: id } });
        await tx.orderItem.createMany({
          data: items.map((item, index) => ({
            tenantId,
            orderId: id,
            sourceType: item.sourceType,
            sourceId: item.sourceId ?? null,
            name: item.name,
            description: item.description || null,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            discount: item.discount,
            taxRate: item.taxRate,
            lineTotal: toMoneyString(calculated.lines[index]?.lineTotal ?? zero()),
            sortOrder: index,
          })),
        });
      } else if (dto.discountAmount !== undefined) {
        // الخصم وحده تغيّر ⇒ نعيد الحساب من البنود الحالية.
        const current = await tx.orderItem.findMany({
          where: { orderId: id },
          orderBy: { sortOrder: 'asc' },
        });

        const calculated = this.calculator.calculate(
          current.map((i) => ({
            sourceType: i.sourceType,
            sourceId: i.sourceId ?? undefined,
            name: i.name,
            description: i.description ?? '',
            quantity: i.quantity.toString(),
            unitPrice: i.unitPrice.toString(),
            discount: i.discount.toString(),
            taxRate: i.taxRate.toString(),
          })),
          dto.discountAmount,
        );

        data.subtotal = toMoneyString(calculated.subtotal);
        data.discountAmount = toMoneyString(calculated.discountAmount);
        data.taxAmount = toMoneyString(calculated.taxAmount);
        data.total = toMoneyString(calculated.total);
      }

      const result = await tx.order.updateMany({
        where: { id, version: dto.version },
        data: data as Prisma.OrderUpdateManyMutationInput,
      });
      if (result.count === 0) {
        throw AppError.conflict('تغيّر الطلب أثناء التعديل. أعد المحاولة.');
      }

      await this.audit.record(tx, {
        action: AUDIT_ACTIONS.ORDER_UPDATED,
        summary: `تعديل الطلب ${order.number}`,
        entityType: 'Order',
        entityId: id,
        before: { total: order.total.toString(), status: order.status },
        after: { total: data.total?.toString() ?? order.total.toString() },
      });
    });

    const updated = await this.findOne(id);
    if (!updated) throw AppError.notFound('الطلب');
    return updated;
  }

  /**
   * إلغاء الطلب.
   *
   * مؤكد ⇒ يولّد **قيد عكس** يُلغي أثر القيد المدين. الطلب يبقى في السجل
   * بحالة CANCELLED، وقيداه (المدين وعكسه) يبقيان في الدفتر.
   *
   * ⚠️ طلب مدفوع جزئيًا لا يُلغى مباشرة: يجب عكس دفعاته أولًا. وإلا صار
   *    لدينا دفعة موزَّعة على طلب ملغي — تناقض لا يُحل.
   */
  async cancel(id: string, dto: CancelOrderRequest): Promise<OrderDetail> {
    const { tenantId, storeId, userId } = this.context();

    await this.prisma.runInTenant(tenantId, async (tx) => {
      const order = await tx.order.findFirst({
        where: { id },
        include: { customer: { select: { name: true } } },
      });
      if (!order) throw AppError.notFound('الطلب');

      if (order.status === 'CANCELLED') {
        throw AppError.conflict('الطلب ملغي مسبقًا.');
      }
      if (order.version !== dto.version) {
        throw AppError.conflict('عُدِّل هذا الطلب من جلسة أخرى. حدّث الصفحة.');
      }

      const paid = toMoney(order.paidAmount.toString());
      if (!isZero(paid)) {
        throw AppError.conflict(
          `الطلب ${order.number} عليه دفعات بقيمة ${toMoneyString(paid, 2)}. ` +
            'اعكس الدفعات أولًا، ثم ألغِ الطلب.',
        );
      }

      const wasConfirmed = order.status !== 'DRAFT' && order.status !== 'QUOTE';

      if (wasConfirmed) {
        const debitEntry = await tx.ledgerEntry.findFirst({
          where: {
            tenantId,
            refType: 'ORDER',
            refId: id,
            entryType: 'ORDER_DEBIT',
          },
          select: { id: true },
        });

        if (debitEntry) {
          await this.ledger.reverse(tx, {
            tenantId,
            storeId,
            entryId: debitEntry.id,
            reason: `إلغاء الطلب ${order.number}: ${dto.reason}`,
            createdBy: userId,
          });
        }
      }

      const now = new Date();
      const result = await tx.order.updateMany({
        where: { id, version: dto.version },
        data: {
          status: 'CANCELLED',
          cancelledAt: now,
          cancelledBy: userId,
          cancelReason: dto.reason,
          version: { increment: 1 },
        },
      });
      if (result.count === 0) {
        throw AppError.conflict('تغيّر الطلب أثناء الإلغاء. أعد المحاولة.');
      }

      await this.audit.record(tx, {
        action: AUDIT_ACTIONS.ORDER_CANCELLED,
        summary:
          `إلغاء الطلب ${order.number} (${order.customer.name})` +
          (wasConfirmed ? ' — أُنشئ قيد عكس' : '') +
          `. السبب: ${dto.reason}`,
        entityType: 'Order',
        entityId: id,
        before: { status: order.status },
        after: { status: 'CANCELLED', reason: dto.reason, reversedLedger: wasConfirmed },
      });
    });

    const cancelled = await this.findOne(id);
    if (!cancelled) throw AppError.notFound('الطلب');
    return cancelled;
  }

  /**
   * نسخ طلب — يُنشئ **مسودة جديدة** بنفس الزبون والبنود.
   *
   * لا يُنسخ الرقم ولا الحالة ولا القيود: النسخة مسودة نظيفة بلا أثر مالي.
   * تُعيد حساب المبالغ من البنود (لا تنسخ اللقطة المجمّدة) — فلو تغيّر شيء
   * في منطق الحساب، النسخة الجديدة تتبعه.
   */
  async duplicate(id: string): Promise<OrderDetail> {
    const source = await this.findOne(id);
    if (!source) throw AppError.notFound('الطلب');

    return this.create({
      customerId: source.customerId,
      status: 'DRAFT',
      discountAmount: source.discountAmount,
      notes: source.notes ?? undefined,
      items: source.items.map((item) => ({
        sourceType: item.sourceType,
        sourceId: item.sourceId ?? undefined,
        name: item.name,
        description: item.description ?? undefined,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discount: item.discount,
        taxRate: item.taxRate,
      })),
    });
  }

  /**
   * حذف مسودة أو عرض سعر.
   *
   * ⛔ الطلب المؤكد لا يُحذف — له قيد محاسبي، وحذفه يترك القيد يتيمًا. القاعدة
   *    تحرسه أيضًا: حذف طلب مقفل يُشغّل trigger بنوده فيُرفض. هنا نرفض مبكرًا
   *    برسالة واضحة، ونوجّه إلى الإلغاء (الذي يولّد قيد عكس).
   */
  async remove(id: string, version: number): Promise<void> {
    const { tenantId } = this.context();

    await this.prisma.runInTenant(tenantId, async (tx) => {
      const order = await tx.order.findFirst({ where: { id } });
      if (!order) throw AppError.notFound('الطلب');

      if (order.status !== 'DRAFT' && order.status !== 'QUOTE') {
        throw AppError.conflict(
          `الطلب ${order.number} (${order.status}) لا يُحذف — له أثر محاسبي. ` +
            'استخدم الإلغاء بدلًا من الحذف.',
        );
      }
      if (order.version !== version) {
        throw AppError.conflict('عُدِّل هذا الطلب من جلسة أخرى. حدّث الصفحة.');
      }

      await this.audit.record(tx, {
        action: AUDIT_ACTIONS.ORDER_DELETED,
        summary: `حذف المسودة ${order.number}`,
        entityType: 'Order',
        entityId: id,
        before: { number: order.number, status: order.status, total: order.total.toString() },
      });

      // البنود تُحذف تلقائيًا (onDelete Cascade). trigger القفل لا يعترض
      // لأن المسودة غير مقفلة.
      await tx.order.delete({ where: { id } });
    });
  }

  /** أرشفة/إلغاء أرشفة طلب — إخفاء من القوائم دون حذف ولا أثر مالي. */
  async setArchived(id: string, version: number, archived: boolean): Promise<OrderDetail> {
    const { tenantId } = this.context();

    await this.prisma.runInTenant(tenantId, async (tx) => {
      const order = await tx.order.findFirst({ where: { id } });
      if (!order) throw AppError.notFound('الطلب');
      if (order.version !== version) {
        throw AppError.conflict('عُدِّل هذا الطلب من جلسة أخرى. حدّث الصفحة.');
      }

      // نمنع أرشفة طلب نشط (مؤكد/مدفوع جزئيًا) — قد يُنسى وهو مستحق.
      if (
        archived &&
        (order.status === 'CONFIRMED' || order.status === 'PARTIALLY_PAID')
      ) {
        throw AppError.conflict(
          'لا تُؤرشف طلبًا نشطًا (مؤكد أو مدفوع جزئيًا). أغلقه أو ألغه أولًا.',
        );
      }

      const result = await tx.order.updateMany({
        where: { id, version },
        data: { archivedAt: archived ? new Date() : null, version: { increment: 1 } },
      });
      if (result.count === 0) throw AppError.conflict('تغيّر الطلب. أعد المحاولة.');

      await this.audit.record(tx, {
        action: AUDIT_ACTIONS.ORDER_ARCHIVED,
        summary: `${archived ? 'أرشفة' : 'إلغاء أرشفة'} الطلب ${order.number}`,
        entityType: 'Order',
        entityId: id,
        after: { archived },
      });
    });

    const updated = await this.findOne(id);
    if (!updated) throw AppError.notFound('الطلب');
    return updated;
  }

  /**
   * إرجاع عرض سعر إلى مسودة.
   *
   * ⛔ **عرض السعر فقط** — لا الطلب المؤكد. عرض السعر لم يولّد قيدًا، فإرجاعه
   *    آمن. إرجاع طلب مؤكد كان سيتطلب عكس قيده المدين، وهو تغيير خفي لحالة
   *    مالية — نرفضه، والتصحيح الصحيح هو الإلغاء ثم إنشاء مسودة جديدة.
   */
  async revertToDraft(id: string, version: number): Promise<OrderDetail> {
    const { tenantId } = this.context();

    await this.prisma.runInTenant(tenantId, async (tx) => {
      const order = await tx.order.findFirst({ where: { id } });
      if (!order) throw AppError.notFound('الطلب');
      if (order.version !== version) {
        throw AppError.conflict('عُدِّل هذا الطلب من جلسة أخرى. حدّث الصفحة.');
      }
      if (order.status !== 'QUOTE') {
        throw AppError.conflict(
          'الإرجاع إلى مسودة متاح لعروض الأسعار فقط. الطلب المؤكد يُلغى ثم يُنشأ من جديد.',
        );
      }

      const result = await tx.order.updateMany({
        where: { id, version },
        data: { status: 'DRAFT', version: { increment: 1 } },
      });
      if (result.count === 0) throw AppError.conflict('تغيّر الطلب. أعد المحاولة.');

      await this.audit.record(tx, {
        action: AUDIT_ACTIONS.ORDER_REVERTED_DRAFT,
        summary: `إرجاع عرض السعر ${order.number} إلى مسودة`,
        entityType: 'Order',
        entityId: id,
      });
    });

    const updated = await this.findOne(id);
    if (!updated) throw AppError.notFound('الطلب');
    return updated;
  }

  async list(query: OrderListQuery): Promise<PaginatedResult<Order>> {
    const { tenantId } = this.context();

    return this.prisma.runInTenant(tenantId, async (tx) => {
      const where = this.buildWhere(query);

      const [total, rows] = await Promise.all([
        tx.order.count({ where }),
        tx.order.findMany({
          where,
          orderBy: { [query.sortBy]: query.sortOrder } as Prisma.OrderOrderByWithRelationInput,
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
          include: {
            customer: { select: { name: true, code: true } },
            _count: { select: { items: true } },
          },
        }),
      ]);

      return {
        items: rows.map((row) => this.toDto(row)),
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
      };
    });
  }

  async findOne(id: string): Promise<OrderDetail | null> {
    const { tenantId } = this.context();

    return this.prisma.runInTenant(tenantId, async (tx) => {
      const row = await tx.order.findFirst({
        where: { id },
        include: {
          customer: { select: { name: true, code: true } },
          _count: { select: { items: true } },
          items: { orderBy: { sortOrder: 'asc' } },
          allocations: {
            include: {
              payment: { select: { id: true, number: true, paidAt: true, method: true } },
            },
            orderBy: { createdAt: 'asc' },
          },
        },
      });

      if (!row) return null;

      return {
        ...this.toDto(row),
        items: row.items.map((item) => ({
          id: item.id,
          sourceType: item.sourceType,
          sourceId: item.sourceId,
          name: item.name,
          description: item.description,
          quantity: item.quantity.toString(),
          unitPrice: toMoneyString(item.unitPrice.toString(), 2),
          discount: toMoneyString(item.discount.toString(), 2),
          taxRate: item.taxRate.toString(),
          lineTotal: toMoneyString(item.lineTotal.toString(), 2),
          sortOrder: item.sortOrder,
        })),
        allocations: row.allocations.map((a) => ({
          paymentId: a.payment.id,
          paymentNumber: a.payment.number,
          paidAt: a.payment.paidAt.toISOString(),
          method: a.payment.method,
          amount: toMoneyString(a.amount.toString(), 2),
        })),
      } as OrderDetail;
    });
  }

  /** البحث برقم الطلب (المتطلب 13). */
  async findByNumber(number: string): Promise<OrderDetail | null> {
    const { tenantId } = this.context();

    const found = await this.prisma.runInTenant(tenantId, (tx) =>
      tx.order.findFirst({
        where: { number: { equals: number, mode: 'insensitive' } },
        select: { id: true },
      }),
    );

    return found ? this.findOne(found.id) : null;
  }

  async stats(query: OrderListQuery): Promise<OrderStats> {
    const { tenantId } = this.context();

    return this.prisma.runInTenant(tenantId, async (tx) => {
      const where = this.buildWhere({ ...query, status: undefined });

      const [grouped, agg] = await Promise.all([
        tx.order.groupBy({ by: ['status'], where, _count: true }),
        tx.order.aggregate({
          where: { ...where, status: { notIn: ['CANCELLED', 'DRAFT', 'QUOTE'] } },
          _sum: { total: true, paidAmount: true },
        }),
      ]);

      const count = (status: string) =>
        grouped.find((g) => g.status === status)?._count ?? 0;

      const totalAmount = toMoney(agg._sum.total?.toString() ?? '0');
      const paidAmount = toMoney(agg._sum.paidAmount?.toString() ?? '0');

      return {
        total: grouped.reduce((acc, g) => acc + g._count, 0),
        draft: count('DRAFT'),
        quote: count('QUOTE'),
        confirmed: count('CONFIRMED'),
        partiallyPaid: count('PARTIALLY_PAID'),
        paid: count('PAID'),
        cancelled: count('CANCELLED'),
        totalAmount: toMoneyString(totalAmount, 2),
        outstandingAmount: toMoneyString(subtract(totalAmount, paidAmount), 2),
      } as OrderStats;
    });
  }

  // ── مساعدات ──────────────────────────────────────────────────────────────

  private buildWhere(query: OrderListQuery): Prisma.OrderWhereInput {
    const now = new Date();

    return {
      // المؤرشفة مخفية افتراضيًا.
      ...(query.includeArchived ? {} : { archivedAt: null }),
      ...(query.status ? { status: query.status } : {}),
      ...(query.customerId ? { customerId: query.customerId } : {}),
      ...(query.search
        ? {
            OR: [
              { number: { contains: query.search, mode: 'insensitive' } },
              { customer: { name: { contains: query.search, mode: 'insensitive' } } },
              { customer: { code: { contains: query.search, mode: 'insensitive' } } },
            ],
          }
        : {}),
      ...(query.from || query.to
        ? {
            issuedAt: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              // نهاية اليوم — وإلا استُبعدت طلبات آخر يوم في المدى.
              ...(query.to ? { lte: new Date(`${query.to}T23:59:59.999Z`) } : {}),
            },
          }
        : {}),
      ...(query.overdueOnly
        ? { status: { in: ['CONFIRMED', 'PARTIALLY_PAID'] }, dueAt: { lt: now } }
        : {}),
      ...(query.unpaidOnly ? { status: { in: ['CONFIRMED', 'PARTIALLY_PAID'] } } : {}),
    };
  }

  private toDto(row: OrderRow): Order {
    const total = toMoney(row.total.toString());
    const paid = toMoney(row.paidAmount.toString());
    const remaining = subtract(total, paid);

    const isOverdue =
      (row.status === 'CONFIRMED' || row.status === 'PARTIALLY_PAID') &&
      row.dueAt !== null &&
      row.dueAt.getTime() < Date.now();

    return {
      id: row.id,
      number: row.number,
      status: row.status,

      customerId: row.customerId,
      customerName: row.customer.name,
      customerCode: row.customer.code,

      issuedAt: row.issuedAt.toISOString(),
      dueAt: row.dueAt?.toISOString() ?? null,

      subtotal: toMoneyString(row.subtotal.toString(), 2),
      discountAmount: toMoneyString(row.discountAmount.toString(), 2),
      taxAmount: toMoneyString(row.taxAmount.toString(), 2),
      total: toMoneyString(total, 2),

      paidAmount: toMoneyString(paid, 2),
      remainingAmount: toMoneyString(remaining, 2),

      notes: row.notes,
      isLocked: row.lockedAt !== null,
      isOverdue,
      isArchived: row.archivedAt !== null,

      itemCount: row._count.items,
      version: row.version,

      confirmedAt: row.confirmedAt?.toISOString() ?? null,
      cancelledAt: row.cancelledAt?.toISOString() ?? null,
      cancelReason: row.cancelReason,
      createdAt: row.createdAt.toISOString(),
    } as Order;
  }

  private addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }

  private context(): { tenantId: string; storeId: string; userId: string } {
    const ctx = TenantContext.get();
    const tenantId = TenantContext.requireTenantId();
    const userId = TenantContext.requireUserId();
    if (!ctx?.storeId) throw AppError.forbidden('لا يوجد محل مرتبط بحسابك.');
    return { tenantId, storeId: ctx.storeId, userId };
  }
}

/** يُستخدم في تحويل العملة عند الحاجة لاحقًا. */
export type { CurrencyCode };
