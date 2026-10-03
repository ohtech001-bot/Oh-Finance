import { useUiTranslation } from '../localization.js';
import { ChevronLeft } from 'lucide-react';
import { cn } from '../lib/cn.js';

export interface Crumb {
  label: string;
  href?: string;
}

export interface BreadcrumbsProps {
  items: Crumb[];
  /** مكوّن الرابط — يُمرَّر من التطبيق (React Router Link). */
  linkAs?: React.ComponentType<{ to: string; className?: string; children: React.ReactNode }>;
  className?: string;
}

/**
 * فُتات الخبز — «الرئيسية / الزبائن / أحمد محمود».
 *
 * الفاصل `ChevronLeft` في RTL يشير إلى **اليسار** أي إلى الأمام في اتجاه
 * القراءة (من اليمين لليسار). لو استخدمنا ChevronRight لأشار إلى الخلف
 * وبدا مقلوبًا. هذا مطابق للمرجع البصري.
 *
 * `aria-current="page"` على العنصر الأخير — قارئ الشاشة يعلن أنه الصفحة
 * الحالية بدل قراءته كرابط قابل للنقر.
 */
export function Breadcrumbs({ items, linkAs: Link, className }: BreadcrumbsProps) {
  const copy = useUiTranslation();

  return (
    <nav
      aria-label={copy('مسار التنقّل')}
      className={cn('flex items-center gap-1.5 text-[13px]', className)}
    >
      <ol className="flex flex-wrap items-center gap-1.5">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;

          return (
            <li key={`${item.label}-${index}`} className="flex items-center gap-1.5">
              {isLast || !item.href ? (
                <span
                  aria-current={isLast ? 'page' : undefined}
                  className={isLast ? 'text-fg font-medium' : 'text-fg-muted'}
                >
                  {item.label}
                </span>
              ) : Link ? (
                <Link to={item.href} className="text-fg-muted hover:text-accent transition-colors">
                  {item.label}
                </Link>
              ) : (
                <a href={item.href} className="text-fg-muted hover:text-accent transition-colors">
                  {item.label}
                </a>
              )}

              {!isLast ? (
                <ChevronLeft
                  className="text-fg-subtle size-3.5 ltr:rotate-180 rtl:rotate-0"
                  aria-hidden
                />
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

// ── ترويسة الصفحة (عنوان + فُتات + إجراءات) ─────────────────────────────────

export interface PageHeaderProps {
  title: string;
  icon?: React.ComponentType<{ className?: string }>;
  breadcrumbs?: Crumb[];
  linkAs?: BreadcrumbsProps['linkAs'];
  description?: string;
  /** أزرار الإجراءات — تظهر في الطرف المقابل للعنوان. */
  actions?: React.ReactNode;
  className?: string;
}

/**
 * ترويسة الصفحة — مطابقة للمرجع:
 * العنوان + الأيقونة في جهة البداية، فُتات الخبز تحته، الإجراءات في المقابل.
 */
export function PageHeader({
  title,
  icon: Icon,
  breadcrumbs,
  linkAs,
  description,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn('flex items-start justify-between gap-3', className)}>
      <div className="min-w-0">
        <div className="flex items-center gap-2.5">
          {Icon ? <Icon className="text-fg-muted size-6" aria-hidden /> : null}
          <h1 className="text-page-title text-fg">{title}</h1>
        </div>

        {breadcrumbs ? (
          <Breadcrumbs items={breadcrumbs} linkAs={linkAs} className="mt-1.5 hidden sm:flex" />
        ) : null}

        {description ? <p className="text-fg-muted mt-1.5 text-sm">{description}</p> : null}
      </div>

      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">{actions}</div>
      ) : null}
    </div>
  );
}
