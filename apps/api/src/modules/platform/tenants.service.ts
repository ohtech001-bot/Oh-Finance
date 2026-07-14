import { Injectable, Logger } from '@nestjs/common';
import {
  AUDIT_ACTIONS,
  type CreateTenantRequest,
  type PaginatedResult,
  type PlatformStats,
  type SetTenantStatusRequest,
  type Tenant,
  type TenantDetail,
  type TenantListQuery,
  type UpdateTenantRequest,
} from '@oh/contracts';
import {
  ROLES,
  ROLE_DESCRIPTIONS,
  TENANT_ROLES,
  permissionsForRole,
  type RoleName,
} from '@oh/config';
import { toMoneyString, sum, zero } from '@oh/money';
import type { Prisma } from '@prisma/client';
import { AppError } from '../../core/errors/app-error.js';
import { AuditService } from '../../core/audit/audit.service.js';
import { PrismaService, type TxClient } from '../../core/prisma/prisma.service.js';
import { PasswordService } from '../auth/password.service.js';

@Injectable()
export class TenantsService {
  private readonly logger = new Logger(TenantsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly audit: AuditService,
  ) {}

  /**
   * ═══════════════════════════════════════════════════════════════════════
   *  إنشاء محل جديد (المتطلب 1) — عملية ذرّية واحدة.
   * ═══════════════════════════════════════════════════════════════════════
   *
   *  تُنشئ في معاملة واحدة:
   *    المستأجر → المحل → الفرع الرئيسي → الأدوار النظامية الأربعة
   *    → صلاحيات كل دور → صاحب المحل → الاشتراك
   *
   *  ── لماذا معاملة واحدة؟ ────────────────────────────────────────────────
   *  لو انقسمت إلى خطوات مستقلة، لأنتج أي فشل جزئي حالةً فاسدة يستحيل
   *  إصلاحها من الواجهة:
   *    • مستأجر بلا صاحب  → محل لا يستطيع أحد الدخول إليه، ولا حذفه.
   *    • مستأجر بلا أدوار → صاحب بلا صلاحيات، مقفل خارج محله.
   *    • محل بلا اشتراك   → يعمل مجانًا للأبد.
   *
   *  فشل أي خطوة ⇒ تراجع الكل. لا حالة وسطى.
   */
  async create(dto: CreateTenantRequest, actorName: string): Promise<TenantDetail> {
    const plan = await this.prisma.runAsPlatform((tx) =>
      tx.plan.findUnique({ where: { id: dto.planId } }),
    );
    if (!plan) throw AppError.notFound('الباقة');
    if (!plan.isActive) throw AppError.validation('الباقة غير مفعّلة.');

    const passwordHash = await this.passwords.hash(dto.ownerPassword);

    const tenantId = await this.prisma.runAsPlatform(async (tx) => {
      // ── تفرّد المعرّف والبريد ──────────────────────────────────────────
      const existingSlug = await tx.tenant.findUnique({ where: { slug: dto.slug } });
      if (existingSlug) {
        throw AppError.conflict(`المعرّف "${dto.slug}" مستخدم لمحل آخر.`);
      }

      const existingEmail = await tx.user.findUnique({ where: { email: dto.ownerEmail } });
      if (existingEmail) {
        throw AppError.conflict('البريد الإلكتروني مستخدم لحساب آخر.');
      }

      // ── 1) المستأجر ────────────────────────────────────────────────────
      const tenant = await tx.tenant.create({
        data: {
          name: dto.name,
          slug: dto.slug,
          locale: dto.locale,
          currency: dto.currency,
          timezone: dto.timezone,
          status: dto.trialDays > 0 ? 'TRIAL' : 'ACTIVE',
        },
      });

      // ── 2) المحل ───────────────────────────────────────────────────────
      const storeCode = await this.nextStoreCode(tx);
      const store = await tx.store.create({
        data: {
          tenantId: tenant.id,
          code: storeCode,
          name: dto.storeName,
          phone: dto.storePhone || null,
          email: dto.storeEmail || null,
          address: dto.storeAddress || null,
          city: dto.storeCity || null,
          currency: dto.currency,
          settings: {},
        },
      });

      // ── 3) الفرع الرئيسي ───────────────────────────────────────────────
      await tx.branch.create({
        data: {
          tenantId: tenant.id,
          storeId: store.id,
          code: 'MAIN',
          name: 'الفرع الرئيسي',
          phone: dto.storePhone || null,
          address: dto.storeAddress || null,
          city: dto.storeCity || null,
          isMain: true,
        },
      });

      // ── 4) الأدوار النظامية + صلاحياتها ────────────────────────────────
      const roleIds = new Map<RoleName, string>();
      for (const roleName of TENANT_ROLES) {
        const role = await tx.role.create({
          data: {
            tenantId: tenant.id,
            name: roleName,
            description: ROLE_DESCRIPTIONS[roleName],
            isSystem: true,
          },
        });
        roleIds.set(roleName, role.id);

        const permissions = permissionsForRole(roleName);
        if (permissions.length > 0) {
          await tx.rolePermission.createMany({
            data: permissions.map((permissionKey) => ({
              roleId: role.id,
              permissionKey,
              tenantId: tenant.id,
            })),
          });
        }
      }

      const ownerRoleId = roleIds.get(ROLES.OWNER);
      if (!ownerRoleId) {
        throw AppError.internal('تعذّر إنشاء دور صاحب المحل.');
      }

      // ── 5) صاحب المحل ──────────────────────────────────────────────────
      const owner = await tx.user.create({
        data: {
          tenantId: tenant.id,
          storeId: store.id,
          roleId: ownerRoleId,
          email: dto.ownerEmail,
          name: dto.ownerName,
          phone: dto.ownerPhone || null,
          passwordHash,
          locale: dto.locale,
          isSuperAdmin: false,
          status: 'ACTIVE',
          passwordChangedAt: new Date(),
        },
      });

      // ── 6) الاشتراك ────────────────────────────────────────────────────
      const now = new Date();
      const periodEnd = new Date(now);
      periodEnd.setMonth(periodEnd.getMonth() + 1);

      const trialEndsAt =
        dto.trialDays > 0
          ? new Date(now.getTime() + dto.trialDays * 24 * 60 * 60 * 1000)
          : null;

      await tx.subscription.create({
        data: {
          tenantId: tenant.id,
          planId: plan.id,
          status: dto.trialDays > 0 ? 'TRIALING' : 'ACTIVE',
          startedAt: now,
          currentPeriodStart: now,
          currentPeriodEnd: trialEndsAt ?? periodEnd,
          trialEndsAt,
        },
      });

      // ── 7) التدقيق (داخل نفس المعاملة) ─────────────────────────────────
      await this.audit.record(tx, {
        action: AUDIT_ACTIONS.TENANT_CREATED,
        summary: `إنشاء محل "${dto.name}" (${storeCode}) بباقة ${plan.nameAr} — صاحب المحل: ${dto.ownerEmail}`,
        entityType: 'Tenant',
        entityId: tenant.id,
        tenantId: null, // حدث منصة
        after: {
          tenantId: tenant.id,
          slug: dto.slug,
          storeCode,
          ownerEmail: dto.ownerEmail,
          ownerId: owner.id,
          planCode: plan.code,
          trialDays: dto.trialDays,
        },
        actor: { id: null, name: actorName },
      });

      return tenant.id;
    });

    this.logger.log({ tenantId, slug: dto.slug }, 'أُنشئ محل جديد.');

    const detail = await this.findOne(tenantId);
    if (!detail) throw AppError.internal('تعذّر قراءة المحل بعد إنشائه.');
    return detail;
  }

