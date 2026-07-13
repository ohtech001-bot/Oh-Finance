import { Injectable } from '@nestjs/common';
import {
  AUDIT_ACTIONS,
  type CreatePlanRequest,
  type Plan,
  type UpdatePlanRequest,
} from '@oh/contracts';
import { toMoneyString } from '@oh/money';
import { AppError } from '../../core/errors/app-error.js';
import { AuditService } from '../../core/audit/audit.service.js';
import { PrismaService } from '../../core/prisma/prisma.service.js';

/** Prisma يُرجع Decimal — نحوّله إلى نص قبل الخروج عبر الـAPI. */
type PlanRow = {
  id: string;
  code: string;
  nameAr: string;
  nameHe: string;
  nameEn: string;
  priceMonthly: { toString(): string };
  currency: string;
  maxStores: number;
  maxUsers: number;
  maxCustomers: number;
  maxOrdersPerMonth: number;
  maxStorageMb: number;
  isActive: boolean;
  createdAt: Date;
};

@Injectable()
export class PlansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * قائمة الباقات.
   *
   * `includeInactive` للمدير العام فقط. المحل يرى الباقات النشطة (شاشة الترقية)
   * — وسياسة RLS `read_active` تفرض ذلك في القاعدة أيضًا، لا هنا فقط.
   */
  async list(includeInactive = false): Promise<Plan[]> {
    const run = includeInactive
      ? this.prisma.runAsPlatform.bind(this.prisma)
      : this.prisma.runUnscoped.bind(this.prisma);

    const rows = await run(async (tx) =>
      tx.plan.findMany({
        where: includeInactive ? {} : { isActive: true },
        orderBy: { priceMonthly: 'asc' },
      }),
    );

    return (rows as PlanRow[]).map((row) => this.toDto(row));
  }

  async create(dto: CreatePlanRequest, actorName: string): Promise<Plan> {
    const row = await this.prisma.runAsPlatform(async (tx) => {
      const existing = await tx.plan.findUnique({ where: { code: dto.code } });
      if (existing) throw AppError.conflict(`رمز الباقة "${dto.code}" مستخدم.`);

      const created = await tx.plan.create({
        data: {
          code: dto.code,
          nameAr: dto.nameAr,
          nameHe: dto.nameHe,
          nameEn: dto.nameEn,
          // نص → Decimal. Prisma يقبل النص ويحوّله بلا مرور عبر float.
          priceMonthly: dto.priceMonthly,
          currency: dto.currency,
          maxStores: dto.maxStores,
          maxUsers: dto.maxUsers,
          maxCustomers: dto.maxCustomers,
          maxOrdersPerMonth: dto.maxOrdersPerMonth,
          maxStorageMb: dto.maxStorageMb,
          isActive: dto.isActive,
        },
      });

      await this.audit.record(tx, {
        action: AUDIT_ACTIONS.PLAN_CREATED,
        summary: `إنشاء باقة "${dto.nameAr}" (${dto.code}) بسعر ${dto.priceMonthly} ${dto.currency}.`,
        entityType: 'Plan',
        entityId: created.id,
        tenantId: null,
        after: { code: dto.code, priceMonthly: dto.priceMonthly },
        actor: { id: null, name: actorName },
      });

      return created;
    });

    return this.toDto(row as PlanRow);
  }

  async update(id: string, dto: UpdatePlanRequest, actorName: string): Promise<Plan> {
    const row = await this.prisma.runAsPlatform(async (tx) => {
      const before = await tx.plan.findUnique({ where: { id } });
      if (!before) throw AppError.notFound('الباقة');

      const updated = await tx.plan.update({ where: { id }, data: dto });

      await this.audit.record(tx, {
        action: AUDIT_ACTIONS.PLAN_UPDATED,
        summary: `تعديل الباقة "${updated.nameAr}".`,
        entityType: 'Plan',
        entityId: id,
        tenantId: null,
        before: { priceMonthly: before.priceMonthly.toString(), isActive: before.isActive },
        after: { priceMonthly: updated.priceMonthly.toString(), isActive: updated.isActive },
        actor: { id: null, name: actorName },
      });

      return updated;
    });

    return this.toDto(row as PlanRow);
  }

  private toDto(row: PlanRow): Plan {
    return {
      id: row.id,
      code: row.code,
      nameAr: row.nameAr,
      nameHe: row.nameHe,
      nameEn: row.nameEn,
      // ⚠️ Decimal → نص. لو أعدناه رقمًا لفقد الدقة على حدود JSON.
      priceMonthly: toMoneyString(row.priceMonthly.toString(), 2),
      currency: row.currency,
      maxStores: row.maxStores,
      maxUsers: row.maxUsers,
      maxCustomers: row.maxCustomers,
      maxOrdersPerMonth: row.maxOrdersPerMonth,
      maxStorageMb: row.maxStorageMb,
      isActive: row.isActive,
      createdAt: row.createdAt.toISOString(),
    } as Plan;
  }
}
