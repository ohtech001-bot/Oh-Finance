import { Link } from 'react-router-dom';
import { BookOpen, CreditCard, Bell, ShoppingBag, User } from 'lucide-react';
import { type ActivityCategory, type ActivityItem } from '@oh/contracts';
import { Skeleton } from '@oh/ui';

/**
 * موجز النشاط القابل لإعادة الاستخدام (لوحة التحكم + صفحة الزبون).
 *
 * مكوّن عرض بحت: يستقبل عناصر جاهزة من الخادم ويعرضها بأيقونة ولون حسب النوع،
 * مع الفاعل والوقت النسبي ورابط للكيان المرجعي إن توفّر. لا تجميع هنا.
 */

const CATEGORY_ICON: Record<ActivityCategory, typeof ShoppingBag> = {
  ORDER: ShoppingBag,
  PAYMENT: CreditCard,
  CUSTOMER: User,
  LEDGER: BookOpen,
  SYSTEM: Bell,
};

const CATEGORY_STYLE: Record<ActivityCategory, string> = {
  ORDER: 'bg-accent-soft text-accent',
  PAYMENT: 'bg-success-soft text-success',
  CUSTOMER: 'bg-purple-soft text-purple',
  LEDGER: 'bg-info-soft text-info',
  SYSTEM: 'bg-neutral-soft text-neutral',
};

/** رابط الكيان المرجعي، أو null إن لا صفحة تفاصيل له. */
function entityHref(item: ActivityItem): string | null {
  if (!item.entityId) return null;
  if (item.entityType === 'Order') return `/orders/${item.entityId}`;
  if (item.entityType === 'Customer') return `/customers/${item.entityId}`;
  return null;
}

/** وقت نسبي بالعربية (منذ ٣ ساعات). Math.floor مسموح — لا تقريب مالي. */
function relativeTime(iso: string): string {
  const rtf = new Intl.RelativeTimeFormat('ar', { numeric: 'auto' });
  const past = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ['year', 31_536_000],
    ['month', 2_592_000],
    ['day', 86_400],
    ['hour', 3_600],
    ['minute', 60],
  ];
  for (const [unit, secs] of units) {
    if (past >= secs) return rtf.format(-Math.floor(past / secs), unit);
  }
  return rtf.format(-Math.max(0, past), 'second');
}

export interface ActivityFeedProps {
  items: ActivityItem[];
  loading?: boolean;
  emptyText?: string;
  className?: string;
}

export function ActivityFeed({ items, loading, emptyText = 'لا يوجد نشاط بعد.', className }: ActivityFeedProps) {
  if (loading && items.length === 0) {
    return (
      <div className="space-y-3 p-2" aria-busy="true">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-start gap-3 px-2 py-1">
            <Skeleton className="size-8 rounded-full" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3.5 w-3/4" />
              <Skeleton className="h-3 w-1/3" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return <p className="py-8 text-center text-[13px] text-fg-subtle">{emptyText}</p>;
  }

  return (
    <ol className={className}>
      {items.map((item) => {
        const Icon = CATEGORY_ICON[item.category];
        const href = entityHref(item);

        const body = (
          <div className="flex items-start gap-3 rounded-ctrl px-2 py-2.5 hover:bg-card-muted">
            <span className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full ${CATEGORY_STYLE[item.category]}`}>
              <Icon className="size-4" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] leading-snug text-fg">{item.title}</p>
              <p className="mt-0.5 text-xs text-fg-muted">
                {item.actorName ? <span>{item.actorName}</span> : <span>النظام</span>}
                {' · '}
                <time dateTime={item.occurredAt}>{relativeTime(item.occurredAt)}</time>
              </p>
            </div>
          </div>
        );

        return (
          <li key={`${item.entityType ?? 'x'}:${item.seq}`}>
            {href ? (
              <Link to={href} className="block">
                {body}
              </Link>
            ) : (
              body
            )}
          </li>
        );
      })}
    </ol>
  );
}
