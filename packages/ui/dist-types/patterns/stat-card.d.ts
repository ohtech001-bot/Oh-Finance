import { type LucideIcon } from 'lucide-react';
import type { CurrencyCode, MoneyString } from '@oh/money';
import { type MoneyTone } from './money-text.js';
export type StatTone = 'brand' | 'accent' | 'debit' | 'credit' | 'partial' | 'purple' | 'orange' | 'info' | 'neutral';
export interface StatCardProps {
    label: string;
    /** قيمة عددية (عدد الطلبات، عدد الزبائن). */
    value?: string | number;
    /** قيمة مالية — تُعرض عبر MoneyText. يُستخدم بدل `value`. */
    money?: MoneyString;
    currency?: CurrencyCode;
    moneyTone?: MoneyTone;
    icon: LucideIcon;
    tone?: StatTone;
    /** نص فرعي: «من 56 زبون» · «هذا الشهر». */
    sublabel?: string;
    /** دلتا: `{ value: 15, direction: 'up' }` → «↗ +15%». */
    delta?: {
        value: number;
        label?: string;
    };
    loading?: boolean;
    /**
     * ميزة غير مُفعّلة بعد — تُعرض البطاقة بشكلها الكامل مع شارة صريحة.
     *
     * هذا بديل **أمين** عن عرض رقم مخترع: المستخدم يرى أن المكان محجوز
     * وأن البيانات ستأتي، بدل أن يقرأ صفرًا فيظنه حقيقة، أو رقمًا وهميًا
     * فيبني عليه قرارًا.
     */
    pending?: string;
    className?: string;
}
/**
 * بطاقة KPI — مطابقة للمرجع: التسمية أعلى، القيمة كبيرة ملوّنة، أيقونة في
 * مربع ملوّن 48px، نص فرعي أو دلتا أسفل.
 */
export declare function StatCard({ label, value, money, currency, moneyTone, icon: Icon, tone, sublabel, delta, loading, pending, className, }: StatCardProps): import("react").JSX.Element;
//# sourceMappingURL=stat-card.d.ts.map