import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  Info,
  LayoutDashboard,
  OctagonAlert,
} from 'lucide-react';
import { PERMISSIONS } from '@oh/config';
import {
  PAYMENT_METHOD_LABELS,
  type DashboardAlert,
  type DashboardData,
} from '@oh/contracts';
import { formatMoney, type CurrencyCode } from '@oh/money';
import {
  Avatar,
  Card,
  CardBody,
  CardHeader,
  ErrorState,
  MoneyText,
  PageHeader,
  StatCardsSkeleton,
  StatusBadge,
  ORDER_STATUS_BADGE,
} from '@oh/ui';
import { ApiRequestError } from '@/lib/api';
import { useAuth } from '@/app/auth-context';
import { ActivityFeed } from '@/features/activity/activity-feed';
import { useStoreActivityFeed } from '@/features/activity/api';
import { useDashboard } from './api';
import { TrendChart } from './charts';
import { KpiCard } from './kpi-card';
import { RangePicker, type RangeValue } from './range-picker';

/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  لوحة تحكم المحل — المرحلة 3.5 / Increment 3.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  ⚠️ كل رقم من الخادم (`GET /dashboard`) المشتق من قاعدة البيانات بمنطقة المحل.
 *     لا Mock Data ولا حساب مالي في الواجهة. الأقسام تُرشَّح بالصلاحيات على
 *     الخادم؛ الواجهة تعرض ما تستلمه فقط.
 */
