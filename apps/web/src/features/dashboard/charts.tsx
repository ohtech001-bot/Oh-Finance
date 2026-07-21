import { useMemo } from 'react';
import {
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
import { TREND_META, type DashboardTrendId, type KpiMetric, type TrendSeries } from '@oh/contracts';
import { currentLocale } from '@/lib/i18n';

/**
 * منحنيات لوحة التحكم — Recharts، بيانات مجمّعة على الخادم (لا حساب هنا).
 *
 * ⚠️ Recharts يرسم SVG ويحتاج قيم لون صريحة لا متغيّرات CSS.
 */

const SERIES_COLOR: Record<DashboardTrendId, string> = {
  revenue: '#16A34A',
  payments: '#2563EB',
  orders: '#7C3AED',
  outstanding_balance: '#DC2626',
  new_customers: '#F59E0B',
};

const GRID = '#E2E8F0';
const AXIS = '#94A3B8';

const COLLECTION_LABELS = {
  ar: { title: 'نسبة التحصيل', collected: 'تم تحصيله من المبالغ المستحقة' },
  he: { title: 'שיעור הגבייה', collected: 'נגבה מתוך הסכומים לתשלום' },
  en: { title: 'Collection rate', collected: 'Collected from amounts due' },
} as const;

export function CollectionRateChart({ metric }: { metric: KpiMetric }) {
  const locale = currentLocale();
  const value = Number(metric.value);
  const displayed = Number.isFinite(value) ? value : 0;
  const progress = Math.min(100, Math.max(0, displayed));
  const formattedValue = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(
    displayed,
  );
  const data = [
    { name: 'collected', value: progress },
    { name: 'remaining', value: 100 - progress },
  ];

  return (
    <section
      aria-label={COLLECTION_LABELS[locale].title}
      className="rounded-card border-border bg-card shadow-card flex min-h-28 items-center justify-between gap-3 border px-4 py-3"
    >
      <div className="min-w-0 text-start">
        <h2 className="text-fg-muted text-sm font-medium">{COLLECTION_LABELS[locale].title}</h2>
        <p className="text-fg-subtle mt-2 text-xs leading-5">
          {COLLECTION_LABELS[locale].collected}
        </p>
      </div>
      <div className="relative size-24 shrink-0" dir="ltr">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              innerRadius={31}
              outerRadius={43}
              startAngle={90}
              endAngle={-270}
              stroke="none"
              isAnimationActive
            >
              <Cell fill="#16A34A" />
              <Cell fill="#E2E8F0" />
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="text-fg text-lg font-bold tabular-nums">{formattedValue}%</span>
        </div>
      </div>
    </section>
  );
}

function shortNumber(v: number): string {
  // eslint-disable-next-line no-restricted-properties -- تقريب تسمية محور بصرية، لا مبلغ.
  if (Math.abs(v) >= 1000) return `${Math.round(v / 1000)}k`;
  return String(v);
}

const tooltipStyle: React.CSSProperties = {
  borderRadius: 10,
  border: '1px solid #E2E8F0',
  boxShadow: '0 10px 24px rgba(16,24,40,.12)',
  fontSize: 12,
  direction: 'rtl',
};

/**
 * منحنى يجمع سلاسل مختارة على محور زمني واحد. السلاسل المالية تُنسّق كعملة،
 * والعددية كأرقام. يدمج النقاط حسب الدلو (bucket).
 */
export function TrendChart({
  series,
  currency,
  height = 260,
  emptyText = 'لا توجد بيانات في هذه الفترة.',
}: {
  series: TrendSeries[];
  currency: CurrencyCode;
  height?: number;
  emptyText?: string;
}) {
  const { data, ids } = useMemo(() => {
    const byBucket = new Map<string, Record<string, number | string>>();
    for (const s of series) {
      for (const pt of s.points) {
        const row = byBucket.get(pt.bucket) ?? { bucket: pt.bucket, label: pt.bucket.slice(5) };
        row[s.id] = Number(pt.value);
        byBucket.set(pt.bucket, row);
      }
    }
    return {
      data: [...byBucket.values()].sort((a, b) => String(a.bucket).localeCompare(String(b.bucket))),
      ids: series.map((s) => s.id),
    };
  }, [series]);

  const hasData = data.some((row) => ids.some((id) => Number(row[id] ?? 0) !== 0));

  if (!hasData) {
    return (
      <div className="text-fg-muted flex items-center justify-center text-sm" style={{ height }}>
        {emptyText}
      </div>
    );
  }

  const anyMoney = series.some((s) => s.unit === 'money');

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fill: AXIS, fontSize: 11 }}
          axisLine={{ stroke: GRID }}
          tickLine={false}
          reversed
        />
        <YAxis
          orientation="right"
          tick={{ fill: AXIS, fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={shortNumber}
          width={44}
        />
        <Tooltip
          formatter={(value: number, name: string) => {
            const id = name as DashboardTrendId;
            const meta = TREND_META[id];
            const formatted =
              meta?.unit === 'money' ? formatMoney(String(value), { currency }) : String(value);
            return [formatted, meta?.label ?? name];
          }}
          labelFormatter={(l) => `التاريخ: ${l}`}
          contentStyle={tooltipStyle}
        />
        {ids.length > 1 ? (
          <Legend
            formatter={(value) => TREND_META[value as DashboardTrendId]?.label ?? value}
            iconType="circle"
            wrapperStyle={{ fontSize: 12 }}
          />
        ) : null}
        {ids.map((id) => (
          <Line
            key={id}
            type="monotone"
            dataKey={id}
            stroke={SERIES_COLOR[id]}
            strokeWidth={2}
            dot={anyMoney ? false : { r: 2 }}
            activeDot={{ r: 5 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
