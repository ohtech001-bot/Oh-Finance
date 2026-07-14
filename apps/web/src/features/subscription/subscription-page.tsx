import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { CreditCard, Package, ShieldCheck } from 'lucide-react';
import type { Plan, Subscription } from '@oh/contracts';
import type { CurrencyCode } from '@oh/money';
import {
  Card,
  CardBody,
  CardHeader,
  CardSkeleton,
  ErrorState,
  MoneyText,
  PageHeader,
  StatusBadge,
  SUBSCRIPTION_STATUS_BADGE,
  cn,
} from '@oh/ui';
import { ApiRequestError, api } from '@/lib/api';
import { displayPercent } from '@/lib/percent';

/**
 * شاشة «إدارة الاشتراك» — مطابقة لتبويب الاشتراك في المرجع البصري.
 *
 * تعرض: الباقة الحالية · الحالة · تواريخ الفترة · المبلغ الشهري ·
 *       أشرطة تقدّم استخدام الباقة · الباقات المتاحة للترقية.
 *
 * ⚠️ زر «ترقية الباقة» **غير موجود** هنا الآن. تغيير الباقة يمر عبر المدير
 *    العام (المرحلة 9) لأنه يستلزم فوترة. عرض زر ترقية لا يعمل يخالف قاعدة
 *    «لا أزرار لا تعمل» — فنعرض الباقات وسعرها ونوجّه المستخدم لطلب الترقية.
 */
