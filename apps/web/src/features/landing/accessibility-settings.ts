export const ACCESSIBILITY_STORAGE_KEY = 'oh_landing_accessibility_v1';

export interface AccessibilitySettings {
  textScale: number;
  grayscale: boolean;
  invert: boolean;
  lowSaturation: boolean;
  highContrast: boolean;
  highlightLinks: boolean;
  underlineLinks: boolean;
  hideImages: boolean;
  readableFont: boolean;
  lineSpacing: boolean;
  letterSpacing: boolean;
  alignLeft: boolean;
  pauseMotion: boolean;
  colorFilter: 'none' | 'redGreen' | 'red' | 'blueYellow';
}

export const DEFAULT_ACCESSIBILITY: AccessibilitySettings = {
  textScale: 100,
  grayscale: false,
  invert: false,
  lowSaturation: false,
  highContrast: false,
  highlightLinks: false,
  underlineLinks: false,
  hideImages: false,
  readableFont: false,
  lineSpacing: false,
  letterSpacing: false,
  alignLeft: false,
  pauseMotion: false,
  colorFilter: 'none',
};

export function readAccessibilitySettings(): AccessibilitySettings {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(ACCESSIBILITY_STORAGE_KEY) ?? '{}');
    if (!stored || typeof stored !== 'object' || Array.isArray(stored))
      return { ...DEFAULT_ACCESSIBILITY };
    const source = stored as Record<string, unknown>;
    const result = { ...DEFAULT_ACCESSIBILITY };
    for (const key of Object.keys(DEFAULT_ACCESSIBILITY) as (keyof AccessibilitySettings)[]) {
      if (key === 'textScale' || key === 'colorFilter') continue;
      if (typeof source[key] === 'boolean') result[key] = source[key];
    }
    if (typeof source.textScale === 'number' && Number.isFinite(source.textScale))
      result.textScale = Math.trunc(Math.min(140, Math.max(100, source.textScale)) / 10 + 0.5) * 10;
    if (['none', 'redGreen', 'red', 'blueYellow'].includes(String(source.colorFilter)))
      result.colorFilter = source.colorFilter as AccessibilitySettings['colorFilter'];
    return result;
  } catch {
    return { ...DEFAULT_ACCESSIBILITY };
  }
}

export function accessibilityFilter(settings: AccessibilitySettings): string {
  return (
    [
      settings.grayscale && 'grayscale(1)',
      settings.invert && 'invert(1)',
      settings.lowSaturation && 'saturate(0.45)',
      settings.highContrast && 'contrast(1.25)',
      settings.colorFilter !== 'none' && `url(#oh-filter-${settings.colorFilter})`,
    ]
      .filter(Boolean)
      .join(' ') || 'none'
  );
}
