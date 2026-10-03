import { useUiTranslation } from '../localization.js';
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
  const copy = useUiTranslation();

  return (
    <div
      className={cn('flex flex-col items-center justify-center px-6 py-16 text-center', className)}
    >
      <div
        className="bg-neutral-soft flex size-14 items-center justify-center rounded-full"
        aria-hidden
      >
        <Icon className="text-fg-subtle size-6" />
      </div>
      <h3 className="text-card-title text-fg mt-4">{copy(title)}</h3>
      {description ? (
        <p className="text-fg-muted mt-1.5 max-w-sm text-sm">{copy(description)}</p>
      ) : null}
      {action ? (
        <Button variant="brand" className="mt-5" onClick={action.onClick}>
          {copy(action.label)}
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
  const copy = useUiTranslation();

  return (
    <div
      className={cn('flex flex-col items-center justify-center px-6 py-16 text-center', className)}
    >
      <div
        className="bg-neutral-soft flex size-14 items-center justify-center rounded-full"
        aria-hidden
      >
        <FilterX className="text-fg-subtle size-6" />
      </div>
      <h3 className="text-card-title text-fg mt-4">{copy('لا توجد نتائج مطابقة')}</h3>
      <p className="text-fg-muted mt-1.5 max-w-sm text-sm">
        {copy('جرّب تعديل كلمات البحث أو توسيع نطاق الفلاتر.')}
      </p>
      <Button variant="outline" className="mt-5" onClick={onReset}>
        <FilterX aria-hidden />
        {copy('إعادة تعيين الفلاتر')}
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
  const copy = useUiTranslation();

  return (
    <div
      role="alert"
      className={cn('flex flex-col items-center justify-center px-6 py-16 text-center', className)}
    >
      <div
        className="bg-danger-soft flex size-14 items-center justify-center rounded-full"
        aria-hidden
      >
        <AlertTriangle className="text-danger size-6" />
      </div>
      <h3 className="text-card-title text-fg mt-4">{copy(title)}</h3>
      <p className="text-fg-muted mt-1.5 max-w-sm text-sm">{copy(message)}</p>

      {requestId ? (
        <p className="text-fg-subtle mt-2 font-mono text-[11px]" dir="ltr">
          {requestId}
        </p>
      ) : null}

      {onRetry ? (
        <Button variant="outline" className="mt-5" onClick={onRetry}>
          <RefreshCw aria-hidden />
          {copy('إعادة المحاولة')}
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
  const copy = useUiTranslation();

  return (
    <div
      className={cn(
        'rounded-card border-border bg-card flex flex-col items-center justify-center border border-dashed px-6 py-20 text-center',
        className,
      )}
    >
      <div
        className="bg-accent-soft flex size-14 items-center justify-center rounded-full"
        aria-hidden
      >
        <Wrench className="text-accent size-6" />
      </div>

      <h3 className="text-page-title text-fg mt-4">{copy(title)}</h3>
      <p className="text-fg-muted mt-2 max-w-md text-sm">{copy(description)}</p>

      <span className="rounded-pill bg-accent-soft text-badge text-accent mt-5 inline-flex items-center gap-2 px-3 py-1.5">
        {copy('قيد التطوير —')} {copy(phase)}
      </span>

      <p className="text-fg-subtle mt-4 max-w-md text-xs">
        {copy(
          'هذه الشاشة محجوزة ومصمَّمة، ولم تُربط ببياناتها بعد. لا تُعرض هنا أرقام تقديرية أو تجريبية.',
        )}
      </p>
    </div>
  );
}
