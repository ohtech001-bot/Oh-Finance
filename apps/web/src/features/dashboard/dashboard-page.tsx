import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, Info, LayoutDashboard, OctagonAlert } from 'lucide-react';
import { PAYMENT_METHOD_LABELS, type DashboardAlert, type DashboardData } from '@oh/contracts';
import { formatMoney, type CurrencyCode } from '@oh/money';
import {
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
import { useDashboard } from './api';
import { CollectionRateChart, TrendChart } from './charts';
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
  const { user } = useAuth();
  const currency = (user?.store?.currency ?? 'ILS') as CurrencyCode;

  const [range, setRange] = useState<RangeValue>({ preset: 'today' });
  // لا نطلق الاستعلام لفترة مخصّصة ناقصة التواريخ.
  const ready = range.preset !== 'custom' || Boolean(range.from && range.to);

  const { data, isLoading, isError, error, refetch } = useDashboard(
    ready ? range : { preset: 'today' },
  );

  const moneyTrends = data?.trends.filter((s) => s.unit === 'money') ?? [];
  const countTrends = data?.trends.filter((s) => s.unit === 'count') ?? [];
  const scope = data?.meta.scope;
  const collectionRate = data?.kpis.find((metric) => metric.id === 'collection_rate');
  const cardKpis = data?.kpis.filter((metric) => metric.id !== 'collection_rate') ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="لوحة التحكم"
        icon={LayoutDashboard}
        description={data ? `${data.meta.storeName} · ${data.meta.range.label}` : user?.store?.name}
      />

      <div className="flex justify-end">
        <RangePicker value={range} onChange={setRange} />
      </div>

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
          {cardKpis.length > 0 || collectionRate ? (
            <section aria-label="المؤشرات المالية">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {cardKpis.map((m) => (
                  <KpiCard key={m.id} metric={m} currency={currency} />
                ))}
                {collectionRate ? <CollectionRateChart metric={collectionRate} /> : null}
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
                          className="rounded-ctrl hover:bg-card-muted flex items-center justify-between gap-2 px-2 py-2"
                        >
                          <MoneyText value={o.total} currency={currency} tone="plain" size="sm" />
                          <StatusBadge tone={badge.tone}>{badge.label}</StatusBadge>
                          <span className="text-fg flex-1 truncate text-end text-[13px]">
                            {o.customerName}
                          </span>
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
                      <div
                        key={p.id}
                        className="rounded-ctrl flex items-center justify-between gap-2 px-2 py-2"
                      >
                        <MoneyText value={p.amount} currency={currency} tone="credit" size="sm" />
                        <span className="text-fg-muted text-xs">
                          {PAYMENT_METHOD_LABELS[p.method]}
                        </span>
                        <div className="flex flex-1 flex-col items-end">
                          <span className="text-fg truncate text-[13px]">{p.customerName}</span>
                          {p.createdByName ? (
                            <span className="text-fg-subtle text-[11px]">
                              سجّلها: {p.createdByName}
                            </span>
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
                        className="rounded-ctrl hover:bg-card-muted flex items-center justify-between gap-3 px-2 py-2"
                      >
                        <MoneyText value={c.balance} currency={currency} tone="debit" size="sm" />
                        <div className="flex flex-1 items-center justify-end gap-2.5">
                          <div className="flex flex-col items-end">
                            <span className="text-fg truncate text-[13px] font-medium">
                              {c.name}
                            </span>
                            <span className="text-fg-subtle text-[11px]">
                              {c.openOrders} طلب مفتوح
                            </span>
                          </div>
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
                  title={
                    data.meta.topCustomersBasis === 'sales'
                      ? 'أعلى الزبائن مبيعًا'
                      : 'أعلى الزبائن تحصيلًا'
                  }
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
                        className="rounded-ctrl hover:bg-card-muted flex items-center justify-between gap-3 px-2 py-2"
                      >
                        <span className="text-fg text-[13px] tabular-nums" dir="ltr">
                          {formatMoney(c.amount, { currency })}
                        </span>
                        <div className="flex flex-1 items-center justify-end gap-2.5">
                          <span className="text-fg truncate text-[13px] font-medium">{c.name}</span>
                        </div>
                      </Link>
                    ))
                  )}
                </CardBody>
              </Card>
            ) : null}
          </div>
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
          <div
            className={`rounded-card flex items-center gap-3 px-4 py-3 text-[13px] ${s.bg} ${s.fg}`}
          >
            <Icon className="size-4 shrink-0" aria-hidden />
            <span className="flex-1">{a.message}</span>
            {a.amount ? (
              <span className="font-semibold tabular-nums" dir="ltr">
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
    <Link
      to={to}
      className="text-accent flex items-center gap-1 text-[13px] font-medium hover:underline"
    >
      عرض الكل
      <ArrowLeft className="size-3.5 ltr:rotate-180" aria-hidden />
    </Link>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="text-fg-subtle py-8 text-center text-[13px]">{text}</p>;
}

export type { DashboardData };
