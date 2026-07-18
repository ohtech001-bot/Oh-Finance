import { Injectable } from '@nestjs/common';
import type {
  DashboardResolvedRange,
  ReportMetric,
  ReportsData,
  ReportsQuery,
  ResolvedGranularity,
} from '@oh/contracts';
import { WEEKDAY_LABELS_AR } from '@oh/contracts';
import { divide, toMoney, toMoneyString } from '@oh/money';
import { AppError } from '../../core/errors/app-error.js';
import { PrismaService, type TxClient } from '../../core/prisma/prisma.service.js';
import { TenantContext } from '../../core/tenancy/tenant-context.js';

/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  خدمة التقارير — المرحلة 4 / Increment 4.1.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  كل رقم مشتق من قاعدة البيانات على الخادم، بمنطقة المحل، ونصوص عشرية. تعيد
 *  استخدام نمط لوحة التحكم (حلّ الفترة بمنطقة المحل، CTEs، مقارنة الفترة
 *  السابقة). تحت `runInTenant` فتحترم RLS.
 *
 *  أقسام مؤجَّلة بحالة صريحة (لا بيانات وهمية): تصنيف المنتجات (لا بُعد تصنيف
 *  في النموذج)، وتقارير الفروع (المعاملات غير مرتبطة بفرع).
 */

const CONFIRMED_SALE = "status NOT IN ('DRAFT','QUOTE','CANCELLED')";

const LOCAL_BOUNDS: Record<
  Exclude<ReportsQuery['preset'], 'custom'>,
  { cs: string; ce: string; ps: string; pe: string }
> = {
  today: { cs: 'd0', ce: "d0 + interval '1 day'", ps: "d0 - interval '1 day'", pe: 'd0' },
  yesterday: { cs: "d0 - interval '1 day'", ce: 'd0', ps: "d0 - interval '2 day'", pe: "d0 - interval '1 day'" },
  last_7_days: { cs: "d0 - interval '6 day'", ce: "d0 + interval '1 day'", ps: "d0 - interval '13 day'", pe: "d0 - interval '6 day'" },
  last_30_days: { cs: "d0 - interval '29 day'", ce: "d0 + interval '1 day'", ps: "d0 - interval '59 day'", pe: "d0 - interval '29 day'" },
  this_month: { cs: 'm0', ce: "m0 + interval '1 month'", ps: "m0 - interval '1 month'", pe: 'm0' },
  previous_month: { cs: "m0 - interval '1 month'", ce: 'm0', ps: "m0 - interval '2 month'", pe: "m0 - interval '1 month'" },
  this_year: { cs: 'y0', ce: "y0 + interval '1 year'", ps: "y0 - interval '1 year'", pe: 'y0' },
};

