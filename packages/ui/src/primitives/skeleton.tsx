import { useUiTranslation } from '../localization.js';
import { cn } from '../lib/cn.js';

/**
 * هيكل تحميل.
 *
 * `aria-hidden` + `role="status"` على الحاوية: قارئ الشاشة يُعلن «جارٍ
 * التحميل» مرة واحدة، بدل أن يقرأ عشرين مستطيلًا فارغًا.
 */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('bg-border-subtle animate-pulse rounded-md', className)}
      aria-hidden
      {...props}
    />
  );
}

/**
 * هيكل يطابق شكل الجدول.
 *
 * ⚠️ لا نستخدم spinner عامًا: الهيكل الذي يطابق التخطيط النهائي يمنع «قفزة
 *    التخطيط» عند وصول البيانات، ويُشعر المستخدم بأن الصفحة تُبنى لا أنها
 *    معلّقة. الفارق في الإحساس بالسرعة حقيقي ومقيس.
 */
export function TableSkeleton({ rows = 10, columns = 6 }: { rows?: number; columns?: number }) {
  const copy = useUiTranslation();

  return (
    <div role="status" aria-label={copy('جارٍ تحميل الجدول')} className="w-full">
      <div className="border-border bg-card-muted flex h-12 items-center gap-4 border-b px-4">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} className="h-3 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="border-border-subtle flex h-14 items-center gap-4 border-b px-4">
          {Array.from({ length: columns }).map((_, c) => (
            <Skeleton key={c} className="h-4 flex-1" />
          ))}
        </div>
      ))}
      <span className="sr-only">{copy('جارٍ التحميل…')}</span>
    </div>
  );
}

export function StatCardsSkeleton({ count = 4 }: { count?: number }) {
  const copy = useUiTranslation();

  return (
    <div
      role="status"
      aria-label={copy('جارٍ تحميل الإحصاءات')}
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
    >
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-card border-border bg-card shadow-card border p-5">
          <div className="flex items-start justify-between">
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-8 w-28" />
              <Skeleton className="h-3 w-20" />
            </div>
            <Skeleton className="rounded-icon size-12" />
          </div>
        </div>
      ))}
      <span className="sr-only">{copy('جارٍ التحميل…')}</span>
    </div>
  );
}

export function CardSkeleton({ className }: { className?: string }) {
  const copy = useUiTranslation();

  return (
    <div
      role="status"
      aria-label={copy('جارٍ التحميل')}
      className={cn('rounded-card border-border bg-card shadow-card border p-5', className)}
    >
      <Skeleton className="mb-4 h-5 w-40" />
      <div className="space-y-3">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-4/6" />
      </div>
      <span className="sr-only">{copy('جارٍ التحميل…')}</span>
    </div>
  );
}
