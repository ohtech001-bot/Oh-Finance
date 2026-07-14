import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Building2, Save, Store, User } from 'lucide-react';
import {
  createTenantSchema,
  type CreateTenantRequest,
  type Plan,
  type TenantDetail,
  type UpdateTenantRequest,
} from '@oh/contracts';
import { CURRENCY_CODES, CURRENCIES, type CurrencyCode } from '@oh/money';
import { LOCALES, LOCALE_CODES, TIMEZONES } from '@oh/config';
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  CardSkeleton,
  ErrorState,
  Field,
  Input,
  PageHeader,
  toast,
} from '@oh/ui';
import { ApiRequestError, api } from '@/lib/api';

/**
 * إضافة / تعديل محل.
 *
 * ── إنشاء المحل عملية ذرّية واحدة ─────────────────────────────────────────
 * نموذج واحد يُنشئ: المستأجر + المحل + الفرع الرئيسي + الأدوار الأربعة +
 * صاحب المحل + الاشتراك. الخادم ينفّذها في **معاملة واحدة** — فشل أي خطوة
 * يُلغي الكل.
 *
 * لو قسّمناها إلى نماذج متتابعة («أنشئ المحل» ثم «أضف صاحبه» ثم «اختر باقة»)،
 * لأنتج انقطاعُ الاتصال في المنتصف محلًا بلا صاحب — لا أحد يستطيع الدخول إليه
 * ولا حذفه من الواجهة.
 *
 * ── التعديل لا يشمل صاحب المحل ─────────────────────────────────────────────
 * تغيير بريد صاحب المحل أو كلمة مروره عملية أمنية منفصلة (المرحلة 8)، لا
 * حقل في نموذج تعديل عام.
 */
