import { createContext, useContext, type ReactNode } from 'react';

export type UiTranslate = (message: string, values?: Record<string, string | number>) => string;

const UiLocalization = createContext<{ translate: UiTranslate; locale: 'ar' | 'he' }>({
  translate: (message) => message,
  locale: 'ar',
});

export function UiLocalizationProvider({
  children,
  translate,
  locale,
}: {
  children: ReactNode;
  translate: UiTranslate;
  locale: 'ar' | 'he';
}) {
  return (
    <UiLocalization.Provider value={{ translate, locale }}>{children}</UiLocalization.Provider>
  );
}

export function useUiTranslation(): UiTranslate {
  return useContext(UiLocalization).translate;
}

export function useUiLocale(): 'ar' | 'he' {
  return useContext(UiLocalization).locale;
}
