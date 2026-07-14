import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * دمج أصناف Tailwind مع حل التعارضات.
 *
 * `clsx` يتعامل مع الشروط، و`twMerge` يحل التعارض: `cn('p-2', 'p-4')` → `'p-4'`.
 * بدونه يفوز الصنف الأول في ملف CSS النهائي لا الأخير في السلسلة، فتنكسر
 * قدرة المستدعي على تجاوز التنسيق عبر `className`.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
