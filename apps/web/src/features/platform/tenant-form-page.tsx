import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, ImagePlus, Save, Store, User } from 'lucide-react';
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
  ConfirmDialog,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  ErrorState,
  Field,
  Input,
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
  const today = new Date().toISOString().slice(0, 10);
  const nextMonth = new Date();
  nextMonth.setMonth(nextMonth.getMonth() + 1);
  const nextMonthDate = nextMonth.toISOString().slice(0, 10);

  const isEdit = Boolean(id);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingValues, setPendingValues] = useState<CreateTenantRequest | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

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
    setValue,
    watch,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<CreateTenantRequest>({
    resolver: zodResolver(createTenantSchema),
    defaultValues: {
      name: '',
      locale: 'ar',
      currency: 'ILS',
      timezone: 'Asia/Jerusalem',
      websiteUrl: '',
      logoDataUrl: '',
      ownerName: '',
      ownerEmail: '',
      ownerPassword: '',
      planId: '',
      subscriptionStartDate: today,
      subscriptionEndDate: nextMonthDate,
      agreedMonthlyAmount: '0.00',
      paymentStatus: 'UNPAID',
      paidAmount: '0.00',
    },
  });

  // ملء النموذج عند التعديل.
  useEffect(() => {
    if (!isEdit || !tenantQuery.data) return;
    const tenant = tenantQuery.data;

    reset({
      name: tenant.name,
      locale: tenant.locale as 'ar',
      currency: tenant.currency as 'ILS',
      timezone: tenant.timezone,
      storePhone: tenant.stores[0]?.phone ?? '',
      storeEmail: tenant.stores[0]?.email ?? '',
      storeAddress: tenant.stores[0]?.address ?? '',
      storeCity: tenant.stores[0]?.city ?? '',
      websiteUrl: tenant.stores[0]?.websiteUrl ?? '',
      logoDataUrl: '',
      ownerName: tenant.ownerName ?? '',
      ownerEmail: tenant.ownerEmail ?? '',
      ownerPassword: 'placeholder-not-used',
      planId: '',
      subscriptionStartDate: today,
      subscriptionEndDate: nextMonthDate,
      agreedMonthlyAmount: '0.00',
      paymentStatus: 'UNPAID',
      paidAmount: '0.00',
    });
  }, [isEdit, tenantQuery.data, reset, today, nextMonthDate]);

  const selectedPlanId = watch('planId');
  useEffect(() => {
    if (isEdit || !plansQuery.data?.length) return;
    const activePlans = plansQuery.data.filter((plan) => plan.isActive);
    const basicPlan =
      activePlans.find((plan) => plan.code.toLowerCase() === 'basic') ?? activePlans[0];
    const selected = activePlans.find((plan) => plan.id === selectedPlanId) ?? basicPlan;
    if (!selected) return;
    if (!selectedPlanId) setValue('planId', selected.id, { shouldValidate: true });
    setValue('agreedMonthlyAmount', selected.priceMonthly, { shouldValidate: true });
  }, [isEdit, plansQuery.data, selectedPlanId, setValue]);

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
      setConfirmOpen(false);
      setSuccessMessage(
        `${t('platform.tenantCreated')}: ${tenant.name} — ${tenant.stores[0]?.code ?? ''}`,
      );
    },
  });

  const updateMutation = useMutation({
    mutationFn: (body: UpdateTenantRequest) =>
      api.patch<TenantDetail>(`/platform/tenants/${id}`, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['platform'] });
      setConfirmOpen(false);
      setSuccessMessage(t('platform.tenantUpdated'));
    },
  });

  const submitConfirmed = async () => {
    if (!pendingValues) return;
    try {
      if (isEdit) {
        await updateMutation.mutateAsync({
          name: pendingValues.name,
          locale: pendingValues.locale,
          currency: pendingValues.currency,
          timezone: pendingValues.timezone,
          storePhone: pendingValues.storePhone,
          storeEmail: pendingValues.storeEmail,
          storeAddress: pendingValues.storeAddress,
          storeCity: pendingValues.storeCity,
          websiteUrl: pendingValues.websiteUrl,
          logoDataUrl: pendingValues.logoDataUrl,
        });
      } else {
        await createMutation.mutateAsync(pendingValues);
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
  };

  const onSubmit = handleSubmit((values) => {
    setPendingValues(values);
    setConfirmOpen(true);
  });

  if (isEdit && tenantQuery.isLoading) {
    return (
      <Dialog open onOpenChange={(open) => !open && navigate('/platform/tenants')}>
        <DialogContent size="xl">
          <DialogHeader>
            <DialogTitle>{t('platform.editTenant')}</DialogTitle>
          </DialogHeader>
          <div className="p-6">
            <CardSkeleton />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (isEdit && tenantQuery.isError) {
    return (
      <Dialog open onOpenChange={(open) => !open && navigate('/platform/tenants')}>
        <DialogContent size="lg">
          <DialogHeader>
            <DialogTitle>{t('platform.editTenant')}</DialogTitle>
          </DialogHeader>
          <ErrorState
            message="تعذّر تحميل بيانات المحل."
            onRetry={() => void tenantQuery.refetch()}
          />
        </DialogContent>
      </Dialog>
    );
  }

  const plans = plansQuery.data?.filter((plan) => plan.isActive) ?? [];
  const pending = isSubmitting || createMutation.isPending || updateMutation.isPending;

  return (
    <>
      <Dialog open onOpenChange={(open) => !open && !pending && navigate('/platform/tenants')}>
        <DialogContent size="xl">
          <DialogHeader>
            <DialogTitle>{isEdit ? t('platform.editTenant') : t('platform.addTenant')}</DialogTitle>
            <DialogDescription>
              {isEdit
                ? t('platform.editTenantDialogDescription')
                : t('platform.addTenantDialogDescription')}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={onSubmit} className="space-y-5 p-6" noValidate>
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

                <Field label="المدينة" error={errors.storeCity?.message}>
                  {(props) => <Input {...props} {...register('storeCity')} placeholder="الرياض" />}
                </Field>

                <Field label="هاتف المحل" error={errors.storePhone?.message}>
                  {(props) => (
                    <Input
                      {...props}
                      {...register('storePhone')}
                      dir="ltr"
                      placeholder="050-1234567"
                    />
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

                <Field label="رابط موقع المحل" error={errors.websiteUrl?.message}>
                  {(props) => (
                    <Input
                      {...props}
                      {...register('websiteUrl')}
                      type="url"
                      dir="ltr"
                      placeholder="https://example.com"
                    />
                  )}
                </Field>

                <Field label="شعار المحل" error={errors.logoDataUrl?.message}>
                  {() => (
                    <div className="flex items-center gap-4">
                      {(watch('logoDataUrl') || tenantQuery.data?.stores[0]?.logoUrl) ? (
                        <img
                          src={watch('logoDataUrl') || tenantQuery.data?.stores[0]?.logoUrl || ''}
                          alt="شعار المحل"
                          className="size-16 rounded-ctrl border border-border object-contain"
                        />
                      ) : (
                        <div className="flex size-16 items-center justify-center rounded-ctrl border border-dashed border-border text-fg-muted">
                          <ImagePlus className="size-6" aria-hidden />
                        </div>
                      )}
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        className="block min-w-0 text-sm text-fg-muted file:me-3 file:rounded-ctrl file:border-0 file:bg-brand-soft file:px-3 file:py-2 file:text-brand"
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (!file) return;
                          if (file.size > 5 * 1024 * 1024) {
                            setError('logoDataUrl', { message: 'حجم الشعار يجب ألا يتجاوز 5 ميجابايت.' });
                            return;
                          }
                          const reader = new FileReader();
                          reader.onload = () =>
                            setValue('logoDataUrl', String(reader.result), {
                              shouldDirty: true,
                              shouldValidate: true,
                            });
                          reader.readAsDataURL(file);
                        }}
                      />
                    </div>
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
                      className="rounded-ctrl border-border bg-card text-fg focus-visible:ring-ring h-11 w-full border px-3 text-sm focus-visible:outline-none focus-visible:ring-2"
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
                      className="rounded-ctrl border-border bg-card text-fg focus-visible:ring-ring h-11 w-full border px-3 text-sm focus-visible:outline-none focus-visible:ring-2"
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
                      className="rounded-ctrl border-border bg-card text-fg focus-visible:ring-ring h-11 w-full border px-3 text-sm focus-visible:outline-none focus-visible:ring-2"
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
                    <Field
                      label={t('platform.ownerName')}
                      error={errors.ownerName?.message}
                      required
                    >
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
                          className="rounded-ctrl border-border bg-card text-fg focus-visible:ring-ring h-11 w-full border px-3 text-sm focus-visible:outline-none focus-visible:ring-2"
                        >
                          {plans.map((plan) => (
                            <option key={plan.id} value={plan.id}>
                              {plan.nameAr} — {plan.priceMonthly} {plan.currency} / شهريًا
                            </option>
                          ))}
                        </select>
                      )}
                    </Field>

                    <Field
                      label={t('subscription.startDate')}
                      error={errors.subscriptionStartDate?.message}
                      required
                    >
                      {(props) => (
                        <Input
                          {...props}
                          {...register('subscriptionStartDate')}
                          type="date"
                          dir="ltr"
                        />
                      )}
                    </Field>

                    <Field
                      label={t('subscription.endDate')}
                      error={errors.subscriptionEndDate?.message}
                      required
                    >
                      {(props) => (
                        <Input
                          {...props}
                          {...register('subscriptionEndDate')}
                          type="date"
                          dir="ltr"
                        />
                      )}
                    </Field>

                    <Field
                      label={t('subscription.monthlyPrice')}
                      error={errors.agreedMonthlyAmount?.message}
                      required
                    >
                      {(props) => (
                        <Input
                          {...props}
                          {...register('agreedMonthlyAmount')}
                          type="number"
                          min="0"
                          step="0.01"
                          dir="ltr"
                          readOnly
                          className="bg-bg-subtle"
                        />
                      )}
                    </Field>

                    <Field
                      label={t('subscription.paymentStatus')}
                      error={errors.paymentStatus?.message}
                      required
                    >
                      {(props) => (
                        <select
                          {...props}
                          {...register('paymentStatus')}
                          className="rounded-ctrl border-border bg-card text-fg focus-visible:ring-ring h-11 w-full border px-3 text-sm focus-visible:outline-none focus-visible:ring-2"
                        >
                          <option value="UNPAID">{t('subscription.unpaid')}</option>
                          <option value="PARTIAL">{t('subscription.partial')}</option>
                          <option value="PAID">{t('subscription.paid')}</option>
                        </select>
                      )}
                    </Field>

                    <Field
                      label={t('subscription.paidAmount')}
                      error={errors.paidAmount?.message}
                      required
                    >
                      {(props) => (
                        <Input
                          {...props}
                          {...register('paidAmount')}
                          type="number"
                          min="0"
                          step="0.01"
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

              <Button
                type="button"
                variant="outline"
                disabled={pending}
                onClick={() => navigate('/platform/tenants')}
              >
                {t('common.cancel')}
              </Button>

              {isDirty ? (
                <span className="text-warning text-xs">لديك تغييرات غير محفوظة.</span>
              ) : null}
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={isEdit ? t('platform.editTenantConfirmTitle') : t('platform.addTenantConfirmTitle')}
        description={
          isEdit
            ? t('platform.editTenantConfirmDescription', { name: pendingValues?.name })
            : t('platform.addTenantConfirmDescription', { name: pendingValues?.name })
        }
        confirmLabel={isEdit ? t('common.saveChanges') : t('platform.addTenant')}
        cancelLabel={t('common.cancel')}
        variant="brand"
        loading={pending}
        onConfirm={() => void submitConfirmed()}
      />

      <Dialog
        open={successMessage !== null}
        onOpenChange={(open) => {
          if (!open) {
            setSuccessMessage(null);
            navigate('/platform/tenants');
          }
        }}
      >
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="text-success size-5" aria-hidden />
              {t('common.success')}
            </DialogTitle>
            <DialogDescription>{successMessage}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="brand"
              onClick={() => {
                setSuccessMessage(null);
                navigate('/platform/tenants');
              }}
            >
              {t('common.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export { Store };
