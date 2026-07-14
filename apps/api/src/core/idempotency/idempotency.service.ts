import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { AppError } from '../errors/app-error.js';
import { PrismaService, type TxClient } from '../prisma/prisma.service.js';

/** مدة صلاحية المفتاح. بعدها يُنظَّف — إعادة إرسال بعد 24 ساعة ليست «نفس الطلب». */
const TTL_HOURS = 24;

/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  منع التسجيل المزدوج (Idempotency).
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  المشكلة الحقيقية (ADR-0004): الكاشير يسجّل دفعة 500 ₪، الشبكة تتأخر،
 *  فينقر «حفظ» مرة أخرى — **بينما الطلب الأول نجح فعلًا على الخادم**.
 *  النتيجة بلا حماية: دفعتان، ورصيد الزبون ينقص 1000 بدل 500.
 *
 *  ── لماذا لا «افحص ثم أدرج»؟ ─────────────────────────────────────────────
 *      if (!await exists(key)) { await insert(key); ... }
 *
 *  بين `exists` و`insert` نافذة. طلبان متزامنان يجتازان الفحص كلاهما، ثم
 *  يُدرجان. النافذة صغيرة (ميلي‌ثوانٍ) — وهي بالضبط الفارق بين نقرتين
 *  متسرعتين، أو بين طلب وإعادة محاولته التلقائية.
 *
 *  ── الحل: اجعل الإدراج نفسه هو الفحص ─────────────────────────────────────
 *  `INSERT` مع `UNIQUE(tenant, key)`. الرابح واحد **ذرّيًا** بحكم القاعدة.
 *  الخاسر يلتقط P2002 ويقرأ الرد المخزَّن. لا نافذة، لا سباق.
 */
@Injectable()
export class IdempotencyService {
  private readonly logger = new Logger(IdempotencyService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** بصمة الحمولة — نفس المفتاح بحمولة مختلفة = خطأ عميل، لا إعادة محاولة. */
  hashPayload(payload: unknown): string {
    return createHash('sha256').update(JSON.stringify(payload ?? null), 'utf8').digest('hex');
  }

  /**
   * يحاول حجز المفتاح.
   *
   * @returns `{ acquired: true }`  → أنت الرابح، نفّذ العملية.
   *          `{ acquired: false, replay }` → طلب مكرر، أعِد الرد المخزَّن.
   *
   * ⚠️ **معاملة منفصلة عن العملية نفسها** — وهذا مقصود:
   *    لو حجزنا المفتاح داخل معاملة الدفعة، ثم فشلت الدفعة وتراجعت، لتراجع
   *    الحجز معها — فيستطيع الطلب المكرر تنفيذ الدفعة مرة أخرى. الحجز يجب
   *    أن **يصمد** حتى لو فشلت العملية.
   */
  async acquire(
    tenantId: string,
    key: string,
    endpoint: string,
    payload: unknown,
  ): Promise<
    | { acquired: true; recordId: string }
    | { acquired: false; replay: { status: number; body: unknown } }
  > {
    const requestHash = this.hashPayload(payload);
    const expiresAt = new Date(Date.now() + TTL_HOURS * 60 * 60 * 1000);

    try {
      const record = await this.prisma.runInTenant(tenantId, (tx) =>
        tx.idempotencyKey.create({
          data: {
            tenantId,
            key,
            endpoint,
            requestHash,
            status: 'IN_PROGRESS',
            expiresAt,
          },
          select: { id: true },
        }),
      );

      return { acquired: true, recordId: record.id };
    } catch (error) {
      // P2002 = انتهاك UNIQUE ⇒ المفتاح موجود ⇒ طلب مكرر.
      if (
        !(error instanceof Prisma.PrismaClientKnownRequestError) ||
        error.code !== 'P2002'
      ) {
        throw error;
      }
    }

    // ── طلب مكرر: نفحص حالته ────────────────────────────────────────────
    const existing = await this.prisma.runInTenant(tenantId, (tx) =>
      tx.idempotencyKey.findUnique({
        where: { tenantId_key: { tenantId, key } },
        select: {
          requestHash: true,
          status: true,
          responseStatus: true,
          responseBody: true,
        },
      }),
    );

    if (!existing) {
      // اختفى بين الإدراج والقراءة (انتهت صلاحيته ونُظِّف). حالة نادرة جدًا.
      throw AppError.conflict('تعذّر التحقق من مفتاح منع التكرار. أعد المحاولة.');
    }

    // نفس المفتاح، حمولة مختلفة ⇒ خطأ في العميل، لا إعادة محاولة.
    // لو أعدنا الرد القديم هنا، لظن العميل أن دفعته الجديدة سُجِّلت — وهي لم تُسجَّل.
    if (existing.requestHash !== requestHash) {
      throw new AppError(
        'IDEMPOTENCY_PAYLOAD_MISMATCH',
        'مفتاح منع التكرار مستخدم مع بيانات مختلفة. استخدم مفتاحًا جديدًا لكل عملية.',
        422,
      );
    }

    // الطلب الأصلي ما زال يعمل.
    if (existing.status === 'IN_PROGRESS') {
      throw AppError.conflict('العملية قيد التنفيذ. انتظر النتيجة ولا تُعِد الإرسال.');
    }

    this.logger.log({ key, endpoint }, 'طلب مكرر — أُعيد الرد المخزَّن بلا أثر جانبي.');

    return {
      acquired: false,
      replay: {
        status: existing.responseStatus ?? 200,
        body: existing.responseBody,
      },
    };
  }

  /** يخزّن الرد بعد نجاح العملية — فتعيده أي إعادة إرسال لاحقة. */
  async complete(
    tx: TxClient,
    recordId: string,
    status: number,
    body: unknown,
  ): Promise<void> {
    await tx.idempotencyKey.update({
      where: { id: recordId },
      data: {
        status: 'COMPLETED',
        responseStatus: status,
        responseBody: body as Prisma.InputJsonValue,
      },
    });
  }

  /**
   * يحرّر المفتاح بعد فشل العملية.
   *
   * ⚠️ الحذف هنا **صحيح ومقصود**: العملية فشلت، فلا شيء تكرره إعادةُ المحاولة.
   *    لو أبقينا المفتاح، لعلق العميل: كل إعادة محاولة تصطدم بـIN_PROGRESS
   *    أو تُعيد ردًا فاشلًا محفوظًا — ولا يستطيع تسجيل دفعته أبدًا.
   */
  async release(tenantId: string, recordId: string): Promise<void> {
    try {
      await this.prisma.runInTenant(tenantId, (tx) =>
        tx.idempotencyKey.delete({ where: { id: recordId } }),
      );
    } catch (error) {
      // فشل التحرير لا يجوز أن يحجب الخطأ الأصلي عن المستخدم.
      this.logger.error({ err: error, recordId }, 'تعذّر تحرير مفتاح منع التكرار.');
    }
  }
}