export function TenantFormPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const isEdit = Boolean(id);

  const plansQuery = useQuery({
    queryKey: ['platform', 'plans'],
    queryFn: () => api.get<Plan[]>('/platform/plans'),
  });

  const tenantQuery = useQuery({
    queryKey: ['platform', 'tenants', id],
    queryFn: () => api.get<TenantDetail>(`/platform/tenants/${id}`),
    enabled: isEdit,
  });

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<CreateTenantRequest>({
    resolver: zodResolver(createTenantSchema),
    defaultValues: {
      name: '',
      slug: '',
      locale: 'ar',
      currency: 'ILS',
      timezone: 'Asia/Jerusalem',
      storeName: '',
      ownerName: '',
      ownerEmail: '',
      ownerPassword: '',
      planId: '',
      trialDays: 0,
    },
  });

  // ملء النموذج عند التعديل.
  useEffect(() => {
    if (!isEdit || !tenantQuery.data) return;
    const tenant = tenantQuery.data;

    reset({
      name: tenant.name,
      slug: tenant.slug,
      locale: tenant.locale as 'ar',
      currency: tenant.currency as 'ILS',
      timezone: tenant.timezone,
      storeName: tenant.stores[0]?.name ?? tenant.name,
      ownerName: tenant.ownerName ?? '',
      ownerEmail: tenant.ownerEmail ?? '',
      ownerPassword: 'placeholder-not-used',
      planId: '',
      trialDays: 0,
    });
  }, [isEdit, tenantQuery.data, reset]);

  /**
   * تحذير التغييرات غير المحفوظة.
   *
   * `beforeunload` يغطي إغلاق التبويب/تحديث الصفحة. مغادرة المسار داخل
   * التطبيق يغطيها React Router (مؤجّل — يتطلب data router API).
   */
  useEffect(() => {
    if (!isDirty) return;

    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  const createMutation = useMutation({
    mutationFn: (body: CreateTenantRequest) => api.post<TenantDetail>('/platform/tenants', body),
    onSuccess: (tenant) => {
      void queryClient.invalidateQueries({ queryKey: ['platform'] });
      toast.success(t('platform.tenantCreated'), `${tenant.name} — ${tenant.stores[0]?.code ?? ''}`);
      navigate('/platform/tenants');
    },
  });

  const updateMutation = useMutation({
    mutationFn: (body: UpdateTenantRequest) =>
      api.patch<TenantDetail>(`/platform/tenants/${id}`, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['platform'] });
      toast.success(t('platform.tenantUpdated'));
      navigate('/platform/tenants');
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      if (isEdit) {
        await updateMutation.mutateAsync({
          name: values.name,
          locale: values.locale,
          currency: values.currency,
          timezone: values.timezone,
        });
      } else {
        await createMutation.mutateAsync(values);
      }
    } catch (error) {
      if (error instanceof ApiRequestError) {
        // أخطاء الحقول من الخادم تُربط بالحقول مباشرة — لا تُعرض كتنبيه عام.
        if (error.fields) {
          for (const [field, messages] of Object.entries(error.fields)) {
            setError(field as keyof CreateTenantRequest, {
              message: messages.join('، '),
            });
          }
          return;
        }
        toast.apiError(error.message, error.requestId);
        return;
      }
      toast.error(t('errors.network'));
    }
  });

  if (isEdit && tenantQuery.isLoading) {
    return <CardSkeleton />;
  }

  if (isEdit && tenantQuery.isError) {
    return (
      <Card>
        <ErrorState
          message="تعذّر تحميل بيانات المحل."
          onRetry={() => void tenantQuery.refetch()}
        />
      </Card>
    );
  }

  const plans = plansQuery.data?.filter((plan) => plan.isActive) ?? [];
  const pending = isSubmitting || createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-5">
      <PageHeader
        title={isEdit ? t('platform.editTenant') : t('platform.addTenant')}
        icon={Building2}
        breadcrumbs={[
          { label: t('nav.platform'), href: '/platform' },
          { label: t('platform.tenantsList'), href: '/platform/tenants' },
          { label: isEdit ? t('platform.editTenant') : t('platform.addTenant') },
        ]}
        linkAs={Link}
      />

      <form onSubmit={onSubmit} className="space-y-5" noValidate>
        {/* ── بيانات المحل ────────────────────────────────────────────── */}
        <Card>
          <CardHeader title="بيانات المحل" />
          <CardBody className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <Field label={t('platform.tenantName')} error={errors.name?.message} required>
              {(props) => (
                <Input
                  {...props}
                  {...register('name')}
                  placeholder="محل النجاح"
                  error={Boolean(errors.name)}
                />
              )}
            </Field>

            <Field
              label={t('platform.tenantSlug')}
              hint="حروف إنجليزية صغيرة وأرقام وشرطات فقط. لا يمكن تغييره لاحقًا."
              error={errors.slug?.message}
              required
            >
              {(props) => (
                <Input
                  {...props}
                  {...register('slug')}
                  dir="ltr"
                  placeholder="al-najah"
                  disabled={isEdit}
                  error={Boolean(errors.slug)}
                />
              )}
            </Field>

            <Field label="اسم المحل التجاري" error={errors.storeName?.message} required>
              {(props) => (
                <Input
                  {...props}
                  {...register('storeName')}
                  placeholder="محل النجاح"
                  error={Boolean(errors.storeName)}
                />
              )}
            </Field>

            <Field label="المدينة" error={errors.storeCity?.message}>
              {(props) => <Input {...props} {...register('storeCity')} placeholder="الرياض" />}
            </Field>

            <Field label="هاتف المحل" error={errors.storePhone?.message}>
              {(props) => (
                <Input {...props} {...register('storePhone')} dir="ltr" placeholder="050-1234567" />
              )}
            </Field>

            <Field label="بريد المحل" error={errors.storeEmail?.message}>
              {(props) => (
                <Input
                  {...props}
                  {...register('storeEmail')}
                  type="email"
                  dir="ltr"
                  placeholder="info@alnajah.com"
                />
              )}
            </Field>

            <Field label="العنوان" error={errors.storeAddress?.message}>
              {(props) => (
                <Input
                  {...props}
                  {...register('storeAddress')}
                  placeholder="شارع النجاح، حي النور"
                />
              )}
            </Field>
          </CardBody>
        </Card>

        {/* ── التوطين والعملة ─────────────────────────────────────────── */}
        <Card>
          <CardHeader title="اللغة والعملة" />
          <CardBody className="grid grid-cols-1 gap-5 md:grid-cols-3">
            <Field label="اللغة الافتراضية" required>
              {(props) => (
                <select
                  {...props}
                  {...register('locale')}
                  className="h-11 w-full rounded-ctrl border border-border bg-card px-3 text-sm text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {LOCALE_CODES.map((code) => (
                    <option key={code} value={code}>
                      {LOCALES[code].nameNative}
                    </option>
                  ))}
                </select>
              )}
            </Field>

            <Field label="العملة" hint="تُستخدم في كل المبالغ والفواتير." required>
              {(props) => (
                <select
                  {...props}
                  {...register('currency')}
                  className="h-11 w-full rounded-ctrl border border-border bg-card px-3 text-sm text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {CURRENCY_CODES.map((code) => (
                    <option key={code} value={code}>
                      {CURRENCIES[code as CurrencyCode].nameAr} (
                      {CURRENCIES[code as CurrencyCode].symbol})
                    </option>
                  ))}
                </select>
              )}
            </Field>

            <Field label="المنطقة الزمنية" required>
              {(props) => (
                <select
                  {...props}
                  {...register('timezone')}
                  className="h-11 w-full rounded-ctrl border border-border bg-card px-3 text-sm text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {TIMEZONES.map((zone) => (
                    <option key={zone} value={zone}>
                      {zone}
                    </option>
                  ))}
                </select>
              )}
            </Field>
          </CardBody>
        </Card>

        {/* ── صاحب المحل + الباقة — عند الإنشاء فقط ───────────────────── */}
        {!isEdit ? (
          <>
            <Card>
              <CardHeader title="صاحب المحل" />
              <CardBody className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <Field label={t('platform.ownerName')} error={errors.ownerName?.message} required>
                  {(props) => (
                    <Input
                      {...props}
                      {...register('ownerName')}
                      placeholder="أحمد محمود"
                      startIcon={<User className="size-4" />}
                      error={Boolean(errors.ownerName)}
                    />
                  )}
                </Field>

                <Field
                  label={t('platform.ownerEmail')}
                  hint="سيستخدمه لتسجيل الدخول. يجب أن يكون فريدًا في المنصة."
                  error={errors.ownerEmail?.message}
                  required
                >
                  {(props) => (
                    <Input
                      {...props}
                      {...register('ownerEmail')}
                      type="email"
                      dir="ltr"
                      placeholder="owner@alnajah.com"
                      error={Boolean(errors.ownerEmail)}
                    />
                  )}
                </Field>

                <Field
                  label={t('platform.ownerPassword')}
                  hint="12 حرفًا على الأقل. أبلغه بها عبر قناة آمنة واطلب تغييرها."
                  error={errors.ownerPassword?.message}
                  required
                >
                  {(props) => (
                    <Input
                      {...props}
                      {...register('ownerPassword')}
                      type="password"
                      autoComplete="new-password"
                      error={Boolean(errors.ownerPassword)}
                    />
                  )}
                </Field>

                <Field label="هاتف صاحب المحل" error={errors.ownerPhone?.message}>
                  {(props) => (
                    <Input
                      {...props}
                      {...register('ownerPhone')}
                      dir="ltr"
                      placeholder="050-1234567"
                    />
                  )}
                </Field>
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="الاشتراك" />
              <CardBody className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <Field label={t('platform.plan')} error={errors.planId?.message} required>
                  {(props) => (
                    <select
                      {...props}
                      {...register('planId')}
                      className="h-11 w-full rounded-ctrl border border-border bg-card px-3 text-sm text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <option value="">اختر باقة…</option>
                      {plans.map((plan) => (
                        <option key={plan.id} value={plan.id}>
                          {plan.nameAr} — {plan.priceMonthly} {plan.currency} / شهريًا
                        </option>
                      ))}
                    </select>
                  )}
                </Field>

                <Field
                  label={t('platform.trialDays')}
                  hint="صفر = اشتراك نشط فورًا."
                  error={errors.trialDays?.message}
                >
                  {(props) => (
                    <Input
                      {...props}
                      {...register('trialDays', { valueAsNumber: true })}
                      type="number"
                      min={0}
                      max={365}
                      dir="ltr"
                    />
                  )}
                </Field>
              </CardBody>
            </Card>
          </>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" variant="brand" loading={pending}>
            <Save aria-hidden />
            {isEdit ? t('common.saveChanges') : t('platform.addTenant')}
          </Button>

          <Button type="button" variant="outline" asChild disabled={pending}>
            <Link to="/platform/tenants">{t('common.cancel')}</Link>
          </Button>

          {isDirty ? (
            <span className="text-xs text-warning">لديك تغييرات غير محفوظة.</span>
          ) : null}
        </div>
      </form>
    </div>
  );
}

export { Store };
