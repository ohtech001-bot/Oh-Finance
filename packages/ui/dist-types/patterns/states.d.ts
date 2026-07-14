import { type LucideIcon } from 'lucide-react';
interface BaseStateProps {
    className?: string;
}
export interface EmptyStateProps extends BaseStateProps {
    icon?: LucideIcon;
    title: string;
    description?: string;
    action?: {
        label: string;
        onClick: () => void;
    };
}
/**
 * حالة فارغة.
 *
 * ⚠️ ليست «لا توجد بيانات» فحسب — بل **دعوة للفعل**. الفارق مهم: مستخدم جديد
 *    يفتح شاشة الزبائن لأول مرة يرى فراغًا. إن قلنا له «لا يوجد» فقط، فقد ضاع.
 *    الزر يخبره بالخطوة التالية مباشرة.
 */
export declare function EmptyState({ icon: Icon, title, description, action, className, }: EmptyStateProps): import("react").JSX.Element;
export interface NoResultsStateProps extends BaseStateProps {
    onReset: () => void;
}
/**
 * منفصلة عن `EmptyState` عمدًا.
 *
 * «لا يوجد زبائن بعد» و«لا نتائج لفلترك» حالتان مختلفتان تمامًا، والخلط
 * بينهما يربك المستخدم: قد يظن أن بياناته اختفت، بينما كل ما فعله هو ضبط
 * فلتر تاريخ خاطئ. الحل هنا زر «إعادة تعيين»، لا زر «إضافة».
 */
export declare function NoResultsState({ onReset, className }: NoResultsStateProps): import("react").JSX.Element;
export interface ErrorStateProps extends BaseStateProps {
    title?: string;
    message?: string;
    /** يُعرض للدعم — يربط ما رآه المستخدم بسطر السجل على الخادم. */
    requestId?: string;
    onRetry?: () => void;
}
export declare function ErrorState({ title, message, requestId, onRetry, className, }: ErrorStateProps): import("react").JSX.Element;
export interface PendingFeatureStateProps extends BaseStateProps {
    title: string;
    description: string;
    /** رقم المرحلة التي ستُفعِّل هذه الميزة. */
    phase: string;
}
/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  حالة «قيد التطوير» — البديل الأمين عن الواجهة الوهمية.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  القاعدة: **لا زر لا يعمل، ولا رقم مخترع.**
 *
 *  شاشة تعرض «إجمالي الديون: 38,450 ₪» بينما جدول الحركات غير موجود أصلًا
 *  ليست «واجهة أولية» — هي كذبة. المستخدم يصدّق الرقم، وقد يبني عليه قرارًا.
 *
 *  هذا المكوّن يقول الحقيقة صراحةً: الشاشة محجوزة، الميزة قادمة، ومتى.
 */
export declare function PendingFeatureState({ title, description, phase, className, }: PendingFeatureStateProps): import("react").JSX.Element;
export {};
//# sourceMappingURL=states.d.ts.map