import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { AppError } from '../../../core/errors/app-error.js';
import { PrismaService } from '../../../core/prisma/prisma.service.js';
import { IS_PUBLIC, SKIP_CSRF } from '../decorators.js';
import { TokenService, type AccessTokenPayload } from '../token.service.js';

/** الطرق الآمنة (RFC 9110) — لا تغيّر حالة، فلا تحتاج CSRF. */
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  حماية CSRF — Double-Submit Cookie.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  ── لماذا نحتاجها أصلًا؟ ─────────────────────────────────────────────────
 *  اخترنا كوكيز HttpOnly للرموز (تحميها من XSS). لكن المتصفح يرسل الكوكيز
 *  **تلقائيًا** مع أي طلب إلى نطاقنا — بما فيها طلب أطلقه موقع خبيث:
 *
 *      <form action="https://oh-finance.app/api/payments" method="POST">
 *      ← المتصفح يُرفق كوكي الجلسة. الخادم يرى طلبًا موثّقًا تمامًا.
 *
 *  ── الحل ─────────────────────────────────────────────────────────────────
 *  رمز CSRF يُرسل في **موضعين**: كوكي مقروء + ترويسة `X-CSRF-Token`.
 *  الخادم يطلبهما معًا ويطابقهما مع الهاش المخزّن في الجلسة.
 *
 *  الموقع الخبيث يستطيع إجبار المتصفح على إرسال الكوكي، لكنه **لا يستطيع
 *  قراءته** (Same-Origin Policy) — فلا يستطيع ملء الترويسة. الطلب يُرفض.
 *
 *  ── لماذا لا نكتفي بـSameSite؟ ───────────────────────────────────────────
 *  SameSite=Lax يوقف معظم CSRF وهو طبقتنا الأولى. لكنه إعداد **متصفح**:
 *  متصفح قديم، أو إعداد نشر يفرض SameSite=None (واجهة على نطاق فرعي مختلف)،
 *  يُسقطه بصمت. الدفاع في العمق يعني ألا نعتمد على طبقة واحدة.
 */
@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokens: TokenService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { user?: AccessTokenPayload }>();

    if (SAFE_METHODS.has(request.method)) return true;

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ]);
    const skipCsrf = this.reflector.getAllAndOverride<boolean>(SKIP_CSRF, [
      context.getHandler(),
      context.getClass(),
    ]);

    // تسجيل الدخول: لا جلسة بعد ⇒ لا رمز CSRF بعد.
    if (isPublic || skipCsrf) return true;

    const sessionId = request.user?.sid;
    if (!sessionId) {
      throw AppError.unauthenticated();
    }

    const headerToken = request.headers['x-csrf-token'];
    const token = Array.isArray(headerToken) ? headerToken[0] : headerToken;

    if (!token) {
      throw AppError.csrfInvalid();
    }

    const valid = await this.prisma.runUnscoped((tx) =>
      this.tokens.verifyCsrf(tx, sessionId, token),
    );
    if (!valid) {
      throw AppError.csrfInvalid();
    }

    return true;
  }
}
