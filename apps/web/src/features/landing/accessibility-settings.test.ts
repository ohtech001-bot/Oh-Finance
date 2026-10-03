import { afterEach, describe, expect, it } from 'vitest';
import {
  ACCESSIBILITY_STORAGE_KEY,
  accessibilityFilter,
  DEFAULT_ACCESSIBILITY,
  readAccessibilitySettings,
} from './accessibility-settings';

afterEach(() => localStorage.removeItem(ACCESSIBILITY_STORAGE_KEY));
describe('landing accessibility preferences', () => {
  it('uses safe defaults for missing or corrupt settings', () => {
    expect(readAccessibilitySettings()).toEqual(DEFAULT_ACCESSIBILITY);
    localStorage.setItem(ACCESSIBILITY_STORAGE_KEY, '{broken');
    expect(readAccessibilitySettings()).toEqual(DEFAULT_ACCESSIBILITY);
  });
  it('validates saved preferences and clamps text sizing', () => {
    localStorage.setItem(
      ACCESSIBILITY_STORAGE_KEY,
      JSON.stringify({
        textScale: 300,
        pauseMotion: true,
        highContrast: 'yes',
        colorFilter: 'invalid',
      }),
    );
    expect(readAccessibilitySettings()).toMatchObject({
      textScale: 140,
      pauseMotion: true,
      highContrast: false,
      colorFilter: 'none',
    });
  });
  it('composes only supported color filters', () => {
    expect(accessibilityFilter(DEFAULT_ACCESSIBILITY)).toBe('none');
    expect(
      accessibilityFilter({
        ...DEFAULT_ACCESSIBILITY,
        grayscale: true,
        highContrast: true,
        colorFilter: 'blueYellow',
      }),
    ).toBe('grayscale(1) contrast(1.25) url(#oh-filter-blueYellow)');
  });
});
