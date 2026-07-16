import { Injectable, Logger } from '@nestjs/common';
import {
  Decimal,
  add,
  isNegative,
  isZero,
  subtract,
  toMoney,
  toMoneyString,
  zero,
  type MoneyString,
} from '@oh/money';
import type { LedgerEntryType, LedgerRefType } from '@oh/contracts';
import { AppError } from '../../core/errors/app-error.js';
import type { TxClient } from '../../core/prisma/prisma.service.js';

/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  LedgerService — الطريق الوحيد لكتابة قيد محاسبي.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  لا يوجد في هذا النظام أي كود آخر يُدرج في `ledger_entries`. كل شيء —
 *  تأكيد طلب، تسجيل دفعة، تسوية، عكس — يمر من هنا.
 *
 *  ── لماذا التمركز؟ ────────────────────────────────────────────────────────
 *  المعادلة المحاسبية (`running = opening + debit − credit`) وسلسلة التسلسل
 *  (`seq` متصاعد بلا فجوات) وقفل التزامن — ثلاثتها يجب أن تُطبَّق **معًا**
 *  في كل كتابة. لو نُثرت هذه المسؤولية على ثلاث خدمات، لكفى أن تنسى واحدة
 *  منها القفل حتى ينكسر الدفتر بصمت تحت الحمل.
 *
 *  ⚠️ كل دوال هذه الخدمة تستقبل `tx` — معاملة قائمة، لا تفتح واحدة.
 *     السبب: القيد المحاسبي يجب أن يكون **ذرّيًا مع العملية التي ولّدته**.
 *     طلب مؤكد بلا قيد، أو قيد بلا طلب، كلاهما فساد لا يُصلَح.
 */
@Injectable()
export class LedgerService {
  private readonly logger = new Logger(LedgerService.name);

  /**
   * ═══════════════════════════════════════════════════════════════════════
   *  إضافة قيد — القلب.
   * ═══════════════════════════════════════════════════════════════════════
   *
   *  التسلسل:
   *    1. قفل استشاري على الزبون  ← يُسلسِل الكتابات المتزامنة
   *    2. قراءة آخر قيد           ← الرصيد الحالي + آخر seq
   *    3. حساب الرصيد الجديد      ← بـDecimal، لا float
   *    4. إدراج القيد             ← القاعدة تتحقق من المعادلة بـCHECK
   *
   *  ── الخطوة 1 هي الأهم ──────────────────────────────────────────────────
   *  بلا `pg_advisory_xact_lock`، دفعتان متزامنتان لنفس الزبون تقرآن نفس
   *  `runningBalance` وتحسبان نفس `seq` — فتُدرجان قيدين بنفس التسلسل
   *  ونفس الرصيد السابق. النتيجة: دفتر متفرّع، ورصيد خاطئ للأبد.
   *
   *  القفل على مستوى المعاملة: يُحرَّر تلقائيًا عند COMMIT/ROLLBACK، فلا
   *  يمكن أن يعلق. وهو مقيّد بالزبون: دفعات زبائن مختلفين تعمل بالتوازي.
   *
   *  ── لماذا نثق بالقاعدة أيضًا؟ ──────────────────────────────────────────
   *  القيد `ledger_balance_equation` يرفض أي قيد تخالف أرقامُه المعادلة.
   *  و`UNIQUE(tenant, customer, seq)` يرفض تسلسلًا مكررًا. فلو أخطأ هذا
   *  الكود يومًا، تنهار المعاملة — ولا تُكتب بيانات فاسدة.
   */
  async append(
    tx: TxClient,
    params: {
      tenantId: string;
      storeId: string;
      customerId: string;
      entryType: LedgerEntryType;
      /** الاتجاه. `debit` يزيد ما على الزبون، `credit` ينقصه. */
      direction: 'DEBIT' | 'CREDIT';
      /** موجب دائمًا. الاتجاه في `direction` لا في الإشارة. */
      amount: MoneyString;
      refType: LedgerRefType;
      refId?: string | null;
      notes?: string | null;
      occurredAt?: Date;
      createdBy?: string | null;
      idempotencyKey?: string | null;
      reversesEntryId?: string | null;
    },
  ): Promise<{ id: string; seq: number; openingBalance: Decimal; runningBalance: Decimal }> {
    const amount = toMoney(params.amount);

    if (isNegative(amount)) {
      throw AppError.validation('مبلغ القيد لا يكون سالبًا. الاتجاه يُحدَّد بـdirection.');
    }
    if (isZero(amount) && params.entryType !== 'OPENING_BALANCE') {
      throw AppError.validation('قيد بمبلغ صفر بلا معنى محاسبي.');
    }

    // ── 1. القفل ─────────────────────────────────────────────────────────
    // hashtextextended يحوّل UUID إلى bigint — مفتاح القفل.
    await tx.$executeRaw`
      SELECT pg_advisory_xact_lock(hashtextextended(${`ledger:${params.customerId}`}, 0))
    `;

    // ── 2. آخر قيد ───────────────────────────────────────────────────────
    const last = await tx.ledgerEntry.findFirst({
      where: { tenantId: params.tenantId, customerId: params.customerId },
      orderBy: { seq: 'desc' },
      select: { seq: true, runningBalance: true },
    });

    const openingBalance = last ? toMoney(last.runningBalance.toString()) : zero();
    const nextSeq = (last?.seq ?? 0) + 1;

    // ── 3. الرصيد الجديد ─────────────────────────────────────────────────
    const isDebit = params.direction === 'DEBIT';
    const runningBalance = isDebit
      ? add(openingBalance, amount)
      : subtract(openingBalance, amount);

    // ── 4. الإدراج ───────────────────────────────────────────────────────
    const entry = await tx.ledgerEntry.create({
      data: {
        tenantId: params.tenantId,
        storeId: params.storeId,
        customerId: params.customerId,
        seq: nextSeq,
        entryType: params.entryType,

        openingBalance: toMoneyString(openingBalance),
        debit: isDebit ? toMoneyString(amount) : '0',
        credit: isDebit ? '0' : toMoneyString(amount),
        runningBalance: toMoneyString(runningBalance),

        refType: params.refType,
        refId: params.refId ?? null,
        reversesEntryId: params.reversesEntryId ?? null,
        notes: params.notes ?? null,
        idempotencyKey: params.idempotencyKey ?? null,
        occurredAt: params.occurredAt ?? new Date(),
        createdBy: params.createdBy ?? null,
      },
      select: { id: true, seq: true },
    });

    return { id: entry.id, seq: entry.seq, openingBalance, runningBalance };
  }

