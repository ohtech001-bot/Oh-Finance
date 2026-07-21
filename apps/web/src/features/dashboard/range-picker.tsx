import type { DashboardRangePreset } from '@oh/contracts';
import { DateRangeFilter } from '@oh/ui';
import { CalendarRange } from 'lucide-react';
import { currentLocale } from '@/lib/i18n';

/**
 * منتقي الفترة — أزرار فترات جاهزة + مدى مخصّص.
 *
 * ⚠️ لا يحسب أي تاريخ: يرسل «اسم الفترة» (أو تاريخين تقويميين) للخادم، والخادم
 *    يحوّلها إلى حدود فعلية بمنطقة المحل. لا نعتمد منطقة المتصفح مصدرًا للحقيقة.
 */

const PRESETS: {
  value: Exclude<DashboardRangePreset, 'custom'>;
  label: Record<'ar' | 'he' | 'en', string>;
}[] = [
  { value: 'today', label: { ar: 'اليوم', he: 'היום', en: 'Today' } },
  { value: 'yesterday', label: { ar: 'أمس', he: 'אתמול', en: 'Yesterday' } },
  { value: 'last_7_days', label: { ar: 'آخر 7 أيام', he: '7 הימים האחרונים', en: 'Last 7 days' } },
  { value: 'this_month', label: { ar: 'هذا الشهر', he: 'החודש', en: 'This month' } },
  { value: 'previous_month', label: { ar: 'الشهر الماضي', he: 'החודש שעבר', en: 'Last month' } },
  { value: 'this_year', label: { ar: 'السنة', he: 'השנה', en: 'This year' } },
];

const CUSTOM_LABEL = { ar: 'مخصّص', he: 'מותאם', en: 'Custom' } as const;

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
  const locale = currentLocale();
  const selectedPreset = value.preset === 'custom' ? 'today' : value.preset;
  return (
    <div className="flex flex-col items-end gap-3">
      <div className="flex items-center gap-2" role="group" aria-label="الفترة الزمنية">
        <select
          value={selectedPreset}
          onChange={(event) => onChange({ preset: event.target.value as DashboardRangePreset })}
          className="rounded-ctrl border-border bg-card text-fg focus-visible:ring-ring h-9 min-w-36 border px-3 text-sm focus-visible:outline-none focus-visible:ring-2"
        >
          {PRESETS.map((preset) => (
            <option key={preset.value} value={preset.value}>
              {preset.label[locale]}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() =>
            onChange(
              value.preset === 'custom' ? { preset: 'today' } : { ...value, preset: 'custom' },
            )
          }
          aria-pressed={value.preset === 'custom'}
          className={`rounded-ctrl flex h-9 items-center gap-2 border px-3 text-sm font-medium transition-colors ${
            value.preset === 'custom'
              ? 'border-brand bg-brand text-brand-fg'
              : 'border-border bg-card text-fg-muted hover:bg-card-muted hover:text-fg'
          }`}
        >
          <CalendarRange className="size-4" aria-hidden />
          {CUSTOM_LABEL[locale]}
        </button>
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
