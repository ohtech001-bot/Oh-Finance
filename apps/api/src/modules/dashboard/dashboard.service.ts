import { Injectable } from '@nestjs/common';
import type {
  DashboardAlert,
  DashboardData,
  DashboardKpiId,
  DashboardQuery,
  DashboardResolvedRange,
  DashboardTrendId,
  KpiMetric,
  ResolvedGranularity,
  TopCustomersBasis,
  TrendSeries,
} from '@oh/contracts';
import { DASHBOARD_KPI_META } from '@oh/contracts';
import { divide, greaterThanOrEqual, toMoney, toMoneyString } from '@oh/money';
import { AppError } from '../../core/errors/app-error.js';
import { PrismaService, type TxClient } from '../../core/prisma/prisma.service.js';
import { TenantContext } from '../../core/tenancy/tenant-context.js';

/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  خدمة لوحة التحكم — المرحلة 3.5 / Increment 3.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  كل رقم مشتق من قاعدة البيانات عند الطلب — لا قيمة مخزّنة، لا بيانات وهمية.
 *  التجميع كله على الخادم بـSQL خام (CTE)، والمبالغ نصوص عشرية بلا فاصلة عائمة.
 *
 *  ── المنطقة الزمنية ──────────────────────────────────────────────────────
 *  حدود الفترات تُحسب بمنطقة المستأجر (`AT TIME ZONE`) على الخادم، لا بمنطقة
 *  المتصفح. الدلاء (buckets) تُولَّد بالوقت المحلي ثم تُحوَّل — فتبقى محاذيةً
 *  للتقويم المحلي رغم التوقيت الصيفي (DST).
 *
 *  ── الصلاحيات ────────────────────────────────────────────────────────────
 *  البوابة `dashboard.read` تفتح اللوحة، وكل قسم يُرشَّح بصلاحية قراءته
 *  التفصيلية على الخادم — فلا تُرسَل بيانات لا يملك المستخدم رؤيتها.
 *
 *  كله تحت `runInTenant` فيحترم RLS.
 */

/** الدفعة/الطلب المؤكد لأغراض الإيراد. */
const CONFIRMED_SALE = "status NOT IN ('DRAFT','QUOTE','CANCELLED')";

/** حدود الفترة المحلية (تعابير SQL ثابتة، لا مُدخلات مستخدم). */
const LOCAL_BOUNDS: Record<
  Exclude<DashboardQuery['preset'], 'custom'>,
  { cs: string; ce: string; ps: string; pe: string }
> = {
  today: { cs: 'd0', ce: "d0 + interval '1 day'", ps: "d0 - interval '1 day'", pe: 'd0' },
  yesterday: {
    cs: "d0 - interval '1 day'",
    ce: 'd0',
    ps: "d0 - interval '2 day'",
    pe: "d0 - interval '1 day'",
  },
  last_7_days: {
    cs: "d0 - interval '6 day'",
    ce: "d0 + interval '1 day'",
    ps: "d0 - interval '13 day'",
    pe: "d0 - interval '6 day'",
  },
  last_30_days: {
    cs: "d0 - interval '29 day'",
    ce: "d0 + interval '1 day'",
    ps: "d0 - interval '59 day'",
    pe: "d0 - interval '29 day'",
  },
  this_month: {
    cs: 'm0',
    ce: "m0 + interval '1 month'",
    ps: "m0 - interval '1 month'",
    pe: 'm0',
  },
  previous_month: {
    cs: "m0 - interval '1 month'",
    ce: 'm0',
    ps: "m0 - interval '2 month'",
    pe: "m0 - interval '1 month'",
  },
  this_year: {
    cs: 'y0',
    ce: "y0 + interval '1 year'",
    ps: "y0 - interval '1 year'",
    pe: 'y0',
  },
};

const PRESET_LABEL: Record<DashboardQuery['preset'], string> = {
  today: 'اليوم',
  yesterday: 'أمس',
  last_7_days: 'آخر ٧ أيام',
  last_30_days: 'آخر ٣٠ يومًا',
  this_month: 'الشهر الحالي',
  previous_month: 'الشهر الماضي',
  this_year: 'هذه السنة',
  custom: 'فترة مخصّصة',
};

/** الصلاحيات المطلوبة لكل مؤشر (كلها مطلوبة معًا). */
const KPI_PERMS: Record<DashboardKpiId, readonly string[]> = {
  revenue: ['orders.read'],
  orders: ['orders.read'],
  average_order_value: ['orders.read'],
  payments: ['payments.read'],
  collection_rate: ['orders.read', 'payments.read'],
  outstanding_balance: ['ledger.read'],
  overdue_balance: ['ledger.read'],
  overdue_customers: ['ledger.read'],
  unallocated_payments: ['ledger.read'],
  active_customers: ['customers.read'],
};