  async list(query: TenantListQuery): Promise<PaginatedResult<Tenant>> {
    return this.prisma.runAsPlatform(async (tx) => {
      // النوع صريح: بناء `where` بـspread يجعل TS يستنتج نوعًا واسعًا،
      // فينكسر استنتاج نتيجة findMany ويختفي `_count` و`include` من النوع.
      const where: Prisma.TenantWhereInput = {
        ...(query.status ? { status: query.status } : {}),
        ...(query.search
          ? {
              OR: [
                { name: { contains: query.search, mode: 'insensitive' } },
                { slug: { contains: query.search, mode: 'insensitive' } },
              ],
            }
          : {}),
        ...(query.planId
          ? {
              subscriptions: {
                some: { planId: query.planId, status: { in: ['ACTIVE', 'TRIALING'] } },
              },
            }
          : {}),
      };

      const [total, rows] = await Promise.all([
        tx.tenant.count({ where }),
        tx.tenant.findMany({
          where,
          orderBy: { [query.sortBy]: query.sortOrder } as Prisma.TenantOrderByWithRelationInput,
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
          include: {
            _count: { select: { stores: true, users: true } },
            users: {
              where: { role: { name: ROLES.OWNER } },
              select: { name: true, email: true },
              take: 1,
            },
            subscriptions: {
              where: { status: { in: ['ACTIVE', 'TRIALING'] } },
              include: { plan: { select: { nameAr: true } } },
              take: 1,
            },
          },
        }),
      ]);

      const items: Tenant[] = rows.map((row) => {
        const subscription = row.subscriptions[0];
        const owner = row.users[0];

        return {
          id: row.id,
          slug: row.slug,
          name: row.name,
          status: row.status,
          locale: row.locale,
          currency: row.currency,
          timezone: row.timezone,
          ownerEmail: owner?.email ?? null,
          ownerName: owner?.name ?? null,
          storeCount: row._count.stores,
          userCount: row._count.users,
          planName: subscription?.plan.nameAr ?? null,
          subscriptionStatus: subscription?.status ?? null,
          subscriptionEndsAt: subscription?.currentPeriodEnd.toISOString() ?? null,
          createdAt: row.createdAt.toISOString(),
        } as Tenant;
      });

      return {
        items,
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
      };
    });
  }

