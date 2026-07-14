import { ChevronDown, ChevronsUpDown, ChevronUp } from 'lucide-react';
import { cn } from '../lib/cn.js';
import { TableSkeleton } from '../primitives/skeleton.js';
import { EmptyState, ErrorState, NoResultsState } from './states.js';

export interface Column<T> {
  /** مفتاح الفرز — يُرسل للخادم. `undefined` = غير قابل للفرز. */
  key?: string;
  header: string;
  /** محاذاة المحتوى. المبالغ دائمًا `end`. */
  align?: 'start' | 'center' | 'end';
  width?: string;
  render: (row: T, index: number) => React.ReactNode;
  /** إخفاء العمود تحت هذا العرض (أعمدة ثانوية على الشاشات الضيقة). */
  hideBelow?: 'sm' | 'md' | 'lg' | 'xl';
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;

  loading?: boolean;
  error?: { message: string; requestId?: string } | null;
  onRetry?: () => void;

  /** حالة «لا بيانات أصلًا». */
  empty?: { title: string; description?: string; action?: { label: string; onClick: () => void } };
  /** هل الفلاتر مُفعَّلة؟ يقرّر: NoResults أم Empty. */
  isFiltered?: boolean;
  onResetFilters?: () => void;

  sort?: { key: string; order: 'asc' | 'desc' };
  onSortChange?: (key: string) => void;

  onRowClick?: (row: T) => void;

  /** وصف الجدول لقارئ الشاشة — إلزامي للوصول. */
  caption: string;

  className?: string;
}

const ALIGN_CLASS = {
  start: 'text-start',
  center: 'text-center',
  end: 'text-end',
} as const;

const HIDE_CLASS = {
  sm: 'hidden sm:table-cell',
  md: 'hidden md:table-cell',
  lg: 'hidden lg:table-cell',
  xl: 'hidden xl:table-cell',
} as const;

/**
 * أساس الجداول — مطابق للمرجع البصري.
 *
 * رأس `#F8FAFC` بارتفاع 48px · صفوف 56px · فواصل `#EEF2F6` · hover خفيف.
 *
 * ── الوصول ────────────────────────────────────────────────────────────────
 *  • `<caption>` مخفي بصريًا: قارئ الشاشة يُعلن ما هذا الجدول قبل قراءته.
 *  • `scope="col"` على الرؤوس: يربط كل خلية برأس عمودها، فيقرأ المستخدم
 *    «الرصيد الحالي: 1,250.00» بدل «1,250.00» مجرّدة.
 *  • `aria-sort` على العمود المفروز.
 *  • التمرير الأفقي في حاوية مستقلة — الصفحة نفسها لا تتمرّر أفقيًا أبدًا.
 */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  loading,
  error,
  onRetry,
  empty,
  isFiltered,
  onResetFilters,
  sort,
  onSortChange,
  onRowClick,
  caption,
  className,
}: DataTableProps<T>) {
  if (loading) {
    return (
      <div className={cn('overflow-hidden rounded-card border border-border bg-card', className)}>
        <TableSkeleton columns={columns.length} />
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn('rounded-card border border-border bg-card', className)}>
        <ErrorState message={error.message} requestId={error.requestId} onRetry={onRetry} />
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className={cn('rounded-card border border-border bg-card', className)}>
        {isFiltered && onResetFilters ? (
          <NoResultsState onReset={onResetFilters} />
        ) : (
          <EmptyState
            title={empty?.title ?? 'لا توجد بيانات'}
            description={empty?.description}
            action={empty?.action}
          />
        )}
      </div>
    );
  }

  return (
    <div className={cn('rounded-card border border-border bg-card shadow-card', className)}>
      {/* الجدول يتمرّر داخل حاويته — لا تتمرّر الصفحة أفقيًا. */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">{caption}</caption>

          <thead>
            <tr className="border-b border-border bg-card-muted">
              {columns.map((col, i) => {
                const sortable = Boolean(col.key && onSortChange);
                const isSorted = sort?.key === col.key;

                return (
                  <th
                    key={col.key ?? `col-${i}`}
                    scope="col"
                    style={col.width ? { width: col.width } : undefined}
                    aria-sort={
                      isSorted && sort
                        ? sort.order === 'asc'
                          ? 'ascending'
                          : 'descending'
                        : undefined
                    }
                    className={cn(
                      'h-12 px-4 text-table-head text-fg-muted',
                      ALIGN_CLASS[col.align ?? 'start'],
                      col.hideBelow && HIDE_CLASS[col.hideBelow],
                    )}
                  >
                    {sortable ? (
                      <button
                        type="button"
                        onClick={() => col.key && onSortChange?.(col.key)}
                        className={cn(
                          'inline-flex items-center gap-1.5 rounded transition-colors hover:text-fg',
                          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                          isSorted && 'text-fg',
                        )}
                      >
                        {col.header}
                        {isSorted && sort ? (
                          sort.order === 'asc' ? (
                            <ChevronUp className="size-3.5" aria-hidden />
                          ) : (
                            <ChevronDown className="size-3.5" aria-hidden />
                          )
                        ) : (
                          <ChevronsUpDown className="size-3.5 opacity-40" aria-hidden />
                        )}
                      </button>
                    ) : (
                      col.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody>
            {rows.map((row, rowIndex) => (
              <tr
                key={rowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cn(
                  'border-b border-border-subtle transition-colors last:border-0',
                  onRowClick && 'cursor-pointer hover:bg-card-muted',
                )}
              >
                {columns.map((col, colIndex) => (
                  <td
                    key={col.key ?? `cell-${colIndex}`}
                    className={cn(
                      'h-14 px-4 text-fg',
                      ALIGN_CLASS[col.align ?? 'start'],
                      col.hideBelow && HIDE_CLASS[col.hideBelow],
                    )}
                  >
                    {col.render(row, rowIndex)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