export function SubscriptionPage() {
  const { t } = useTranslation();

  const subscriptionQuery = useQuery({
    queryKey: ['subscription'],
    queryFn: () => api.get<Subscription>('/subscription'),
  });

  const plansQuery = useQuery({
    queryKey: ['plans'],
    queryFn: () => api.get<Plan[]>('/plans'),
  });

  if (subscriptionQuery.isLoading) {
    return (
      <div className="space-y-5">
        <CardSkeleton />
        <CardSkeleton />
      </div>
    );
  }

  if (subscriptionQuery.isError || !subscriptionQuery.data) {
    return (
      <Card>
        <ErrorState
          message={
            subscriptionQuery.error instanceof ApiRequestError
              ? subscriptionQuery.error.message
              : 'تعذّر تحميل بيانات الاشتراك.'
          }
          requestId={
            subscriptionQuery.error instanceof ApiRequestError
              ? subscriptionQuery.error.requestId
              : undefined
          }
          onRetry={() => void subscriptionQuery.refetch()}
        />
      </Card>
    );
  }

  const subscription = subscriptionQuery.data;
  const currency = subscription.plan.currency as CurrencyCode;
  const badge = SUBSCRIPTION_STATUS_BADGE[subscription.status];

  const usageRows = [
    { label: t('subscription.stores'), data: subscription.usage.stores, live: true },
    { label: t('subscription.users'), data: subscription.usage.users, live: true },
    { label: t('subscription.customers'), data: subscription.usage.customers, live: false },
    { label: t('subscription.orders'), data: subscription.usage.ordersThisMonth, live: false },
    { label: t('subscription.storage'), data: subscription.usage.storageMb, live: false },
  ];

  return (
    <div className="space-y-5">
      <PageHeader title={t('subscription.title')} icon={CreditCard} />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* ── معلومات الاشتراك ─────────────────────────────────────────── */}
        <Card className="lg:col-span-1">
          <CardHeader title="معلومات الاشتراك" />
          <CardBody>
            <dl className="space-y-4 text-sm">
              <Row label={t('subscription.currentPlan')}>
                <span className="font-semibold text-fg">{subscription.plan.nameAr}</span>
              </Row>

              <Row label={t('subscription.status')}>
                <StatusBadge tone={badge.tone} withDot>
                  {badge.label}
                </StatusBadge>
              </Row>

              <Row label={t('subscription.startDate')}>
                <span className="tabular-nums text-fg" dir="ltr">
                  {subscription.currentPeriodStart.slice(0, 10)}
                </span>
              </Row>

              <Row label={t('subscription.endDate')}>
                <span className="tabular-nums text-fg" dir="ltr">
                  {subscription.currentPeriodEnd.slice(0, 10)}
                </span>
              </Row>

              <Row label={t('subscription.monthlyPrice')}>
                <MoneyText
                  value={subscription.plan.priceMonthly}
                  currency={currency}
                  tone="plain"
                  size="md"
                />
              </Row>

              {subscription.trialEndsAt ? (
                <Row label="نهاية الفترة التجريبية">
                  <span className="tabular-nums text-warning" dir="ltr">
                    {subscription.trialEndsAt.slice(0, 10)}
                  </span>
                </Row>
              ) : null}
            </dl>
          </CardBody>
        </Card>

        {/* ── استخدام الباقة ───────────────────────────────────────────── */}
        <Card className="lg:col-span-2">
          <CardHeader title={t('subscription.usage')} />
          <CardBody className="space-y-5">
            {usageRows.map((row) => {
              const percent = displayPercent(row.data.used, row.data.limit);
              const nearLimit = percent >= 80;

              return (
                <div key={row.label}>
                  <div className="flex items-center justify-between text-[13px]">
                    <span className="flex items-center gap-2 font-medium text-fg">
                      {row.label}
                      {!row.live ? (
                        <span className="rounded-pill bg-neutral-soft px-1.5 py-0.5 text-[10px] font-medium text-neutral">
                          يُربط لاحقًا
                        </span>
                      ) : null}
                    </span>
                    <span
                      className={cn('tabular-nums', nearLimit ? 'text-warning' : 'text-fg-muted')}
                      dir="ltr"
                    >
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
      </div>

      {/* ── الباقات المتاحة ──────────────────────────────────────────── */}
      <Card>
        <CardHeader title="الباقات المتاحة" />
        <CardBody>
          {plansQuery.isLoading ? (
            <p className="text-sm text-fg-muted">{t('common.loading')}</p>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {(plansQuery.data ?? []).map((plan) => {
                const isCurrent = plan.id === subscription.plan.id;

                return (
                  <div
                    key={plan.id}
                    className={cn(
                      'rounded-card border p-5 transition-colors',
                      isCurrent
                        ? 'border-brand bg-brand-soft'
                        : 'border-border bg-card hover:border-accent',
                    )}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-card-title text-fg">{plan.nameAr}</h3>
                        <div className="mt-1.5 flex items-baseline gap-1">
                          <MoneyText
                            value={plan.priceMonthly}
                            currency={plan.currency as CurrencyCode}
                            size="lg"
                            tone="plain"
                          />
                          <span className="text-xs text-fg-muted">/ شهريًا</span>
                        </div>
                      </div>

                      {isCurrent ? (
                        <StatusBadge tone="credit">
                          <ShieldCheck className="size-3" aria-hidden />
                          الحالية
                        </StatusBadge>
                      ) : (
                        <Package className="size-5 text-fg-subtle" aria-hidden />
                      )}
                    </div>

                    <ul className="mt-4 space-y-1.5 text-[13px] text-fg-muted">
                      <li className="flex justify-between">
                        <span>المحلات</span>
                        <span className="tabular-nums text-fg">{plan.maxStores}</span>
                      </li>
                      <li className="flex justify-between">
                        <span>المستخدمون</span>
                        <span className="tabular-nums text-fg">{plan.maxUsers}</span>
                      </li>
                      <li className="flex justify-between">
                        <span>الزبائن</span>
                        <span className="tabular-nums text-fg">
                          {plan.maxCustomers.toLocaleString('en-US')}
                        </span>
                      </li>
                      <li className="flex justify-between">
                        <span>الطلبات / شهر</span>
                        <span className="tabular-nums text-fg">
                          {plan.maxOrdersPerMonth.toLocaleString('en-US')}
                        </span>
                      </li>
                    </ul>
                  </div>
                );
              })}
            </div>
          )}

          {/*
            صادق بدل زر لا يعمل: تغيير الباقة يستلزم فوترة (المرحلة 9).
            زر «ترقية» ينقر فلا يحدث شيء أسوأ من غياب الزر.
          */}
          <p className="mt-5 rounded-ctrl border border-border bg-card-muted px-4 py-3 text-[13px] text-fg-muted">
            لترقية باقتك، تواصل مع إدارة المنصة. الترقية الذاتية والفوترة
            الإلكترونية تُفعَّلان في المرحلة 9.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-fg-muted">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}
