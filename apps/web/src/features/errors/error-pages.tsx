import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Link, useNavigate, useRouteError } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AlertOctagon, FileQuestion, Home, RefreshCw, ShieldX } from 'lucide-react';
import { Button } from '@oh/ui';

interface ErrorPageShellProps {
  icon: React.ComponentType<{ className?: string }>;
  code: string;
  title: string;
  description: string;
  tone: 'danger' | 'warning' | 'neutral';
  children: ReactNode;
}

function ErrorPageShell({
  icon: Icon,
  code,
  title,
  description,
  tone,
  children,
}: ErrorPageShellProps) {
  const toneClass = {
    danger: 'bg-danger-soft text-danger',
    warning: 'bg-warning-soft text-warning',
    neutral: 'bg-neutral-soft text-neutral',
  }[tone];

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-bg px-6 py-16 text-center">
      <div className={`flex size-16 items-center justify-center rounded-full ${toneClass}`} aria-hidden>
        <Icon className="size-8" />
      </div>

      <p className="mt-6 text-5xl font-bold tabular-nums text-fg-subtle" dir="ltr">
        {code}
      </p>
      <h1 className="mt-3 text-page-title text-fg">{title}</h1>
      <p className="mt-2 max-w-md text-sm text-fg-muted">{description}</p>

      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">{children}</div>
    </div>
  );
}

// ── 404 ──────────────────────────────────────────────────────────────────────

export function NotFoundPage() {
  const { t } = useTranslation();

  return (
    <ErrorPageShell
      icon={FileQuestion}
      code="404"
      title={t('errors.notFound')}
      description={t('errors.notFoundDescription')}
      tone="neutral"
    >
      <Button variant="brand" asChild>
        <Link to="/">
          <Home aria-hidden />
          {t('errors.goHome')}
        </Link>
      </Button>
    </ErrorPageShell>
  );
}

// ── 403 ──────────────────────────────────────────────────────────────────────

export function ForbiddenPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <ErrorPageShell
      icon={ShieldX}
      code="403"
      title={t('errors.forbidden')}
      description={t('errors.forbiddenDescription')}
      tone="danger"
    >
      <Button variant="brand" onClick={() => navigate('/')}>
        <Home aria-hidden />
        {t('errors.goHome')}
      </Button>
      <Button variant="outline" onClick={() => navigate(-1)}>
        {t('common.back')}
      </Button>
    </ErrorPageShell>
  );
}

// ── خطأ عام من الراوتر ───────────────────────────────────────────────────────

export function RouteErrorPage() {
  const error = useRouteError();
  const { t } = useTranslation();

  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : t('errors.somethingWentWrongDescription');

  return (
    <ErrorPageShell
      icon={AlertOctagon}
      code="500"
      title={t('errors.somethingWentWrong')}
      // ⚠️ في الإنتاج، الخادم لا يرسل تفاصيل داخلية. هذه رسالة من الواجهة
      //    نفسها (خطأ عرض)، وهي غير حسّاسة.
      description={message}
      tone="danger"
    >
      <Button variant="brand" onClick={() => window.location.reload()}>
        <RefreshCw aria-hidden />
        {t('errors.reload')}
      </Button>
      <Button variant="outline" asChild>
        <Link to="/">{t('errors.goHome')}</Link>
      </Button>
    </ErrorPageShell>
  );
}

// ── حدّ الأخطاء (Error Boundary) ─────────────────────────────────────────────

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * حدّ الأخطاء الجذري.
 *
 * بدونه، خطأ عرض واحد في أي مكوّن يُفرغ الشاشة إلى **بياض تام** — بلا رسالة،
 * بلا مخرج، بلا حتى زر تحديث. المستخدم يظن أن التطبيق تعطّل وأن بياناته ضاعت.
 *
 * React لا يوفّر نسخة hook من هذا؛ الصنف (class) هو الطريقة الوحيدة.
 */
export class AppErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('خطأ عرض غير معالج:', error, info.componentStack);
  }

  override render(): ReactNode {
    if (this.state.error) {
      return (
        <div className="flex min-h-dvh flex-col items-center justify-center bg-bg px-6 text-center">
          <div className="flex size-16 items-center justify-center rounded-full bg-danger-soft" aria-hidden>
            <AlertOctagon className="size-8 text-danger" />
          </div>

          <h1 className="mt-6 text-page-title text-fg">حدث خطأ في التطبيق</h1>
          <p className="mt-2 max-w-md text-sm text-fg-muted">
            نعتذر — حدث خطأ غير متوقع أثناء عرض الصفحة. بياناتك محفوظة ولم يتأثر
            شيء منها.
          </p>

          <div className="mt-8 flex gap-3">
            <Button variant="brand" onClick={() => window.location.reload()}>
              <RefreshCw aria-hidden />
              تحديث الصفحة
            </Button>
            <Button variant="outline" onClick={() => (window.location.href = '/')}>
              <Home aria-hidden />
              العودة للرئيسية
            </Button>
          </div>

          {import.meta.env.DEV ? (
            <pre
              dir="ltr"
              className="mt-8 max-w-2xl overflow-x-auto rounded-card border border-border bg-card p-4 text-start text-xs text-danger"
            >
              {this.state.error.stack ?? this.state.error.message}
            </pre>
          ) : null}
        </div>
      );
    }

    return this.props.children;
  }
}
