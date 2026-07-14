import { Calendar, Search, SlidersHorizontal } from 'lucide-react';
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
        'flex flex-wrap items-center gap-3 rounded-card border border-border bg-card p-4 shadow-card',
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
  return (
    <div className={cn('min-w-[200px] flex-1', className)}>
      <Input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        startIcon={<Search className="size-4" />}
        aria-label={placeholder}
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
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={label}
      className={cn(
        'h-11 min-w-[150px] rounded-ctrl border border-border bg-card px-3 text-sm text-fg',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-accent',
        className,
      )}
    >
      <option value="">{allLabel}</option>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
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
}: DateRangeFilterProps) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Input
        type="date"
        value={from}
        onChange={(e) => onFromChange(e.target.value)}
        // `max` يمنع اختيار مدى مقلوب في الواجهة أصلًا — الخادم يتحقق أيضًا.
        max={to || undefined}
        startIcon={<Calendar className="size-4" />}
        aria-label="من تاريخ"
        className="w-[165px]"
      />
      <Input
        type="date"
        value={to}
        onChange={(e) => onToChange(e.target.value)}
        min={from || undefined}
        startIcon={<Calendar className="size-4" />}
        aria-label="إلى تاريخ"
        className="w-[165px]"
      />
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
  return (
    <Button variant="outline" onClick={onClick}>
      <SlidersHorizontal aria-hidden />
      تصفية متقدمة
      {activeCount ? (
        <span className="ms-1 flex size-5 items-center justify-center rounded-full bg-accent text-[11px] font-bold text-white tabular-nums">
          {activeCount}
        </span>
      ) : null}
    </Button>
  );
}
