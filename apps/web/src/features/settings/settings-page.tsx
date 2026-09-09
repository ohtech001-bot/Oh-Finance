import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  ChevronLeft,
  CircleDollarSign,
  Crown,
  MessageSquare,
  Settings as SettingsIcon,
  Store,
  TriangleAlert,
} from 'lucide-react';
import {
  financialSettingsSchema,
  generalSettingsSchema,
  messagingSettingsSchema,
  type FinancialSettings,
  type GeneralSettings,
  type MessagingSettings,
  type Subscription,
  type SettingsSection,
  type StoreSettings,
} from '@oh/contracts';
import { PERMISSIONS } from '@oh/config';
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  ErrorState,
  Field,
  Input,
  MoneyText,
  PageHeader,
  Switch,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  toast,
} from '@oh/ui';
import type { CurrencyCode } from '@oh/money';
import { ApiRequestError, api } from '@/lib/api';
import { currentLocale } from '@/lib/i18n';
import { useAuth } from '@/app/auth-context';
import { useSettings, useUpdateSettingsSection } from './api';

/**
 * إعدادات المحل — الأقسام السبعة. مطابقة لـ`ui/other screens/كل الاعدادات.jpeg`.
 *  عام · المالية · الفواتير · الطباعة · الرسائل · سجل النشاط · إدارة الاشتراك.
 *  «سجل النشاط» يعيد استخدام موجز النشاط، و«إدارة الاشتراك» يعرض الاشتراك القائم.
 */
export function SettingsPage() {
  const { t } = useTranslation();
  const { can } = useAuth();
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const canManage = can(PERMISSIONS.SETTINGS_MANAGE);
  const { data, isLoading, isError, error, refetch } = useSettings();
  const sections = [
    {
      value: 'general',
      label: t('settings.general'),
      description: t('settings.generalDescription'),
      icon: Store,
    },
    {
      value: 'financial',
      label: t('settings.financial'),
      description: t('settings.financialDescription'),
      icon: CircleDollarSign,
    },
    {
      value: 'messaging',
      label: t('settings.messaging'),
      description: t('settings.messagingDescription'),
      icon: MessageSquare,
    },
    {
      value: 'subscription',
      label: t('settings.subscription'),
      description: t('settings.subscriptionDescription'),
      icon: Crown,
    },
  ];
  const selectedSection = sections.find((section) => section.value === activeTab);

  return (
    <div className="space-y-6">
      {selectedSection ? (
        <SettingsSectionHeader
          label={selectedSection.label}
          description={selectedSection.description}
          icon={selectedSection.icon}
          onBack={() => setActiveTab(null)}
        />
      ) : (
        <PageHeader
          title={t('nav.settings')}
          icon={SettingsIcon}
          description={t('settings.description')}
        />
      )}

      {isError ? (
        <Card>
          <ErrorState
            message={error instanceof ApiRequestError ? error.message : t('settings.loadError')}
            onRetry={() => void refetch()}
          />
        </Card>
      ) : (
        <Tabs value={activeTab ?? ''} onValueChange={setActiveTab}>
          {!activeTab ? (
            <TabsList className="grid h-auto w-full grid-cols-2 gap-2 bg-transparent p-0">
              {sections.map((section) => (
                <SettingsTab key={section.value} {...section} />
              ))}
            </TabsList>
          ) : (
            <div key={activeTab} className="page-enter">
              {activeTab === 'subscription' ? (
                <TabsContent value="subscription">
                  <SubscriptionTab />
                </TabsContent>
              ) : isLoading || !data ? (
                <Card>
                  <CardBody>{t('common.loading')}</CardBody>
                </Card>
              ) : (
                <>
                  <TabsContent value="general">
                    <GeneralForm data={data} canManage={canManage} />
                  </TabsContent>
                  <TabsContent value="financial">
                    <FinancialForm data={data} canManage={canManage} />
                  </TabsContent>
                  <TabsContent value="messaging">
                    <MessagingForm data={data} canManage={canManage} />
                  </TabsContent>
                </>
              )}
            </div>
          )}
        </Tabs>
      )}
    </div>
  );
}

