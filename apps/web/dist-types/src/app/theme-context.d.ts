type Theme = 'light' | 'dark';
interface ThemeContextValue {
    theme: Theme;
    toggleTheme: () => void;
    setTheme: (theme: Theme) => void;
}
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
export declare function ThemeProvider({ children }: {
    children: React.ReactNode;
}): import("react").JSX.Element;
export declare function useTheme(): ThemeContextValue;
export {};
//# sourceMappingURL=theme-context.d.ts.map