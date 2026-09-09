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
import { Card, CardBody, cn } from '@oh/ui';
import { useTranslation } from 'react-i18next';
import { currentLocale } from '@/lib/i18n';

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

const KPI_STYLE: Record<DashboardKpiId, { card: string; icon: string }> = {
  revenue: {
    card: 'border-emerald-200/80 bg-emerald-50/70 dark:border-emerald-900 dark:bg-emerald-950/30',
    icon: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300',
  },
  payments: {
    card: 'border-sky-200/80 bg-sky-50/70 dark:border-sky-900 dark:bg-sky-950/30',
    icon: 'bg-sky-100 text-sky-700 dark:bg-sky-900/60 dark:text-sky-300',
  },
  orders: {
    card: 'border-blue-200/80 bg-blue-50/70 dark:border-blue-900 dark:bg-blue-950/30',
    icon: 'bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300',
  },
  outstanding_balance: {
    card: 'border-rose-200/80 bg-rose-50/70 dark:border-rose-900 dark:bg-rose-950/30',
    icon: 'bg-rose-100 text-rose-700 dark:bg-rose-900/60 dark:text-rose-300',
  },
  overdue_balance: {
    card: 'border-amber-200/80 bg-amber-50/70 dark:border-amber-900 dark:bg-amber-950/30',
    icon: 'bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300',
  },
  overdue_customers: {
    card: 'border-violet-200/80 bg-violet-50/70 dark:border-violet-900 dark:bg-violet-950/30',
    icon: 'bg-violet-100 text-violet-700 dark:bg-violet-900/60 dark:text-violet-300',
  },
  active_customers: {
    card: 'border-cyan-200/80 bg-cyan-50/70 dark:border-cyan-900 dark:bg-cyan-950/30',
    icon: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/60 dark:text-cyan-300',
  },
  average_order_value: {
    card: 'border-indigo-200/80 bg-indigo-50/70 dark:border-indigo-900 dark:bg-indigo-950/30',
    icon: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-300',
  },
  collection_rate: {
    card: 'border-emerald-200/80 bg-emerald-50/70 dark:border-emerald-900 dark:bg-emerald-950/30',
    icon: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300',
  },
  unallocated_payments: {
    card: 'border-orange-200/80 bg-orange-50/70 dark:border-orange-900 dark:bg-orange-950/30',
    icon: 'bg-orange-100 text-orange-700 dark:bg-orange-900/60 dark:text-orange-300',
  },
};

function formatValue(m: KpiMetric, currency: CurrencyCode): string {
  if (m.unit === 'money') return formatMoney(m.value, { currency });
  if (m.unit === 'percent') return `${m.value}%`;
  return new Intl.NumberFormat(currentLocale()).format(Number(m.value));
}

export function KpiCard({ metric, currency }: { metric: KpiMetric; currency: CurrencyCode }) {
  const { t } = useTranslation();
  const meta = DASHBOARD_KPI_META[metric.id];
  const Icon = KPI_ICON[metric.id];
  const trend = TREND_STYLE[metric.trend];
  const TrendIcon = trend.icon;
  const style = KPI_STYLE[metric.id];
  const label = t(`dashboard.kpis.${metric.id}.label`, { defaultValue: meta.label });
  const definition = t(`dashboard.kpis.${metric.id}.definition`, { defaultValue: meta.definition });

  return (
    <Card
      className={cn(
        'overflow-hidden transition-transform duration-200 hover:-translate-y-0.5',
        style.card,
      )}
    >
      <CardBody className="flex flex-col gap-2 p-3 sm:p-5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-fg-muted flex items-center gap-2 text-[13px] font-medium">
            <span
              className={cn('rounded-ctrl flex size-8 items-center justify-center', style.icon)}
            >
              <Icon className="size-4" aria-hidden />
            </span>
            {label}
          </span>
          <span
            className="text-fg-subtle cursor-help"
            title={definition}
            aria-label={t('dashboard.calculationMethod', { label, definition })}
            tabIndex={0}
          >
            <Info className="size-3.5" aria-hidden />
          </span>
        </div>

        <p className="text-fg text-xl font-semibold tabular-nums" dir="ltr">
          {formatValue(metric, currency)}
        </p>

        {metric.deltaPct !== null ? (
          <p className={`flex items-center gap-1 text-xs ${trend.cls}`}>
            <TrendIcon className="size-3.5" aria-hidden />
            <span className="tabular-nums" dir="ltr">
              {metric.deltaPct > 0 ? '+' : ''}
              {metric.deltaPct}%
            </span>
            <span className="text-fg-subtle hidden sm:inline">
              {t('dashboard.comparedToPrevious')}
            </span>
          </p>
        ) : (
          <p className="text-fg-subtle text-xs">{t('dashboard.liveValue')}</p>
        )}
      </CardBody>
    </Card>
  );
}