function SettingsSectionHeader({
  label,
  description,
  icon: Icon,
  onBack,
}: {
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  onBack: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="border-border-subtle flex items-center gap-3 border-b pb-4">
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={onBack}
        aria-label={t('settings.backToSettings')}
        title={t('settings.backToSettings')}
        className="shrink-0"
      >
        <ChevronLeft className="size-5 rtl:rotate-180" aria-hidden />
      </Button>
      <span className="bg-brand-soft text-brand rounded-icon flex size-11 shrink-0 items-center justify-center">
        <Icon className="size-5" aria-hidden />
      </span>
      <div className="min-w-0">
        <h1 className="text-fg text-xl font-bold sm:text-2xl">{label}</h1>
        <p className="text-fg-muted mt-1 text-sm">{description}</p>
      </div>
    </div>
  );
}

function SettingsTab({
  value,
  label,
  description,
  icon: Icon,
}: {
  value: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <TabsTrigger
      value={value}
      className="border-border bg-card shadow-card h-auto w-full justify-start gap-3 border p-4 text-start"
    >
      <span className="bg-brand-soft text-brand rounded-icon flex size-11 shrink-0 items-center justify-center">
        <Icon className="size-5" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="text-fg block text-sm font-bold">{label}</span>
        <span className="text-fg-muted mt-1 block text-xs font-normal">{description}</span>
      </span>
      <ChevronLeft className="text-fg-subtle ms-auto size-5" aria-hidden />
    </TabsTrigger>
  );
}

// ── مكوّنات مساعدة ──────────────────────────────────────────────────────────

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="mt-4">
      <CardHeader title={title} />
      <CardBody className="space-y-4">{children}</CardBody>
    </Card>
  );
}

function SaveBar({ disabled, loading }: { disabled: boolean; loading: boolean }) {
  const { t } = useTranslation();
  return (
    <div className="flex justify-start pt-2">
      <Button type="submit" variant="brand" disabled={disabled} loading={loading}>
        {t('common.saveChanges')}
      </Button>
    </div>
  );
}

const selectCls = 'w-full rounded-ctrl border border-border bg-card px-3 py-2 text-sm text-fg';
const areaCls = 'w-full rounded-ctrl border border-border bg-card px-3 py-2 text-sm text-fg';

function useSectionForm<T extends Record<string, unknown>>(
  section: SettingsSection,
  schema: Parameters<typeof zodResolver>[0],
  values: T,
) {
  const { t } = useTranslation();
  const mutation = useUpdateSettingsSection();
  const form = useForm<T>({ resolver: zodResolver(schema), values: values as never });
  const onSubmit = form.handleSubmit((data) =>
    mutation.mutate(
      { section, data },
      {
        onSuccess: () => toast.success(t('settings.saved')),
        onError: (e) =>
          toast.error(e instanceof ApiRequestError ? e.message : t('settings.saveError')),
      },
    ),
  );
  return { form, onSubmit, saving: mutation.isPending };
}

// ── عام ──────────────────────────────────────────────────────────────────────

function GeneralForm({ data, canManage }: { data: StoreSettings; canManage: boolean }) {
  const { t } = useTranslation();
  const { form, onSubmit, saving } = useSectionForm<GeneralSettings>(
    'general',
    generalSettingsSchema,
    data.general,
  );
  const {
    register,
    formState: { errors },
  } = form;
  return (
    <form onSubmit={onSubmit}>
      <SectionCard title={t('settings.generalTitle')}>
        <Field label={t('settings.storeName')} error={errors.name?.message} required>
          {(p) => <Input {...p} {...register('name')} disabled={!canManage} />}
        </Field>
        <Field label={t('settings.email')} error={errors.email?.message}>
          {(p) => <Input {...p} {...register('email')} dir="ltr" disabled={!canManage} />}
        </Field>
        <Field label={t('settings.address')} error={errors.address?.message}>
          {(p) => <Input {...p} {...register('address')} disabled={!canManage} />}
        </Field>
        <Field label={t('common.language')}>
          {(p) => (
            <select {...p} {...register('language')} className={selectCls} disabled={!canManage}>
              <option value="ar">العربية</option>
              <option value="he">עברית</option>
            </select>
          )}
        </Field>
        <Field label={t('settings.timezone')} error={errors.timezone?.message}>
          {(p) => (
            <Input
              {...p}
              {...register('timezone')}
              dir="ltr"
              disabled={!canManage}
              placeholder="Asia/Jerusalem"
            />
          )}
        </Field>
        {canManage ? <SaveBar disabled={saving} loading={saving} /> : null}
      </SectionCard>
    </form>
  );
}

// ── المالية ──────────────────────────────────────────────────────────────────

