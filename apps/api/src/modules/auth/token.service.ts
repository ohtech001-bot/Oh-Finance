import { Injectable, Logger } from '@nestjs/common';
import { JwtService, type JwtSignOptions } from '@nestjs/jwt';
import type { Response } from 'express';
import type { Permission } from '@oh/config';
import { EnvService } from '../../core/config/env.service.js';
import type { TxClient } from '../../core/prisma/prisma.service.js';
import { PasswordService } from './password.service.js';

/**
 * حمولة رمز الوصول.
 *
 * ⚠️ `tid` هنا هو **المصدر الوحيد** للمستأجر في كل النظام. موقّع بـHMAC،
 *    فلا يستطيع العميل تغييره. أي كود يقرأ المستأجر من مكان آخر (body,
 *    query, header) هو ثغرة.
 */
export interface AccessTokenPayload {
  sub: string; // userId
  tid: string | null; // tenantId — null للمدير العام
  sid: string; // sessionId
  sa: boolean; // isSuperAdmin
  st: string | null; // storeId
  perms: Permission[];
  pc: boolean; // mustChangePassword
  sup?: boolean; // جلسة دعم مؤقتة داخل محل، صادرة للمدير العام
}

export const COOKIE_NAMES = {
  ACCESS: 'oh_at',
  REFRESH: 'oh_rt',
  /** مقروء من JS عمدًا — نصف double-submit. ليس سرًّا. */
  CSRF: 'oh_csrf',
} as const;

/** مسار الكوكي: يمنع إرسال رمز التجديد مع كل طلب — يُرسل لمسار التجديد فقط. */
const REFRESH_COOKIE_PATH = '/api/auth';

@Injectable()
export class TokenService {
  private readonly logger = new Logger(TokenService.name);

  constructor(
    private readonly jwt: JwtService,
    private readonly env: EnvService,
    private readonly passwords: PasswordService,
  ) {}

  // ── إصدار الرموز ──────────────────────────────────────────────────────────

  /**
   * `expiresIn` في jsonwebtoken نوعه template-literal مقيّد ("15m" | "1h" | …)
   * لا `string` عام. قيمتنا تأتي من متغيّر بيئة، وZod يتحقق من صيغتها عند
   * الإقلاع — فالتضييق هنا آمن ومبنيّ على تحقق سابق، لا تخمين.
   */
  private ttl(value: string): NonNullable<JwtSignOptions['expiresIn']> {
    return value as NonNullable<JwtSignOptions['expiresIn']>;
  }

  async signAccessToken(payload: AccessTokenPayload): Promise<string> {
    return this.jwt.signAsync(payload, {
      secret: this.env.get('JWT_ACCESS_SECRET'),
      expiresIn: this.ttl(this.env.get('JWT_ACCESS_TTL')),
    });
  }

  async verifyAccessToken(token: string): Promise<AccessTokenPayload> {
    return this.jwt.verifyAsync<AccessTokenPayload>(token, {
      secret: this.env.get('JWT_ACCESS_SECRET'),
    });
  }

  /**
   * ينشئ جلسة جديدة (رمز تجديد + رمز CSRF).
   *
   * رمز التجديد **عشوائي معتم** لا JWT: نريد إبطاله فورًا من جانب الخادم،
   * وJWT مستقل بذاته فلا يمكن إبطاله قبل انتهائه إلا بقائمة سوداء — أي
   * بحث في قاعدة البيانات على أي حال. فلنجعله رمزًا في قاعدة البيانات من البداية.
   *
   * نخزّن **هاشه** لا هو: تسريب الجدول لا يمنح المهاجم جلسات صالحة.
   */
  async createSession(
    tx: TxClient,
    params: {
      userId: string;
      tenantId: string | null;
      familyId?: string;
      userAgent: string | null;
      ipAddress: string | null;
      rememberMe: boolean;
    },
  ): Promise<{ sessionId: string; refreshToken: string; csrfToken: string }> {
    const refreshToken = this.passwords.generateToken(48);
    const csrfToken = this.passwords.generateToken(32);

    const ttlDays = params.rememberMe ? this.refreshTtlDays() : 1;
    const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000);

    const session = await tx.session.create({
      data: {
        userId: params.userId,
        tenantId: params.tenantId,
        refreshTokenHash: this.passwords.hashToken(refreshToken),
        csrfTokenHash: this.passwords.hashToken(csrfToken),
        familyId: params.familyId ?? crypto.randomUUID(),
        userAgent: params.userAgent?.slice(0, 512) ?? null,
        ipAddress: params.ipAddress?.slice(0, 64) ?? null,
        expiresAt,
      },
      select: { id: true },
    });

