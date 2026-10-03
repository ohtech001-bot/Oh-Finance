import { type AppLocaleCode } from './i18n';
type CopyValues = Record<string, string | number | null | undefined>;
/** Translate UI copy, never customer names or other user-entered data. */
export declare function copy(message: string, values?: CopyValues, locale?: "he" | "ar"): string;
export declare function useCopy(): typeof copy;
export declare function localizedError(message: string, locale?: AppLocaleCode): string;
export {};
//# sourceMappingURL=copy.d.ts.map