const HIDDEN_KPIS = new Set<DashboardKpiId>([
  'revenue',
  'average_order_value',
  'unallocated_payments',
  'active_customers',
]);

const TREND_PERMS: Record<DashboardTrendId, readonly string[]> = {
  revenue: ['orders.read'],
  orders: ['orders.read'],
  payments: ['payments.read'],
  outstanding_balance: ['ledger.read'],
  new_customers: ['customers.read'],
};

type ListId = 'topCustomers' | 'topDebtors' | 'recentPayments' | 'recentOrders';
const LIST_PERMS: Record<ListId, readonly string[]> = {
  topCustomers: ['customers.read'],
  topDebtors: ['ledger.read'],
  recentPayments: ['payments.read'],
  recentOrders: ['orders.read'],
};

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboard(query: DashboardQuery): Promise<DashboardData> {
    const tenantId = TenantContext.requireTenantId();
    const ctx = TenantContext.get();
    if (!ctx?.storeId) throw AppError.forbidden('لا يوجد محل مرتبط بحسابك.');
    const storeId = ctx.storeId;
    const perms = new Set<string>(ctx.permissions ?? []);
    const has = (...required: readonly string[]) => required.every((p) => perms.has(p));

    return this.prisma.runInTenant(tenantId, async (tx) => {
      const store = await tx.store.findFirst({
        where: { id: storeId },
        select: { name: true, currency: true, tenant: { select: { timezone: true } } },
      });
      const timezone = store?.tenant?.timezone ?? 'Asia/Jerusalem';
      const currency = store?.currency ?? 'ILS';

      const range = await this.resolveRange(tx, timezone, query);
      const now = new Date();

      // نطاق الأقسام المسموح بها.
      const kpiScope = (Object.keys(KPI_PERMS) as DashboardKpiId[]).filter(
        (id) => !HIDDEN_KPIS.has(id) && has(...KPI_PERMS[id]),
      );
      const trendScope = (Object.keys(TREND_PERMS) as DashboardTrendId[]).filter(
        (id) => id !== 'revenue' && has(...TREND_PERMS[id]),
      );
      const listScope = (Object.keys(LIST_PERMS) as ListId[]).filter((id) => has(...LIST_PERMS[id]));
      const basis: TopCustomersBasis = has('orders.read') ? 'sales' : 'collection';

      const [kpis, trends, lists, alerts] = await Promise.all([
        this.buildKpis(tx, tenantId, range, now, kpiScope),
        this.buildTrends(tx, tenantId, timezone, range, trendScope),
        this.buildLists(tx, tenantId, range, now, listScope, basis),
        this.buildAlerts(tx, tenantId, now, perms),
      ]);

      return {
        meta: {
          storeName: store?.name ?? '',
          currency,
          timezone,
          generatedAt: now.toISOString(),
          range,
          topCustomersBasis: basis,
          scope: { kpis: kpiScope, trends: trendScope, lists: listScope },
        },
        kpis,
        trends,
        ...lists,
        alerts,
      } satisfies DashboardData;
    });
  }

  // ── حلّ الفترة الزمنية (بمنطقة المحل) ──────────────────────────────────────

  private async resolveRange(
    tx: TxClient,
    tz: string,
    query: DashboardQuery,
  ): Promise<DashboardResolvedRange> {
    let cs: string;
    let ce: string;
    let ps: string;
    let pe: string;
    const params: string[] = [tz];

    if (query.preset === 'custom') {
      // $2 = from, $3 = to (تواريخ تقويمية بمنطقة المحل).
      params.push(query.from!, query.to!);
      cs = '($2::timestamp)';
      ce = "($3::timestamp + interval '1 day')";
      ps = `(($2::timestamp) - (($3::timestamp + interval '1 day') - ($2::timestamp)))`;
      pe = '($2::timestamp)';
    } else {
      const b = LOCAL_BOUNDS[query.preset];
      cs = b.cs;
      ce = b.ce;
      ps = b.ps;
      pe = b.pe;
    }

    const sql = `
      WITH a AS (SELECT (now() AT TIME ZONE $1) AS nl),
      b AS (
        SELECT date_trunc('day', nl) AS d0,
               date_trunc('month', nl) AS m0,
               date_trunc('year', nl) AS y0
        FROM a
      )
      SELECT
        ((${cs}) AT TIME ZONE $1) AS cur_start,
        ((${ce}) AT TIME ZONE $1) AS cur_end,
        ((${ps}) AT TIME ZONE $1) AS prev_start,
        ((${pe}) AT TIME ZONE $1) AS prev_end
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

    const label =
      query.preset === 'custom'
        ? `من ${query.from} إلى ${query.to}`
        : PRESET_LABEL[query.preset];

    return {
      preset: query.preset,
      from: row.cur_start.toISOString(),
      to: row.cur_end.toISOString(),
      previousFrom: row.prev_start.toISOString(),
      previousTo: row.prev_end.toISOString(),
      granularity,
      label,
    };
  }

  // ── المؤشرات ───────────────────────────────────────────────────────────────

  private async buildKpis(
    tx: TxClient,
    tenantId: string,
    range: DashboardResolvedRange,
    now: Date,
    scope: DashboardKpiId[],
  ): Promise<KpiMetric[]> {
    if (scope.length === 0) return [];
    // نمرّر كائنات Date — Prisma يربطها كـtimestamptz (لا نص).
    const cs = new Date(range.from);
    const ce = new Date(range.to);
    const ps = new Date(range.previousFrom);
    const pe = new Date(range.previousTo);
    const want = new Set(scope);

    // مجاميع الطلبات (إيراد/عدد/مؤكد) للفترتين في مسحة واحدة.
    const ordersAgg = tx.$queryRawUnsafe<
      {
        rev_cur: string;
        rev_prev: string;
        conf_cur: bigint;
        conf_prev: bigint;
        ord_cur: bigint;
        ord_prev: bigint;
      }[]
    >(
      `SELECT
         COALESCE(SUM(total) FILTER (WHERE ${CONFIRMED_SALE} AND confirmed_at >= $2 AND confirmed_at < $3),0)::text AS rev_cur,
         COALESCE(SUM(total) FILTER (WHERE ${CONFIRMED_SALE} AND confirmed_at >= $4 AND confirmed_at < $5),0)::text AS rev_prev,
         COUNT(*) FILTER (WHERE ${CONFIRMED_SALE} AND confirmed_at >= $2 AND confirmed_at < $3) AS conf_cur,
         COUNT(*) FILTER (WHERE ${CONFIRMED_SALE} AND confirmed_at >= $4 AND confirmed_at < $5) AS conf_prev,
         COUNT(*) FILTER (WHERE ${CONFIRMED_SALE} AND issued_at >= $2 AND issued_at < $3) AS ord_cur,
         COUNT(*) FILTER (WHERE ${CONFIRMED_SALE} AND issued_at >= $4 AND issued_at < $5) AS ord_prev
       FROM orders WHERE tenant_id = $1::uuid`,
      tenantId,
      cs,
      ce,
      ps,
      pe,
    );

    const paymentsAgg = tx.$queryRawUnsafe<{ pay_cur: string; pay_prev: string }[]>(
      `SELECT
         COALESCE(SUM(amount) FILTER (WHERE paid_at >= $2 AND paid_at < $3),0)::text AS pay_cur,
         COALESCE(SUM(amount) FILTER (WHERE paid_at >= $4 AND paid_at < $5),0)::text AS pay_prev
       FROM payments WHERE tenant_id = $1::uuid AND status = 'POSTED'`,
      tenantId,
      cs,
      ce,
      ps,
      pe,
    );

    // مقاييس لحظية: الدَّين (الآن وكما كان بداية الفترة)، المتأخرات، الزبائن.
    const stock = tx.$queryRawUnsafe<
      {
        outstanding_now: string;
        outstanding_prev: string;
        overdue_amount: string;
        overdue_customers: bigint;
        active_now: bigint;
        active_prev: bigint;
        unallocated: string;
      }[]
    >(
      `WITH bal_now AS (
         SELECT DISTINCT ON (le.customer_id) le.customer_id, le.running_balance
         FROM ledger_entries le JOIN customers c ON c.id = le.customer_id
         WHERE le.tenant_id = $1::uuid AND c.archived_at IS NULL
         ORDER BY le.customer_id, le.seq DESC
       ),
       bal_start AS (
         SELECT DISTINCT ON (le.customer_id) le.customer_id, le.running_balance
         FROM ledger_entries le JOIN customers c ON c.id = le.customer_id
         WHERE le.tenant_id = $1::uuid AND c.archived_at IS NULL AND le.created_at < $2
         ORDER BY le.customer_id, le.seq DESC
       ),
       overdue AS (
         SELECT customer_id, SUM(total - paid_amount) AS due
         FROM orders
         WHERE tenant_id = $1::uuid AND status IN ('CONFIRMED','PARTIALLY_PAID') AND due_at < $3
         GROUP BY customer_id
       ),
       unalloc AS (
         SELECT COALESCE(SUM(p.amount - COALESCE(al.total,0)),0) AS amt
         FROM payments p
         LEFT JOIN (SELECT payment_id, SUM(amount) total FROM payment_allocations GROUP BY payment_id) al
           ON al.payment_id = p.id
         WHERE p.tenant_id = $1::uuid AND p.status = 'POSTED'
       )
       SELECT
         (SELECT COALESCE(SUM(running_balance) FILTER (WHERE running_balance > 0),0) FROM bal_now)::text AS outstanding_now,
         (SELECT COALESCE(SUM(running_balance) FILTER (WHERE running_balance > 0),0) FROM bal_start)::text AS outstanding_prev,
         (SELECT COALESCE(SUM(due),0) FROM overdue WHERE due > 0)::text AS overdue_amount,
         (SELECT COUNT(*) FROM overdue WHERE due > 0) AS overdue_customers,
         (SELECT COUNT(*) FROM customers WHERE tenant_id = $1::uuid AND archived_at IS NULL AND status = 'ACTIVE') AS active_now,
         (SELECT COUNT(*) FROM customers WHERE tenant_id = $1::uuid AND created_at < $2 AND (archived_at IS NULL OR archived_at >= $2)) AS active_prev,
         (SELECT amt FROM unalloc)::text AS unallocated`,
      tenantId,
      cs,
      now,
    );

    const [oRows, pRows, sRows] = await Promise.all([ordersAgg, paymentsAgg, stock]);
    const o = oRows[0];
    const p = pRows[0];
    const s = sRows[0];
    if (!o || !p || !s) throw AppError.internal('تعذّر حساب مؤشرات اللوحة.');

    const revCur = o.rev_cur;
    const collectionCur = ratePct(p.pay_cur, o.rev_cur);
    const collectionPrev = ratePct(p.pay_prev, o.rev_prev);

    const all: Record<DashboardKpiId, KpiMetric> = {
      revenue: money('revenue', o.rev_cur, o.rev_prev),
      payments: money('payments', p.pay_cur, p.pay_prev),
      orders: count('orders', o.ord_cur, o.ord_prev),
      average_order_value: money(
        'average_order_value',
        aov(revCur, o.conf_cur),
        aov(o.rev_prev, o.conf_prev),
      ),
      collection_rate: percent('collection_rate', collectionCur, collectionPrev),
      outstanding_balance: money('outstanding_balance', s.outstanding_now, s.outstanding_prev),
      overdue_balance: money('overdue_balance', s.overdue_amount, null),
      overdue_customers: count('overdue_customers', s.overdue_customers, null),
      active_customers: count('active_customers', s.active_now, s.active_prev),
      unallocated_payments: money('unallocated_payments', s.unallocated, null),
    };

    return scope.filter((id) => want.has(id)).map((id) => all[id]);
  }

  // ── المنحنيات (تجميع مُدلًّى على الخادم) ────────────────────────────────────

  private async buildTrends(
    tx: TxClient,
    tenantId: string,
    tz: string,
    range: DashboardResolvedRange,
    scope: DashboardTrendId[],
  ): Promise<TrendSeries[]> {
    if (scope.length === 0) return [];

    const unit = range.granularity; // 'day' | 'week' | 'month'
    const step = `1 ${unit}`;

    const rows = await tx.$queryRawUnsafe<
      { bucket: string; revenue: string; orders: string; payments: string; new_customers: string }[]
    >(
      `WITH bk AS (
         SELECT gs AS b_local, gs + interval '${step}' AS b_next_local
         FROM generate_series(
           date_trunc('${unit}', ($2::timestamptz AT TIME ZONE $1)),
           ($3::timestamptz AT TIME ZONE $1) - interval '1 microsecond',
           interval '${step}'
         ) gs
       ),
       b AS (
         SELECT b_local,
                (b_local AT TIME ZONE $1) AS b_start,
                (b_next_local AT TIME ZONE $1) AS b_end
         FROM bk
       )
       SELECT
         to_char(b.b_local, 'YYYY-MM-DD') AS bucket,
         COALESCE((SELECT SUM(total) FROM orders o WHERE o.tenant_id = $4::uuid AND ${CONFIRMED_SALE}
                    AND o.confirmed_at >= b.b_start AND o.confirmed_at < b.b_end),0)::text AS revenue,
         COALESCE((SELECT COUNT(*) FROM orders o WHERE o.tenant_id = $4::uuid AND ${sqlPrefixed(CONFIRMED_SALE, 'o')}
                    AND o.issued_at >= b.b_start AND o.issued_at < b.b_end),0)::text AS orders,
         COALESCE((SELECT SUM(amount) FROM payments p WHERE p.tenant_id = $4::uuid AND p.status = 'POSTED'
                    AND p.paid_at >= b.b_start AND p.paid_at < b.b_end),0)::text AS payments,
         COALESCE((SELECT COUNT(*) FROM customers c WHERE c.tenant_id = $4::uuid
                    AND c.created_at >= b.b_start AND c.created_at < b.b_end),0)::text AS new_customers
       FROM b ORDER BY b.b_local`,
      tz,
      new Date(range.from),
      new Date(range.to),
      tenantId,
    );

    const series: Partial<Record<DashboardTrendId, TrendSeries>> = {};
    const want = new Set(scope);

    if (want.has('revenue'))
      series.revenue = pointsSeries('revenue', 'money', rows, (r) => toMoneyString(r.revenue, 2));
    if (want.has('payments'))
      series.payments = pointsSeries('payments', 'money', rows, (r) => toMoneyString(r.payments, 2));
    if (want.has('orders'))
      series.orders = pointsSeries('orders', 'count', rows, (r) => String(Number(r.orders)));
    if (want.has('new_customers'))
      series.new_customers = pointsSeries('new_customers', 'count', rows, (r) =>
        String(Number(r.new_customers)),
      );

    // منحنى الدَّين مشتق: الدَّين بداية الفترة + تراكم (إيراد − مقبوضات) لكل دلو.
    // دقيق باستثناء قيود التسوية اليدوية النادرة — موثّق في تعريف المؤشر.
    if (want.has('outstanding_balance')) {
      const startRow = await tx.$queryRawUnsafe<{ bal: string }[]>(
        `WITH bal AS (
           SELECT DISTINCT ON (le.customer_id) le.running_balance
           FROM ledger_entries le JOIN customers c ON c.id = le.customer_id
           WHERE le.tenant_id = $1::uuid AND c.archived_at IS NULL AND le.created_at < $2
           ORDER BY le.customer_id, le.seq DESC
         )
         SELECT COALESCE(SUM(running_balance) FILTER (WHERE running_balance > 0),0)::text AS bal FROM bal`,
        tenantId,
        new Date(range.from),
      );
      let running = toMoney(startRow[0]?.bal ?? '0');
      series.outstanding_balance = {
        id: 'outstanding_balance',
        unit: 'money',
        points: rows.map((r) => {
          running = running.plus(toMoney(r.revenue)).minus(toMoney(r.payments));
          return { bucket: r.bucket, value: toMoneyString(running, 2) };
        }),
      };
    }

    return scope.map((id) => series[id]).filter((s): s is TrendSeries => Boolean(s));
  }

  // ── القوائم المرتّبة ────────────────────────────────────────────────────────

  private async buildLists(
    tx: TxClient,
    tenantId: string,
    range: DashboardResolvedRange,
    now: Date,
    scope: ListId[],
    basis: TopCustomersBasis,
  ): Promise<Pick<DashboardData, 'topCustomers' | 'topDebtors' | 'recentPayments' | 'recentOrders'>> {
    const want = new Set(scope);
    const out: Pick<
      DashboardData,
      'topCustomers' | 'topDebtors' | 'recentPayments' | 'recentOrders'
    > = { topCustomers: [], topDebtors: [], recentPayments: [], recentOrders: [] };

    const jobs: Promise<void>[] = [];

    if (want.has('topCustomers')) {
      jobs.push(
        (async () => {
          const rows =
            basis === 'sales'
              ? await tx.$queryRawUnsafe<
                  { id: string; code: string; name: string; amount: string }[]
                >(
                  `SELECT c.id, c.code, c.name, COALESCE(SUM(o.total),0)::text AS amount
                   FROM customers c JOIN orders o ON o.customer_id = c.id
                   WHERE c.tenant_id = $1::uuid AND c.archived_at IS NULL AND ${sqlPrefixed(CONFIRMED_SALE, 'o')}
                     AND o.confirmed_at >= $2 AND o.confirmed_at < $3
                   GROUP BY c.id, c.code, c.name
                   HAVING SUM(o.total) > 0
                   ORDER BY SUM(o.total) DESC, c.id LIMIT 5`,
                  tenantId,
                  new Date(range.from),
                  new Date(range.to),
                )
              : await tx.$queryRawUnsafe<
                  { id: string; code: string; name: string; amount: string }[]
                >(
                  `SELECT c.id, c.code, c.name, COALESCE(SUM(p.amount),0)::text AS amount
                   FROM customers c JOIN payments p ON p.customer_id = c.id
                   WHERE c.tenant_id = $1::uuid AND c.archived_at IS NULL AND p.status = 'POSTED'
                     AND p.paid_at >= $2 AND p.paid_at < $3
                   GROUP BY c.id, c.code, c.name
                   HAVING SUM(p.amount) > 0
                   ORDER BY SUM(p.amount) DESC, c.id LIMIT 5`,
                  tenantId,
                  new Date(range.from),
                  new Date(range.to),
                );
          out.topCustomers = rows.map((r) => ({
            id: r.id,
            code: r.code,
            name: r.name,
            amount: toMoneyString(r.amount, 2),
          }));
        })(),
      );
    }

    if (want.has('topDebtors')) {
      jobs.push(
        (async () => {
          const rows = await tx.$queryRawUnsafe<
            {
              id: string;
              code: string;
              name: string;
              balance: string;
              oldest: Date | null;
              open_orders: bigint;
            }[]
          >(
            `WITH bal AS (
               SELECT DISTINCT ON (le.customer_id) le.customer_id, le.running_balance
               FROM ledger_entries le JOIN customers c ON c.id = le.customer_id
               WHERE le.tenant_id = $1::uuid AND c.archived_at IS NULL
               ORDER BY le.customer_id, le.seq DESC
             ),
             open AS (
               SELECT customer_id, MIN(due_at) FILTER (WHERE due_at < $2) AS oldest, COUNT(*) AS cnt
               FROM orders
               WHERE tenant_id = $1::uuid AND status IN ('CONFIRMED','PARTIALLY_PAID')
               GROUP BY customer_id
             )
             SELECT c.id, c.code, c.name, b.running_balance::text AS balance,
                    open.oldest AS oldest, COALESCE(open.cnt,0) AS open_orders
             FROM bal b JOIN customers c ON c.id = b.customer_id
             LEFT JOIN open ON open.customer_id = c.id
             WHERE b.running_balance > 0
             ORDER BY b.running_balance DESC, c.id LIMIT 5`,
            tenantId,
            now,
          );
          out.topDebtors = rows.map((r) => ({
            id: r.id,
            code: r.code,
            name: r.name,
            balance: toMoneyString(r.balance, 2),
            oldestOverdueAt: r.oldest ? r.oldest.toISOString() : null,
            openOrders: Number(r.open_orders),
          }));
        })(),
      );
    }

    if (want.has('recentPayments')) {
      jobs.push(
        (async () => {
          const rows = await tx.payment.findMany({
            where: { tenantId, status: 'POSTED' },
            orderBy: { createdAt: 'desc' },
            take: 5,
            include: { customer: { select: { id: true, name: true } } },
          });
          // `created_by` عمود UUID بلا علاقة Prisma — نجلب أسماء المسجّلين مرة واحدة.
          const userIds = [...new Set(rows.map((p) => p.createdBy).filter((v): v is string => !!v))];
          const users = userIds.length
            ? await tx.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } })
            : [];
          const nameById = new Map(users.map((u) => [u.id, u.name]));
          out.recentPayments = rows.map((p) => ({
            id: p.id,
            number: p.number,
            customerId: p.customerId,
            customerName: p.customer.name,
            amount: toMoneyString(p.amount.toString(), 2),
            method: p.method,
            paidAt: p.paidAt.toISOString(),
            createdByName: p.createdBy ? (nameById.get(p.createdBy) ?? null) : null,
          }));
        })(),
      );
    }

    if (want.has('recentOrders')) {
      jobs.push(
        (async () => {
          const rows = await tx.order.findMany({
            where: { tenantId, status: { not: 'CANCELLED' } },
            orderBy: { createdAt: 'desc' },
            take: 5,
            include: { customer: { select: { id: true, name: true } } },
          });
          out.recentOrders = rows.map((o) => ({
            id: o.id,
            number: o.number,
            customerId: o.customerId,
            customerName: o.customer.name,
            status: o.status,
            total: toMoneyString(o.total.toString(), 2),
            issuedAt: o.issuedAt.toISOString(),
          }));
        })(),
      );
    }

    await Promise.all(jobs);
    return out;
  }

  // ── التنبيهات ────────────────────────────────────────────────────────────────

  private async buildAlerts(
    tx: TxClient,
    tenantId: string,
    now: Date,
    perms: Set<string>,
  ): Promise<DashboardAlert[]> {
    const has = (...r: readonly string[]) => r.every((p) => perms.has(p));
    const alerts: DashboardAlert[] = [];

    // حدود قابلة للضبط (settings مستقبلًا) — موثّقة كثوابت الآن.
    const APPROACHING_PCT = 80;
    const LONG_OVERDUE_DAYS = 60;
    const STALE_DRAFT_DAYS = 14;

    if (has('ledger.read')) {
      const rows = await tx.$queryRawUnsafe<
        { id: string; name: string; balance: string; credit_limit: string; ratio: number }[]
      >(
        `WITH bal AS (
           SELECT DISTINCT ON (le.customer_id) le.customer_id, le.running_balance
           FROM ledger_entries le JOIN customers c ON c.id = le.customer_id
           WHERE le.tenant_id = $1::uuid AND c.archived_at IS NULL
           ORDER BY le.customer_id, le.seq DESC
         )
         SELECT c.id, c.name, b.running_balance::text AS balance, c.credit_limit::text AS credit_limit,
                (b.running_balance / NULLIF(c.credit_limit,0) * 100)::float8 AS ratio
         FROM bal b JOIN customers c ON c.id = b.customer_id
         WHERE c.credit_limit > 0 AND b.running_balance > 0
           AND b.running_balance >= c.credit_limit * ${APPROACHING_PCT} / 100.0
         ORDER BY ratio DESC LIMIT 20`,
        tenantId,
      );
      for (const r of rows) {
        const over = greaterThanOrEqual(r.balance, r.credit_limit);
        alerts.push({
          id: `credit:${r.id}`,
          kind: over ? 'over_credit_limit' : 'approaching_credit_limit',
          severity: over ? 'critical' : 'warning',
          message: over
            ? `${r.name} تجاوز حد الائتمان`
            : // eslint-disable-next-line no-restricted-properties -- نسبة عرض، لا مبلغ.
              `${r.name} قارب حد الائتمان (${Math.round(r.ratio)}%)`,
          amount: toMoneyString(r.balance, 2),
          entityType: 'Customer',
          entityId: r.id,
          actionHref: `/customers/${r.id}`,
          date: null,
        });
      }

      const longOverdue = await tx.$queryRawUnsafe<
        { customer_id: string; name: string; due: string; oldest: Date }[]
      >(
        `SELECT o.customer_id, c.name, SUM(o.total - o.paid_amount)::text AS due, MIN(o.due_at) AS oldest
         FROM orders o JOIN customers c ON c.id = o.customer_id
         WHERE o.tenant_id = $1::uuid AND o.status IN ('CONFIRMED','PARTIALLY_PAID')
           AND o.due_at < $2
         GROUP BY o.customer_id, c.name
         HAVING MIN(o.due_at) < $3
         ORDER BY MIN(o.due_at) ASC LIMIT 20`,
        tenantId,
        now,
        new Date(now.getTime() - LONG_OVERDUE_DAYS * 86_400_000),
      );
      for (const r of longOverdue) {
        alerts.push({
          id: `overdue:${r.customer_id}`,
          kind: 'long_overdue',
          severity: 'critical',
          message: `${r.name} متأخر أكثر من ${LONG_OVERDUE_DAYS} يومًا`,
          amount: toMoneyString(r.due, 2),
          entityType: 'Customer',
          entityId: r.customer_id,
          actionHref: `/customers/${r.customer_id}`,
          date: r.oldest.toISOString(),
        });
      }

      const [unalloc] = await tx.$queryRawUnsafe<{ amt: string; cnt: bigint }[]>(
        `SELECT COALESCE(SUM(p.amount - COALESCE(al.total,0)),0)::text AS amt,
                COUNT(*) FILTER (WHERE p.amount - COALESCE(al.total,0) > 0) AS cnt
         FROM payments p
         LEFT JOIN (SELECT payment_id, SUM(amount) total FROM payment_allocations GROUP BY payment_id) al
           ON al.payment_id = p.id
         WHERE p.tenant_id = $1::uuid AND p.status = 'POSTED'`,
        tenantId,
      );
      if (unalloc && Number(unalloc.cnt) > 0 && toMoney(unalloc.amt).greaterThan(toMoney('0'))) {
        alerts.push({
          id: 'unallocated',
          kind: 'unallocated_payments',
          severity: 'info',
          message: `${Number(unalloc.cnt)} دفعة غير موزّعة بالكامل`,
          amount: toMoneyString(unalloc.amt, 2),
          entityType: null,
          entityId: null,
          actionHref: '/payments',
          date: null,
        });
      }
    }

    if (has('orders.read')) {
      const [stale] = await tx.$queryRawUnsafe<{ cnt: bigint }[]>(
        `SELECT COUNT(*) AS cnt FROM orders
         WHERE tenant_id = $1::uuid AND status = 'DRAFT' AND archived_at IS NULL AND created_at < $2`,
        tenantId,
        new Date(now.getTime() - STALE_DRAFT_DAYS * 86_400_000),
      );
      if (stale && Number(stale.cnt) > 0) {
        alerts.push({
          id: 'stale-drafts',
          kind: 'stale_draft_orders',
          severity: 'info',
          message: `${Number(stale.cnt)} مسودة راكدة منذ أكثر من ${STALE_DRAFT_DAYS} يومًا`,
          amount: null,
          entityType: null,
          entityId: null,
          actionHref: '/orders?status=DRAFT',
          date: null,
        });
      }
    }

    if (has('subscription.read')) {
      const sub = await tx.subscription.findFirst({
        where: { tenantId, status: { in: ['ACTIVE', 'TRIALING', 'PAST_DUE'] } },
        orderBy: { createdAt: 'desc' },
        select: { currentPeriodEnd: true },
      });
      if (sub?.currentPeriodEnd) {
        const daysLeft = Math.ceil((sub.currentPeriodEnd.getTime() - now.getTime()) / 86_400_000);
        if (daysLeft <= 7) {
          alerts.push({
            id: 'subscription',
            kind: 'subscription_ending',
            severity: daysLeft <= 3 ? 'critical' : 'warning',
            message:
              daysLeft <= 0 ? 'انتهى اشتراكك' : `اشتراكك ينتهي خلال ${daysLeft} ${daysLeft === 1 ? 'يوم' : 'أيام'}`,
            amount: null,
            entityType: null,
            entityId: null,
            actionHref: '/subscription',
            date: sub.currentPeriodEnd.toISOString(),
          });
        }
      }
    }

    return alerts;
  }
}

// ── مساعدات بناء المؤشرات ──────────────────────────────────────────────────────

function trendOf(cur: string, prev: string | null, positiveIsGood: boolean): KpiMetric['trend'] {
  if (prev === null) return 'flat';
  const d = toMoney(cur).minus(toMoney(prev));
  if (d.isZero()) return 'flat';
  const rising = d.greaterThan(toMoney('0'));
  // «up» تعني تحسّنًا: للمؤشر السلبي (كالديون) يكون التحسّن انخفاضًا.
  return rising === positiveIsGood ? 'up' : 'down';
}

function deltaPct(cur: string, prev: string | null): number | null {
  if (prev === null) return null;
  const p = toMoney(prev);
  if (p.isZero()) return toMoney(cur).greaterThan(toMoney('0')) ? 100 : null;
  // eslint-disable-next-line no-restricted-properties -- نسبة عرض، لا مبلغ.
  return Math.round(toMoney(cur).minus(p).dividedBy(p).times(100).toNumber());
}

function money(id: DashboardKpiId, cur: string, prev: string | null): KpiMetric {
  const meta = DASHBOARD_KPI_META[id];
  return {
    id,
    unit: 'money',
    value: toMoneyString(cur, 2),
    previous: prev === null ? null : toMoneyString(prev, 2),
    deltaPct: deltaPct(cur, prev),
    trend: trendOf(cur, prev, meta.positiveIsGood),
  };
}

function count(id: DashboardKpiId, cur: bigint | number, prev: bigint | number | null): KpiMetric {
  const meta = DASHBOARD_KPI_META[id];
  const c = String(Number(cur));
  const p = prev === null ? null : String(Number(prev));
  return {
    id,
    unit: 'count',
    value: c,
    previous: p,
    deltaPct: deltaPct(c, p),
    trend: trendOf(c, p, meta.positiveIsGood),
  };
}

function percent(id: DashboardKpiId, cur: number | null, prev: number | null): KpiMetric {
  const meta = DASHBOARD_KPI_META[id];
  /* eslint-disable no-restricted-syntax, no-restricted-properties -- نسبة مئوية للعرض، لا مبلغ. */
  const c = cur === null ? '0.00' : cur.toFixed(2);
  const p = prev === null ? null : prev.toFixed(2);
  const delta = cur === null || prev === null || prev === 0 ? null : Math.round(cur - prev);
  /* eslint-enable no-restricted-syntax, no-restricted-properties */
  return {
    id,
    unit: 'percent',
    value: c,
    previous: p,
    deltaPct: delta,
    trend: cur === null || prev === null ? 'flat' : trendOf(c, p, meta.positiveIsGood),
  };
}

/** متوسط قيمة الطلب — الإيراد ÷ عدد الطلبات المؤكدة (صفر بدل NaN). */
function aov(revenue: string, confirmed: bigint | number): string {
  const n = Number(confirmed);
  if (n === 0) return '0';
  return toMoneyString(divide(revenue, String(n)), 4);
}

/** نسبة التحصيل المئوية، أو null إذا الإيراد صفر (لا NaN/Infinity). */
function ratePct(payments: string, revenue: string): number | null {
  const rev = toMoney(revenue);
  if (rev.isZero()) return null;
  return divide(payments, rev).times(100).toNumber();
}

function pointsSeries<R extends { bucket: string }>(
  id: DashboardTrendId,
  unit: 'money' | 'count',
  rows: R[],
  value: (r: R) => string,
): TrendSeries {
  return { id, unit, points: rows.map((r) => ({ bucket: r.bucket, value: value(r) })) };
}

/** يضيف بادئة جدول لشرط SQL نصّي بسيط (لتفادي التباس أسماء الأعمدة في JOIN). */
function sqlPrefixed(condition: string, alias: string): string {
  return condition.replace(/\bstatus\b/g, `${alias}.status`);
}
