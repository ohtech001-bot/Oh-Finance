import { useUiTranslation } from '../localization.js';
import { Search, SlidersHorizontal } from 'lucide-react';
import { cn } from '../lib/cn.js';
import { Button } from '../primitives/button.js';
import { Input } from '../primitives/input.js';

export interface FilterBarProps {
  children?: React.ReactNode;
  className?: string;
}

/**
 * شريط الفلاتر — بطاقة بيضاء أفقية، مطابقة للمرجع.
 *
 * على الموبايل: يتحوّل إلى بحث + زر «تصفية» يفتح درجًا. لا نضغط ستة عناصر
 * في شاشة 360px — تصير كلها غير قابلة للاستخدام.
 */
export function FilterBar({ children, className }: FilterBarProps) {
  return (
    <div
      className={cn(
        'rounded-card border-border bg-card shadow-card flex flex-wrap items-center gap-3 border p-4',
        className,
      )}
    >
      {children}
    </div>
  );
}

export interface SearchFilterProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function SearchFilter({
  value,
  onChange,
  placeholder = 'بحث سريع…',
  className,
}: SearchFilterProps) {
  const copy = useUiTranslation();

  return (
    <div className={cn('min-w-[200px] flex-1', className)}>
      <Input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={copy(placeholder)}
        startIcon={<Search className="size-4" />}
        aria-label={copy(placeholder)}
      />
    </div>
  );
}

export interface SelectFilterProps {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  /** الخيار الافتراضي: «كل الحالات» · «كل الزبائن». */
  allLabel: string;
  label: string;
  className?: string;
}

export function SelectFilter({
  value,
  onChange,
  options,
  allLabel,
  label,
  className,
}: SelectFilterProps) {
  const copy = useUiTranslation();

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={copy(label)}
      className={cn(
        'rounded-ctrl border-border bg-card text-fg h-11 min-w-[150px] border px-3 text-sm',
        'focus-visible:ring-ring focus-visible:border-accent focus-visible:outline-none focus-visible:ring-2',
        className,
      )}
    >
      <option value="">{copy(allLabel)}</option>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {copy(option.label)}
        </option>
      ))}
    </select>
  );
}

export interface DateRangeFilterProps {
  from: string;
  to: string;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
  className?: string;
  fromLabel?: string;
  toLabel?: string;
}

/**
 * مدى تاريخي — «من تاريخ» / «إلى تاريخ».
 *
 * `type="date"` يعطي منتقي التاريخ الأصلي للمتصفح: يعمل بلوحة المفاتيح،
 * ومترجم للغة النظام، ويحترم إعدادات التقويم — كلها أشياء يخسرها المنتقي
 * المخصّص عادةً.
 */
export function DateRangeFilter({
  from,
  to,
  onFromChange,
  onToChange,
  className,
  fromLabel = 'من تاريخ',
  toLabel = 'إلى تاريخ',
}: DateRangeFilterProps) {
  const copy = useUiTranslation();

  return (
    <div
      className={cn('grid w-full min-w-0 grid-cols-1 gap-3 sm:w-auto sm:grid-cols-2', className)}
    >
      <label className="min-w-0 space-y-1">
        <span className="text-fg-muted block text-xs font-medium">{copy(fromLabel)}</span>
        <Input
          type="date"
          value={from}
          onChange={(e) => onFromChange(e.target.value)}
          // `max` يمنع اختيار مدى مقلوب في الواجهة أصلًا — الخادم يتحقق أيضًا.
          max={to || undefined}
          dir="ltr"
          aria-label={copy(fromLabel)}
          className="block w-full min-w-0 max-w-full appearance-none sm:w-[180px]"
        />
      </label>
      <label className="min-w-0 space-y-1">
        <span className="text-fg-muted block text-xs font-medium">{copy(toLabel)}</span>
        <Input
          type="date"
          value={to}
          onChange={(e) => onToChange(e.target.value)}
          min={from || undefined}
          dir="ltr"
          aria-label={copy(toLabel)}
          className="block w-full min-w-0 max-w-full appearance-none sm:w-[180px]"
        />
      </label>
    </div>
  );
}

export function AdvancedFilterButton({
  onClick,
  activeCount,
}: {
  onClick: () => void;
  activeCount?: number;
}) {
  const copy = useUiTranslation();

  return (
    <Button variant="outline" onClick={onClick}>
      <SlidersHorizontal aria-hidden />
      {copy('تصفية متقدمة')}
      {activeCount ? (
        <span className="bg-accent ms-1 flex size-5 items-center justify-center rounded-full text-[11px] font-bold tabular-nums text-white">
          {activeCount}
        </span>
      ) : null}
    </Button>
  );
}