  async findOne(id: string): Promise<TenantDetail | null> {
    return this.prisma.runAsPlatform(async (tx) => {
      const row = await tx.tenant.findUnique({
        where: { id },
        include: {
          _count: { select: { stores: true, users: true } },
          users: {
            where: { role: { name: ROLES.OWNER } },
            select: { name: true, email: true },
            take: 1,
          },
          subscriptions: {
            where: { status: { in: ['ACTIVE', 'TRIALING'] } },
            include: { plan: { select: { nameAr: true } } },
            take: 1,
          },
          stores: {
            include: { _count: { select: { branches: true } } },
            orderBy: { createdAt: 'asc' },
          },
        },
      });

      if (!row) return null;

      const subscription = row.subscriptions[0];
      const owner = row.users[0];

      return {
        id: row.id,
        slug: row.slug,
        name: row.name,
        status: row.status,
        locale: row.locale,
        currency: row.currency,
        timezone: row.timezone,
        ownerEmail: owner?.email ?? null,
        ownerName: owner?.name ?? null,
        storeCount: row._count.stores,
        userCount: row._count.users,
        planName: subscription?.plan.nameAr ?? null,
        subscriptionStatus: subscription?.status ?? null,
        subscriptionEndsAt: subscription?.currentPeriodEnd.toISOString() ?? null,
        createdAt: row.createdAt.toISOString(),
        stores: row.stores.map((store) => ({
          id: store.id,
          code: store.code,
          name: store.name,
          phone: store.phone,
          city: store.city,
          currency: store.currency,
          isActive: store.isActive,
          branchCount: store._count.branches,
        })),
      } as TenantDetail;
    });
  }

  async update(id: string, dto: UpdateTenantRequest, actorName: string): Promise<TenantDetail> {
    await this.prisma.runAsPlatform(async (tx) => {
      const before = await tx.tenant.findUnique({ where: { id } });
      if (!before) throw AppError.notFound('المحل');

      const after = await tx.tenant.update({ where: { id }, data: dto });

      await this.audit.record(tx, {
        action: AUDIT_ACTIONS.TENANT_UPDATED,
        summary: `تعديل بيانات المحل "${after.name}".`,
        entityType: 'Tenant',
        entityId: id,
        tenantId: null,
        before: { name: before.name, locale: before.locale, currency: before.currency },
        after: { name: after.name, locale: after.locale, currency: after.currency },
        actor: { id: null, name: actorName },
      });
    });

    const detail = await this.findOne(id);
    if (!detail) throw AppError.notFound('المحل');
    return detail;
  }

