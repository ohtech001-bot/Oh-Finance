import type { DashboardRangePreset } from '@oh/contracts';
import { DateRangeFilter } from '@oh/ui';

/**
 * منتقي الفترة — أزرار فترات جاهزة + مدى مخصّص.
 *
 * ⚠️ لا يحسب أي تاريخ: يرسل «اسم الفترة» (أو تاريخين تقويميين) للخادم، والخادم
 *    يحوّلها إلى حدود فعلية بمنطقة المحل. لا نعتمد منطقة المتصفح مصدرًا للحقيقة.
 */

const PRESETS: { value: DashboardRangePreset; label: string }[] = [
  { value: 'today', label: 'اليوم' },
  { value: 'yesterday', label: 'أمس' },
  { value: 'last_7_days', label: 'آخر ٧ أيام' },
  { value: 'last_30_days', label: 'آخر ٣٠ يومًا' },
  { value: 'this_month', label: 'هذا الشهر' },
  { value: 'previous_month', label: 'الشهر الماضي' },
  { value: 'this_year', label: 'هذه السنة' },
  { value: 'custom', label: 'مخصّص' },
];

export interface RangeValue {
  preset: DashboardRangePreset;
  from?: string;
  to?: string;
}

export function RangePicker({
  value,
  onChange,
}: {
  value: RangeValue;
  onChange: (v: RangeValue) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="الفترة الزمنية">
        {PRESETS.map((p) => {
          const active = value.preset === p.value;
          return (
            <button
              key={p.value}
              type="button"
              onClick={() => onChange({ ...value, preset: p.value })}
              aria-pressed={active}
              className={`rounded-ctrl px-3 py-1.5 text-[13px] font-medium transition-colors ${
                active
                  ? 'bg-brand text-brand-fg'
                  : 'bg-card-muted text-fg-muted hover:bg-card-muted/70 hover:text-fg'
              }`}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      {value.preset === 'custom' ? (
        <DateRangeFilter
          from={value.from ?? ''}
          to={value.to ?? ''}
          onFromChange={(from) => onChange({ ...value, preset: 'custom', from })}
          onToChange={(to) => onChange({ ...value, preset: 'custom', to })}
        />
      ) : null}
    </div>
  );
}
