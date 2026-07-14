import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { AppError } from '../../../core/errors/app-error.js';
import { PrismaService } from '../../../core/prisma/prisma.service.js';
import { TenantContext } from '../../../core/tenancy/tenant-context.js';
import { IS_PUBLIC } from '../decorators.js';
import { COOKIE_NAMES, TokenService, type AccessTokenPayload } from '../token.service.js';

/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  الحارس الأول: المصادقة + حقن سياق المستأجر.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  هذا الحارس هو **المكان الوحيد** في النظام الذي يُحدَّد فيه المستأجر.
 *  المصدر: حمولة الـJWT الموقّعة. لا body، لا query، لا header.
 *
 *  مُسجَّل عالميًا (APP_GUARD) — أي مسار جديد محمي تلقائيًا ما لم يُعلَّم
 *  بـ`@Public()` صراحةً. الافتراضي الآمن: نسيان الحماية مستحيل؛ فتحها فعل واعٍ.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokens: TokenService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<Request & { user?: AccessTokenPayload }>();

    const token = this.extractToken(request);
    if (!token) {
      throw AppError.unauthenticated();
    }

    let payload: AccessTokenPayload;
    try {
      payload = await this.tokens.verifyAccessToken(token);
    } catch {
      // توقيع غير صالح أو رمز منتهٍ — لا نفرّق (لا نساعد المهاجم في التشخيص).
      throw AppError.tokenExpired();
    }

    /**
     * الجلسة قد تكون أُبطلت بعد إصدار الرمز (خروج، كشف سرقة، تعطيل الحساب).
     * الرمز نفسه ما زال صالح التوقيع لـ15 دقيقة — لذا نفحص الجلسة في قاعدة
     * البيانات. هذا يكلّف استعلامًا لكل طلب، وهو الثمن العادل لإمكانية
     * **الإبطال الفوري**. بدونه، رمز مسروق يبقى صالحًا حتى انتهائه مهما فعلنا.
     */
    const active = await this.prisma.runUnscoped((tx) =>
      this.tokens.isSessionActive(tx, payload.sid),
    );
    if (!active) {
      throw AppError.tokenExpired();
    }

    request.user = payload;

    // ⬅ اللحظة الوحيدة التي يدخل فيها المستأجر إلى السياق.
    TenantContext.attachIdentity({
      tenantId: payload.tid,
      userId: payload.sub,
      storeId: payload.st,
      isSuperAdmin: payload.sa,
      permissions: payload.perms ?? [],
    });

    return true;
  }

  /**
   * الرمز من كوكي HttpOnly حصرًا.
   *
   * لا ندعم `Authorization: Bearer` عمدًا: قبوله يسمح لواجهة تخزّن الرمز في
   * localStorage بالعمل — أي يفتح الباب الذي أغلقناه بـHttpOnly.
   * (عملاء الخادم-إلى-الخادم سيحصلون على آلية مفاتيح API منفصلة عند الحاجة.)
   */
  private extractToken(request: Request): string | null {
    const cookies = request.cookies as Record<string, string> | undefined;
    return cookies?.[COOKIE_NAMES.ACCESS] ?? null;
  }
}
