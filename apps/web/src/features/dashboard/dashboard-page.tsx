import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  CreditCard,
  LayoutDashboard,
  Package,
  ShoppingBag,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react';
import type { Subscription } from '@oh/contracts';
import type { CurrencyCode } from '@oh/money';
import {
  Card,
  CardBody,
  CardHeader,
  CardSkeleton,
  MoneyText,
  PageHeader,
  StatCard,
  StatusBadge,
  SUBSCRIPTION_STATUS_BADGE,
  cn,
} from '@oh/ui';
import { api } from '@/lib/api';
import { displayPercent } from '@/lib/percent';
import { useAuth } from '@/app/auth-context';

/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  لوحة صاحب المحل.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  ── قرار حاسم: لا أرقام مخترعة ─────────────────────────────────────────────
 *
 *  المرجع البصري يعرض «إجمالي الديون 38,450 ر.س» و«الطلبات 87» و«المبيعات
 *  63,300». هذه بيانات موك‌أب. جداول `orders` و`payments` و`ledger_entries`
 *  **غير موجودة** في المرحلة 1 — تُبنى في المرحلتين 4 و5.
 *
 *  أمامي ثلاثة خيارات:
 *    (أ) عرض أرقام الموك‌أب      ← كذب. قد يبني عليه صاحب المحل قرارًا.
 *    (ب) عرض أصفار                ← كذب أيضًا، وأخبث: يبدو صحيحًا.
 *    (ج) عرض البطاقات بشكلها الكامل مع شارة «المرحلة 4» صريحة.  ← المختار.
 *
 *  البطاقات هنا **بتخطيطها النهائي بالضبط** — نفس الشبكة، نفس الألوان، نفس
 *  الأيقونات. ربطها بالبيانات في المرحلة 4 لن يغيّر سطر تخطيط واحد.
 *
 *  ما هو **حقيقي** الآن ويُعرض فعلًا: بيانات المحل، الباقة، حالة الاشتراك،
 *  وعدّادات الاستخدام (المحلات والمستخدمون) — كلها من الخادم.
 */
export function DashboardPage() {
  const { t } = useTranslation();
  const { user } = useAuth();

  const {
    data: subscription,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['subscription'],
    queryFn: () => api.get<Subscription>('/subscription'),
  });

  const currency = (user?.store?.currency ?? 'ILS') as CurrencyCode;
  const storeName = user?.store?.name ?? user?.tenant?.name ?? '';

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('dashboard.title')}
        icon={LayoutDashboard}
        description={t('dashboard.welcome', { store: storeName })}
      />

      {/* ── بطاقات KPI — التخطيط النهائي، البيانات في المرحلة 4/5 ─────── */}
      <section aria-labelledby="kpi-heading">
        <h2 id="kpi-heading" className="sr-only">
          المؤشرات المالية
        </h2>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label={t('dashboard.totalDebt')}
            icon={Wallet}
            tone="debit"
            pending="المرحلة 5"
          />
          <StatCard
            label={t('dashboard.collectedThisMonth')}
            icon={CreditCard}
            tone="credit"
            pending="المرحلة 5"
          />
          <StatCard
            label={t('dashboard.ordersThisMonth')}
            icon={ShoppingBag}
            tone="accent"
            pending="المرحلة 4"
          />
          <StatCard
            label={t('dashboard.totalSales')}
            icon={TrendingUp}
            tone="purple"
            pending="المرحلة 4"
          />
        </div>

        <p className="mt-3 text-xs text-fg-subtle">
          المؤشرات المالية تُربط بدفتر الحركات في المرحلتين 4 و5. لا تُعرض هنا
          أرقام تقديرية.
        </p>
      </section>

      {/* ── ما هو حقيقي الآن: الاشتراك والاستخدام ─────────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <section className="lg:col-span-2">
          {isLoading ? (
            <CardSkeleton />
          ) : isError || !subscription ? (
            <Card>
              <CardHeader title={t('subscription.usage')} />
              <CardBody>
                <p className="text-sm text-fg-muted">تعذّر تحميل بيانات الاشتراك.</p>
              </CardBody>
            </Card>
          ) : (
            <UsageCard subscription={subscription} />
          )}
        </section>

        <section>
          {isLoading ? (
            <CardSkeleton />
          ) : isError || !subscription ? null : (
            <PlanCard subscription={subscription} currency={currency} />
          )}
        </section>
      </div>

      {/* ── الأقسام القادمة ───────────────────────────────────────────── */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <UpcomingCard
          title={t('dashboard.recentOrders')}
          description="آخر الطلبات مع حالاتها ومبالغها."
          phase="المرحلة 4"
          icon={ShoppingBag}
        />
        <UpcomingCard
          title={t('dashboard.recentPayments')}
          description="آخر الدفعات المستلمة وطرق الدفع."
          phase="المرحلة 5"
          icon={CreditCard}
        />
        <UpcomingCard
          title={t('dashboard.topDebtors')}
          description="الزبائن الأعلى مديونية ورصيد كل منهم."
          phase="المرحلة 5"
          icon={Users}
        />
      </section>
    </div>
  );
}