export function DashboardPage() {
  const { user, can } = useAuth();
  const currency = (user?.store?.currency ?? 'ILS') as CurrencyCode;
  const canSeeActivity = can(PERMISSIONS.ACTIVITY_READ);

  const [range, setRange] = useState<RangeValue>({ preset: 'this_month' });
  // لا نطلق الاستعلام لفترة مخصّصة ناقصة التواريخ.
  const ready = range.preset !== 'custom' || Boolean(range.from && range.to);

  const { data, isLoading, isError, error, refetch } = useDashboard(ready ? range : { preset: 'this_month' });
  const activityFeed = useStoreActivityFeed({ pageSize: 8 }, canSeeActivity);

  const moneyTrends = data?.trends.filter((s) => s.unit === 'money') ?? [];
  const countTrends = data?.trends.filter((s) => s.unit === 'count') ?? [];
  const scope = data?.meta.scope;

  return (
    <div className="space-y-6">
      <PageHeader
        title="لوحة التحكم"
        icon={LayoutDashboard}
        description={data ? `${data.meta.storeName} · ${data.meta.range.label}` : user?.store?.name}
      />

      <Card>
        <CardBody className="py-3">
          <RangePicker value={range} onChange={setRange} />
        </CardBody>
      </Card>

      {isLoading ? (
        <StatCardsSkeleton count={4} />
      ) : isError ? (
        <Card>
          <ErrorState
            message={error instanceof ApiRequestError ? error.message : 'تعذّر تحميل لوحة التحكم.'}
            requestId={error instanceof ApiRequestError ? error.requestId : undefined}
            onRetry={() => void refetch()}
          />
        </Card>
      ) : data ? (
        <>
          {data.alerts.length > 0 ? <AlertsPanel alerts={data.alerts} currency={currency} /> : null}

          {/* ── المؤشرات ─────────────────────────────────────────────── */}
          {data.kpis.length > 0 ? (
            <section aria-label="المؤشرات المالية">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                {data.kpis.map((m) => (
                  <KpiCard key={m.id} metric={m} currency={currency} />
                ))}
              </div>
            </section>
          ) : null}

          {/* ── المنحنيات ────────────────────────────────────────────── */}
          {moneyTrends.length > 0 || countTrends.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {moneyTrends.length > 0 ? (
                <Card>
                  <CardHeader title="اتجاه المبالغ" />
                  <CardBody>
                    <TrendChart series={moneyTrends} currency={currency} />
                  </CardBody>
                </Card>
              ) : null}
              {countTrends.length > 0 ? (
                <Card>
                  <CardHeader title="اتجاه الأعداد" />
                  <CardBody>
                    <TrendChart series={countTrends} currency={currency} />
                  </CardBody>
                </Card>
              ) : null}
            </div>
          ) : null}

          {/* ── القوائم المرتّبة ─────────────────────────────────────── */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-4">
            {scope?.lists.includes('recentOrders') ? (
              <Card>
                <CardHeader title="أحدث الطلبات" action={<ViewAll to="/orders" />} />
                <CardBody className="space-y-1">
                  {data.recentOrders.length === 0 ? (
                    <Empty text="لا توجد طلبات في هذه الفترة." />
                  ) : (
                    data.recentOrders.map((o) => {
                      const badge = ORDER_STATUS_BADGE[o.status];
                      return (
                        <Link
                          key={o.id}
                          to={`/orders/${o.id}`}
                          className="flex items-center justify-between gap-2 rounded-ctrl px-2 py-2 hover:bg-card-muted"
                        >
                          <MoneyText value={o.total} currency={currency} tone="plain" size="sm" />
                          <StatusBadge tone={badge.tone}>{badge.label}</StatusBadge>
                          <span className="flex-1 truncate text-end text-[13px] text-fg">{o.customerName}</span>
                        </Link>
                      );
                    })
                  )}
                </CardBody>
              </Card>
            ) : null}

            {scope?.lists.includes('recentPayments') ? (
              <Card>
                <CardHeader title="أحدث الدفعات" action={<ViewAll to="/payments" />} />
                <CardBody className="space-y-1">
                  {data.recentPayments.length === 0 ? (
                    <Empty text="لا توجد دفعات في هذه الفترة." />
                  ) : (
                    data.recentPayments.map((p) => (
                      <div key={p.id} className="flex items-center justify-between gap-2 rounded-ctrl px-2 py-2">
                        <MoneyText value={p.amount} currency={currency} tone="credit" size="sm" />
                        <span className="text-xs text-fg-muted">{PAYMENT_METHOD_LABELS[p.method]}</span>
                        <div className="flex flex-1 flex-col items-end">
                          <span className="truncate text-[13px] text-fg">{p.customerName}</span>
                          {p.createdByName ? (
                            <span className="text-[11px] text-fg-subtle">سجّلها: {p.createdByName}</span>
                          ) : null}
                        </div>
                      </div>
                    ))
                  )}
                </CardBody>
              </Card>
            ) : null}

            {scope?.lists.includes('topDebtors') ? (
              <Card>
                <CardHeader title="أعلى المدينين" action={<ViewAll to="/customers" />} />
                <CardBody className="space-y-1">
                  {data.topDebtors.length === 0 ? (
                    <Empty text="لا يوجد زبائن مدينون." />
                  ) : (
                    data.topDebtors.map((c) => (
                      <Link
                        key={c.id}
                        to={`/customers/${c.id}`}
                        className="flex items-center justify-between gap-3 rounded-ctrl px-2 py-2 hover:bg-card-muted"
                      >
                        <MoneyText value={c.balance} currency={currency} tone="debit" size="sm" />
                        <div className="flex flex-1 items-center justify-end gap-2.5">
                          <div className="flex flex-col items-end">
                            <span className="truncate text-[13px] font-medium text-fg">{c.name}</span>
                            <span className="text-[11px] text-fg-subtle">
                              {c.openOrders} طلب مفتوح
                            </span>
                          </div>
                          <Avatar name={c.name} size="sm" />
                        </div>
                      </Link>
                    ))
                  )}
                </CardBody>
              </Card>
            ) : null}

            {scope?.lists.includes('topCustomers') ? (
              <Card>
                <CardHeader
                  title={data.meta.topCustomersBasis === 'sales' ? 'أعلى الزبائن مبيعًا' : 'أعلى الزبائن تحصيلًا'}
                  action={<ViewAll to="/customers" />}
                />
                <CardBody className="space-y-1">
                  {data.topCustomers.length === 0 ? (
                    <Empty text="لا توجد بيانات في هذه الفترة." />
                  ) : (
                    data.topCustomers.map((c) => (
                      <Link
                        key={c.id}
                        to={`/customers/${c.id}`}
                        className="flex items-center justify-between gap-3 rounded-ctrl px-2 py-2 hover:bg-card-muted"
                      >
                        <span className="tabular-nums text-[13px] text-fg" dir="ltr">
                          {formatMoney(c.amount, { currency })}
                        </span>
                        <div className="flex flex-1 items-center justify-end gap-2.5">
                          <span className="truncate text-[13px] font-medium text-fg">{c.name}</span>
                          <Avatar name={c.name} size="sm" />
                        </div>
                      </Link>
                    ))
                  )}
                </CardBody>
              </Card>
            ) : null}
          </div>

          {/* ── النشاط الأخير — يظهر فقط لمن يملك activity.read ─────────── */}
          {canSeeActivity ? (
            <Card>
              <CardHeader title="النشاط الأخير" />
              <CardBody className="pt-0">
                <ActivityFeed
                  items={activityFeed.data?.items ?? []}
                  loading={activityFeed.isLoading}
                  emptyText="لا يوجد نشاط في المحل بعد."
                />
              </CardBody>
            </Card>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

// ── مكوّنات مساعدة ──────────────────────────────────────────────────────────

const ALERT_STYLE = {
  critical: { bg: 'bg-danger-soft', fg: 'text-danger', icon: OctagonAlert },
  warning: { bg: 'bg-warning-soft', fg: 'text-warning', icon: AlertTriangle },
  info: { bg: 'bg-accent-soft', fg: 'text-accent', icon: Info },
} as const;

function AlertsPanel({ alerts, currency }: { alerts: DashboardAlert[]; currency: CurrencyCode }) {
  return (
    <div className="space-y-2">
      {alerts.map((a) => {
        const s = ALERT_STYLE[a.severity];
        const Icon = s.icon;
        const body = (
          <div className={`flex items-center gap-3 rounded-card px-4 py-3 text-[13px] ${s.bg} ${s.fg}`}>
            <Icon className="size-4 shrink-0" aria-hidden />
            <span className="flex-1">{a.message}</span>
            {a.amount ? (
              <span className="tabular-nums font-semibold" dir="ltr">
                {formatMoney(a.amount, { currency, withSymbol: false })}
              </span>
            ) : null}
          </div>
        );
        return a.actionHref ? (
          <Link key={a.id} to={a.actionHref} className="block">
            {body}
          </Link>
        ) : (
          <div key={a.id}>{body}</div>
        );
      })}
    </div>
  );
}

function ViewAll({ to }: { to: string }) {
  return (
    <Link to={to} className="flex items-center gap-1 text-[13px] font-medium text-accent hover:underline">
      عرض الكل
      <ArrowLeft className="size-3.5 ltr:rotate-180" aria-hidden />
    </Link>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="py-8 text-center text-[13px] text-fg-subtle">{text}</p>;
}

export type { DashboardData };
