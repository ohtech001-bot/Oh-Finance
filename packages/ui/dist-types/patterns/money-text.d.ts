import { type CurrencyCode, type MoneyString } from '@oh/money';
export type MoneyTone = 'debit' | 'credit' | 'neutral' | 'auto' | 'plain';
export interface MoneyTextProps {
    /** المبلغ **كنص** — لا `number`. النوع نفسه يمنع الخطأ. */
    value: MoneyString;
    currency?: CurrencyCode;
    /**
     * الدلالة المالية:
     *   debit   → أحمر (دَين، مدين، مستحق)
     *   credit  → أخضر (مدفوع، مقبوض، دائن)
     *   auto    → أحمر للسالب، أخضر للموجب، رمادي للصفر
     *   neutral → رمادي
     *   plain   → لون النص العادي (للمبالغ غير الدلالية: سعر باقة مثلًا)
     */
    tone?: MoneyTone;
    size?: 'sm' | 'md' | 'lg' | 'kpi';
    withSymbol?: boolean;
    signDisplay?: boolean;
    className?: string;
}
/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  عرض مبلغ مالي — المكوّن الوحيد المسموح له بذلك.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  ثلاثة قرارات مقصودة:
 *
 *  1. `value: MoneyString` — النوع يرفض `number` وقت الترجمة. لا يمكن لمطوّر
 *     أن يمرّر رقمًا عائمًا «بالخطأ»؛ البناء يفشل.
 *
 *  2. `tabular-nums` — بدونه تختلف عروض الأرقام (١ أضيق من ٠)، فتهتز الأعمدة
 *     بين صفوف الجدول ويصعب المسح البصري لعمود مبالغ. في جدول حركات مالية
 *     هذا فارق حقيقي في قابلية القراءة، لا تفصيل تجميلي.
 *
 *  3. `dir="ltr"` على الرقم نفسه — الأرقام تُقرأ من اليسار لليمين حتى داخل
 *     نص عربي. بدونه ينكسر ترتيب "1,250.00" في بعض المتصفحات ويظهر "00.250,1".
 */
export declare function MoneyText({ value, currency, tone, size, withSymbol, signDisplay, className, }: MoneyTextProps): import("react").JSX.Element;
//# sourceMappingURL=money-text.d.ts.map