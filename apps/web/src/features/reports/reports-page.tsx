import { useState } from 'react';
import { Link } from 'react-router-dom';
import { BarChart3, ShoppingBag, User, Users, Wallet } from 'lucide-react';
import { PAYMENT_METHOD_LABELS } from '@oh/contracts';
import { formatMoney, type CurrencyCode } from '@oh/money';
import {
  Card,
  CardBody,
  CardHeader,
  ErrorState,
  MoneyText,
  PageHeader,
  StatCard,
  StatCardsSkeleton,
} from '@oh/ui';
import { ApiRequestError } from '@/lib/api';
import { useAuth } from '@/app/auth-context';
import { RangePicker, type RangeValue } from '@/features/dashboard/range-picker';
import { useReports } from './api';
import { PaymentMethodsDonut, SalesPaymentsLine, WeekdayBars } from './reports-charts';

/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  التقارير — المرحلة 4 / Increment 4.1. مطابقة لـ`ui/other screens/التقارير.jpeg`.
 * ═══════════════════════════════════════════════════════════════════════════
 *  كل رقم من الخادم (`GET /reports`) المشتق من قاعدة البيانات بمنطقة المحل.
 *  لا حساب في الواجهة، لا بيانات وهمية.
 */
export function ReportsPage() {
  const { user } = useAuth();
  const currency = (user?.store?.currency ?? 'ILS') as CurrencyCode;
  const [range, setRange] = useState<RangeValue>({ preset: 'last_30_days' });
  const ready = range.preset !== 'custom' || Boolean(range.from && range.to);
  const { data, isLoading, isError, error, refetch } = useReports(
    ready ? range : { preset: 'last_30_days' },
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="التقارير"
        icon={BarChart3}
        breadcrumbs={[{ label: 'الرئيسية', href: '/' }, { label: 'التقارير' }]}
        linkAs={Link}
      />

      <Card>
        <CardBody className="py-3">
          <RangePicker value={range} onChange={setRange} />
        </CardBody>
      </Card>

      {isLoading ? (
        <StatCardsSkeleton count={3} />
      ) : isError ? (
        <Card>
          <ErrorState
            message={error instanceof ApiRequestError ? error.message : 'تعذّر تحميل التقارير.'}
            requestId={error instanceof ApiRequestError ? error.requestId : undefined}
            onRetry={() => void refetch()}
          />
        </Card>
      ) : data ? (
        <>
          {/* ── المؤشرات ─────────────────────────────────────────────── */}
          <div className="space-y-3 sm:space-y-4">
            <StatCard
              label="المبلغ المتبقي (الديون)"
              money={data.kpis.outstanding.value}
              currency={currency}
              moneyTone="debit"
              icon={Wallet}
              tone="debit"
            />
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              <StatCard
                label="إجمالي الطلبات"
                value={Number(data.kpis.ordersCount.value)}
                icon={ShoppingBag}
                tone="brand"
              />
              <StatCard
                label="عدد الزبائن الكلي"
                value={data.kpis.totalCustomers}
                icon={Users}
                tone="purple"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader title="المبيعات والمدفوعات" />
              <CardBody>
                <SalesPaymentsLine data={data.salesVsPayments} currency={currency} />
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="عدد الطلبات حسب اليوم" />
              <CardBody>
                <WeekdayBars data={data.ordersByWeekday} />
              </CardBody>
            </Card>
          </div>

          {/* ── صف القوائم الثلاثة ───────────────────────────────────── */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Card>
              <CardHeader title="أعلى الزبائن مبيعًا" />
              <CardBody>
                {data.topCustomers.length === 0 ? (
                  <Empty text="لا توجد مبيعات في الفترة." />
                ) : (
                  <ol className="space-y-1">
                    {data.topCustomers.map((c, i) => (
                      <li key={c.id}>
                        <Link
                          to={`/customers/${c.id}`}
                          className="rounded-ctrl hover:bg-card-muted flex items-center justify-between gap-2 px-2 py-2"
                        >
                          <MoneyText
                            value={c.purchases}
                            currency={currency}
                            tone="plain"
                            size="sm"
                          />
                          <div className="flex flex-1 items-center justify-end gap-2.5">
                            <span className="text-fg truncate text-[13px] font-medium">
                              {c.name}
                            </span>
                            <span className="text-fg-subtle w-4 text-center text-xs">{i + 1}</span>
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ol>
                )}
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="أكثر المنتجات مبيعًا" />
              <CardBody>
                {data.topProducts.length === 0 ? (
                  <Empty text="لا توجد منتجات مباعة في الفترة." />
                ) : (
                  <ol className="space-y-1">
                    {data.topProducts.map((p, i) => (
                      <li
                        key={p.name}
                        className="rounded-ctrl flex items-center justify-between gap-2 px-2 py-2"
                      >
                        <MoneyText value={p.sales} currency={currency} tone="plain" size="sm" />
                        <span className="text-fg-muted text-xs tabular-nums" dir="ltr">
                          {Number(p.quantity)}
                        </span>
                        <div className="flex flex-1 items-center justify-end gap-2.5">
                          <span className="text-fg truncate text-[13px]">{p.name}</span>
                          <ShoppingBag className="text-fg-subtle size-4" aria-hidden />
                          <span className="text-fg-subtle w-4 text-center text-xs">{i + 1}</span>
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="ملخص طرق الدفع" />
              <CardBody>
                <PaymentMethodsDonut data={data.paymentMethods} currency={currency} />
                <ul className="border-border mt-3 space-y-2 border-t pt-3">
                  {data.paymentMethods.map((m) => (
                    <li
                      key={m.method}
                      className="flex items-center justify-between gap-2 text-[13px]"
                    >
                      <span className="text-fg-muted tabular-nums" dir="ltr">
                        {formatMoney(m.amount, { currency, withSymbol: false })}
                      </span>
                      <span className="text-fg-muted flex-1 text-end">
                        {PAYMENT_METHOD_LABELS[m.method]}
                      </span>
                      <span className="text-fg font-semibold tabular-nums" dir="ltr">
                        {m.pct}%
                      </span>
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          </div>

          {/* ── أداء الموظفين (أساسي) ────────────────────────────────── */}
          {data.employeePerformance.length > 0 ? (
            <Card>
              <CardHeader title="أداء الموظفين" />
              <CardBody>
                <ul className="space-y-1">
                  {data.employeePerformance.map((e) => (
                    <li
                      key={e.userId ?? 'system'}
                      className="rounded-ctrl flex items-center justify-between gap-3 px-2 py-2"
                    >
                      <div className="flex items-center gap-4">
                        <span className="text-fg-muted text-[13px]">
                          مبيعات:{' '}
                          <MoneyText value={e.sales} currency={currency} tone="plain" size="sm" />
                        </span>
                        <span className="text-fg-muted text-[13px]">
                          مقبوضات:{' '}
                          <MoneyText
                            value={e.payments}
                            currency={currency}
                            tone="credit"
                            size="sm"
                          />
                        </span>
                        <span className="text-fg-muted text-[13px] tabular-nums">
                          {e.orders} طلب
                        </span>
                      </div>
                      <div className="flex flex-1 items-center justify-end gap-2.5">
                        <span className="text-fg truncate text-[13px] font-medium">{e.name}</span>
                        <User className="text-fg-subtle size-4" aria-hidden />
                      </div>
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="text-fg-subtle py-8 text-center text-[13px]">{text}</p>;
}