  /**
   * رصيد الزبون — من الدفتر، لا من عمود.
   *
   * نقرأ `runningBalance` من آخر قيد بدل `SUM(debit) - SUM(credit)`:
   * أسرع (فهرس على seq DESC) ومتطابق حتمًا مع المجموع — لأن قيد المعادلة
   * في القاعدة يضمن أن كل `runningBalance` = مجموع ما سبقه.
   *
   * `verifyIntegrity()` أدناه يتحقق من هذا التطابق فعليًا.
   */
  async getBalance(tx: TxClient, tenantId: string, customerId: string): Promise<Decimal> {
    const last = await tx.ledgerEntry.findFirst({
      where: { tenantId, customerId },
      orderBy: { seq: 'desc' },
      select: { runningBalance: true },
    });

    return last ? toMoney(last.runningBalance.toString()) : zero();
  }

  /** أرصدة عدة زبائن دفعة واحدة — يمنع N+1 في شاشة قائمة الزبائن. */
  async getBalances(
    tx: TxClient,
    tenantId: string,
    customerIds: string[],
  ): Promise<Map<string, Decimal>> {
    const balances = new Map<string, Decimal>();
    if (customerIds.length === 0) return balances;

    /**
     * DISTINCT ON — امتداد PostgreSQL: يعيد أول صف لكل مجموعة.
     * مع ORDER BY (customer_id, seq DESC) فهو آخر قيد لكل زبون.
     *
     * البديل (استعلام لكل زبون) = 25 رحلة لقاعدة البيانات لصفحة واحدة.
     */
    const rows = await tx.$queryRaw<{ customer_id: string; running_balance: string }[]>`
      SELECT DISTINCT ON (customer_id)
             customer_id,
             running_balance::text AS running_balance
      FROM ledger_entries
      WHERE tenant_id = ${tenantId}::uuid
        AND customer_id = ANY(${customerIds}::uuid[])
      ORDER BY customer_id, seq DESC
    `;

    for (const row of rows) {
      balances.set(row.customer_id, toMoney(row.running_balance));
    }
    // زبون بلا قيود = رصيد صفر.
    for (const id of customerIds) {
      if (!balances.has(id)) balances.set(id, zero());
    }

    return balances;
  }

