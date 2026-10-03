import { type ReactNode } from 'react';
export type UiTranslate = (message: string, values?: Record<string, string | number>) => string;
export declare function UiLocalizationProvider({ children, translate, locale, }: {
    children: ReactNode;
    translate: UiTranslate;
    locale: 'ar' | 'he';
}): import("react").JSX.Element;
export declare function useUiTranslation(): UiTranslate;
export declare function useUiLocale(): 'ar' | 'he';
//# sourceMappingURL=localization.d.ts.map