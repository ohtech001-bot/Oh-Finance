import { describe, expect, it, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';
import { DEFAULT_LOCALE, LOCALES, directionOf, isRtl } from '@oh/config';
import i18n, { applyLocale, changeLocale, currentLocale } from '@/lib/i18n';
import { ThemeProvider } from './theme-context';
import { NotFoundPage, ForbiddenPage } from '@/features/errors/error-pages';

function renderWithProviders(ui: React.ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <MemoryRouter>{ui}</MemoryRouter>
        </ThemeProvider>
      </QueryClientProvider>
    </I18nextProvider>,
  );
}

describe('اتجاه اللغة (RTL / LTR)', () => {
  beforeEach(() => {
    changeLocale('ar');
  });

  it('العربية هي الافتراضية', () => {
    expect(DEFAULT_LOCALE).toBe('ar');
    expect(currentLocale()).toBe('ar');
  });

  it('العربية تضبط <html dir="rtl" lang="ar">', () => {
    applyLocale('ar');
    expect(document.documentElement.dir).toBe('rtl');
    expect(document.documentElement.lang).toBe('ar');
  });

  it('العبرية تضبط dir=rtl وتفعّل خط العبرية', () => {
    applyLocale('he');
    expect(document.documentElement.dir).toBe('rtl');
    expect(document.documentElement.lang).toBe('he');
    // IBM Plex Sans Arabic لا يغطي العبرية — يجب تبديل الخط.
    expect(document.documentElement.classList.contains('font-he')).toBe(true);
  });

  it('الإنجليزية تضبط dir=ltr وتُلغي خط العبرية', () => {
    applyLocale('en');
    expect(document.documentElement.dir).toBe('ltr');
    expect(document.documentElement.lang).toBe('en');
    expect(document.documentElement.classList.contains('font-he')).toBe(false);
  });

  it('خريطة الاتجاهات في @oh/config متسقة', () => {
    expect(directionOf('ar')).toBe('rtl');
    expect(directionOf('he')).toBe('rtl');
    expect(directionOf('en')).toBe('ltr');
    expect(isRtl('ar')).toBe(true);
    expect(isRtl('en')).toBe(false);
  });

  it('التبديل بين اللغات يُحدّث الاتجاه في كل مرة', () => {
    changeLocale('en');
    expect(document.documentElement.dir).toBe('ltr');

    changeLocale('he');
    expect(document.documentElement.dir).toBe('rtl');

    changeLocale('ar');
    expect(document.documentElement.dir).toBe('rtl');
  });
});

describe('الترجمات', () => {
  it('اللغات الثلاث تملك نفس مفاتيح الترجمة', () => {
    // مفتاح ناقص في العبرية يعني نصًا عربيًا يظهر وسط واجهة عبرية.
    const collectKeys = (obj: Record<string, unknown>, prefix = ''): string[] =>
      Object.entries(obj).flatMap(([key, value]) => {
        const path = prefix ? `${prefix}.${key}` : key;
        return typeof value === 'object' && value !== null
          ? collectKeys(value as Record<string, unknown>, path)
          : [path];
      });

    const arKeys = collectKeys(
      i18n.getResourceBundle('ar', 'translation') as Record<string, unknown>,
    ).sort();
    const heKeys = collectKeys(
      i18n.getResourceBundle('he', 'translation') as Record<string, unknown>,
    ).sort();
    const enKeys = collectKeys(
      i18n.getResourceBundle('en', 'translation') as Record<string, unknown>,
    ).sort();

    expect(heKeys).toEqual(arKeys);
    expect(enKeys).toEqual(arKeys);
  });

  it('كل لغة لها اسم أصلي واتجاه', () => {
    for (const [code, def] of Object.entries(LOCALES)) {
      expect(def.nameNative, `ينقص الاسم الأصلي: ${code}`).toBeTruthy();
      expect(['rtl', 'ltr']).toContain(def.dir);
    }
  });
});

describe('صفحات الأخطاء', () => {
  it('404 تعرض الرمز والعنوان ومخرجًا', () => {
    renderWithProviders(<NotFoundPage />);
    expect(screen.getByText('404')).toBeInTheDocument();
    // مخرج إلزامي — صفحة خطأ بلا زر عودة تحبس المستخدم.
    expect(screen.getByRole('link')).toBeInTheDocument();
  });

  it('403 تشرح السبب وتقدّم مخرجين', () => {
    renderWithProviders(<ForbiddenPage />);
    expect(screen.getByText('403')).toBeInTheDocument();
    expect(screen.getAllByRole('button').length).toBeGreaterThanOrEqual(2);
  });
});