// ── عدّادات استخدام الباقة ──────────────────────────────────────────────────

function UsageCard({ subscription }: { subscription: Subscription }) {
  const { t } = useTranslation();
  const { usage } = subscription;

  /**
   * ⚠️ عدّادات الزبائن والطلبات = 0 وهذا **صحيح**، لا نائب:
   *    لا يوجد زبون واحد في قاعدة البيانات لأن الجدول لم يُنشأ بعد.
   *    نميّزها بصريًا كي لا يظنها المستخدم بيانات ناقصة.
   */
  const rows = [
    { key: 'stores', label: t('subscription.stores'), data: usage.stores, live: true },
    { key: 'users', label: t('subscription.users'), data: usage.users, live: true },
    { key: 'customers', label: t('subscription.customers'), data: usage.customers, live: false },
    { key: 'orders', label: t('subscription.orders'), data: usage.ordersThisMonth, live: false },
  ];

  return (
    <Card>
      <CardHeader
        title={t('subscription.usage')}
        action={
          <Link
            to="/subscription"
            className="flex items-center gap-1 text-[13px] font-medium text-accent hover:underline"
          >
            التفاصيل
            <ArrowLeft className="size-3.5 rtl:rotate-0 ltr:rotate-180" aria-hidden />
          </Link>
        }
      />

      <CardBody className="space-y-5">
        {rows.map((row) => {
          const percent = displayPercent(row.data.used, row.data.limit);

          // تحذير بصري عند اقتراب الحد — قبل أن يُرفض إنشاء زبون جديد فجأة.
          const nearLimit = percent >= 80;

          return (
            <div key={row.key}>
              <div className="flex items-center justify-between text-[13px]">
                <span className="font-medium text-fg">
                  {row.label}
                  {!row.live ? (
                    <span className="ms-2 rounded-pill bg-neutral-soft px-1.5 py-0.5 text-[10px] font-medium text-neutral">
                      يُفعَّل في المرحلة 4
                    </span>
                  ) : null}
                </span>
                <span className="tabular-nums text-fg-muted" dir="ltr">
                  {row.data.used} / {row.data.limit}
                </span>
              </div>

              <div
                className="mt-2 h-2 w-full overflow-hidden rounded-full bg-border-subtle"
                role="progressbar"
                aria-valuenow={percent}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={row.label}
              >
                <div
                  className={cn(
                    'h-full rounded-full transition-all',
                    nearLimit ? 'bg-warning' : 'bg-brand',
                  )}
                  style={{ width: `${percent}%` }}
                />
              </div>
            </div>
          );
        })}
      </CardBody>
    </Card>
  );
}

// ── بطاقة الباقة ────────────────────────────────────────────────────────────

function PlanCard({
  subscription,
  currency,
}: {
  subscription: Subscription;
  currency: CurrencyCode;
}) {
  const { t } = useTranslation();
  const badge = SUBSCRIPTION_STATUS_BADGE[subscription.status];

  return (
    <Card>
      <CardHeader title={t('subscription.currentPlan')} />

      <CardBody className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-lg font-bold text-fg">{subscription.plan.nameAr}</span>
          <StatusBadge tone={badge.tone} withDot>
            {badge.label}
          </StatusBadge>
        </div>

        <div className="flex items-baseline gap-1.5">
          <MoneyText
            value={subscription.plan.priceMonthly}
            currency={currency}
            size="lg"
            tone="plain"
          />
          <span className="text-sm text-fg-muted">/ شهريًا</span>
        </div>

        <dl className="space-y-2 border-t border-border pt-4 text-[13px]">
          <div className="flex justify-between">
            <dt className="text-fg-muted">{t('subscription.startDate')}</dt>
            <dd className="tabular-nums text-fg" dir="ltr">
              {formatDate(subscription.currentPeriodStart)}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-fg-muted">{t('subscription.endDate')}</dt>
            <dd className="tabular-nums text-fg" dir="ltr">
              {formatDate(subscription.currentPeriodEnd)}
            </dd>
          </div>
        </dl>
      </CardBody>
    </Card>
  );
}

// ── بطاقة «قادم» ────────────────────────────────────────────────────────────

function UpcomingCard({
  title,
  description,
  phase,
  icon: Icon,
}: {
  title: string;
  description: string;
  phase: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Card className="border-dashed">
      <CardHeader title={title} />
      <CardBody>
        <div className="flex flex-col items-center py-6 text-center">
          <Icon className="size-8 text-fg-subtle" aria-hidden />
          <p className="mt-3 text-[13px] text-fg-muted">{description}</p>
          <span className="mt-3 rounded-pill bg-accent-soft px-2.5 py-1 text-[11px] font-semibold text-accent">
            {phase}
          </span>
        </div>
      </CardBody>
    </Card>
  );
}

/** تنسيق تاريخ ISO → YYYY-MM-DD (مطابق للمرجع البصري). */
function formatDate(iso: string): string {
  return iso.slice(0, 10);
}

export { Package };
