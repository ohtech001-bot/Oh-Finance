import { Injectable } from '@nestjs/common';
import type {
  ActivityCategory,
  ActivityItem,
  ActivityQuery,
  NotificationFeed,
  NotificationItem,
  PaginatedResult,
} from '@oh/contracts';
import type { Prisma } from '@prisma/client';
import { toMoneyString } from '@oh/money';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import { TenantContext } from '../../core/tenancy/tenant-context.js';
import { isoDateInTimeZone } from '../../core/time/iso-date-in-timezone.js';

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

  async notifications(): Promise<NotificationFeed> {
    const tenantId = TenantContext.requireTenantId();
    const permissions = new Set<string>(TenantContext.get()?.permissions ?? []);

    return this.prisma.runInTenant(tenantId, async (tx) => {
      const tenant = await tx.tenant.findUnique({
        where: { id: tenantId },
        select: { timezone: true },
      });
      const timezone = tenant?.timezone ?? 'Asia/Jerusalem';
      const todayText = isoDateInTimeZone(new Date(), timezone);
      const today = new Date(`${todayText}T00:00:00.000Z`);
      const fiveDaysFromNow = new Date(today);
      fiveDaysFromNow.setUTCDate(fiveDaysFromNow.getUTCDate() + 5);
      const todayDay = today.getUTCDate();
      const dueSoonDay = fiveDaysFromNow.getUTCDate();
      const currentMonthLastDay = new Date(
        Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 0),
      ).getUTCDate();

      const allowedActions: string[] = [];
      if (permissions.has('orders.read')) allowedActions.push('order.created');
      if (permissions.has('payments.read')) allowedActions.push('payment.created');
      const recentActivityStart = new Date();
      recentActivityStart.setDate(recentActivityStart.getDate() - 7);

      const activityRows =
        allowedActions.length > 0
          ? await tx.auditLog.findMany({
              where: {
                action: { in: allowedActions },
                createdAt: { gte: recentActivityStart },
              },
              orderBy: { seq: 'desc' },
              take: 12,
              select: {
                id: true,
                action: true,
                entityId: true,
                summary: true,
                createdAt: true,
              },
            })
          : [];

      const orderIds = activityRows
        .filter((row) => row.action === 'order.created' && row.entityId)
        .map((row) => row.entityId as string);
      const paymentIds = activityRows
        .filter((row) => row.action === 'payment.created' && row.entityId)
        .map((row) => row.entityId as string);
      const [orders, payments] = await Promise.all([
        orderIds.length
          ? tx.order.findMany({
              where: { id: { in: orderIds } },
              select: {
                id: true,
                number: true,
                total: true,
                customer: { select: { name: true } },
              },
            })
          : [],
        paymentIds.length
          ? tx.payment.findMany({
              where: { id: { in: paymentIds } },
              select: {
                id: true,
                amount: true,
                customer: { select: { name: true } },
              },
            })
          : [],
      ]);
      const ordersById = new Map(orders.map((order) => [order.id, order]));
      const paymentsById = new Map(payments.map((payment) => [payment.id, payment]));

      const items: NotificationItem[] = activityRows.map((row) => {
        if (row.action === 'payment.created') {
          const payment = row.entityId ? paymentsById.get(row.entityId) : undefined;
          return {
            id: row.id,
            kind: 'PAYMENT_RECEIVED',
            severity: 'success',
            title: 'تم استلام دفعة',
            description: row.summary,
            customerName: payment?.customer.name,
            amount: payment ? decimalAmount(payment.amount.toString()) : undefined,
            occurredAt: row.createdAt.toISOString(),
            href: '/payments',
          };
        }

        const order = row.entityId ? ordersById.get(row.entityId) : undefined;
        return {
          id: row.id,
          kind: 'ORDER_CREATED',
          severity: 'info',
          title: 'تم إدخال طلبية جديدة',
          description: row.summary,
          customerName: order?.customer.name,
          amount: order ? decimalAmount(order.total.toString()) : undefined,
          orderNumber: order?.number,
          occurredAt: row.createdAt.toISOString(),
          href: row.entityId ? `/orders?orderId=${row.entityId}` : '/orders',
        };
      });

      if (permissions.has('customers.read')) {
        const dueCustomers = await tx.$queryRaw<
          { id: string; name: string; payment_due_date: Date; balance: string }[]
        >`
          WITH balances AS (
            SELECT DISTINCT ON (le.customer_id)
                   le.customer_id,
                   le.running_balance
            FROM ledger_entries le
            WHERE le.tenant_id = ${tenantId}::uuid
            ORDER BY le.customer_id, le.seq DESC
          )
          SELECT c.id, c.name, c.payment_due_date, b.running_balance::text AS balance
          FROM customers c
          JOIN balances b ON b.customer_id = c.id
          WHERE c.tenant_id = ${tenantId}::uuid
            AND c.archived_at IS NULL
            AND b.running_balance > 0
            AND c.payment_due_date IS NOT NULL
          ORDER BY c.name ASC
        `;

        const generatedAt = new Date().toISOString();
        for (const customer of dueCustomers) {
          const dueDay = Math.min(customer.payment_due_date.getUTCDate(), currentMonthLastDay);
          const dueToday = dueDay === todayDay;
          const dueSoon = dueDay === dueSoonDay;
          const overdue = dueDay < todayDay;
          if (!dueToday && !dueSoon && !overdue) continue;
          items.push({
            id: `${overdue ? 'due-overdue' : dueToday ? 'due-today' : 'due-soon'}-${customer.id}-${todayText}`,
            kind: overdue
              ? 'PAYMENT_DUE_OVERDUE'
              : dueToday
                ? 'PAYMENT_DUE_TODAY'
                : 'PAYMENT_DUE_SOON',
            severity: dueToday || overdue ? 'danger' : 'warning',
            title: overdue
              ? `تجاوز ${customer.name} موعد السداد`
              : dueToday
                ? `موعد سداد ${customer.name} اليوم`
                : `اقترب موعد سداد ${customer.name}`,
            description: overdue
              ? `تجاوز موعد السداد وما زال الحساب مديونًا. الرصيد المستحق: ${customer.balance}`
              : dueToday
                ? `موعد سداد الدين اليوم وما زال الحساب مديونًا. الرصيد المستحق: ${customer.balance}`
                : `متبقي 5 أيام على موعد سداد الدين. الرصيد المستحق: ${customer.balance}`,
            customerName: customer.name,
            balance: customer.balance,
            occurredAt: generatedAt,
            href: `/customers/${customer.id}`,
          });
        }
      }

      const sorted = items.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)).slice(0, 20);
      return { items: sorted, total: sorted.length };
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

function decimalAmount(value: string): string {
  return toMoneyString(value.includes('.') ? value : `${value}.0`, 2);
}
