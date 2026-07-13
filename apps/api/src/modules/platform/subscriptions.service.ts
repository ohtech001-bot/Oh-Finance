import { Injectable } from '@nestjs/common';
import { AUDIT_ACTIONS, type Subscription, type SubscriptionUsage } from '@oh/contracts';
import { toMoneyString } from '@oh/money';
import { AppError } from '../../core/errors/app-error.js';
import { AuditService } from '../../core/audit/audit.service.js';
import { PrismaService, type TxClient } from '../../core/prisma/prisma.service.js';

@Injectable()
export class SubscriptionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** تفاصيل اشتراك محل — يستدعيه المدير العام. */
  async findByTenant(tenantId: string): Promise<Subscription> {
    return this.prisma.runAsPlatform((tx) => this.load(tx, tenantId));
  }

  /**
   * اشتراك المحل الحالي — يستدعيه صاحب المحل (شاشة «إدارة الاشتراك»).
   * السياق مستأجر، وسياسة `self_read` في RLS تسمح بقراءة اشتراكه هو فقط.
   */
  async findForCurrentTenant(tenantId: string): Promise<Subscription> {
    return this.prisma.runInTenant(tenantId, (tx) => this.load(tx, tenantId));
  }

  async changePlan(
    tenantId: string,
    planId: string,
    actorName: string,
  ): Promise<Subscription> {
    await this.prisma.runAsPlatform(async (tx) => {
      const subscription = await tx.subscription.findFirst({
        where: { tenantId, status: { in: ['ACTIVE', 'TRIALING'] } },
        include: { plan: true },
      });
      if (!subscription) throw AppError.notFound('الاشتراك النشط');

      const plan = await tx.plan.findUnique({ where: { id: planId } });
      if (!plan) throw AppError.notFound('الباقة');
      if (!plan.isActive) throw AppError.validation('الباقة غير مفعّلة.');

      await tx.subscription.update({
        where: { id: subscription.id },
        data: { planId },
      });

      await this.audit.record(tx, {
        action: AUDIT_ACTIONS.SUBSCRIPTION_PLAN_CHANGED,
        summary: `تغيير الباقة من "${subscription.plan.nameAr}" إلى "${plan.nameAr}".`,
        entityType: 'Subscription',
        entityId: subscription.id,
        tenantId: null,
        before: { planCode: subscription.plan.code },
        after: { planCode: plan.code },
        actor: { id: null, name: actorName },
      });
    });

    return this.findByTenant(tenantId);
  }

  private async load(tx: TxClient, tenantId: string): Promise<Subscription> {
    const subscription = await tx.subscription.findFirst({
      where: { tenantId, status: { in: ['ACTIVE', 'TRIALING', 'PAST_DUE'] } },
      include: { plan: true, tenant: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    });

    if (!subscription) throw AppError.notFound('الاشتراك');

    const usage = await this.computeUsage(tx, tenantId, subscription.plan);

    return {
      id: subscription.id,
      tenantId: subscription.tenantId,
      tenantName: subscription.tenant.name,
      plan: {
        id: subscription.plan.id,
        code: subscription.plan.code,
        nameAr: subscription.plan.nameAr,
        nameHe: subscription.plan.nameHe,
        nameEn: subscription.plan.nameEn,
        priceMonthly: toMoneyString(subscription.plan.priceMonthly.toString(), 2),
        currency: subscription.plan.currency,
        maxStores: subscription.plan.maxStores,
        maxUsers: subscription.plan.maxUsers,
        maxCustomers: subscription.plan.maxCustomers,
        maxOrdersPerMonth: subscription.plan.maxOrdersPerMonth,
        maxStorageMb: subscription.plan.maxStorageMb,
        isActive: subscription.plan.isActive,
        createdAt: subscription.plan.createdAt.toISOString(),
      },
      status: subscription.status,
      startedAt: subscription.startedAt.toISOString(),
      currentPeriodStart: subscription.currentPeriodStart.toISOString(),
      currentPeriodEnd: subscription.currentPeriodEnd.toISOString(),
      trialEndsAt: subscription.trialEndsAt?.toISOString() ?? null,
      cancelledAt: subscription.cancelledAt?.toISOString() ?? null,
      usage,
    } as Subscription;
  }

  /**
   * عدّادات استخدام الباقة (أشرطة التقدم في شاشة الاشتراك).
   *
   * الزبائن والطلبات = 0 في المرحلة 1 — جداولهما غير موجودة بعد.
   * لا نخترع أرقامًا: الصفر هنا **صحيح** (لا يوجد زبون واحد فعلًا)، وليس
   * قيمة نائبة. الواجهة تعرضه كما هو.
   */
  private async computeUsage(
    tx: TxClient,
    tenantId: string,
    plan: {
      maxStores: number;
      maxUsers: number;
      maxCustomers: number;
      maxOrdersPerMonth: number;
      maxStorageMb: number;
    },
  ): Promise<SubscriptionUsage> {
    const [stores, users] = await Promise.all([
      tx.store.count({ where: { tenantId } }),
      tx.user.count({ where: { tenantId } }),
    ]);

    return {
      stores: { used: stores, limit: plan.maxStores },
      users: { used: users, limit: plan.maxUsers },
      // تُربط فعليًا في المرحلة 4 عند إنشاء جدولي customers و orders.
      customers: { used: 0, limit: plan.maxCustomers },
      ordersThisMonth: { used: 0, limit: plan.maxOrdersPerMonth },
      storageMb: { used: 0, limit: plan.maxStorageMb },
    };
  }
}