function FinancialForm({ data, canManage }: { data: StoreSettings; canManage: boolean }) {
  const { t } = useTranslation();
  const { form, onSubmit, saving } = useSectionForm<FinancialSettings>(
    'financial',
    financialSettingsSchema,
    data.financial,
  );
  const {
    register,
    formState: { errors },
    watch,
    setValue,
  } = form;
  const taxEnabled = watch('tax.enabled');
  return (
    <form onSubmit={onSubmit}>
      <SectionCard title={t('settings.financialTitle')}>
        <Field label={t('settings.currency')} error={errors.currency?.message}>
          {(p) => (
            <Input
              {...p}
              {...register('currency')}
              dir="ltr"
              disabled={!canManage}
              placeholder="ILS"
            />
          )}
        </Field>
        <Field label={t('settings.country')}>
          {(p) => <Input {...p} {...register('country')} disabled={!canManage} />}
        </Field>
        <Field label={t('settings.numberFormat')}>
          {(p) => (
            <select
              {...p}
              {...register('numberFormat')}
              className={selectCls}
              disabled={!canManage}
            >
              <option value="1,234.56">1,234.56</option>
              <option value="1.234,56">1.234,56</option>
              <option value="1234.56">1234.56</option>
            </select>
          )}
        </Field>
        <Field label={t('settings.dateFormat')}>
          {(p) => (
            <select {...p} {...register('dateFormat')} className={selectCls} disabled={!canManage}>
              <option value="YYYY-MM-DD">YYYY-MM-DD</option>
              <option value="DD/MM/YYYY">DD/MM/YYYY</option>
              <option value="MM/DD/YYYY">MM/DD/YYYY</option>
            </select>
          )}
        </Field>
        <ToggleRow
          label={t('settings.taxEnabled')}
          checked={!!taxEnabled}
          disabled={!canManage}
          onChange={(v) => setValue('tax.enabled', v, { shouldDirty: true })}
        />
        <Field label={t('settings.taxRate')} error={errors.tax?.rate?.message}>
          {(p) => (
            <Input
              {...p}
              type="number"
              step="0.01"
              {...register('tax.rate', { valueAsNumber: true })}
              dir="ltr"
              disabled={!canManage || !taxEnabled}
            />
          )}
        </Field>
        <Field label={t('settings.taxText')}>
          {(p) => (
            <textarea
              {...p}
              {...register('tax.text')}
              className={areaCls}
              rows={3}
              disabled={!canManage}
            />
          )}
        </Field>
        {canManage ? <SaveBar disabled={saving} loading={saving} /> : null}
      </SectionCard>
    </form>
  );
}

// ── الرسائل ──────────────────────────────────────────────────────────────────

function MessagingForm({ data, canManage }: { data: StoreSettings; canManage: boolean }) {
  const { t } = useTranslation();
  const { form, onSubmit, saving } = useSectionForm<MessagingSettings>(
    'messaging',
    messagingSettingsSchema,
    data.messaging,
  );
  const { register, watch, setValue } = form;
  return (
    <form onSubmit={onSubmit}>
      <SectionCard title={t('settings.messagingTitle')}>
        <ToggleRow
          label={t('settings.whatsappEnabled')}
          checked={!!watch('whatsappEnabled')}
          disabled={!canManage}
          onChange={(v) => setValue('whatsappEnabled', v, { shouldDirty: true })}
        />
        <Field label={t('settings.whatsappNumber')}>
          {(p) => (
            <Input
              {...p}
              {...register('whatsappNumber')}
              dir="ltr"
              disabled={!canManage}
              placeholder="97250..."
            />
          )}
        </Field>
        <Field label={t('settings.newOrderTemplate')}>
          {(p) => (
            <textarea
              {...p}
              {...register('newOrderTemplate')}
              className={areaCls}
              rows={3}
              disabled={!canManage}
            />
          )}
        </Field>
        <ToggleRow
          label={t('settings.alertsEnabled')}
          checked={!!watch('alertsEnabled')}
          disabled={!canManage}
          onChange={(v) => setValue('alertsEnabled', v, { shouldDirty: true })}
        />
        <Field label={t('settings.newOrders')}>
          {(p) => (
            <select
              {...p}
              {...register('newOrdersFrequency')}
              className={selectCls}
              disabled={!canManage}
            >
              <option value="instant">{t('settings.instant')}</option>
              <option value="hourly">{t('settings.hourly')}</option>
              <option value="daily">{t('settings.daily')}</option>
              <option value="off">{t('settings.off')}</option>
            </select>
          )}
        </Field>
        <Field label={t('settings.sequence')}>
          {(p) => (
            <select {...p} {...register('sequence')} className={selectCls} disabled={!canManage}>
              <option value="instant">{t('settings.instant')}</option>
              <option value="hourly">{t('settings.hourly')}</option>
              <option value="daily">{t('settings.daily')}</option>
              <option value="off">{t('settings.off')}</option>
            </select>
          )}
        </Field>
        {canManage ? <SaveBar disabled={saving} loading={saving} /> : null}
      </SectionCard>
    </form>
  );
}

