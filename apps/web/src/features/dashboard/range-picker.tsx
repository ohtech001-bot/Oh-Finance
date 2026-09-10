import type { DashboardRangePreset } from '@oh/contracts';
import { DateRangeFilter } from '@oh/ui';
import { CalendarRange } from 'lucide-react';
import { currentLocale } from '@/lib/i18n';
import { useTranslation } from 'react-i18next';

/**
 * منتقي الفترة — أزرار فترات جاهزة + مدى مخصّص.
 *
 * ⚠️ لا يحسب أي تاريخ: يرسل «اسم الفترة» (أو تاريخين تقويميين) للخادم، والخادم
 *    يحوّلها إلى حدود فعلية بمنطقة المحل. لا نعتمد منطقة المتصفح مصدرًا للحقيقة.
 */

const PRESETS: {
  value: Exclude<DashboardRangePreset, 'custom'>;
  label: Record<'ar' | 'he', string>;
}[] = [
  { value: 'today', label: { ar: 'اليوم', he: 'היום' } },
  { value: 'yesterday', label: { ar: 'أمس', he: 'אתמול' } },
  { value: 'last_7_days', label: { ar: 'آخر 7 أيام', he: '7 הימים האחרונים' } },
  { value: 'this_month', label: { ar: 'هذا الشهر', he: 'החודש' } },
  { value: 'previous_month', label: { ar: 'الشهر الماضي', he: 'החודש שעבר' } },
  { value: 'this_year', label: { ar: 'السنة', he: 'השנה' } },
];

const CUSTOM_LABEL = { ar: 'مخصّص', he: 'מותאם' } as const;

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
  const { t } = useTranslation();
  const locale = currentLocale() === 'he' ? 'he' : 'ar';
  return (
    <div className="flex w-full flex-col items-stretch gap-3 sm:w-auto sm:items-end">
      <div
        className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2"
        role="group"
        aria-label={t('dashboard.timeRange')}
      >
        <select
          value={value.preset}
          onChange={(event) => onChange({ preset: event.target.value as DashboardRangePreset })}
          className="rounded-ctrl border-border bg-card text-fg focus-visible:ring-ring h-9 min-w-0 border px-3 text-sm focus-visible:outline-none focus-visible:ring-2 sm:min-w-36"
        >
          {PRESETS.map((preset) => (
            <option key={preset.value} value={preset.value}>
              {preset.label[locale]}
            </option>
          ))}
          <option value="custom">{CUSTOM_LABEL[locale]}</option>
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
          fromLabel={locale === 'he' ? 'מתאריך' : 'من تاريخ'}
          toLabel={locale === 'he' ? 'עד תאריך' : 'إلى تاريخ'}
        />
      ) : null}
    </div>
  );
}
