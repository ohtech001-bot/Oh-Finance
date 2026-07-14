import { type VariantProps } from 'class-variance-authority';
/**
 * شارات الحالة — الألوان والأشكال مقيسة من المرجع البصري.
 *
 * ⚠️ اللون **ليس** الوسيلة الوحيدة لنقل الحالة: كل شارة تحمل نصًا صريحًا.
 *    8% من الذكور مصابون بعمى ألوان (أشهره الأحمر/الأخضر — وهما بالضبط
 *    لونا «مدين»/«دائن» عندنا). لولا النص، لَما فرّق هؤلاء بين زبون مدين
 *    وزبون دائن في جدول الزبائن.
 */
declare const badgeVariants: (props?: ({
    tone?: "partial" | "debit" | "credit" | "neutral" | "info" | "purple" | "orange" | null | undefined;
} & import("class-variance-authority/types").ClassProp) | undefined) => string;
export interface StatusBadgeProps extends VariantProps<typeof badgeVariants> {
    children: React.ReactNode;
    /** نقطة ملوّنة قبل النص — كما في بطاقات إحصاء الطلبات في المرجع. */
    withDot?: boolean;
    className?: string;
}
export declare function StatusBadge({ tone, withDot, children, className }: StatusBadgeProps): import("react").JSX.Element;
/**
 * خرائط الحالات → (النص العربي، اللون).
 *
 * مركزية عمدًا: لو ترجم كل مطوّر «PARTIALLY_PAID» في مكانه، لظهرت «مدفوع
 * جزئيًا» و«مدفوعة جزئياً» و«جزئي» في ثلاث شاشات — فيظن المستخدم أنها ثلاث
 * حالات مختلفة.
 */
export declare const TENANT_STATUS_BADGE: {
    ACTIVE: {
        label: string;
        tone: "credit";
    };
    TRIAL: {
        label: string;
        tone: "info";
    };
    SUSPENDED: {
        label: string;
        tone: "debit";
    };
    CANCELLED: {
        label: string;
        tone: "debit";
    };
};
export declare const SUBSCRIPTION_STATUS_BADGE: {
    ACTIVE: {
        label: string;
        tone: "credit";
    };
    TRIALING: {
        label: string;
        tone: "info";
    };
    PAST_DUE: {
        label: string;
        tone: "partial";
    };
    CANCELLED: {
        label: string;
        tone: "debit";
    };
    EXPIRED: {
        label: string;
        tone: "debit";
    };
};
export declare const USER_STATUS_BADGE: {
    ACTIVE: {
        label: string;
        tone: "credit";
    };
    INACTIVE: {
        label: string;
        tone: "debit";
    };
};
/**
 * حالات الطلبات والدفعات — معرَّفة الآن، تُستخدم في المرحلة 4/5.
 * وجودها هنا يضمن أن تصميم الشارات مُقرَّر مرة واحدة، لا مرتجلًا لاحقًا.
 */
export declare const ORDER_STATUS_BADGE: {
    DRAFT: {
        label: string;
        tone: "neutral";
    };
    QUOTE: {
        label: string;
        tone: "info";
    };
    CONFIRMED: {
        label: string;
        tone: "credit";
    };
    PARTIALLY_PAID: {
        label: string;
        tone: "partial";
    };
    PAID: {
        label: string;
        tone: "credit";
    };
    CANCELLED: {
        label: string;
        tone: "debit";
    };
};
export declare const ACCOUNT_STATUS_BADGE: {
    DEBIT: {
        label: string;
        tone: "debit";
    };
    CREDIT: {
        label: string;
        tone: "credit";
    };
    SETTLED: {
        label: string;
        tone: "credit";
    };
};
export {};
//# sourceMappingURL=status-badge.d.ts.map