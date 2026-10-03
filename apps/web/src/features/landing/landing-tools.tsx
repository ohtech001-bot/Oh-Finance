import {
  Accessibility,
  Contrast,
  Eye,
  EyeOff,
  Instagram,
  Link,
  Minus,
  Palette,
  Pause,
  Plus,
  RotateCcw,
  Type,
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, Switch, WhatsAppIcon } from '@oh/ui';
import { useCopy } from '@/lib/copy';
import { SUBSCRIPTION_MESSAGE } from './landing-content';
import { DEFAULT_ACCESSIBILITY, type AccessibilitySettings } from './accessibility-settings';
import { useRef, useState } from 'react';

interface Props {
  settings: AccessibilitySettings;
  onChange: (settings: AccessibilitySettings) => void;
}

export function LandingTools({ settings, onChange }: Props) {
  const copy = useCopy();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const toggles = [
    { key: 'grayscale', label: 'تدرّج رمادي', Icon: Palette },
    { key: 'invert', label: 'عكس الألوان', Icon: Contrast },
    { key: 'lowSaturation', label: 'تشبّع منخفض', Icon: Palette },
    { key: 'highContrast', label: 'تباين عالٍ', Icon: Contrast },
    { key: 'highlightLinks', label: 'إبراز الروابط', Icon: Link },
    { key: 'underlineLinks', label: 'تسطير الروابط', Icon: Link },
    { key: 'hideImages', label: 'إخفاء الصور', Icon: EyeOff },
    { key: 'readableFont', label: 'خط واضح للقراءة', Icon: Type },
    { key: 'lineSpacing', label: 'زيادة المسافة بين الأسطر', Icon: Type },
    { key: 'letterSpacing', label: 'زيادة المسافة بين الحروف', Icon: Type },
    { key: 'alignLeft', label: 'محاذاة النص لليسار', Icon: Type },
    { key: 'pauseMotion', label: 'إيقاف الرسوم المتحركة', Icon: Pause },
  ] as const;
  const filters = [
    { value: 'none', label: 'بدون فلتر' },
    { value: 'redGreen', label: 'أحمر–أخضر' },
    { value: 'red', label: 'أحمر' },
    { value: 'blueYellow', label: 'أزرق–أصفر' },
  ] as const;
  return (
    <>
      <aside className="oh-floating-tools" aria-label={copy('التواصل وأدوات الوصول')}>
        <a
          className="oh-floating-tool oh-floating-tool--whatsapp"
          href={`https://wa.me/972552616622?text=${encodeURIComponent(copy(SUBSCRIPTION_MESSAGE))}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={copy('تواصل عبر واتساب')}
        >
          <WhatsAppIcon width={25} height={25} aria-hidden="true" />
          <span className="oh-floating-tooltip">{copy('تواصل عبر واتساب')}</span>
        </a>
        <a
          className="oh-floating-tool oh-floating-tool--instagram"
          href="https://www.instagram.com/oh_tech/"
          target="_blank"
          rel="noopener noreferrer"
          aria-label={copy('إنستغرام O&H Tech')}
        >
          <Instagram size={24} aria-hidden="true" />
          <span className="oh-floating-tooltip" dir="ltr">
            @oh_tech
          </span>
        </a>
        <button
          ref={triggerRef}
          className="oh-floating-tool oh-floating-tool--accessibility"
          type="button"
          onClick={() => setOpen(true)}
          aria-label={copy('أدوات إمكانية الوصول')}
          aria-haspopup="dialog"
          aria-expanded={open}
        >
          <Accessibility size={25} aria-hidden="true" />
          <span className="oh-floating-tooltip">{copy('أدوات إمكانية الوصول')}</span>
        </button>
      </aside>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="oh-accessibility-panel"
          dir="rtl"
          size="sm"
          aria-describedby={undefined}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            triggerRef.current?.focus();
          }}
        >
          <DialogHeader>
            <DialogTitle>
              <Accessibility size={23} aria-hidden="true" />
              {copy('أدوات إمكانية الوصول')}
            </DialogTitle>
          </DialogHeader>
          <div className="oh-accessibility-scroll">
            <section aria-labelledby="oh-text-size-title" className="oh-accessibility-group">
              <h3 id="oh-text-size-title">
                <Type size={18} aria-hidden="true" />
                {copy('حجم النص')}
                <output dir="ltr">{settings.textScale}%</output>
              </h3>
              <div className="oh-size-controls">
                <button
                  type="button"
                  onClick={() =>
                    onChange({ ...settings, textScale: Math.max(100, settings.textScale - 10) })
                  }
                  disabled={settings.textScale === 100}
                  aria-label={copy('تصغير النص')}
                >
                  <Minus size={18} />
                </button>
                <input
                  type="range"
                  min={100}
                  max={140}
                  step={10}
                  value={settings.textScale}
                  onChange={(event) =>
                    onChange({ ...settings, textScale: Number(event.target.value) })
                  }
                  aria-label={copy('حجم النص')}
                />
                <button
                  type="button"
                  onClick={() =>
                    onChange({ ...settings, textScale: Math.min(140, settings.textScale + 10) })
                  }
                  disabled={settings.textScale === 140}
                  aria-label={copy('تكبير النص')}
                >
                  <Plus size={18} />
                </button>
              </div>
            </section>
            <section className="oh-accessibility-group" aria-labelledby="oh-color-filter-title">
              <h3 id="oh-color-filter-title">
                <Palette size={18} aria-hidden="true" />
                {copy('فلتر تمييز الألوان')}
              </h3>
              <div
                className="oh-color-filters"
                role="group"
                aria-labelledby="oh-color-filter-title"
              >
                {filters.map((filter) => (
                  <button
                    type="button"
                    key={filter.value}
                    aria-pressed={settings.colorFilter === filter.value}
                    onClick={() => onChange({ ...settings, colorFilter: filter.value })}
                  >
                    {copy(filter.label)}
                  </button>
                ))}
              </div>
            </section>
            <section className="oh-accessibility-group" aria-labelledby="oh-visual-options-title">
              <h3 id="oh-visual-options-title">
                <Eye size={18} aria-hidden="true" />
                {copy('خيارات العرض والقراءة')}
              </h3>
              {toggles.map(({ key, label, Icon }) => (
                <div className="oh-accessibility-toggle" key={key}>
                  <label htmlFor={`oh-accessibility-${key}`}>
                    <Icon size={17} aria-hidden="true" />
                    {copy(label)}
                  </label>
                  <Switch
                    id={`oh-accessibility-${key}`}
                    checked={settings[key]}
                    onCheckedChange={(checked) => onChange({ ...settings, [key]: checked })}
                    aria-label={copy(label)}
                  />
                </div>
              ))}
            </section>
          </div>
          <div className="oh-accessibility-reset">
            <button type="button" onClick={() => onChange({ ...DEFAULT_ACCESSIBILITY })}>
              <RotateCcw size={17} aria-hidden="true" />
              {copy('إعادة تعيين إلى الافتراضي')}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function AccessibilityFilters() {
  return (
    <svg width="0" height="0" aria-hidden="true" className="oh-filter-definitions">
      <defs>
        <filter id="oh-filter-redGreen" colorInterpolationFilters="sRGB">
          <feColorMatrix
            type="matrix"
            values="0.625 0.375 0 0 0 0.7 0.3 0 0 0 0 0.3 0.7 0 0 0 0 0 1 0"
          />
        </filter>
        <filter id="oh-filter-red" colorInterpolationFilters="sRGB">
          <feColorMatrix
            type="matrix"
            values="0.567 0.433 0 0 0 0.558 0.442 0 0 0 0 0.242 0.758 0 0 0 0 0 1 0"
          />
        </filter>
        <filter id="oh-filter-blueYellow" colorInterpolationFilters="sRGB">
          <feColorMatrix
            type="matrix"
            values="0.95 0.05 0 0 0 0 0.433 0.567 0 0 0 0.475 0.525 0 0 0 0 0 1 0"
          />
        </filter>
      </defs>
    </svg>
  );
}