const PRESET_LABEL: Record<ReportsQuery['preset'], string> = {
  today: 'اليوم',
  yesterday: 'أمس',
  last_7_days: 'آخر ٧ أيام',
  last_30_days: 'آخر ٣٠ يومًا',
  this_month: 'الشهر الحالي',
  previous_month: 'الشهر الماضي',
  this_year: 'هذه السنة',
  custom: 'فترة مخصّصة',
};

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async getReports(query: ReportsQuery): Promise<ReportsData> {
    const tenantId = TenantContext.requireTenantId();
    const ctx = TenantContext.get();
    if (!ctx?.storeId) throw AppError.forbidden('لا يوجد محل مرتبط بحسابك.');
    const storeId = ctx.storeId;

    return this.prisma.runInTenant(tenantId, async (tx) => {
      const store = await tx.store.findFirst({
        where: { id: storeId },
        select: { name: true, currency: true, tenant: { select: { timezone: true } } },
      });
      const timezone = store?.tenant?.timezone ?? 'Asia/Jerusalem';
      const currency = store?.currency ?? 'ILS';
      const now = new Date();

      const range = await this.resolveRange(tx, timezone, query);
      const cs = new Date(range.from);
      const ce = new Date(range.to);
      const ps = new Date(range.previousFrom);
      const pe = new Date(range.previousTo);

      const [flows, stock, series, weekday, byStatus, methods, customers, products, employees, durations] =
        await Promise.all([
          this.flows(tx, tenantId, cs, ce, ps, pe),
          this.stock(tx, tenantId, cs, now),
          this.series(tx, tenantId, timezone, range),
          this.ordersByWeekday(tx, tenantId, timezone, cs, ce),
          this.ordersByStatus(tx, tenantId, cs, ce),
          this.paymentMethods(tx, tenantId, cs, ce),
          this.topCustomers(tx, tenantId, cs, ce),
          this.topProducts(tx, tenantId, cs, ce),
          this.employeePerformance(tx, tenantId, cs, ce),
          this.avgPaymentDuration(tx, tenantId, cs, ce),
        ]);

      return {
        meta: {
          storeName: store?.name ?? '',
          currency,
          timezone,
          generatedAt: now.toISOString(),
          range,
          scope: ['kpis', 'trends', 'orders', 'payments', 'customers', 'products', 'employees'],
        },
        kpis: {
          outstanding: metric(stock.outstanding_now, stock.outstanding_prev),
          payments: metric(flows.pay_cur, flows.pay_prev),
          sales: metric(flows.rev_cur, flows.rev_prev),
          ordersCount: metric(String(flows.ord_cur), String(flows.ord_prev), 'count'),
          activeCustomers: metric(String(stock.active_now), String(stock.active_prev), 'count'),
          totalCustomers: Number(stock.total_customers),
          averageOrderValue: metric(
            aov(flows.rev_cur, flows.ord_cur),
            aov(flows.rev_prev, flows.ord_prev),
          ),
          taxes: metric(flows.tax_cur, flows.tax_prev),
          discounts: metric(flows.disc_cur, flows.disc_prev),
          avgPaymentDurationDays: durations,
        },
        salesVsPayments: series,
        ordersByWeekday: weekday,
        ordersByStatus: byStatus,
        paymentMethods: methods,
        topCustomers: customers,
        topProducts: products,
        employeePerformance: employees,
        salesByCategory: {
          available: false,
          reason: 'يتطلب بُعد تصنيف المنتجات (غير موجود بعد في النموذج — يأتي مع وحدة المنتجات).',
        },
        branchReports: {
          available: false,
          reason: 'المعاملات غير مرتبطة بفرع في النموذج الحالي — تقارير الفروع مؤجَّلة.',
        },
      } satisfies ReportsData;
    });
  }

  // ── حلّ الفترة (بمنطقة المحل) ───────────────────────────────────────────────

  private async resolveRange(
    tx: TxClient,
    tz: string,
    query: ReportsQuery,
  ): Promise<DashboardResolvedRange> {
    let cs: string, ce: string, ps: string, pe: string;
    const params: string[] = [tz];
    if (query.preset === 'custom') {
      params.push(query.from!, query.to!);
      cs = '($2::timestamp)';
      ce = "($3::timestamp + interval '1 day')";
      ps = `(($2::timestamp) - (($3::timestamp + interval '1 day') - ($2::timestamp)))`;
      pe = '($2::timestamp)';
    } else {
      ({ cs, ce, ps, pe } = LOCAL_BOUNDS[query.preset]);
    }
    const sql = `
      WITH a AS (SELECT (now() AT TIME ZONE $1) AS nl),
      b AS (SELECT date_trunc('day', nl) d0, date_trunc('month', nl) m0, date_trunc('year', nl) y0 FROM a)
      SELECT ((${cs}) AT TIME ZONE $1) cur_start, ((${ce}) AT TIME ZONE $1) cur_end,
             ((${ps}) AT TIME ZONE $1) prev_start, ((${pe}) AT TIME ZONE $1) prev_end
      FROM b`;
    const rows = await tx.$queryRawUnsafe<
      { cur_start: Date; cur_end: Date; prev_start: Date; prev_end: Date }[]
    >(sql, ...params);
    const row = rows[0];
    if (!row) throw AppError.internal('تعذّر حساب حدود الفترة.');

    const spanDays = (row.cur_end.getTime() - row.cur_start.getTime()) / 86_400_000;
    const granularity: ResolvedGranularity =
      query.granularity !== 'auto'
        ? query.granularity
        : spanDays <= 31
          ? 'day'
          : spanDays <= 92
            ? 'week'
            : 'month';
    return {
      preset: query.preset,
      from: row.cur_start.toISOString(),
      to: row.cur_end.toISOString(),
      previousFrom: row.prev_start.toISOString(),
      previousTo: row.prev_end.toISOString(),
      granularity,
      label: query.preset === 'custom' ? `من ${query.from} إلى ${query.to}` : PRESET_LABEL[query.preset],
    };
  }

  // ── التدفقات (إيراد/مقبوضات/عدد/ضريبة/خصم) للفترتين ─────────────────────────

  private async flows(tx: TxClient, tenantId: string, cs: Date, ce: Date, ps: Date, pe: Date) {
    const [row] = await tx.$queryRawUnsafe<
      {
        rev_cur: string; rev_prev: string; ord_cur: bigint; ord_prev: bigint;
        tax_cur: string; tax_prev: string; disc_cur: string; disc_prev: string;
        pay_cur: string; pay_prev: string;
      }[]
    >(
      `SELECT
         COALESCE((SELECT SUM(total) FROM orders WHERE tenant_id=$1::uuid AND ${CONFIRMED_SALE} AND confirmed_at>=$2 AND confirmed_at<$3),0)::text rev_cur,
         COALESCE((SELECT SUM(total) FROM orders WHERE tenant_id=$1::uuid AND ${CONFIRMED_SALE} AND confirmed_at>=$4 AND confirmed_at<$5),0)::text rev_prev,
         (SELECT COUNT(*) FROM orders WHERE tenant_id=$1::uuid AND ${CONFIRMED_SALE} AND issued_at>=$2 AND issued_at<$3) ord_cur,
         (SELECT COUNT(*) FROM orders WHERE tenant_id=$1::uuid AND ${CONFIRMED_SALE} AND issued_at>=$4 AND issued_at<$5) ord_prev,
         COALESCE((SELECT SUM(tax_amount) FROM orders WHERE tenant_id=$1::uuid AND ${CONFIRMED_SALE} AND confirmed_at>=$2 AND confirmed_at<$3),0)::text tax_cur,
         COALESCE((SELECT SUM(tax_amount) FROM orders WHERE tenant_id=$1::uuid AND ${CONFIRMED_SALE} AND confirmed_at>=$4 AND confirmed_at<$5),0)::text tax_prev,
         COALESCE((SELECT SUM(discount_amount) FROM orders WHERE tenant_id=$1::uuid AND ${CONFIRMED_SALE} AND confirmed_at>=$2 AND confirmed_at<$3),0)::text disc_cur,
         COALESCE((SELECT SUM(discount_amount) FROM orders WHERE tenant_id=$1::uuid AND ${CONFIRMED_SALE} AND confirmed_at>=$4 AND confirmed_at<$5),0)::text disc_prev,
         COALESCE((SELECT SUM(amount) FROM payments WHERE tenant_id=$1::uuid AND status='POSTED' AND paid_at>=$2 AND paid_at<$3),0)::text pay_cur,
         COALESCE((SELECT SUM(amount) FROM payments WHERE tenant_id=$1::uuid AND status='POSTED' AND paid_at>=$4 AND paid_at<$5),0)::text pay_prev`,
      tenantId, cs, ce, ps, pe,
    );
    return row!;
  }

  private async stock(tx: TxClient, tenantId: string, cs: Date, now: Date) {
    const [row] = await tx.$queryRawUnsafe<
      { outstanding_now: string; outstanding_prev: string; active_now: bigint; active_prev: bigint; total_customers: bigint }[]
    >(
      `WITH bal_now AS (
         SELECT DISTINCT ON (le.customer_id) le.customer_id, le.running_balance
         FROM ledger_entries le JOIN customers c ON c.id=le.customer_id
         WHERE le.tenant_id=$1::uuid AND c.archived_at IS NULL ORDER BY le.customer_id, le.seq DESC),
       bal_start AS (
         SELECT DISTINCT ON (le.customer_id) le.customer_id, le.running_balance
         FROM ledger_entries le JOIN customers c ON c.id=le.customer_id
         WHERE le.tenant_id=$1::uuid AND c.archived_at IS NULL AND le.created_at<$2 ORDER BY le.customer_id, le.seq DESC)
       SELECT
         (SELECT COALESCE(SUM(running_balance) FILTER (WHERE running_balance>0),0) FROM bal_now)::text outstanding_now,
         (SELECT COALESCE(SUM(running_balance) FILTER (WHERE running_balance>0),0) FROM bal_start)::text outstanding_prev,
         (SELECT COUNT(*) FROM customers WHERE tenant_id=$1::uuid AND archived_at IS NULL AND status='ACTIVE') active_now,
         (SELECT COUNT(*) FROM customers WHERE tenant_id=$1::uuid AND created_at<$2 AND (archived_at IS NULL OR archived_at>=$2)) active_prev,
         (SELECT COUNT(*) FROM customers WHERE tenant_id=$1::uuid AND archived_at IS NULL) total_customers`,
      tenantId, cs, now,
    );
    return row!;
  }

  private async series(tx: TxClient, tenantId: string, tz: string, range: DashboardResolvedRange) {
    const unit = range.granularity;
    const rows = await tx.$queryRawUnsafe<{ date: string; sales: string; payments: string }[]>(
      `WITH bk AS (
         SELECT gs AS b_local, gs + interval '1 ${unit}' AS b_next_local
         FROM generate_series(date_trunc('${unit}', ($2::timestamptz AT TIME ZONE $1)),
              ($3::timestamptz AT TIME ZONE $1) - interval '1 microsecond', interval '1 ${unit}') gs),
       b AS (SELECT b_local, (b_local AT TIME ZONE $1) b_start, (b_next_local AT TIME ZONE $1) b_end FROM bk)
       SELECT to_char(b.b_local,'YYYY-MM-DD') date,
         COALESCE((SELECT SUM(total) FROM orders o WHERE o.tenant_id=$4::uuid AND o.status NOT IN ('DRAFT','QUOTE','CANCELLED') AND o.confirmed_at>=b.b_start AND o.confirmed_at<b.b_end),0)::text sales,
         COALESCE((SELECT SUM(amount) FROM payments p WHERE p.tenant_id=$4::uuid AND p.status='POSTED' AND p.paid_at>=b.b_start AND p.paid_at<b.b_end),0)::text payments
       FROM b ORDER BY b.b_local`,
      tz, new Date(range.from), new Date(range.to), tenantId,
    );
    return rows.map((r) => ({ date: r.date, sales: toMoneyString(r.sales, 2), payments: toMoneyString(r.payments, 2) }));
  }

  private async ordersByWeekday(tx: TxClient, tenantId: string, tz: string, cs: Date, ce: Date) {
    const rows = await tx.$queryRawUnsafe<{ weekday: number; count: bigint }[]>(
      `SELECT EXTRACT(DOW FROM (issued_at AT TIME ZONE $2))::int weekday, COUNT(*) count
       FROM orders WHERE tenant_id=$1::uuid AND ${CONFIRMED_SALE} AND issued_at>=$3 AND issued_at<$4
       GROUP BY 1`,
      tenantId, tz, cs, ce,
    );
    const byDay = new Map(rows.map((r) => [Number(r.weekday), Number(r.count)]));
    return WEEKDAY_LABELS_AR.map((label, weekday) => ({ weekday, label, count: byDay.get(weekday) ?? 0 }));
  }

  private async ordersByStatus(tx: TxClient, tenantId: string, cs: Date, ce: Date) {
    const rows = await tx.$queryRawUnsafe<{ status: string; count: bigint; amount: string }[]>(
      `SELECT status::text, COUNT(*) count, COALESCE(SUM(total),0)::text amount
       FROM orders WHERE tenant_id=$1::uuid AND issued_at>=$2 AND issued_at<$3 GROUP BY status ORDER BY COUNT(*) DESC`,
      tenantId, cs, ce,
    );
    return rows.map((r) => ({ status: r.status as never, count: Number(r.count), amount: toMoneyString(r.amount, 2) }));
  }

  private async paymentMethods(tx: TxClient, tenantId: string, cs: Date, ce: Date) {
    const rows = await tx.$queryRawUnsafe<{ method: string; amount: string; count: bigint }[]>(
      `SELECT method::text, COALESCE(SUM(amount),0)::text amount, COUNT(*) count
       FROM payments WHERE tenant_id=$1::uuid AND status='POSTED' AND paid_at>=$2 AND paid_at<$3 GROUP BY method ORDER BY SUM(amount) DESC`,
      tenantId, cs, ce,
    );
    const total = rows.reduce((s, r) => s.plus(toMoney(r.amount)), toMoney('0'));
    return rows.map((r) => ({
      method: r.method as never,
      amount: toMoneyString(r.amount, 2),
      count: Number(r.count),
      pct: total.isZero() ? 0 : pctNum(r.amount, total.toString()),
    }));
  }

  private async topCustomers(tx: TxClient, tenantId: string, cs: Date, ce: Date) {
    const rows = await tx.$queryRawUnsafe<{ id: string; code: string; name: string; purchases: string }[]>(
      `SELECT c.id, c.code, c.name, COALESCE(SUM(o.total),0)::text purchases
       FROM customers c JOIN orders o ON o.customer_id=c.id
       WHERE c.tenant_id=$1::uuid AND c.archived_at IS NULL AND o.status NOT IN ('DRAFT','QUOTE','CANCELLED')
         AND o.confirmed_at>=$2 AND o.confirmed_at<$3
       GROUP BY c.id, c.code, c.name HAVING SUM(o.total)>0 ORDER BY SUM(o.total) DESC, c.id LIMIT 5`,
      tenantId, cs, ce,
    );
    return rows.map((r) => ({ id: r.id, code: r.code, name: r.name, purchases: toMoneyString(r.purchases, 2) }));
  }

  private async topProducts(tx: TxClient, tenantId: string, cs: Date, ce: Date) {
    const rows = await tx.$queryRawUnsafe<{ name: string; quantity: string; sales: string }[]>(
      `SELECT oi.name, COALESCE(SUM(oi.quantity),0)::text quantity, COALESCE(SUM(oi.line_total),0)::text sales
       FROM order_items oi JOIN orders o ON o.id=oi.order_id
       WHERE oi.tenant_id=$1::uuid AND o.status NOT IN ('DRAFT','QUOTE','CANCELLED') AND o.confirmed_at>=$2 AND o.confirmed_at<$3
       GROUP BY oi.name HAVING SUM(oi.line_total)>0 ORDER BY SUM(oi.line_total) DESC LIMIT 5`,
      tenantId, cs, ce,
    );
    return rows.map((r) => ({ name: r.name, quantity: toMoneyString(r.quantity, 2), sales: toMoneyString(r.sales, 2) }));
  }

  private async employeePerformance(tx: TxClient, tenantId: string, cs: Date, ce: Date) {
    const rows = await tx.$queryRawUnsafe<
      { user_id: string | null; orders: bigint; sales: string; payments: string }[]
    >(
      `WITH ord AS (
         SELECT created_by, COUNT(*) orders, COALESCE(SUM(total),0) sales
         FROM orders WHERE tenant_id=$1::uuid AND ${CONFIRMED_SALE} AND confirmed_at>=$2 AND confirmed_at<$3 GROUP BY created_by),
       pay AS (
         SELECT created_by, COALESCE(SUM(amount),0) payments
         FROM payments WHERE tenant_id=$1::uuid AND status='POSTED' AND paid_at>=$2 AND paid_at<$3 GROUP BY created_by)
       SELECT COALESCE(ord.created_by, pay.created_by) user_id,
              COALESCE(ord.orders,0) orders, COALESCE(ord.sales,0)::text sales, COALESCE(pay.payments,0)::text payments
       FROM ord FULL OUTER JOIN pay ON ord.created_by = pay.created_by
       ORDER BY COALESCE(ord.sales,0) + COALESCE(pay.payments,0) DESC LIMIT 10`,
      tenantId, cs, ce,
    );
    const ids = [...new Set(rows.map((r) => r.user_id).filter((v): v is string => !!v))];
    const users = ids.length
      ? await tx.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } })
      : [];
    const nameById = new Map(users.map((u) => [u.id, u.name]));
    return rows.map((r) => ({
      userId: r.user_id,
      name: r.user_id ? (nameById.get(r.user_id) ?? 'مستخدم محذوف') : 'النظام',
      orders: Number(r.orders),
      sales: toMoneyString(r.sales, 2),
      payments: toMoneyString(r.payments, 2),
    }));
  }

  private async avgPaymentDuration(tx: TxClient, tenantId: string, cs: Date, ce: Date): Promise<number | null> {
    const [row] = await tx.$queryRawUnsafe<{ days: number | null }[]>(
      `SELECT AVG(EXTRACT(EPOCH FROM (p.paid_at - o.issued_at))/86400)::float8 days
       FROM payment_allocations pa
       JOIN payments p ON p.id=pa.payment_id AND p.status='POSTED'
       JOIN orders o ON o.id=pa.order_id
       WHERE pa.tenant_id=$1::uuid AND p.paid_at>=$2 AND p.paid_at<$3`,
      tenantId, cs, ce,
    );
    // eslint-disable-next-line no-restricted-properties -- متوسط أيام للعرض، لا مبلغ.
    return row?.days === null || row?.days === undefined ? null : Math.round(row.days * 10) / 10;
  }
}

// ── مساعدات ────────────────────────────────────────────────────────────────

function deltaPct(cur: string, prev: string | null): number | null {
  if (prev === null) return null;
  const p = toMoney(prev);
  if (p.isZero()) return toMoney(cur).greaterThan(toMoney('0')) ? 100 : null;
  // eslint-disable-next-line no-restricted-properties -- نسبة عرض، لا مبلغ.
  return Math.round(toMoney(cur).minus(p).dividedBy(p).times(100).toNumber());
}

function metric(cur: string, prev: string | null, kind: 'money' | 'count' = 'money'): ReportMetric {
  const fmt = (v: string) => (kind === 'money' ? toMoneyString(v, 2) : v);
  return {
    value: fmt(cur),
    previous: prev === null ? null : fmt(prev),
    deltaPct: deltaPct(cur, prev),
  };
}

function aov(revenue: string, confirmed: bigint | number): string {
  const n = Number(confirmed);
  if (n === 0) return '0.00';
  return toMoneyString(divide(revenue, String(n)), 2);
}

function pctNum(part: string, total: string): number {
  // eslint-disable-next-line no-restricted-properties -- نسبة عرض، لا مبلغ.
  return Math.round(divide(part, total).times(100).toNumber());
}
