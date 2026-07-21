import { Injectable, Logger } from '@nestjs/common';
import type { Response } from 'express';
import {
  AUDIT_ACTIONS,
  type LoginRequest,
  type LoginResponse,
  type SessionUser,
  type ChangePasswordRequest,
} from '@oh/contracts';
import { ROLES, permissionsForRole, type Permission, type RoleName } from '@oh/config';
import { EnvService } from '../../core/config/env.service.js';
import { AppError } from '../../core/errors/app-error.js';
import { PrismaService, type TxClient } from '../../core/prisma/prisma.service.js';
import { AuditService } from '../../core/audit/audit.service.js';
import { TenantContext } from '../../core/tenancy/tenant-context.js';
import { PasswordService } from './password.service.js';
import { TokenService, type AccessTokenPayload } from './token.service.js';

/** ما تُرجعه دالة app_auth_lookup (SECURITY DEFINER). */
interface AuthLookupRow {
  id: string;
  tenant_id: string | null;
  store_id: string | null;
  role_id: string | null;
  password_hash: string;
  status: 'ACTIVE' | 'INACTIVE';
  is_super_admin: boolean;
  totp_enabled: boolean;
  totp_secret: string | null;
  failed_login_count: number;
  locked_until: Date | null;
  tenant_status: 'ACTIVE' | 'TRIAL' | 'SUSPENDED' | 'CANCELLED' | null;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly tokens: TokenService,
    private readonly audit: AuditService,
    private readonly env: EnvService,
  ) {}

  /**
   * ═══════════════════════════════════════════════════════════════════════
   *  تسجيل الدخول.
   * ═══════════════════════════════════════════════════════════════════════
   *
   *  التسلسل مقصود بدقة — كل خطوة تُغلق بابًا:
   *
   *   1. بحث عبر `app_auth_lookup` (SECURITY DEFINER).
   *      RLS تحتاج tenant_id، لكننا لا نعرفه بعد. هذه الدالة الضيقة هي
   *      الثقب الوحيد المسموح في جدار RLS.
   *
   *   2. التحقق من كلمة المرور **حتى لو لم يوجد المستخدم** (هاش وهمي).
   *      توحيد الزمن — وإلا كشف زمن الرد أي البُرد مسجّلة.
   *
   *   3. فحوص القفل/الحالة **بعد** التحقق، لا قبله.
   *      لو رفضنا حسابًا مقفلًا قبل التحقق من كلمة المرور، لصار زمن الرد
   *      يكشف أن الحساب موجود ومقفل.
   *
   *   4. رسالة خطأ **موحّدة** في كل حالات الفشل.
   */
  async login(
    dto: LoginRequest,
    res: Response,
    context: { ip: string | null; userAgent: string | null },
  ): Promise<LoginResponse> {
    const rows = await this.prisma.runUnscoped(
      (tx) => tx.$queryRaw<AuthLookupRow[]>`SELECT * FROM app_auth_lookup(${dto.email}::citext)`,
    );
    const found = rows[0] ?? null;

    // ── (2) التحقق دائمًا — بهاش وهمي إن لم يوجد المستخدم ───────────────
    const passwordValid = await this.passwords.verifyWithTimingEqualization(
      found?.password_hash ?? null,
      dto.password,
    );

    if (!found) {
      await this.recordFailedLogin(null, dto.email, 'مستخدم غير موجود');
      throw AppError.invalidCredentials();
    }

    // ── (3) القفل: نفحصه الآن، بعد صرف زمن التحقق ───────────────────────
    if (found.locked_until && found.locked_until.getTime() > Date.now()) {
      const minutes = Math.ceil((found.locked_until.getTime() - Date.now()) / 60_000);
      throw AppError.accountLocked(minutes);
    }

    if (!passwordValid) {
      await this.registerAttempt(found.id, false);
      await this.recordFailedLogin(found.id, dto.email, 'كلمة مرور خاطئة');
      throw AppError.invalidCredentials();
    }

    if (found.status !== 'ACTIVE') {
      throw AppError.accountInactive();
    }

    // مستخدم محل في محل موقوف — لا يدخل. المدير العام (tenant_status = null) يدخل.
    if (found.tenant_status === 'SUSPENDED' || found.tenant_status === 'CANCELLED') {
      throw AppError.tenantSuspended();
    }

    // ── 2FA ──────────────────────────────────────────────────────────────
    if (found.totp_enabled && this.env.get('FEATURE_2FA')) {
      if (!dto.totpCode) {
        // ليست فشلًا — الواجهة تعرض حقل الرمز وتعيد الإرسال.
        throw AppError.twoFactorRequired();
      }
      // التحقق الفعلي من TOTP يُنفَّذ عند تفعيل الميزة (المرحلة 8).
      // العلم مطفأ افتراضيًا، فلا مسار حيّ يصل هنا الآن.
      throw AppError.validation('التحقق بخطوتين قيد التفعيل (المرحلة 8).');
    }

    // ── إصدار الجلسة ─────────────────────────────────────────────────────
    const authState = await this.prisma.runUnscoped((tx) =>
      tx.user.findUnique({
        where: { id: found.id },
        select: { platformRole: true, mustChangePassword: true },
      }),
    );
    if (!authState) throw AppError.invalidCredentials();
    const permissions = await this.resolvePermissions(found, authState.platformRole);

    const { accessToken, csrfToken } = await this.prisma.runUnscoped(async (tx) => {
      const session = await this.tokens.createSession(tx, {
        userId: found.id,
        tenantId: found.tenant_id,
        userAgent: context.userAgent,
        ipAddress: context.ip,
        rememberMe: dto.rememberMe,
      });

      const payload: AccessTokenPayload = {
        sub: found.id,
        tid: found.tenant_id,
        sid: session.sessionId,
        sa: found.is_super_admin,
        st: found.store_id,
        perms: permissions,
        pc: authState.mustChangePassword,
      };

      const access = await this.tokens.signAccessToken(payload);

      this.tokens.setAuthCookies(
        res,
        {
          accessToken: access,
          refreshToken: session.refreshToken,
          csrfToken: session.csrfToken,
        },
        dto.rememberMe,
      );

      await this.audit.record(tx, {
        action: AUDIT_ACTIONS.AUTH_LOGIN,
        summary: `تسجيل دخول ناجح: ${dto.email}`,
        entityType: 'User',
        entityId: found.id,
        tenantId: found.tenant_id,
        actor: { id: found.id, name: dto.email },
      });

      return { accessToken: access, csrfToken: session.csrfToken };
    });

    await this.registerAttempt(found.id, true);

    void accessToken; // أُرسل في الكوكي — لا يُعاد في الجسم عمدًا.

    const user = await this.buildSessionUser(found.id, found.tenant_id, permissions);

    return { user, csrfToken };
  }

  /**
   * تجديد الجلسة — تدوير مع كشف إعادة الاستخدام.
   */
  async refresh(
    refreshToken: string,
    res: Response,
    context: { ip: string | null; userAgent: string | null },
  ): Promise<LoginResponse> {
    const result = await this.prisma.runUnscoped(async (tx) => {
      const rotation = await this.tokens.rotateRefreshToken(tx, refreshToken, {
        ipAddress: context.ip,
        userAgent: context.userAgent,
      });

      if (rotation.outcome === 'REUSE_DETECTED') {
        // ⚠️ رمز مُبطل استُخدم مجددًا. لا يحدث في الاستخدام الطبيعي.
        // نُبطل العائلة كلها ونسجّل الحادثة.
        const revoked = await this.tokens.revokeFamily(tx, rotation.familyId, 'REUSE_DETECTED');

        const user = await tx.user.findUnique({
          where: { id: rotation.userId },
          select: { tenantId: true, email: true },
        });

        await this.audit.record(tx, {
          action: AUDIT_ACTIONS.AUTH_TOKEN_REUSE_DETECTED,
          summary: `كشف إعادة استخدام رمز تجديد — أُبطلت ${revoked} جلسة.`,
          entityType: 'User',
          entityId: rotation.userId,
          tenantId: user?.tenantId ?? null,
          actor: { id: rotation.userId, name: user?.email ?? null },
        });

        return { kind: 'REUSE' as const };
      }

      if (rotation.outcome === 'INVALID') {
        return { kind: 'INVALID' as const };
      }

      const user = await tx.user.findUnique({
        where: { id: rotation.userId },
        select: {
          id: true,
          tenantId: true,
          storeId: true,
          roleId: true,
          status: true,
          isSuperAdmin: true,
          platformRole: true,
          mustChangePassword: true,
        },
      });

      if (!user || user.status !== 'ACTIVE') {
        return { kind: 'INVALID' as const };
      }

      const supportMode = user.isSuperAdmin && rotation.tenantId !== null;
      const supportStore = supportMode
        ? await tx.store.findFirst({
            where: { tenantId: rotation.tenantId!, isActive: true },
            orderBy: { createdAt: 'asc' },
            select: { id: true },
          })
        : null;
      const permissions = supportMode
        ? permissionsForRole(ROLES.OWNER)
        : await this.resolvePermissionsForUser(tx, user.id, user.isSuperAdmin, user.platformRole);
      const effectiveTenantId = supportMode ? rotation.tenantId : user.tenantId;

      const payload: AccessTokenPayload = {
        sub: user.id,
        tid: effectiveTenantId,
        sid: rotation.sessionId,
        sa: supportMode ? false : user.isSuperAdmin,
        st: supportStore?.id ?? user.storeId,
        perms: permissions,
        pc: user.mustChangePassword,
        sup: supportMode,
      };

      const access = await this.tokens.signAccessToken(payload);

      this.tokens.setAuthCookies(
        res,
        {
          accessToken: access,
          refreshToken: rotation.refreshToken,
          csrfToken: rotation.csrfToken,
        },
        true,
      );

      return {
        kind: 'OK' as const,
        userId: user.id,
        tenantId: effectiveTenantId,
        permissions,
        csrfToken: rotation.csrfToken,
        supportMode,
      };
    });

    if (result.kind === 'REUSE') {
      this.tokens.clearAuthCookies(res);
      throw AppError.tokenReused();
    }
    if (result.kind === 'INVALID') {
      this.tokens.clearAuthCookies(res);
      throw AppError.tokenExpired();
    }

    const user = await this.buildSessionUser(
      result.userId,
      result.tenantId,
      result.permissions,
      result.supportMode,
    );
    return { user, csrfToken: result.csrfToken };
  }

  async logout(sessionId: string, res: Response): Promise<void> {
    await this.prisma.runUnscoped(async (tx) => {
      await this.tokens.revokeSession(tx, sessionId, 'LOGOUT');
      await this.audit.record(tx, {
        action: AUDIT_ACTIONS.AUTH_LOGOUT,
        summary: 'تسجيل خروج.',
        entityType: 'Session',
        entityId: sessionId,
      });
    });
    this.tokens.clearAuthCookies(res);
  }

  /**
   * استعادة كلمة المرور.
   *
   * ⚠️ الرد **موحّد دائمًا** — سواء وُجد البريد أم لا.
   *
   * لو أعدنا 404 عند عدم وجوده، لصار هذا المسار أداة تعداد مستخدمين مجانية:
   * يجرّب المهاجم قائمة بريد ويعرف من مسجّل. الرد الموحّد يغلق الباب.
   *
   * (البريد الفعلي غير مُفعَّل بعد — المرحلة 7. لا نتظاهر بإرساله: نسجّل
   *  النية في سجل التدقيق ونعيد نفس الرسالة.)
   */
  async forgotPassword(email: string): Promise<{ message: string }> {
    const rows = await this.prisma.runUnscoped(
      (tx) => tx.$queryRaw<AuthLookupRow[]>`SELECT * FROM app_auth_lookup(${email}::citext)`,
    );
    const found = rows[0] ?? null;

    if (found) {
      this.logger.log(
        { userId: found.id },
        'طُلبت استعادة كلمة مرور. إرسال البريد مؤجل للمرحلة 7.',
      );
    }

    // نفس الرسالة، ونفس الزمن تقريبًا، في الحالتين.
    return {
      message:
        'إن كان هذا البريد مسجّلًا لدينا، فستصلك رسالة تحتوي على رابط إعادة تعيين كلمة المرور خلال دقائق.',
    };
  }

  /** الجلسة الحالية — يستدعيها /auth/me. */
  async me(): Promise<SessionUser> {
    const ctx = TenantContext.get();
    if (!ctx?.userId) throw AppError.unauthenticated();

    return this.buildSessionUser(ctx.userId, ctx.tenantId, [...ctx.permissions], ctx.supportMode);
  }

  async startSupportSession(
    tenantId: string,
    actor: AccessTokenPayload,
    res: Response,
    context: { ip: string | null; userAgent: string | null },
  ): Promise<LoginResponse> {
    const permissions = permissionsForRole(ROLES.OWNER);
    const result = await this.prisma.runAsPlatform(async (tx) => {
      const [admin, tenant] = await Promise.all([
        tx.user.findUnique({
          where: { id: actor.sub },
          select: { isSuperAdmin: true, platformRole: true, mustChangePassword: true },
        }),
        tx.tenant.findUnique({
          where: { id: tenantId },
          select: {
            id: true,
            name: true,
            status: true,
            stores: {
              where: { isActive: true },
              orderBy: { createdAt: 'asc' },
              take: 1,
              select: { id: true },
            },
          },
        }),
      ]);

      if (
        !admin?.isSuperAdmin ||
        (admin.platformRole !== 'GENERAL_MANAGER' && admin.platformRole !== 'MANAGER')
      ) {
        throw AppError.forbidden('جلسة الدعم متاحة للمدير العام والمدير فقط.');
      }
      if (!tenant) throw AppError.notFound('المحل');
      if (tenant.status === 'CANCELLED') throw AppError.conflict('لا يمكن فتح محل ملغى.');
      const store = tenant.stores[0];
      if (!store) throw AppError.conflict('لا يوجد محل نشط مرتبط بهذا الحساب.');

      await this.tokens.revokeSession(tx, actor.sid, 'SUPPORT_SWITCH');
      const session = await this.tokens.createSession(tx, {
        userId: actor.sub,
        tenantId,
        userAgent: context.userAgent,
        ipAddress: context.ip,
        rememberMe: false,
      });
      const accessToken = await this.tokens.signAccessToken({
        sub: actor.sub,
        tid: tenantId,
        sid: session.sessionId,
        sa: false,
        st: store.id,
        perms: permissions,
        pc: admin.mustChangePassword,
        sup: true,
      });
      await this.audit.record(tx, {
        action: AUDIT_ACTIONS.PLATFORM_SUPPORT_STARTED,
        summary: `بدء جلسة دعم للمحل: ${tenant.name}`,
        entityType: 'Tenant',
        entityId: tenant.id,
        tenantId: null,
        actor: { id: actor.sub, name: null },
      });
      return { session, accessToken };
    });

    this.tokens.setAuthCookies(
      res,
      {
        accessToken: result.accessToken,
        refreshToken: result.session.refreshToken,
        csrfToken: result.session.csrfToken,
      },
      false,
    );

    return {
      user: await this.buildSessionUser(actor.sub, tenantId, permissions, true),
      csrfToken: result.session.csrfToken,
    };
  }

  async exitSupportSession(
    actor: AccessTokenPayload,
    res: Response,
    context: { ip: string | null; userAgent: string | null },
  ): Promise<LoginResponse> {
    if (!actor.sup || !actor.tid) throw AppError.forbidden('لا توجد جلسة دعم نشطة.');
    const supportTenantId = actor.tid;

    // هذه عملية انتقال مصادقة من جلسة دعم (sa=false) إلى جلسة منصة.
    // الاستعلامات مقيّدة بمعرّفات موقعة من رمز الوصول، لذلك لا نستخدم
    // runAsPlatform الذي يرفض جلسة الدعم عمدًا.
    const result = await this.prisma.runUnscoped(async (tx) => {
      const admin = await tx.user.findUnique({
        where: { id: actor.sub },
        select: { isSuperAdmin: true, platformRole: true, mustChangePassword: true },
      });
      if (
        !admin?.isSuperAdmin ||
        (admin.platformRole !== 'GENERAL_MANAGER' && admin.platformRole !== 'MANAGER')
      ) {
        throw AppError.forbidden('جلسة الدعم غير صالحة.');
      }
      const permissions = permissionsForRole(this.platformRoleName(admin.platformRole));
      await this.tokens.revokeSession(tx, actor.sid, 'SUPPORT_EXIT');
      const session = await this.tokens.createSession(tx, {
        userId: actor.sub,
        tenantId: null,
        userAgent: context.userAgent,
        ipAddress: context.ip,
        rememberMe: false,
      });
      const accessToken = await this.tokens.signAccessToken({
        sub: actor.sub,
        tid: null,
        sid: session.sessionId,
        sa: true,
        st: null,
        perms: permissions,
        pc: admin.mustChangePassword,
        sup: false,
      });
      await this.audit.record(tx, {
        action: AUDIT_ACTIONS.PLATFORM_SUPPORT_ENDED,
        summary: 'إنهاء جلسة دعم والعودة إلى لوحة المنصة.',
        entityType: 'Tenant',
        entityId: supportTenantId,
        tenantId: null,
        actor: { id: actor.sub, name: null },
      });
      return { session, accessToken, permissions };
    });

    this.tokens.setAuthCookies(
      res,
      {
        accessToken: result.accessToken,
        refreshToken: result.session.refreshToken,
        csrfToken: result.session.csrfToken,
      },
      false,
    );
    return {
      user: await this.buildSessionUser(actor.sub, null, result.permissions),
      csrfToken: result.session.csrfToken,
    };
  }

  async changeInitialPassword(
    userId: string,
    sessionId: string,
    dto: ChangePasswordRequest,
    res: Response,
  ): Promise<void> {
    const user = await this.prisma.runUnscoped((tx) =>
      tx.user.findUnique({
        where: { id: userId },
        select: { passwordHash: true, mustChangePassword: true },
      }),
    );
    if (!user || !user.mustChangePassword)
      throw AppError.validation('لا توجد كلمة مرور مؤقتة لهذا الحساب.');
    if (!(await this.passwords.verify(user.passwordHash, dto.currentPassword))) {
      throw AppError.validation('كلمة المرور المؤقتة غير صحيحة.');
    }
    const passwordHash = await this.passwords.hash(dto.newPassword);
    await this.prisma.runUnscoped(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: {
          passwordHash,
          mustChangePassword: false,
          passwordChangedAt: new Date(),
        },
      });
      await tx.session.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date(), revokedReason: 'INITIAL_PASSWORD_CHANGED' },
      });
    });
    void sessionId;
    this.tokens.clearAuthCookies(res);
  }

  // ── مساعدات ────────────────────────────────────────────────────────────────

  /**
   * الصلاحيات الفعلية = صلاحيات الدور ± التجاوزات الفردية.
   *
   * نحسبها عند تسجيل الدخول ونضعها في الرمز، فلا نستعلم عنها مع كل طلب.
   * الثمن: تغيير صلاحية موظف يسري عند التجديد التالي (≤15 دقيقة) لا فورًا.
   * مقبول: تغييرات الصلاحيات نادرة، والفارق 15 دقيقة. الإبطال الفوري متاح
   * دائمًا بإنهاء جلسات المستخدم (وهو ما نفعله عند تعطيل الحساب).
   */
  private async resolvePermissions(
    user: AuthLookupRow,
    platformRole: 'GENERAL_MANAGER' | 'MANAGER' | 'EMPLOYEE' | null,
  ): Promise<Permission[]> {
    if (user.is_super_admin) {
      return permissionsForRole(this.platformRoleName(platformRole));
    }
    if (!user.tenant_id) return [];

    return this.prisma.runInTenant(user.tenant_id, (tx) =>
      this.resolvePermissionsForUser(tx, user.id, false),
    );
  }

  private async resolvePermissionsForUser(
    tx: TxClient,
    userId: string,
    isSuperAdmin: boolean,
    platformRole: 'GENERAL_MANAGER' | 'MANAGER' | 'EMPLOYEE' | null = null,
  ): Promise<Permission[]> {
    if (isSuperAdmin) {
      return permissionsForRole(this.platformRoleName(platformRole));
    }

    const user = await tx.user.findUnique({
      where: { id: userId },
      select: {
        role: { select: { name: true } },
        permissions: { select: { permissionKey: true, granted: true } },
      },
    });

    if (!user?.role) return [];

    const fromRole = new Set(permissionsForRole(user.role.name as RoleName));

    // التجاوزات الفردية: تُضيف أو **تسحب**.
    for (const override of user.permissions) {
      if (override.granted) {
        fromRole.add(override.permissionKey as Permission);
      } else {
        fromRole.delete(override.permissionKey as Permission);
      }
    }

    return [...fromRole];
  }

  private async buildSessionUser(
    userId: string,
    tenantId: string | null,
    permissions: Permission[],
    supportMode = false,
  ): Promise<SessionUser> {
    if (supportMode && tenantId) {
      return this.buildSupportSessionUser(userId, tenantId, permissions);
    }
    // المدير العام: لا مستأجر ولا محل.
    if (!tenantId) {
      const admin = await this.prisma.runUnscoped((tx) =>
        tx.user.findUnique({
          where: { id: userId },
          select: {
            id: true,
            email: true,
            name: true,
            avatarUrl: true,
            locale: true,
            isSuperAdmin: true,
            platformRole: true,
            mustChangePassword: true,
            totpEnabled: true,
          },
        }),
      );
      if (!admin) throw AppError.unauthenticated();

      return {
        id: admin.id,
        email: admin.email,
        name: admin.name,
        avatarUrl: admin.avatarUrl,
        role: this.platformRoleName(admin.platformRole),
        permissions,
        locale: admin.locale,
        isSuperAdmin: true,
        supportMode: false,
        mustChangePassword: admin.mustChangePassword,
        twoFactorEnabled: admin.totpEnabled,
        tenant: null,
        store: null,
      } as SessionUser;
    }

    const user = await this.prisma.runInTenant(tenantId, (tx) =>
      tx.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          name: true,
          avatarUrl: true,
          locale: true,
          isSuperAdmin: true,
          mustChangePassword: true,
          totpEnabled: true,
          role: { select: { name: true } },
          tenant: { select: { id: true, name: true, slug: true, status: true } },
          store: {
            select: { id: true, code: true, name: true, currency: true, logoUrl: true },
          },
        },
      }),
    );

    if (!user) throw AppError.unauthenticated();

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      role: user.role?.name ?? ROLES.VIEWER,
      permissions,
      locale: user.locale,
      isSuperAdmin: user.isSuperAdmin,
      supportMode: false,
      mustChangePassword: user.mustChangePassword,
      twoFactorEnabled: user.totpEnabled,
      tenant: user.tenant,
      store: user.store,
    } as SessionUser;
  }

  private async buildSupportSessionUser(
    adminId: string,
    tenantId: string,
    permissions: Permission[],
  ): Promise<SessionUser> {
    const [admin, tenant] = await Promise.all([
      this.prisma.runUnscoped((tx) =>
        tx.user.findUnique({
          where: { id: adminId },
          select: {
            id: true,
            email: true,
            name: true,
            avatarUrl: true,
            locale: true,
            platformRole: true,
            mustChangePassword: true,
            totpEnabled: true,
          },
        }),
      ),
      this.prisma.runInTenant(tenantId, (tx) =>
        tx.tenant.findUnique({
          where: { id: tenantId },
          select: {
            id: true,
            name: true,
            slug: true,
            status: true,
            stores: {
              where: { isActive: true },
              orderBy: { createdAt: 'asc' },
              take: 1,
              select: { id: true, code: true, name: true, currency: true, logoUrl: true },
            },
          },
        }),
      ),
    ]);
    if (!admin || !tenant || !tenant.stores[0])
      throw AppError.unauthenticated();

    const { stores, ...tenantInfo } = tenant;
    return {
      id: admin.id,
      email: admin.email,
      name: admin.name,
      avatarUrl: admin.avatarUrl,
      role: this.platformRoleName(admin.platformRole),
      permissions,
      locale: admin.locale,
      isSuperAdmin: false,
      supportMode: true,
      mustChangePassword: admin.mustChangePassword,
      twoFactorEnabled: admin.totpEnabled,
      tenant: tenantInfo,
      store: stores[0],
    } as SessionUser;
  }

  private platformRoleName(role: 'GENERAL_MANAGER' | 'MANAGER' | 'EMPLOYEE' | null): RoleName {
    if (role === 'MANAGER') return ROLES.PLATFORM_MANAGER;
    if (role === 'EMPLOYEE') return ROLES.PLATFORM_EMPLOYEE;
    return ROLES.SUPER_ADMIN;
  }

  /** عدّاد المحاولات + القفل — عبر دالة SECURITY DEFINER (RLS لا تسمح بغيرها). */
  private async registerAttempt(userId: string, success: boolean): Promise<void> {
    const threshold = this.env.get('AUTH_LOCKOUT_THRESHOLD');
    const minutes = this.env.get('AUTH_LOCKOUT_MINUTES');

    await this.prisma.runUnscoped(
      (tx) =>
        // ⚠️ `::int` إلزامي: Prisma يمرّر أرقام JS كـbigint (int8)، والدالة
        //    تتوقع integer (int4). بلا التحويل يفشل حلّ الدالة (42883).
        tx.$executeRaw`SELECT app_auth_record_attempt(${userId}::uuid, ${success}, ${threshold}::int, ${minutes}::int)`,
    );
  }

  /**
   * يسجّل محاولة فاشلة في سجل التدقيق.
   *
   * ⚠️ لا نسجّل كلمة المرور المُدخلة إطلاقًا — خطأ شائع وكارثي: المستخدم
   *    يخطئ ويكتب كلمة مرور حسابه الآخر، فتُخزَّن نصًا صريحًا في سجل يقرأه
   *    صاحب المحل.
   */
  private async recordFailedLogin(
    userId: string | null,
    email: string,
    reason: string,
  ): Promise<void> {
    try {
      await this.prisma.runUnscoped((tx) =>
        this.audit.record(tx, {
          action: AUDIT_ACTIONS.AUTH_LOGIN_FAILED,
          summary: `محاولة دخول فاشلة (${reason}): ${email}`,
          entityType: 'User',
          entityId: userId ?? undefined,
          tenantId: null,
          actor: { id: userId, name: email },
        }),
      );
    } catch (error) {
      // فشل التسجيل لا يجوز أن يغيّر رد المصادقة (وإلا صار قناة جانبية).
      this.logger.error({ err: error }, 'تعذّر تسجيل محاولة الدخول الفاشلة.');
    }
  }
}
