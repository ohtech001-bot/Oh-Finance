import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextValue {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const STORAGE_KEY = 'oh_theme';

/**
 * السمة (فاتح/داكن).
 *
 * ⚠️ `localStorage` هنا **مقبول تمامًا** — التفضيل البصري ليس سرًّا.
 *    الممنوع هو تخزين **الرموز** فيه. الخلط بين الحالتين يؤدي إلى إما تسريب
 *    الجلسة (خطر)، أو تجنّب localStorage كليًا (شلل بلا سبب).
 *
 * السمة تُطبَّق بـ`data-theme` على <html> — فتتبدّل كل متغيّرات CSS دفعة
 * واحدة بلا إعادة رسم يدوي لأي مكوّن.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'dark' || stored === 'light') return stored;

    // نحترم تفضيل نظام التشغيل عند أول زيارة.
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  const setTheme = useCallback((next: Theme) => setThemeState(next), []);
  const toggleTheme = useCallback(
    () => setThemeState((current) => (current === 'dark' ? 'light' : 'dark')),
    [],
  );

  const value = useMemo(() => ({ theme, toggleTheme, setTheme }), [theme, toggleTheme, setTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme يجب أن يُستخدم داخل <ThemeProvider>.');
  }
  return context;
}
