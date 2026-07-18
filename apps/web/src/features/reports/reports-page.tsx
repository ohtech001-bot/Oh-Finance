import { useState } from 'react';
import { Link } from 'react-router-dom';
import { BarChart3, CreditCard, Download, Printer, ShoppingBag, TrendingUp, User, Users, Wallet } from 'lucide-react';
import { PAYMENT_METHOD_LABELS } from '@oh/contracts';
import { formatMoney, type CurrencyCode } from '@oh/money';
import {
  Avatar,
  Button,
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
import { downloadReportCsv, printReport } from './export';

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
  const { data, isLoading, isError, error, refetch } = useReports(ready ? range : { preset: 'last_30_days' });

  return (
    <div className="space-y-6">
      <PageHeader
        title="التقارير"
        icon={BarChart3}
        breadcrumbs={[{ label: 'الرئيسية', href: '/' }, { label: 'التقارير' }]}
        linkAs={Link}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={printReport} disabled={!data}>
              <Printer aria-hidden /> طباعة
            </Button>
            <Button variant="brand" onClick={() => data && downloadReportCsv(data)} disabled={!data}>
              <Download aria-hidden /> تصدير التقرير
            </Button>
          </div>
        }
      />

      <Card>
        <CardBody className="py-3">
          <RangePicker value={range} onChange={setRange} />
        </CardBody>
      </Card>

      {isLoading ? (
        <StatCardsSkeleton count={5} />
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
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <StatCard label="المبلغ المتبقي (الديون)" money={data.kpis.outstanding.value} currency={currency} moneyTone="debit" icon={Wallet} tone="debit" />
            <StatCard label="إجمالي المدفوعات" money={data.kpis.payments.value} currency={currency} moneyTone="credit" icon={CreditCard} tone="credit" />
            <StatCard label="إجمالي المبيعات (الطلبات)" money={data.kpis.sales.value} currency={currency} icon={ShoppingBag} tone="brand" sublabel={`عدد الطلبات: ${data.kpis.ordersCount.value}`} />
            <StatCard label="عدد الزبائن النشطين" value={data.kpis.activeCustomers.value} icon={Users} tone="purple" sublabel={`من أصل ${data.kpis.totalCustomers} زبون`} />
            <StatCard label="متوسط قيمة الطلب" money={data.kpis.averageOrderValue.value} currency={currency} icon={TrendingUp} tone="orange" />
          </div>

          {/* ── صف المخططات الثلاثة ──────────────────────────────────── */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Card>
              <CardHeader title="توزيع المبيعات حسب الفئات" />
              <CardBody>
                {/* مؤجَّل بحالة صريحة — لا بيانات وهمية. */}
                <div className="flex h-[220px] flex-col items-center justify-center gap-2 text-center text-[13px] text-fg-muted">
                  <BarChart3 className="size-8 text-fg-subtle" aria-hidden />
                  <p>يتطلب تصنيف المنتجات</p>
                  <p className="text-xs text-fg-subtle">{data.salesByCategory.reason}</p>
                </div>
              </CardBody>
            </Card>

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
                        <Link to={`/customers/${c.id}`} className="flex items-center justify-between gap-2 rounded-ctrl px-2 py-2 hover:bg-card-muted">
                          <MoneyText value={c.purchases} currency={currency} tone="plain" size="sm" />
                          <div className="flex flex-1 items-center justify-end gap-2.5">
                            <span className="truncate text-[13px] font-medium text-fg">{c.name}</span>
                            <Avatar name={c.name} size="sm" />
                            <span className="w-4 text-center text-xs text-fg-subtle">{i + 1}</span>
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
                      <li key={p.name} className="flex items-center justify-between gap-2 rounded-ctrl px-2 py-2">
                        <MoneyText value={p.sales} currency={currency} tone="plain" size="sm" />
                        <span className="text-xs text-fg-muted tabular-nums" dir="ltr">
                          {Number(p.quantity)}
                        </span>
                        <div className="flex flex-1 items-center justify-end gap-2.5">
                          <span className="truncate text-[13px] text-fg">{p.name}</span>
                          <ShoppingBag className="size-4 text-fg-subtle" aria-hidden />
                          <span className="w-4 text-center text-xs text-fg-subtle">{i + 1}</span>
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
                <ul className="mt-3 space-y-2 border-t border-border pt-3">
                  {data.paymentMethods.map((m) => (
                    <li key={m.method} className="flex items-center justify-between gap-2 text-[13px]">
                      <span className="tabular-nums text-fg-muted" dir="ltr">
                        {formatMoney(m.amount, { currency, withSymbol: false })}
                      </span>
                      <span className="flex-1 text-end text-fg-muted">{PAYMENT_METHOD_LABELS[m.method]}</span>
                      <span className="tabular-nums font-semibold text-fg" dir="ltr">{m.pct}%</span>
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
                    <li key={e.userId ?? 'system'} className="flex items-center justify-between gap-3 rounded-ctrl px-2 py-2">
                      <div className="flex items-center gap-4">
                        <span className="text-[13px] text-fg-muted">مبيعات: <MoneyText value={e.sales} currency={currency} tone="plain" size="sm" /></span>
                        <span className="text-[13px] text-fg-muted">مقبوضات: <MoneyText value={e.payments} currency={currency} tone="credit" size="sm" /></span>
                        <span className="text-[13px] text-fg-muted tabular-nums">{e.orders} طلب</span>
                      </div>
                      <div className="flex flex-1 items-center justify-end gap-2.5">
                        <span className="truncate text-[13px] font-medium text-fg">{e.name}</span>
                        <User className="size-4 text-fg-subtle" aria-hidden />
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
  return <p className="py-8 text-center text-[13px] text-fg-subtle">{text}</p>;
}
