import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  Clock,
  LayoutDashboard,
  PauseCircle,
  TrendingUp,
  Users,
} from 'lucide-react';
import type { PlatformStats } from '@oh/contracts';
import type { CurrencyCode } from '@oh/money';
import { Button, ErrorState, PageHeader, StatCard, StatCardsSkeleton } from '@oh/ui';
import { ApiRequestError, api } from '@/lib/api';

/**
 * لوحة المدير العام.
 *
 * ⚠️ كل رقم هنا **حقيقي** — من قاعدة البيانات، لا من موك‌أب. جداول
 *    `tenants` و`users` و`subscriptions` و`plans` موجودة فعلًا في المرحلة 1،
 *    فهذه الشاشة تعمل بالكامل من اليوم الأول.
 *
 *  الإيراد الشهري المتكرر (MRR) يُحسب على الخادم بـDecimal من أسعار الباقات
 *  النشطة — لا بجمع أرقام عائمة.
 */
export function PlatformDashboardPage() {
  const { t } = useTranslation();

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['platform', 'stats'],
    queryFn: () => api.get<PlatformStats>('/platform/stats'),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('platform.title')}
        icon={LayoutDashboard}
        description={t('platform.subtitle')}
        actions={
          <Button variant="brand" asChild>
            <Link to="/platform/tenants/new">
              <Building2 aria-hidden />
              {t('platform.addTenant')}
            </Link>
          </Button>
        }
      />

      {isLoading ? (
        <StatCardsSkeleton count={4} />
      ) : isError ? (
        <div className="rounded-card border border-border bg-card">
          <ErrorState
            message={
              error instanceof ApiRequestError ? error.message : 'تعذّر تحميل إحصاءات المنصة.'
            }
            requestId={error instanceof ApiRequestError ? error.requestId : undefined}
            onRetry={() => void refetch()}
          />
        </div>
      ) : data ? (
        <>
          <section aria-label="إحصاءات المنصة">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard
                label={t('platform.totalTenants')}
                value={data.totalTenants}
                icon={Building2}
                tone="accent"
                sublabel={`${data.newTenantsThisMonth} ${t('platform.newThisMonth')}`}
              />
              <StatCard
                label={t('platform.activeTenants')}
                value={data.activeTenants}
                icon={CheckCircle2}
                tone="credit"
                sublabel={`${data.trialTenants} تجريبي`}
              />
              <StatCard
                label={t('platform.totalUsers')}
                value={data.totalUsers}
                icon={Users}
                tone="purple"
                sublabel="عبر جميع المحلات"
              />
              <StatCard
                label={t('platform.mrr')}
                money={data.mrr}
                currency={data.currency as CurrencyCode}
                moneyTone="credit"
                icon={TrendingUp}
                tone="credit"
                sublabel="من الاشتراكات النشطة"
              />
            </div>
          </section>

          <section aria-label="حالات المحلات">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <StatCard
                label={t('platform.activeTenants')}
                value={data.activeTenants}
                icon={CheckCircle2}
                tone="credit"
              />
              <StatCard
                label={t('platform.trialTenants')}
                value={data.trialTenants}
                icon={Clock}
                tone="info"
              />
              <StatCard
                label={t('platform.suspendedTenants')}
                value={data.suspendedTenants}
                icon={PauseCircle}
                tone="debit"
              />
            </div>
          </section>

          <div className="flex justify-center">
            <Button variant="outline" asChild>
              <Link to="/platform/tenants">
                {t('platform.tenantsList')}
                <ArrowLeft className="rtl:rotate-0 ltr:rotate-180" aria-hidden />
              </Link>
            </Button>
          </div>
        </>
      ) : null}
    </div>
  );
}
