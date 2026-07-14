import { AlertTriangle, FilterX, Inbox, RefreshCw, Wrench, type LucideIcon } from 'lucide-react';
import { Button } from '../primitives/button.js';
import { cn } from '../lib/cn.js';

interface BaseStateProps {
  className?: string;
}

// ── فارغ ─────────────────────────────────────────────────────────────────────

export interface EmptyStateProps extends BaseStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
}

/**
 * حالة فارغة.
 *
 * ⚠️ ليست «لا توجد بيانات» فحسب — بل **دعوة للفعل**. الفارق مهم: مستخدم جديد
 *    يفتح شاشة الزبائن لأول مرة يرى فراغًا. إن قلنا له «لا يوجد» فقط، فقد ضاع.
 *    الزر يخبره بالخطوة التالية مباشرة.
 */
export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-16 text-center', className)}>
      <div className="flex size-14 items-center justify-center rounded-full bg-neutral-soft" aria-hidden>
        <Icon className="size-6 text-fg-subtle" />
      </div>
      <h3 className="mt-4 text-card-title text-fg">{title}</h3>
      {description ? (
        <p className="mt-1.5 max-w-sm text-sm text-fg-muted">{description}</p>
      ) : null}
      {action ? (
        <Button variant="brand" className="mt-5" onClick={action.onClick}>
          {action.label}
        </Button>
      ) : null}
    </div>
  );
}

// ── لا نتائج بحث/فلترة ───────────────────────────────────────────────────────

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
export function NoResultsState({ onReset, className }: NoResultsStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-16 text-center', className)}>
      <div className="flex size-14 items-center justify-center rounded-full bg-neutral-soft" aria-hidden>
        <FilterX className="size-6 text-fg-subtle" />
      </div>
      <h3 className="mt-4 text-card-title text-fg">لا توجد نتائج مطابقة</h3>
      <p className="mt-1.5 max-w-sm text-sm text-fg-muted">
        جرّب تعديل كلمات البحث أو توسيع نطاق الفلاتر.
      </p>
      <Button variant="outline" className="mt-5" onClick={onReset}>
        <FilterX aria-hidden />
        إعادة تعيين الفلاتر
      </Button>
    </div>
  );
}

// ── خطأ ──────────────────────────────────────────────────────────────────────

export interface ErrorStateProps extends BaseStateProps {
  title?: string;
  message?: string;
  /** يُعرض للدعم — يربط ما رآه المستخدم بسطر السجل على الخادم. */
  requestId?: string;
  onRetry?: () => void;
}

export function ErrorState({
  title = 'تعذّر تحميل البيانات',
  message = 'حدث خطأ أثناء الاتصال بالخادم.',
  requestId,
  onRetry,
  className,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn('flex flex-col items-center justify-center px-6 py-16 text-center', className)}
    >
      <div className="flex size-14 items-center justify-center rounded-full bg-danger-soft" aria-hidden>
        <AlertTriangle className="size-6 text-danger" />
      </div>
      <h3 className="mt-4 text-card-title text-fg">{title}</h3>
      <p className="mt-1.5 max-w-sm text-sm text-fg-muted">{message}</p>

      {requestId ? (
        <p className="mt-2 font-mono text-[11px] text-fg-subtle" dir="ltr">
          {requestId}
        </p>
      ) : null}

      {onRetry ? (
        <Button variant="outline" className="mt-5" onClick={onRetry}>
          <RefreshCw aria-hidden />
          إعادة المحاولة
        </Button>
      ) : null}
    </div>
  );
}

// ── قيد التطوير ──────────────────────────────────────────────────────────────

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
export function PendingFeatureState({
  title,
  description,
  phase,
  className,
}: PendingFeatureStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-card border border-dashed border-border bg-card px-6 py-20 text-center',
        className,
      )}
    >
      <div className="flex size-14 items-center justify-center rounded-full bg-accent-soft" aria-hidden>
        <Wrench className="size-6 text-accent" />
      </div>

      <h3 className="mt-4 text-page-title text-fg">{title}</h3>
      <p className="mt-2 max-w-md text-sm text-fg-muted">{description}</p>

      <span className="mt-5 inline-flex items-center gap-2 rounded-pill bg-accent-soft px-3 py-1.5 text-badge text-accent">
        قيد التطوير — {phase}
      </span>

      <p className="mt-4 max-w-md text-xs text-fg-subtle">
        هذه الشاشة محجوزة ومصمَّمة، ولم تُربط ببياناتها بعد. لا تُعرض هنا أرقام
        تقديرية أو تجريبية.
      </p>
    </div>
  );
}