    return { sessionId: session.id, refreshToken, csrfToken };
  }

  /**
   * ═══════════════════════════════════════════════════════════════════════
   *  تدوير رمز التجديد مع كشف إعادة الاستخدام.
   * ═══════════════════════════════════════════════════════════════════════
   *
   *  كل تجديد يُبطل الرمز القديم ويصدر رمزًا جديدًا في نفس «العائلة».
   *
   *  ── السيناريو الذي يحمينا منه ──────────────────────────────────────────
   *  1. مهاجم يسرق رمز التجديد (نسخة احتياطية، جهاز مشترك...).
   *  2. المستخدم الشرعي يجدّد → الرمز القديم صار مُبطلًا، والمستخدم يحمل رمزًا جديدًا.
   *  3. المهاجم يستخدم الرمز المسروق (المُبطل الآن).
   *  4. ← نرى استخدامًا لرمز مُبطل. هذا **لا يحدث في الاستخدام الطبيعي أبدًا**.
   *     الاستنتاج الوحيد: الرمز مسروق.
   *  5. نُبطل **العائلة كلها** — بما فيها رمز المهاجم الجديد. يخرج الطرفان،
   *     ويُنبَّه المستخدم الشرعي.
   *
   *  الثمن: خروج المستخدم الشرعي أحيانًا. المقابل: إغلاق الباب على السارق.
   */
  async rotateRefreshToken(
    tx: TxClient,
    refreshToken: string,
    context: { userAgent: string | null; ipAddress: string | null },
  ): Promise<
    | {
        outcome: 'ROTATED';
        sessionId: string;
        userId: string;
        tenantId: string | null;
        refreshToken: string;
        csrfToken: string;
      }
    | { outcome: 'REUSE_DETECTED'; userId: string; familyId: string }
    | { outcome: 'INVALID' }
  > {
    const tokenHash = this.passwords.hashToken(refreshToken);

    const session = await tx.session.findUnique({
      where: { refreshTokenHash: tokenHash },
      select: {
        id: true,
        userId: true,
        tenantId: true,
        familyId: true,
        expiresAt: true,
        revokedAt: true,
        replacedById: true,
      },
    });

    if (!session) {
      return { outcome: 'INVALID' };
    }

    // ── الكشف: رمز مُبطل أو مُستبدل يُستخدم مجددًا ⇒ سرقة ────────────────
    if (session.revokedAt !== null || session.replacedById !== null) {
      this.logger.error(
        { userId: session.userId, familyId: session.familyId },
        'كشف إعادة استخدام رمز تجديد — إبطال عائلة الجلسة بالكامل.',
      );
      return { outcome: 'REUSE_DETECTED', userId: session.userId, familyId: session.familyId };
    }

    if (session.expiresAt.getTime() <= Date.now()) {
      return { outcome: 'INVALID' };
    }

    // ── التدوير ─────────────────────────────────────────────────────────
    const next = await this.createSession(tx, {
      userId: session.userId,
      tenantId: session.tenantId,
      familyId: session.familyId, // نفس العائلة — نحفظ سلسلة النسب
      userAgent: context.userAgent,
      ipAddress: context.ipAddress,
      rememberMe: true,
    });

    await tx.session.update({
      where: { id: session.id },
      data: {
        revokedAt: new Date(),
        revokedReason: 'ROTATED',
        replacedById: next.sessionId,
        lastUsedAt: new Date(),
      },
    });

    return {
      outcome: 'ROTATED',
      sessionId: next.sessionId,
      userId: session.userId,
      tenantId: session.tenantId,
      refreshToken: next.refreshToken,
      csrfToken: next.csrfToken,
    };
  }

  /** يُبطل كل جلسات عائلة — عند كشف السرقة. */
  async revokeFamily(tx: TxClient, familyId: string, reason: string): Promise<number> {
    const result = await tx.session.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date(), revokedReason: reason.slice(0, 64) },
    });
    return result.count;
  }

  async revokeSession(tx: TxClient, sessionId: string, reason: string): Promise<void> {
    await tx.session.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: new Date(), revokedReason: reason.slice(0, 64) },
    });
  }

  async revokeAllForUser(tx: TxClient, userId: string, reason: string): Promise<number> {
    const result = await tx.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date(), revokedReason: reason.slice(0, 64) },
    });
    return result.count;
  }

  /** يتحقق أن الجلسة ما زالت حيّة — يُستدعى مع كل طلب موثّق. */
  async isSessionActive(tx: TxClient, sessionId: string): Promise<boolean> {
    const session = await tx.session.findUnique({
      where: { id: sessionId },
      select: { revokedAt: true, expiresAt: true },
    });
    if (!session) return false;
    if (session.revokedAt !== null) return false;
    return session.expiresAt.getTime() > Date.now();
  }

  async verifyCsrf(tx: TxClient, sessionId: string, csrfToken: string): Promise<boolean> {
    const session = await tx.session.findUnique({
      where: { id: sessionId },
      select: { csrfTokenHash: true },
    });
    if (!session) return false;
    return this.passwords.compareTokens(session.csrfTokenHash, this.passwords.hashToken(csrfToken));
  }

  // ── الكوكيز ───────────────────────────────────────────────────────────────

  /**
   * ═══════════════════════════════════════════════════════════════════════
   *  لماذا كوكيز HttpOnly وليس localStorage؟
   * ═══════════════════════════════════════════════════════════════════════
   *
   *  الرمز في localStorage يقرأه أي JavaScript على الصفحة. ثغرة XSS واحدة —
   *  في كودنا، أو في **أي حزمة npm نستوردها** — تسحب الرمز وترسله للمهاجم.
   *  وسطح الهجوم هنا هائل: كل اعتمادية متعدّية.
   *
   *  كوكي HttpOnly لا يراه JavaScript إطلاقًا. XSS تستطيع إرسال طلبات نيابة
   *  عن المستخدم (وهذا سيّئ)، لكنها **لا تستطيع سرقة الجلسة** والاحتفاظ بها
   *  بعد إغلاق التبويب. الفارق جوهري.
   *
   *  الثمن: الكوكيز تُرسل تلقائيًا ⇒ نحتاج حماية CSRF (double-submit).
   *  رمز CSRF في كوكي **مقروء** + ترويسة `X-CSRF-Token`. موقع خبيث يستطيع
   *  إجبار المتصفح على إرسال الكوكي، لكنه **لا يستطيع قراءته** (Same-Origin
   *  Policy) فلا يستطيع ملء الترويسة.
   */
  setAuthCookies(
    res: Response,
    tokens: { accessToken: string; refreshToken: string; csrfToken: string },
    rememberMe: boolean,
  ): void {
    const secure = this.env.get('COOKIE_SECURE');
    const sameSite = this.env.get('COOKIE_SAME_SITE');
    const domain = this.env.get('COOKIE_DOMAIN') || undefined;

    const base = { httpOnly: true, secure, sameSite, domain, path: '/' } as const;

    // رمز الوصول: عمر قصير (15د). لا maxAge — كوكي جلسة يموت بإغلاق المتصفح.
    res.cookie(COOKIE_NAMES.ACCESS, tokens.accessToken, base);

    // رمز التجديد: مقيّد بمسار /api/auth فقط.
    // فائدة أمنية حقيقية: لا يُرسل مع طلبات الأعمال العادية، فلا يظهر في
    // سجلات وكيل عكسي أو أثر تصحيح لطلب /api/customers.
    const refreshMaxAge = (rememberMe ? this.refreshTtlDays() : 1) * 24 * 60 * 60 * 1000;
    res.cookie(COOKIE_NAMES.REFRESH, tokens.refreshToken, {
      ...base,
      path: REFRESH_COOKIE_PATH,
      maxAge: refreshMaxAge,
    });

    // رمز CSRF: httpOnly = false عمدًا — الواجهة تقرأه لتضعه في الترويسة.
    res.cookie(COOKIE_NAMES.CSRF, tokens.csrfToken, {
      httpOnly: false,
      secure,
      sameSite,
      domain,
      path: '/',
      maxAge: refreshMaxAge,
    });
  }

  clearAuthCookies(res: Response): void {
    const secure = this.env.get('COOKIE_SECURE');
    const sameSite = this.env.get('COOKIE_SAME_SITE');
    const domain = this.env.get('COOKIE_DOMAIN') || undefined;

    res.clearCookie(COOKIE_NAMES.ACCESS, { httpOnly: true, secure, sameSite, domain, path: '/' });
    res.clearCookie(COOKIE_NAMES.REFRESH, {
      httpOnly: true,
      secure,
      sameSite,
      domain,
      path: REFRESH_COOKIE_PATH,
    });
    res.clearCookie(COOKIE_NAMES.CSRF, {
      httpOnly: false,
      secure,
      sameSite,
      domain,
      path: '/',
    });
  }

  private refreshTtlDays(): number {
    const ttl = this.env.get('JWT_REFRESH_TTL');
    const match = /^(\d+)d$/.exec(ttl);
    return match?.[1] ? Number.parseInt(match[1], 10) : 30;
  }
}
