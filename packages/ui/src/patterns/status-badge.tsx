import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../lib/cn.js';

/**
 * شارات الحالة — الألوان والأشكال مقيسة من المرجع البصري.
 *
 * ⚠️ اللون **ليس** الوسيلة الوحيدة لنقل الحالة: كل شارة تحمل نصًا صريحًا.
 *    8% من الذكور مصابون بعمى ألوان (أشهره الأحمر/الأخضر — وهما بالضبط
 *    لونا «مدين»/«دائن» عندنا). لولا النص، لَما فرّق هؤلاء بين زبون مدين
 *    وزبون دائن في جدول الزبائن.
 */
const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-pill px-2.5 py-1 text-badge whitespace-nowrap',
  {
    variants: {
      tone: {
        credit: 'bg-success-soft text-success',   // مدفوع · دائن · نشط
        debit: 'bg-danger-soft text-danger',      // مدين · ملغي · غير نشط
        partial: 'bg-warning-soft text-warning',  // مدفوع جزئيًا
        info: 'bg-info-soft text-info',           // عرض سعر
        neutral: 'bg-neutral-soft text-neutral',  // مسودة
        purple: 'bg-purple-soft text-purple',
        orange: 'bg-orange-soft text-orange',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
);

export interface StatusBadgeProps extends VariantProps<typeof badgeVariants> {
  children: React.ReactNode;
  /** نقطة ملوّنة قبل النص — كما في بطاقات إحصاء الطلبات في المرجع. */
  withDot?: boolean;
  className?: string;
}

export function StatusBadge({ tone, withDot, children, className }: StatusBadgeProps) {
  return (
    <span className={cn(badgeVariants({ tone }), className)}>
      {withDot ? (
        <span className="size-1.5 rounded-full bg-current" aria-hidden />
      ) : null}
      {children}
    </span>
  );
}

/**
 * خرائط الحالات → (النص العربي، اللون).
 *
 * مركزية عمدًا: لو ترجم كل مطوّر «PARTIALLY_PAID» في مكانه، لظهرت «مدفوع
 * جزئيًا» و«مدفوعة جزئياً» و«جزئي» في ثلاث شاشات — فيظن المستخدم أنها ثلاث
 * حالات مختلفة.
 */
export const TENANT_STATUS_BADGE = {
  ACTIVE: { label: 'نشط', tone: 'credit' as const },
  TRIAL: { label: 'تجريبي', tone: 'info' as const },
  SUSPENDED: { label: 'موقوف', tone: 'debit' as const },
  CANCELLED: { label: 'ملغى', tone: 'debit' as const },
};

export const SUBSCRIPTION_STATUS_BADGE = {
  ACTIVE: { label: 'نشط', tone: 'credit' as const },
  TRIALING: { label: 'تجريبي', tone: 'info' as const },
  PAST_DUE: { label: 'متأخر السداد', tone: 'partial' as const },
  CANCELLED: { label: 'ملغى', tone: 'debit' as const },
  EXPIRED: { label: 'منتهٍ', tone: 'debit' as const },
};

export const USER_STATUS_BADGE = {
  ACTIVE: { label: 'نشط', tone: 'credit' as const },
  INACTIVE: { label: 'غير نشط', tone: 'debit' as const },
};

/**
 * حالات الطلبات والدفعات — معرَّفة الآن، تُستخدم في المرحلة 4/5.
 * وجودها هنا يضمن أن تصميم الشارات مُقرَّر مرة واحدة، لا مرتجلًا لاحقًا.
 */
export const ORDER_STATUS_BADGE = {
  DRAFT: { label: 'مسودة', tone: 'neutral' as const },
  QUOTE: { label: 'عرض سعر', tone: 'info' as const },
  CONFIRMED: { label: 'مؤكد', tone: 'credit' as const },
  PARTIALLY_PAID: { label: 'مدفوع جزئيًا', tone: 'partial' as const },
  PAID: { label: 'مدفوع', tone: 'credit' as const },
  CANCELLED: { label: 'ملغي', tone: 'debit' as const },
};

export const ACCOUNT_STATUS_BADGE = {
  DEBIT: { label: 'مدين', tone: 'debit' as const },
  CREDIT: { label: 'دائن', tone: 'credit' as const },
  SETTLED: { label: 'لا يوجد رصيد', tone: 'credit' as const },
};
