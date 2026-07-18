import { Injectable } from '@nestjs/common';
import type { AuditListQuery, AuditLog, PaginatedResult } from '@oh/contracts';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import { TenantContext } from '../../core/tenancy/tenant-context.js';

/**
 * قراءة سجل التدقيق (شاشة «سجل النشاط» وتبويبات النشاط).
 *
 * قراءة فقط — لا كتابة ولا تعديل عبر الـAPI. الكتابة تحدث داخل الخادم ضمن
 * معاملات العمليات (AuditService)، والسجل append-only + سلسلة هاش.
 *
 * تحت سياق المستأجر (RLS)، فلا يرى مستأجر سجل آخر.
 */
@Injectable()
export class AuditQueryService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: AuditListQuery): Promise<PaginatedResult<AuditLog>> {
    const tenantId = TenantContext.requireTenantId();

    return this.prisma.runInTenant(tenantId, async (tx) => {
      const where: Prisma.AuditLogWhereInput = {
        ...(query.action ? { action: query.action } : {}),
        ...(query.actorId ? { actorId: query.actorId } : {}),
        ...(query.entityType ? { entityType: query.entityType } : {}),
        ...(query.from || query.to
          ? {
              createdAt: {
                ...(query.from ? { gte: new Date(query.from) } : {}),
                ...(query.to ? { lte: new Date(`${query.to}T23:59:59.999Z`) } : {}),
              },
            }
          : {}),
      };

      const [total, rows] = await Promise.all([
        tx.auditLog.count({ where }),
        tx.auditLog.findMany({
          where,
          orderBy: { seq: 'desc' },
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
        }),
      ]);

      return {
        items: rows.map((row) => this.toDto(row)),
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
      };
    });
  }

  /** نشاط كيان محدد — لتبويب «النشاط» في ملف الزبون / تفاصيل الطلب. */
  async forEntity(
    entityType: string,
    entityId: string,
    limit = 50,
  ): Promise<AuditLog[]> {
    const tenantId = TenantContext.requireTenantId();

    return this.prisma.runInTenant(tenantId, async (tx) => {
      const rows = await tx.auditLog.findMany({
        where: { entityType, entityId },
        orderBy: { seq: 'desc' },
        take: limit,
      });
      return rows.map((row) => this.toDto(row));
    });
  }

  private toDto(row: {
    id: string;
    seq: bigint;
    action: string;
    entityType: string | null;
    entityId: string | null;
    actorId: string | null;
    actorName: string | null;
    actorIp: string | null;
    summary: string;
    createdAt: Date;
  }): AuditLog {
    return {
      id: row.id,
      seq: row.seq.toString(),
      action: row.action,
      entityType: row.entityType,
      entityId: row.entityId,
      actorId: row.actorId,
      actorName: row.actorName,
      actorIp: row.actorIp,
      summary: row.summary,
      createdAt: row.createdAt.toISOString(),
    } as AuditLog;
  }
}
