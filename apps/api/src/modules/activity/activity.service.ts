import { Injectable } from '@nestjs/common';
import type {
  ActivityCategory,
  ActivityItem,
  ActivityQuery,
  PaginatedResult,
} from '@oh/contracts';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import { TenantContext } from '../../core/tenancy/tenant-context.js';

/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  موجز النشاط — مصدر تجميع واحد للوحة التحكم وصفحة الزبون.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  المصدر: سجل التدقيق (append-only). لا بيانات وهمية — كل عنصر حدث جرى فعلًا،
 *  بفاعله ووقته من نفس القيد.
 *
 *  نطاقان بنفس المنطق:
 *    • بلا customerId → نشاط المحل كله (لوحة التحكم).
 *    • مع customerId  → خطّ الزبون: أحداثه + أحداث طلباته + أحداث دفعاته.
 *
 *  التجميع كله بالخادم مع ترقيم صفحات — لا نحمّل السجل للواجهة ونفلتر محليًا.
 */

const PREFIX_TO_CATEGORY: Record<string, ActivityCategory> = {
  order: 'ORDER',
  payment: 'PAYMENT',
  customer: 'CUSTOMER',
  ledger: 'LEDGER',
};

const CATEGORY_PREFIX: Record<ActivityCategory, string | null> = {
  ORDER: 'order.',
  PAYMENT: 'payment.',
  CUSTOMER: 'customer.',
  LEDGER: 'ledger.',
  SYSTEM: null,
};

const BUSINESS_PREFIXES = ['order.', 'payment.', 'customer.', 'ledger.'];

type AuditRow = {
  id: string;
  seq: bigint;
  action: string;
  entityType: string | null;
  entityId: string | null;
  actorId: string | null;
  actorName: string | null;
  summary: string;
  createdAt: Date;
};

@Injectable()
export class ActivityService {
  constructor(private readonly prisma: PrismaService) {}

  async feed(query: ActivityQuery): Promise<PaginatedResult<ActivityItem>> {
    const tenantId = TenantContext.requireTenantId();
    const permissions = new Set<string>(TenantContext.get()?.permissions ?? []);

    return this.prisma.runInTenant(tenantId, async (tx) => {
      const and: Prisma.AuditLogWhereInput[] = [];

      // حجب ما لا يملك المستخدم صلاحية رؤيته: أحداث كل فئة تظهر فقط إن ملك
      // صلاحية قراءتها. فمن بلا `ledger.read` لا يرى قيود التسوية، وهكذا.
      and.push(this.permissionScope(permissions));

      // نطاق الزبون: أحداثه + أحداث طلباته ودفعاته (بمعرّفاتها المفهرسة).
      if (query.customerId) {
        const [orders, payments] = await Promise.all([
          tx.order.findMany({ where: { customerId: query.customerId }, select: { id: true } }),
          tx.payment.findMany({ where: { customerId: query.customerId }, select: { id: true } }),
        ]);
        and.push({
          OR: [
            { entityType: 'Customer', entityId: query.customerId },
            { entityType: 'Order', entityId: { in: orders.map((o) => o.id) } },
            { entityType: 'Payment', entityId: { in: payments.map((p) => p.id) } },
          ],
        });
      }

      if (query.category) {
        const prefix = CATEGORY_PREFIX[query.category];
        if (prefix) {
          and.push({ action: { startsWith: prefix } });
        } else {
          // SYSTEM = ما ليس من أفعال الأعمال.
          and.push({ NOT: { OR: BUSINESS_PREFIXES.map((p) => ({ action: { startsWith: p } })) } });
        }
      }

      if (query.from || query.to) {
        and.push({
          createdAt: {
            ...(query.from ? { gte: new Date(query.from) } : {}),
            ...(query.to ? { lte: new Date(`${query.to}T23:59:59.999Z`) } : {}),
          },
        });
      }

      const where: Prisma.AuditLogWhereInput = and.length ? { AND: and } : {};

      const [total, rows] = await Promise.all([
        tx.auditLog.count({ where }),
        tx.auditLog.findMany({
          where,
          orderBy: { seq: 'desc' },
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
          select: {
            id: true,
            seq: true,
            action: true,
            entityType: true,
            entityId: true,
            actorId: true,
            actorName: true,
            summary: true,
            createdAt: true,
          },
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

  /**
   * نطاق الرؤية بحسب الصلاحيات.
   *
   * كل فئة أعمال (طلبات/دفعات/حركات/زبائن) تُدرَج فقط إن ملك المستخدم صلاحية
   * قراءتها. أحداث النظام (غير الأعمال) تظهر لمن يملك سجل التدقيق وحده.
   * إن لم يُسمح بأي فئة (لا ينبغي أن يحدث خلف الحارس) نُعيد شرطًا مستحيلًا.
   */
  private permissionScope(perms: Set<string>): Prisma.AuditLogWhereInput {
    const or: Prisma.AuditLogWhereInput[] = [];
    if (perms.has('customers.read')) or.push({ action: { startsWith: 'customer.' } });
    if (perms.has('orders.read')) or.push({ action: { startsWith: 'order.' } });
    if (perms.has('payments.read')) or.push({ action: { startsWith: 'payment.' } });
    if (perms.has('ledger.read')) or.push({ action: { startsWith: 'ledger.' } });
    if (perms.has('audit.read')) {
      // أحداث النظام: ما ليس من أفعال الأعمال.
      or.push({ NOT: { OR: BUSINESS_PREFIXES.map((p) => ({ action: { startsWith: p } })) } });
    }
    return or.length ? { OR: or } : { id: { equals: '00000000-0000-0000-0000-000000000000' } };
  }

  private toDto(row: AuditRow): ActivityItem {
    const prefix = row.action.split('.')[0] ?? '';
    const category = PREFIX_TO_CATEGORY[prefix] ?? 'SYSTEM';

    return {
      id: row.id,
      seq: row.seq.toString(),
      category,
      action: row.action,
      title: row.summary,
      actorId: row.actorId,
      actorName: row.actorName,
      entityType: row.entityType,
      entityId: row.entityId,
      occurredAt: row.createdAt.toISOString(),
    };
  }
}
