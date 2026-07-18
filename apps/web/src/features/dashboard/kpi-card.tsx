import {
  ArrowDownRight,
  ArrowUpRight,
  BadgeDollarSign,
  Coins,
  CreditCard,
  Info,
  Minus,
  ShoppingBag,
  TrendingUp,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { DASHBOARD_KPI_META, type DashboardKpiId, type KpiMetric } from '@oh/contracts';
import { formatMoney, type CurrencyCode } from '@oh/money';
import { Card, CardBody } from '@oh/ui';

/**
 * بطاقة مؤشر — قيمة منسّقة حسب الوحدة، مقارنة بالفترة السابقة، واتجاه ملوّن.
 *
 * ⚠️ لا حساب هنا: القيمة والنسبة والاتجاه كلها من الخادم. البطاقة تعرض وتنسّق.
 * Tooltip يشرح طريقة الحساب (تعريف المؤشر من العقد المشترك).
 */

const KPI_ICON: Record<DashboardKpiId, LucideIcon> = {
  revenue: TrendingUp,
  payments: Wallet,
  orders: ShoppingBag,
  outstanding_balance: Coins,
  overdue_balance: BadgeDollarSign,
  overdue_customers: Users,
  active_customers: Users,
  average_order_value: BadgeDollarSign,
  collection_rate: CreditCard,
  unallocated_payments: Coins,
};

const TREND_STYLE = {
  up: { icon: ArrowUpRight, cls: 'text-success' },
  down: { icon: ArrowDownRight, cls: 'text-danger' },
  flat: { icon: Minus, cls: 'text-fg-subtle' },
} as const;

function formatValue(m: KpiMetric, currency: CurrencyCode): string {
  if (m.unit === 'money') return formatMoney(m.value, { currency });
  if (m.unit === 'percent') return `${m.value}%`;
  return new Intl.NumberFormat('ar').format(Number(m.value));
}

export function KpiCard({ metric, currency }: { metric: KpiMetric; currency: CurrencyCode }) {
  const meta = DASHBOARD_KPI_META[metric.id];
  const Icon = KPI_ICON[metric.id];
  const trend = TREND_STYLE[metric.trend];
  const TrendIcon = trend.icon;

  return (
    <Card>
      <CardBody className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 text-[13px] text-fg-muted">
            <Icon className="size-4 text-fg-subtle" aria-hidden />
            {meta.label}
          </span>
          <span
            className="cursor-help text-fg-subtle"
            title={meta.definition}
            aria-label={`طريقة حساب ${meta.label}: ${meta.definition}`}
            tabIndex={0}
          >
            <Info className="size-3.5" aria-hidden />
          </span>
        </div>

        <p className="text-xl font-semibold tabular-nums text-fg" dir="ltr">
          {formatValue(metric, currency)}
        </p>

        {metric.deltaPct !== null ? (
          <p className={`flex items-center gap-1 text-xs ${trend.cls}`}>
            <TrendIcon className="size-3.5" aria-hidden />
            <span className="tabular-nums" dir="ltr">
              {metric.deltaPct > 0 ? '+' : ''}
              {metric.deltaPct}%
            </span>
            <span className="text-fg-subtle">مقابل الفترة السابقة</span>
          </p>
        ) : (
          <p className="text-xs text-fg-subtle">قيمة لحظية</p>
        )}
      </CardBody>
    </Card>
  );
}
