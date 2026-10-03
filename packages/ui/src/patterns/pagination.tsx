import { useUiTranslation } from '../localization.js';
import { cn } from '../lib/cn.js';
import { Button } from '../primitives/button.js';

export interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  pageSizes?: number[];
  /** اسم العنصر للعدّاد: «عرض 1 - 10 من 95 زبون». */
  itemLabel?: string;
  className?: string;
}

/**
 * الترقيم — مطابق للمرجع: العدّاد يمين، الأرقام يسار.
 *
 * ⚠️ في RTL يبقى «السابق» على اليمين و«التالي» على اليسار — أي **عكس** الترتيب
 *    البصري في LTR. هذا صحيح: اتجاه القراءة ينعكس، فـ«السابق» هو ما يسبق في
 *    اتجاه القراءة. نعتمد على flexbox في حاوية `dir=rtl` ليتكفّل بذلك تلقائيًا،
 *    ولا نُعكّس يدويًا — والمرجع البصري يؤكد هذا الترتيب.
 */
export function Pagination({
  page,
  pageSize,
  total,
  totalPages,
  onPageChange,
  onPageSizeChange,
  pageSizes = [10, 25, 50, 100],
  itemLabel = 'عنصر',
  className,
}: PaginationProps) {
  const copy = useUiTranslation();

  if (total === 0) return null;

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <nav
      aria-label={copy('ترقيم الصفحات')}
      className={cn(
        'border-border flex flex-col gap-3 border-t px-4 py-3 sm:flex-row sm:items-center sm:justify-between',
        className,
      )}
    >
      {/* العدّاد + حجم الصفحة */}
      <div className="text-fg-muted flex flex-wrap items-center gap-3 text-[13px] sm:gap-4">
        {onPageSizeChange ? (
          <div className="flex items-center gap-2">
            <label htmlFor="page-size" className="whitespace-nowrap">
              {copy('لكل صفحة')}
            </label>
            <select
              id="page-size"
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className={cn(
                'rounded-ctrl border-border bg-card text-fg h-9 border px-2 text-[13px]',
                'focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-2',
              )}
            >
              {pageSizes.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <p aria-live="polite" className="tabular-nums">
          {copy('عرض {{from}} إلى {{to}} من {{total}} {{item}}', {
            from,
            to,
            total,
            item: copy(itemLabel),
          })}
        </p>
      </div>

      {/* أزرار الصفحات */}
      <div className="flex w-full items-center justify-between gap-1.5 sm:w-auto sm:justify-start">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
        >
          {copy('السابق')}
        </Button>

        {buildPageList(page, totalPages).map((item, i) =>
          item === 'ellipsis' ? (
            <span key={`gap-${i}`} className="text-fg-subtle hidden px-2 sm:inline" aria-hidden>
              …
            </span>
          ) : (
            <Button
              key={item}
              variant={item === page ? 'accent' : 'outline'}
              size="sm"
              className={cn('min-w-9 tabular-nums', item !== page && 'max-sm:hidden')}
              onClick={() => onPageChange(item)}
              aria-current={item === page ? 'page' : undefined}
              aria-label={copy('صفحة {{value0}}', { value0: item })}
            >
              {item}
            </Button>
          ),
        )}

        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
        >
          {copy('التالي')}
        </Button>
      </div>
    </nav>
  );
}

/**
 * قائمة الصفحات المعروضة: 1 … 4 [5] 6 … 20
 *
 * عرض كل الصفحات مستحيل عند 200 صفحة، وعرض «السابق/التالي» فقط يمنع القفز.
 * هذا التوازن يُبقي: الأولى، الأخيرة، والحالية ± 1.
 */
function buildPageList(current: number, total: number): (number | 'ellipsis')[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const pages = new Set<number>([1, total, current]);
  if (current - 1 > 1) pages.add(current - 1);
  if (current + 1 < total) pages.add(current + 1);

  const sorted = [...pages].sort((a, b) => a - b);
  const result: (number | 'ellipsis')[] = [];

  for (let i = 0; i < sorted.length; i += 1) {
    const value = sorted[i];
    if (value === undefined) continue;

    const previous = sorted[i - 1];
    if (previous !== undefined && value - previous > 1) {
      result.push('ellipsis');
    }
    result.push(value);
  }

  return result;
}