  /**
   * ═══════════════════════════════════════════════════════════════════════
   *  عكس قيد — الطريقة **الوحيدة** لإبطال أثر قيد.
   * ═══════════════════════════════════════════════════════════════════════
   *
   *  لا نحذف ولا نعدّل. نُنشئ قيدًا مضادًا بنفس المبلغ واتجاه معاكس، يشير
   *  إلى الأصلي.
   *
   *  النتيجة: الرصيد يعود كما كان، **والتاريخ يبقى كاملًا** — نرى الخطأ
   *  ونرى تصحيحه. هذا هو الفرق بين نظام محاسبي ونظام يخفي أخطاءه.
   */
  async reverse(
    tx: TxClient,
    params: {
      tenantId: string;
      storeId: string;
      entryId: string;
      reason: string;
      createdBy: string | null;
    },
  ): Promise<{ id: string; runningBalance: Decimal }> {
    const original = await tx.ledgerEntry.findFirst({
      where: { id: params.entryId, tenantId: params.tenantId },
      select: {
        id: true,
        customerId: true,
        entryType: true,
        debit: true,
        credit: true,
        refType: true,
        refId: true,
      },
    });

    if (!original) throw AppError.notFound('القيد');

    if (original.entryType === 'REVERSAL') {
      throw AppError.conflict('لا يُعكس قيد عكس. أنشئ قيد تسوية بدلًا منه.');
    }

    // عُكس من قبل؟ العكس المزدوج يُلغي أثر العكس الأول — فساد صامت.
    const existing = await tx.ledgerEntry.findFirst({
      where: { tenantId: params.tenantId, reversesEntryId: params.entryId },
      select: { id: true },
    });
    if (existing) {
      throw AppError.conflict('هذا القيد معكوس مسبقًا.');
    }

    const debit = toMoney(original.debit.toString());
    const credit = toMoney(original.credit.toString());

    // الاتجاه المعاكس: قيد مدين يُعكس بدائن، والعكس.
    const isOriginalDebit = !isZero(debit);
    const result = await this.append(tx, {
      tenantId: params.tenantId,
      storeId: params.storeId,
      customerId: original.customerId,
      entryType: 'REVERSAL',
      direction: isOriginalDebit ? 'CREDIT' : 'DEBIT',
      amount: toMoneyString(isOriginalDebit ? debit : credit),
      refType: original.refType,
      refId: original.refId,
      reversesEntryId: original.id,
      notes: params.reason,
      createdBy: params.createdBy,
    });

    this.logger.warn(
      { entryId: params.entryId, reversalId: result.id, customerId: original.customerId },
      'عُكس قيد محاسبي.',
    );

    return { id: result.id, runningBalance: result.runningBalance };
  }

  /**
   * ═══════════════════════════════════════════════════════════════════════
   *  التحقق من سلامة الدفتر.
   * ═══════════════════════════════════════════════════════════════════════
   *
   *  يفحص أربعة ثوابت لا يجوز أن تُخرَق أبدًا:
   *    1. التسلسل متصل بلا فجوات (1, 2, 3, ... n)
   *    2. `openingBalance` لكل قيد = `runningBalance` لسابقه
   *    3. المعادلة: running = opening + debit − credit
   *    4. الرصيد النهائي = SUM(debit) − SUM(credit)
   *
   *  الثابت (3) تفرضه القاعدة بـCHECK — فحصه هنا حزام أمان.
   *  الثابت (2) هو ما يكشف فجوة أو تفرّعًا في السلسلة (فشل قفل).
   *  الثابت (4) هو الاختبار النهائي: هل السلسلة تُنتج نفس المجموع؟
   */
  async verifyIntegrity(
    tx: TxClient,
    tenantId: string,
    customerId: string,
  ): Promise<{
    valid: boolean;
    entriesChecked: number;
    errors: string[];
    computedBalance: string;
    aggregateBalance: string;
  }> {
    const entries = await tx.ledgerEntry.findMany({
      where: { tenantId, customerId },
      orderBy: { seq: 'asc' },
      select: {
        seq: true,
        entryType: true,
        openingBalance: true,
        debit: true,
        credit: true,
        runningBalance: true,
      },
    });

    const errors: string[] = [];
    let expectedSeq = 1;
    let expectedOpening = zero();
    let sumDebit = zero();
    let sumCredit = zero();

    for (const entry of entries) {
      const opening = toMoney(entry.openingBalance.toString());
      const debit = toMoney(entry.debit.toString());
      const credit = toMoney(entry.credit.toString());
      const running = toMoney(entry.runningBalance.toString());

      // (1) التسلسل متصل
      if (entry.seq !== expectedSeq) {
        errors.push(`فجوة في التسلسل: متوقَّع ${expectedSeq}، وُجد ${entry.seq}`);
      }

      // (2) الربط بالسابق
      if (!opening.equals(expectedOpening)) {
        errors.push(
          `القيد ${entry.seq}: الرصيد الافتتاحي ${toMoneyString(opening)} ` +
            `لا يطابق رصيد سابقه ${toMoneyString(expectedOpening)} — سلسلة مكسورة.`,
        );
      }

      // (3) المعادلة
      const expectedRunning = subtract(add(opening, debit), credit);
      if (!running.equals(expectedRunning)) {
        errors.push(
          `القيد ${entry.seq}: المعادلة مخروقة — ` +
            `${toMoneyString(opening)} + ${toMoneyString(debit)} − ${toMoneyString(credit)} ` +
            `= ${toMoneyString(expectedRunning)} ≠ ${toMoneyString(running)}`,
        );
      }

      sumDebit = add(sumDebit, debit);
      sumCredit = add(sumCredit, credit);
      expectedOpening = running;
      expectedSeq = entry.seq + 1;
    }

    // (4) الرصيد النهائي = مجموع الحركات
    const computed = expectedOpening;
    const aggregate = subtract(sumDebit, sumCredit);

    if (!computed.equals(aggregate)) {
      errors.push(
        `الرصيد النهائي ${toMoneyString(computed)} لا يساوي ` +
          `SUM(debit) − SUM(credit) = ${toMoneyString(aggregate)}`,
      );
    }

    return {
      valid: errors.length === 0,
      entriesChecked: entries.length,
      errors,
      computedBalance: toMoneyString(computed),
      aggregateBalance: toMoneyString(aggregate),
    };
  }
}
