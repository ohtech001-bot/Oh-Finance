import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ERROR_CODES } from '@oh/contracts';
import type { Request } from 'express';
import { Observable, catchError, from, of, switchMap, tap, throwError } from 'rxjs';
import { AppError } from '../errors/app-error.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { TenantContext } from '../tenancy/tenant-context.js';
import { IdempotencyService } from './idempotency.service.js';

/** يُعلِّم مسارًا بأنه يتطلب `Idempotency-Key`. */
export const IDEMPOTENT = 'idempotent';
export const Idempotent = () => SetMetadata(IDEMPOTENT, true);

/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  اعتراض منع التسجيل المزدوج.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  يغلّف أي مسار مُعلَّم بـ`@Idempotent()`:
 *
 *    1. المفتاح **إلزامي** — بلا مفتاح، 400. لا تنازل.
 *    2. حجز ذرّي — الرابح ينفّذ، والخاسر يقرأ الرد المخزَّن.
 *    3. نجاح ⇒ خزّن الرد. أي إعادة إرسال لاحقة تحصل عليه بلا أثر جانبي.
 *    4. فشل  ⇒ حرّر المفتاح. العملية لم تحدث، فلا شيء تكرره إعادة المحاولة.
 *
 *  ── لماذا المفتاح إلزامي لا اختياري؟ ─────────────────────────────────────
 *  لو كان اختياريًا، لأرسل عميلٌ دفعةً بلا مفتاح — وضاعت الحماية **بصمت**.
 *  الفشل الصاخب (400) أفضل من ثغرة صامتة. الواجهة تولّد UUID عند فتح نموذج
 *  الدفع، فلا عبء على المستخدم.
 *
 *  ── لماذا التحرير عند الفشل ضروري؟ ───────────────────────────────────────
 *  لو أبقينا المفتاح بعد فشل العملية، لعلق العميل: كل إعادة محاولة تصطدم
 *  بـIN_PROGRESS، ولا يستطيع تسجيل دفعته أبدًا حتى تنتهي صلاحية المفتاح
 *  (24 ساعة). التحرير يعيده إلى حالة «لم يحدث شيء» — وهي الحقيقة.
 */
@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly idempotency: IdempotencyService,
    private readonly prisma: PrismaService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const required = this.reflector.getAllAndOverride<boolean>(IDEMPOTENT, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required) return next.handle();

    const request = context.switchToHttp().getRequest<Request>();

    const headerValue = request.headers['idempotency-key'];
    const key = Array.isArray(headerValue) ? headerValue[0] : headerValue;

    if (!key || key.trim().length < 8) {
      throw new AppError(
        ERROR_CODES.IDEMPOTENCY_KEY_REQUIRED,
        'ترويسة Idempotency-Key مطلوبة لهذه العملية المالية. ' +
          'ولّد معرّفًا فريدًا (UUID) لكل عملية دفع.',
        400,
      );
    }

    const tenantId = TenantContext.requireTenantId();
    const endpoint = `${request.method} ${request.route?.path ?? request.path}`;
    const payload = request.body as unknown;

    return from(this.idempotency.acquire(tenantId, key, endpoint, payload)).pipe(
      switchMap((acquisition) => {
        // ── طلب مكرر: أعِد الرد المخزَّن، بلا تنفيذ ──────────────────────
        if (!acquisition.acquired) {
          return of(acquisition.replay.body);
        }

        const { recordId } = acquisition;

        return next.handle().pipe(
          // نجاح ⇒ خزّن الرد.
          switchMap((result) =>
            from(
              this.prisma.runInTenant(tenantId, (tx) =>
                this.idempotency.complete(tx, recordId, 201, result),
              ),
            ).pipe(tap({ next: () => undefined }), switchMap(() => of(result))),
          ),

          // فشل ⇒ حرّر المفتاح، ثم أعِد رمي الخطأ **الأصلي** بلا تغيير.
          catchError((error: unknown) =>
            from(this.idempotency.release(tenantId, recordId)).pipe(
              switchMap(() => throwError(() => error)),
            ),
          ),
        );
      }),
    );
  }
}
