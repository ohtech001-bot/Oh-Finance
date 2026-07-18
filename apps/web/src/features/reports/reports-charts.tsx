import { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatMoney, type CurrencyCode } from '@oh/money';
import { PAYMENT_METHOD_LABELS, type ReportsData } from '@oh/contracts';

const SALES = '#16A34A';
const PAYMENTS = '#2563EB';
const BAR = '#A78BFA';
const METHOD_COLORS = ['#16A34A', '#2563EB', '#F59E0B', '#7C3AED'];
const GRID = '#E2E8F0';
const AXIS = '#94A3B8';

const tip: React.CSSProperties = {
  borderRadius: 10, border: '1px solid #E2E8F0', boxShadow: '0 10px 24px rgba(16,24,40,.12)',
  fontSize: 12, direction: 'rtl',
};
function short(v: number): string {
  // eslint-disable-next-line no-restricted-properties -- تسمية محور بصرية، لا مبلغ.
  return Math.abs(v) >= 1000 ? `${Math.round(v / 1000)}k` : String(v);
}

export function SalesPaymentsLine({ data, currency }: { data: ReportsData['salesVsPayments']; currency: CurrencyCode }) {
  const chart = useMemo(
    () => data.map((p) => ({ label: p.date.slice(5), sales: Number(p.sales), payments: Number(p.payments) })),
    [data],
  );
  if (chart.every((d) => d.sales === 0 && d.payments === 0))
    return <Empty h={260} />;
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={chart} margin={{ top: 8, right: 8, left: 8, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
        <XAxis dataKey="label" tick={{ fill: AXIS, fontSize: 11 }} axisLine={{ stroke: GRID }} tickLine={false} reversed />
        <YAxis orientation="right" tick={{ fill: AXIS, fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={short} width={44} />
        <Tooltip formatter={(v: number, n) => [formatMoney(String(v), { currency }), n === 'sales' ? 'المبيعات' : 'المدفوعات']} contentStyle={tip} />
        <Legend formatter={(v) => (v === 'sales' ? 'المبيعات' : 'المدفوعات')} iconType="circle" wrapperStyle={{ fontSize: 12 }} />
        <Line type="monotone" dataKey="payments" stroke={PAYMENTS} strokeWidth={2} dot={false} activeDot={{ r: 5 }} />
        <Line type="monotone" dataKey="sales" stroke={SALES} strokeWidth={2} dot={false} activeDot={{ r: 5 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function WeekdayBars({ data }: { data: ReportsData['ordersByWeekday'] }) {
  const chart = useMemo(() => data.map((d) => ({ label: d.label, count: d.count })), [data]);
  if (chart.every((d) => d.count === 0)) return <Empty h={260} />;
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={chart} margin={{ top: 8, right: 8, left: 8, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
        <XAxis dataKey="label" tick={{ fill: AXIS, fontSize: 11 }} axisLine={{ stroke: GRID }} tickLine={false} reversed />
        <YAxis orientation="right" tick={{ fill: AXIS, fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} width={32} />
        <Tooltip formatter={(v: number) => [v, 'عدد الطلبات']} contentStyle={tip} cursor={{ fill: 'rgba(167,139,250,.1)' }} />
        <Bar dataKey="count" fill={BAR} radius={[6, 6, 0, 0]} maxBarSize={36} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function PaymentMethodsDonut({ data, currency }: { data: ReportsData['paymentMethods']; currency: CurrencyCode }) {
  const chart = useMemo(() => data.map((m) => ({ name: PAYMENT_METHOD_LABELS[m.method], value: Number(m.amount) })), [data]);
  if (chart.length === 0) return <Empty h={200} text="لا مقبوضات في الفترة." />;
  return (
    <ResponsiveContainer width="100%" height={200}>
      <PieChart>
        <Pie data={chart} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={52} outerRadius={80} paddingAngle={2} stroke="none">
          {chart.map((_, i) => (
            <Cell key={i} fill={METHOD_COLORS[i % METHOD_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip formatter={(v: number) => [formatMoney(String(v), { currency }), 'المبلغ']} contentStyle={tip} />
      </PieChart>
    </ResponsiveContainer>
  );
}

function Empty({ h, text = 'لا توجد بيانات في هذه الفترة.' }: { h: number; text?: string }) {
  return (
    <div className="flex items-center justify-center text-sm text-fg-muted" style={{ height: h }}>
      {text}
    </div>
  );
}
