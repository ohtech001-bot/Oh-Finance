import i18n from 'i18next';
import { type LocaleCode } from '@oh/config';
export declare const APP_LOCALE_CODES: readonly ["ar", "he"];
export type AppLocaleCode = (typeof APP_LOCALE_CODES)[number];
/** يطبّق اللغة والاتجاه على <html>. */
export declare function applyLocale(locale: LocaleCode): void;
export declare function changeLocale(locale: AppLocaleCode): void;
export declare function currentLocale(): AppLocaleCode;
export default i18n;
//# sourceMappingURL=i18n.d.ts.map