// ── إدارة الاشتراك (عرض الاشتراك القائم) ───────────────────────────────────────

function SubscriptionTab() {
  const { t } = useTranslation();
  const subscription = useQuery({
    queryKey: ['subscription'],
    queryFn: () => api.get<Subscription>('/subscription'),
    staleTime: 5 * 60_000,
  });

  if (subscription.isLoading) {
    return (
      <SectionCard title={t('settings.subscription')}>
        <p className="text-fg-muted text-sm">{t('common.loading')}</p>
      </SectionCard>
    );
  }

  if (subscription.isError || !subscription.data) {
    return (
      <SectionCard title={t('settings.subscription')}>
        <ErrorState
          message={
            subscription.error instanceof ApiRequestError
              ? subscription.error.message
              : t('settings.subscriptionLoadError')
          }
          onRetry={() => void subscription.refetch()}
        />
      </SectionCard>
    );
  }

  const data = subscription.data;
  const locale = currentLocale();
  const planName = locale === 'he' ? data.plan.nameHe : data.plan.nameAr;
  const currency = data.plan.currency as CurrencyCode;
  const end = new Date(data.currentPeriodEnd);
  const daysLeft = Math.ceil((end.getTime() - Date.now()) / 86_400_000);
  const paymentApproaching = daysLeft <= 5 && data.remainingAmount !== '0.00';

  return (
    <SectionCard title={t('settings.subscription')}>
      {paymentApproaching ? (
        <div className="rounded-ctrl border-warning/40 bg-warning-soft text-warning flex items-start gap-3 border p-3 text-sm">
          <TriangleAlert className="mt-0.5 size-5 shrink-0" aria-hidden />
          <span>
            {daysLeft < 0
              ? t('settings.subscriptionOverdueNotice')
              : t('settings.subscriptionDueNotice', { count: daysLeft })}
          </span>
        </div>
      ) : null}
      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <SubscriptionInfo label={t('subscription.currentPlan')} value={planName} />
        <SubscriptionInfo
          label={t('subscription.startDate')}
          value={data.currentPeriodStart.slice(0, 10)}
          ltr
        />
        <SubscriptionInfo
          label={t('subscription.endDate')}
          value={data.currentPeriodEnd.slice(0, 10)}
          ltr
        />
        <div className="rounded-ctrl border-border-subtle bg-card-muted border p-3">
          <dt className="text-fg-muted text-xs">{t('subscription.monthlyPrice')}</dt>
          <dd className="mt-1">
            <MoneyText value={data.agreedMonthlyAmount} currency={currency} size="md" />
          </dd>
        </div>
        <div className="rounded-ctrl border-border-subtle bg-card-muted border p-3">
          <dt className="text-fg-muted text-xs">{t('subscription.remainingAmount')}</dt>
          <dd className="mt-1">
            <MoneyText
              value={data.remainingAmount}
              currency={currency}
              tone={data.remainingAmount === '0.00' ? 'credit' : 'debit'}
              size="md"
            />
          </dd>
        </div>
        <SubscriptionInfo
          label={t('subscription.paymentStatus')}
          value={t(`subscription.paymentStatuses.${data.paymentStatus}`)}
        />
      </dl>
    </SectionCard>
  );
}

function SubscriptionInfo({
  label,
  value,
  ltr = false,
}: {
  label: string;
  value: string;
  ltr?: boolean;
}) {
  return (
    <div className="rounded-ctrl border-border-subtle bg-card-muted border p-3">
      <dt className="text-fg-muted text-xs">{label}</dt>
      <dd className="text-fg mt-1 text-sm font-semibold" dir={ltr ? 'ltr' : undefined}>
        {value}
      </dd>
    </div>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="rounded-ctrl border-border flex items-center justify-between border px-3 py-2.5">
      <span className="text-fg text-[13px]">{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} disabled={disabled} />
    </div>
  );
}
