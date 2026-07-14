import { forwardRef } from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import { cn } from '../lib/cn.js';

/**
 * الأزرار — مطابقة للمرجع البصري.
 *
 *   brand   (أخضر)  → «إضافة طلب جديد» · «حفظ التغييرات» · «تسجيل دفعة جديدة»
 *   accent  (أزرق)  → «إضافة زبون جديد» · «تسجيل دفعة»
 *   outline (أبيض)  → «تصدير» · «طباعة كشف حساب»
 *   danger  (أحمر)  → «إلغاء الطلب» (بحوار تأكيد دائمًا)
 *
 * الارتفاع 44px والزوايا 10px — مقيسان من الصور.
 */
const buttonVariants = cva(
  cn(
    'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-ctrl',
    'text-sm font-semibold transition-colors',
    // حلقة تركيز مرئية دائمًا — شرط الوصول بلوحة المفاتيح.
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
    'disabled:pointer-events-none disabled:opacity-50',
    '[&_svg]:size-4 [&_svg]:shrink-0',
  ),
  {
    variants: {
      variant: {
        brand: 'bg-brand text-white hover:bg-brand-hover',
        accent: 'bg-accent text-white hover:bg-accent-hover',
        outline: 'border border-border bg-card text-fg hover:bg-card-muted',
        ghost: 'text-fg-muted hover:bg-card-muted hover:text-fg',
        danger: 'bg-danger text-white hover:brightness-95',
        link: 'text-accent underline-offset-4 hover:underline',
      },
      size: {
        sm: 'h-9 px-3 text-[13px]',
        md: 'h-11 px-4',
        lg: 'h-12 px-6',
        icon: 'h-9 w-9 p-0',
      },
    },
    defaultVariants: { variant: 'brand', size: 'md' },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, variant, size, asChild = false, loading = false, children, disabled, ...props },
    ref,
  ) => {
    /**
     * ── asChild يُمرَّر ابنًا واحدًا فقط ─────────────────────────────────────
     * `Slot` من Radix يدمج خصائص الزر في ابنه المباشر (عادةً <Link>)، ويشترط
     * **عنصر React واحد** بالضبط. لو حقنّا أيقونة التحميل بجانبه — أو حتى
     * `null` من شرط تُرناري — لتلقّى Slot ابنين وانهار وقت التشغيل:
     *
     *     "Slot failed to slot onto its children."
     *
     * لذا: مع asChild نمرّر `children` وحده. زر-كرابط لا يحمل حالة تحميل
     * أصلًا (التنقّل لا «يُرسَل»)، فلا خسارة وظيفية.
     */
    if (asChild) {
      return (
        <Slot
          ref={ref}
          className={cn(buttonVariants({ variant, size }), className)}
          {...props}
        >
          {children}
        </Slot>
      );
    }

    return (
      <button
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        // زر يعمل أثناء التحميل = طلب مزدوج. في نظام مالي: دفعة مزدوجة.
        disabled={disabled ?? loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {loading ? <Loader2 className="animate-spin" aria-hidden /> : null}
        {children}
      </button>
    );
  },
);
Button.displayName = 'Button';

export { buttonVariants };
