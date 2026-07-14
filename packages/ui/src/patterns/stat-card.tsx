import { ArrowDownRight, ArrowUpRight, type LucideIcon } from 'lucide-react';
import type { CurrencyCode, MoneyString } from '@oh/money';
import { cn } from '../lib/cn.js';
import { MoneyText, type MoneyTone } from './money-text.js';
import { Skeleton } from '../primitives/skeleton.js';

export type StatTone = 'brand' | 'accent' | 'debit' | 'credit' | 'partial' | 'purple' | 'orange' | 'info' | 'neutral';

const ICON_TONE: Record<StatTone, string> = {
  brand: 'bg-brand-soft text-brand',
  accent: 'bg-accent-soft text-accent',
  debit: 'bg-danger-soft text-danger',
  credit: 'bg-success-soft text-success',
  partial: 'bg-warning-soft text-warning',
  purple: 'bg-purple-soft text-purple',
  orange: 'bg-orange-soft text-orange',
  info: 'bg-info-soft text-info',
  neutral: 'bg-neutral-soft text-neutral',
};

const VALUE_TONE: Record<StatTone, string> = {
  brand: 'text-brand',
  accent: 'text-accent',
  debit: 'text-danger',
  credit: 'text-success',
  partial: 'text-warning',
  purple: 'text-purple',
  orange: 'text-orange',
  info: 'text-info',
  neutral: 'text-fg',
};

export interface StatCardProps {
  label: string;
  /** قيمة عددية (عدد الطلبات، عدد الزبائن). */
  value?: string | number;
  /** قيمة مالية — تُعرض عبر MoneyText. يُستخدم بدل `value`. */
  money?: MoneyString;
  currency?: CurrencyCode;
  moneyTone?: MoneyTone;

  icon: LucideIcon;
  tone?: StatTone;

  /** نص فرعي: «من 56 زبون» · «هذا الشهر». */
  sublabel?: string;

  /** دلتا: `{ value: 15, direction: 'up' }` → «↗ +15%». */
  delta?: { value: number; label?: string };

  loading?: boolean;

  /**
   * ميزة غير مُفعّلة بعد — تُعرض البطاقة بشكلها الكامل مع شارة صريحة.
   *
   * هذا بديل **أمين** عن عرض رقم مخترع: المستخدم يرى أن المكان محجوز
   * وأن البيانات ستأتي، بدل أن يقرأ صفرًا فيظنه حقيقة، أو رقمًا وهميًا
   * فيبني عليه قرارًا.
   */
  pending?: string;

  className?: string;
}

/**
 * بطاقة KPI — مطابقة للمرجع: التسمية أعلى، القيمة كبيرة ملوّنة، أيقونة في
 * مربع ملوّن 48px، نص فرعي أو دلتا أسفل.
 */
export function StatCard({
  label,
  value,
  money,
  currency = 'ILS',
  moneyTone = 'plain',
  icon: Icon,
  tone = 'neutral',
  sublabel,
  delta,
  loading,
  pending,
  className,
}: StatCardProps) {
  return (
    <div
      className={cn(
        'rounded-card border border-border bg-card p-5 shadow-card',
        'transition-shadow hover:shadow-card-hover',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-medium text-fg-muted">{label}</p>

          <div className="mt-2">
            {loading ? (
              <Skeleton className="h-8 w-28" />
            ) : pending ? (
              <p className="text-sm font-medium text-fg-subtle">—</p>
            ) : money !== undefined ? (
              <MoneyText value={money} currency={currency} tone={moneyTone} size="kpi" />
            ) : (
              <p className={cn('text-kpi tabular-nums', VALUE_TONE[tone])}>{value ?? '—'}</p>
            )}
          </div>

          <div className="mt-1.5 min-h-[18px]">
            {loading ? (
              <Skeleton className="h-3.5 w-20" />
            ) : pending ? (
              <span className="inline-flex items-center rounded-pill bg-neutral-soft px-2 py-0.5 text-[11px] font-medium text-neutral">
                {pending}
              </span>
            ) : delta ? (
              <span
                className={cn(
                  'inline-flex items-center gap-1 text-xs font-semibold',
                  delta.value >= 0 ? 'text-success' : 'text-danger',
                )}
              >
                {delta.value >= 0 ? (
                  <ArrowUpRight className="size-3.5" aria-hidden />
                ) : (
                  <ArrowDownRight className="size-3.5" aria-hidden />
                )}
                <span dir="ltr" className="tabular-nums">
                  {delta.value >= 0 ? '+' : ''}
                  {delta.value}%
                </span>
                {delta.label ? (
                  <span className="font-normal text-fg-muted">{delta.label}</span>
                ) : null}
              </span>
            ) : sublabel ? (
              <p className="text-xs text-fg-muted">{sublabel}</p>
            ) : null}
          </div>
        </div>

        <div
          className={cn(
            'flex size-12 shrink-0 items-center justify-center rounded-icon',
            ICON_TONE[tone],
          )}
          aria-hidden
        >
          <Icon className="size-5" />
        </div>
      </div>
    </div>
  );
}