  /**
   * تغيير حالة المحل (إيقاف/تفعيل).
   *
   * الإيقاف يُبطل **كل جلسات** مستخدمي المحل فورًا — لا ينتظر انتهاء رموزهم.
   * بدون هذا، موظف يحمل رمزًا صالحًا يظل يعمل حتى 15 دقيقة بعد الإيقاف.
   */
  async setStatus(
    id: string,
    dto: SetTenantStatusRequest,
    actorName: string,
  ): Promise<TenantDetail> {
    await this.prisma.runAsPlatform(async (tx) => {
      const before = await tx.tenant.findUnique({ where: { id } });
      if (!before) throw AppError.notFound('المحل');

      const suspending = dto.status === 'SUSPENDED' || dto.status === 'CANCELLED';

      await tx.tenant.update({
        where: { id },
        data: {
          status: dto.status,
          suspendedAt: suspending ? new Date() : null,
        },
      });

      if (suspending) {
        const revoked = await tx.session.updateMany({
          where: { tenantId: id, revokedAt: null },
          data: { revokedAt: new Date(), revokedReason: 'TENANT_SUSPENDED' },
        });
        this.logger.warn({ tenantId: id, revoked: revoked.count }, 'أُوقف محل — أُبطلت جلساته.');
      }

      await this.audit.record(tx, {
        action: AUDIT_ACTIONS.TENANT_STATUS_CHANGED,
        summary: `تغيير حالة المحل "${before.name}" من ${before.status} إلى ${dto.status}. السبب: ${dto.reason}`,
        entityType: 'Tenant',
        entityId: id,
        tenantId: null,
        before: { status: before.status },
        after: { status: dto.status, reason: dto.reason },
        actor: { id: null, name: actorName },
      });
    });

    const detail = await this.findOne(id);
    if (!detail) throw AppError.notFound('المحل');
    return detail;
  }

  /** إحصاءات لوحة المدير العام. */
  async stats(): Promise<PlatformStats> {
    return this.prisma.runAsPlatform(async (tx) => {
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);

      const [total, active, trial, suspended, users, activeSubs, newThisMonth] = await Promise.all([
        tx.tenant.count(),
        tx.tenant.count({ where: { status: 'ACTIVE' } }),
        tx.tenant.count({ where: { status: 'TRIAL' } }),
        tx.tenant.count({ where: { status: 'SUSPENDED' } }),
        tx.user.count({ where: { isSuperAdmin: false } }),
        tx.subscription.findMany({
          where: { status: 'ACTIVE' },
          select: { plan: { select: { priceMonthly: true, currency: true } } },
        }),
        tx.tenant.count({ where: { createdAt: { gte: monthStart } } }),
      ]);

      // الإيراد الشهري المتكرر — بـDecimal، لا بجمع أرقام عائمة.
      const mrr = activeSubs.length
        ? sum(activeSubs.map((s) => s.plan.priceMonthly.toString()))
        : zero();

      return {
        totalTenants: total,
        activeTenants: active,
        trialTenants: trial,
        suspendedTenants: suspended,
        totalUsers: users,
        mrr: toMoneyString(mrr, 2),
        currency: activeSubs[0]?.plan.currency ?? 'ILS',
        newTenantsThisMonth: newThisMonth,
      } as PlatformStats;
    });
  }

  /**
   * رقم المحل التالي ("1001", "1002"...) — الرقم الظاهر في الشريط العلوي.
   *
   * `FOR UPDATE` ضمنيًا عبر معاملة + max: كافٍ هنا لأن إنشاء المحلات نادر
   * ويجري داخل معاملة المدير العام. (الترقيم عالي التزامن — الطلبات والدفعات —
   * سيستخدم `tenant_counters` مع UPDATE...RETURNING في المرحلة 4.)
   */
  private async nextStoreCode(tx: TxClient): Promise<string> {
    const rows = await tx.$queryRaw<{ max_code: number | null }[]>`
      SELECT MAX(NULLIF(regexp_replace(code, '\\D', '', 'g'), '')::int) AS max_code
      FROM stores
    `;
    const current = rows[0]?.max_code ?? 1000;
    return String(current + 1);
  }
}
