import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Settings as SettingsIcon } from 'lucide-react';
import {
  financialSettingsSchema,
  generalSettingsSchema,
  invoiceSettingsSchema,
  messagingSettingsSchema,
  printingSettingsSchema,
  type FinancialSettings,
  type GeneralSettings,
  type InvoiceSettings,
  type MessagingSettings,
  type PrintingSettings,
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
  PageHeader,
  Switch,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  toast,
} from '@oh/ui';
import { ApiRequestError } from '@/lib/api';
import { useAuth } from '@/app/auth-context';
import { ActivityFeed } from '@/features/activity/activity-feed';
import { useStoreActivityFeed } from '@/features/activity/api';
import { useSettings, useUpdateSettingsSection } from './api';

/**
 * إعدادات المحل — الأقسام السبعة. مطابقة لـ`ui/other screens/كل الاعدادات.jpeg`.
 *  عام · المالية · الفواتير · الطباعة · الرسائل · سجل النشاط · إدارة الاشتراك.
 *  «سجل النشاط» يعيد استخدام موجز النشاط، و«إدارة الاشتراك» يعرض الاشتراك القائم.
 */
export function SettingsPage() {
  const { can } = useAuth();
  const canManage = can(PERMISSIONS.SETTINGS_MANAGE);
  const { data, isLoading, isError, error, refetch } = useSettings();

  return (
    <div className="space-y-6">
      <PageHeader title="الإعدادات" icon={SettingsIcon} description="سبعة أقسام لضبط المحل." />

      {isError ? (
        <Card>
          <ErrorState
            message={error instanceof ApiRequestError ? error.message : 'تعذّر تحميل الإعدادات.'}
            onRetry={() => void refetch()}
          />
        </Card>
      ) : (
        <Tabs defaultValue="general">
          <TabsList className="flex flex-wrap gap-1">
            <TabsTrigger value="general">عام</TabsTrigger>
            <TabsTrigger value="financial">المالية</TabsTrigger>
            <TabsTrigger value="invoices">الفواتير</TabsTrigger>
            <TabsTrigger value="printing">الطباعة</TabsTrigger>
            <TabsTrigger value="messaging">الرسائل</TabsTrigger>
            <TabsTrigger value="activity">سجل النشاط</TabsTrigger>
            <TabsTrigger value="subscription">إدارة الاشتراك</TabsTrigger>
          </TabsList>

          {isLoading || !data ? (
            <Card className="mt-4"><CardBody>جارٍ التحميل…</CardBody></Card>
          ) : (
            <>
              <TabsContent value="general"><GeneralForm data={data} canManage={canManage} /></TabsContent>
              <TabsContent value="financial"><FinancialForm data={data} canManage={canManage} /></TabsContent>
              <TabsContent value="invoices"><InvoicesForm data={data} canManage={canManage} /></TabsContent>
              <TabsContent value="printing"><PrintingForm data={data} canManage={canManage} /></TabsContent>
              <TabsContent value="messaging"><MessagingForm data={data} canManage={canManage} /></TabsContent>
              <TabsContent value="activity"><ActivityTab /></TabsContent>
              <TabsContent value="subscription"><SubscriptionTab /></TabsContent>
            </>
          )}
        </Tabs>
      )}
    </div>
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
  return (
    <div className="flex justify-start pt-2">
      <Button type="submit" variant="brand" disabled={disabled} loading={loading}>
        حفظ التغييرات
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
  const mutation = useUpdateSettingsSection();
  const form = useForm<T>({ resolver: zodResolver(schema), values: values as never });
  const onSubmit = form.handleSubmit((data) =>
    mutation.mutate(
      { section, data },
      {
        onSuccess: () => toast.success('حُفظت التغييرات'),
        onError: (e) => toast.error(e instanceof ApiRequestError ? e.message : 'تعذّر الحفظ'),
      },
    ),
  );
  return { form, onSubmit, saving: mutation.isPending };
}

// ── عام ──────────────────────────────────────────────────────────────────────

function GeneralForm({ data, canManage }: { data: StoreSettings; canManage: boolean }) {
  const { form, onSubmit, saving } = useSectionForm<GeneralSettings>('general', generalSettingsSchema, data.general);
  const { register, formState: { errors } } = form;
  return (
    <form onSubmit={onSubmit}>
      <SectionCard title="الإعدادات العامة — معلومات المحل">
        <Field label="اسم المحل" error={errors.name?.message} required>
          {(p) => <Input {...p} {...register('name')} disabled={!canManage} />}
        </Field>
        <Field label="البريد الإلكتروني" error={errors.email?.message}>
          {(p) => <Input {...p} {...register('email')} dir="ltr" disabled={!canManage} />}
        </Field>
        <Field label="العنوان" error={errors.address?.message}>
          {(p) => <Input {...p} {...register('address')} disabled={!canManage} />}
        </Field>
        <Field label="اللغة">
          {(p) => (
            <select {...p} {...register('language')} className={selectCls} disabled={!canManage}>
              <option value="ar">العربية</option>
              <option value="he">العبرية</option>
              <option value="en">الإنجليزية</option>
            </select>
          )}
        </Field>
        <Field label="المنطقة الزمنية" error={errors.timezone?.message}>
          {(p) => <Input {...p} {...register('timezone')} dir="ltr" disabled={!canManage} placeholder="Asia/Jerusalem" />}
        </Field>
        {canManage ? <SaveBar disabled={saving} loading={saving} /> : null}
      </SectionCard>
    </form>
  );
}

// ── المالية ──────────────────────────────────────────────────────────────────

function FinancialForm({ data, canManage }: { data: StoreSettings; canManage: boolean }) {
  const { form, onSubmit, saving } = useSectionForm<FinancialSettings>('financial', financialSettingsSchema, data.financial);
  const { register, formState: { errors }, watch, setValue } = form;
  const taxEnabled = watch('tax.enabled');
  return (
    <form onSubmit={onSubmit}>
      <SectionCard title="الإعدادات المالية — العملة والمنطقة">
        <Field label="العملة" error={errors.currency?.message}>
          {(p) => <Input {...p} {...register('currency')} dir="ltr" disabled={!canManage} placeholder="ILS" />}
        </Field>
        <Field label="الدولة">{(p) => <Input {...p} {...register('country')} disabled={!canManage} />}</Field>
        <Field label="فاصل الأرقام">
          {(p) => (
            <select {...p} {...register('numberFormat')} className={selectCls} disabled={!canManage}>
              <option value="1,234.56">1,234.56</option>
              <option value="1.234,56">1.234,56</option>
              <option value="1234.56">1234.56</option>
            </select>
          )}
        </Field>
        <Field label="تنسيق التاريخ">
          {(p) => (
            <select {...p} {...register('dateFormat')} className={selectCls} disabled={!canManage}>
              <option value="YYYY-MM-DD">YYYY-MM-DD</option>
              <option value="DD/MM/YYYY">DD/MM/YYYY</option>
              <option value="MM/DD/YYYY">MM/DD/YYYY</option>
            </select>
          )}
        </Field>
        <ToggleRow label="تفعيل الضريبة" checked={!!taxEnabled} disabled={!canManage} onChange={(v) => setValue('tax.enabled', v, { shouldDirty: true })} />
        <Field label="نسبة الضريبة (%)" error={errors.tax?.rate?.message}>
          {(p) => <Input {...p} type="number" step="0.01" {...register('tax.rate', { valueAsNumber: true })} dir="ltr" disabled={!canManage || !taxEnabled} />}
        </Field>
        <Field label="نص الفاتورة الضريبية">
          {(p) => <textarea {...p} {...register('tax.text')} className={areaCls} rows={3} disabled={!canManage} />}
        </Field>
        {canManage ? <SaveBar disabled={saving} loading={saving} /> : null}
      </SectionCard>
    </form>
  );
}

// ── الفواتير ─────────────────────────────────────────────────────────────────

function InvoicesForm({ data, canManage }: { data: StoreSettings; canManage: boolean }) {
  const { form, onSubmit, saving } = useSectionForm<InvoiceSettings>('invoices', invoiceSettingsSchema, data.invoices);
  const { register, formState: { errors }, watch, setValue } = form;
  return (
    <form onSubmit={onSubmit}>
      <SectionCard title="إعدادات الفواتير — معلومات الفاتورة">
        <Field label="رقم بداية الفاتورة" error={errors.startNumber?.message}>
          {(p) => <Input {...p} type="number" {...register('startNumber', { valueAsNumber: true })} dir="ltr" disabled={!canManage} />}
        </Field>
        <Field label="البادئة">{(p) => <Input {...p} {...register('prefix')} dir="ltr" disabled={!canManage} />}</Field>
        <Field label="اللاحقة">{(p) => <Input {...p} {...register('suffix')} dir="ltr" disabled={!canManage} />}</Field>
        <Field label="صيغة رقم الفاتورة">{(p) => <Input {...p} {...register('numberFormat')} dir="ltr" disabled={!canManage} placeholder="INV-{0001}" />}</Field>
        <ToggleRow label="عرض الأسعار شامل الضريبة" checked={!!watch('priceIncludesTax')} disabled={!canManage} onChange={(v) => setValue('priceIncludesTax', v, { shouldDirty: true })} />
        <ToggleRow label="إظهار عمود الضريبة في الفاتورة" checked={!!watch('showTaxColumn')} disabled={!canManage} onChange={(v) => setValue('showTaxColumn', v, { shouldDirty: true })} />
        <Field label="ملاحظات الفاتورة">
          {(p) => <textarea {...p} {...register('notes')} className={areaCls} rows={3} disabled={!canManage} />}
        </Field>
        {canManage ? <SaveBar disabled={saving} loading={saving} /> : null}
      </SectionCard>
    </form>
  );
}

// ── الطباعة ──────────────────────────────────────────────────────────────────

function PrintingForm({ data, canManage }: { data: StoreSettings; canManage: boolean }) {
  const { form, onSubmit, saving } = useSectionForm<PrintingSettings>('printing', printingSettingsSchema, data.printing);
  const { register, watch, setValue } = form;
  const check = (k: keyof PrintingSettings, label: string) => (
    <ToggleRow label={label} checked={!!watch(k)} disabled={!canManage} onChange={(v) => setValue(k, v as never, { shouldDirty: true })} />
  );
  return (
    <form onSubmit={onSubmit}>
      <SectionCard title="إعدادات الطباعة — الطابعة الافتراضية">
        <Field label="الطابعة">{(p) => <Input {...p} {...register('printer')} disabled={!canManage} />}</Field>
        <Field label="القياس">
          {(p) => (
            <select {...p} {...register('paperSize')} className={selectCls} disabled={!canManage}>
              <option value="80mm">80mm</option>
              <option value="58mm">58mm</option>
              <option value="A4">A4</option>
              <option value="A5">A5</option>
            </select>
          )}
        </Field>
        <Field label="الاتجاه">
          {(p) => (
            <select {...p} {...register('orientation')} className={selectCls} disabled={!canManage}>
              <option value="portrait">عمودي</option>
              <option value="landscape">أفقي</option>
            </select>
          )}
        </Field>
        <p className="pt-2 text-[13px] font-semibold text-fg">خيارات الطباعة</p>
        {check('printLogo', 'طباعة الشعار في الفاتورة')}
        {check('printInvoiceNumber', 'طباعة رقم الفاتورة')}
        {check('printDateTime', 'طباعة التاريخ والوقت')}
        {check('printBarcode', 'طباعة باركود المنتجات')}
        {canManage ? <SaveBar disabled={saving} loading={saving} /> : null}
      </SectionCard>
    </form>
  );
}

// ── الرسائل ──────────────────────────────────────────────────────────────────

function MessagingForm({ data, canManage }: { data: StoreSettings; canManage: boolean }) {
  const { form, onSubmit, saving } = useSectionForm<MessagingSettings>('messaging', messagingSettingsSchema, data.messaging);
  const { register, watch, setValue } = form;
  return (
    <form onSubmit={onSubmit}>
      <SectionCard title="إعدادات الرسائل — واتساب">
        <ToggleRow label="تفعيل واتساب" checked={!!watch('whatsappEnabled')} disabled={!canManage} onChange={(v) => setValue('whatsappEnabled', v, { shouldDirty: true })} />
        <Field label="رقم واتساب الأعمال">{(p) => <Input {...p} {...register('whatsappNumber')} dir="ltr" disabled={!canManage} placeholder="97250..." />}</Field>
        <Field label="رسالة الطلب الجديد (المتغيّرات: {order_id} {customer_name} {amount})">
          {(p) => <textarea {...p} {...register('newOrderTemplate')} className={areaCls} rows={3} disabled={!canManage} />}
        </Field>
        <ToggleRow label="تفعيل رسائل التنبيهات" checked={!!watch('alertsEnabled')} disabled={!canManage} onChange={(v) => setValue('alertsEnabled', v, { shouldDirty: true })} />
        <Field label="الطلبات الجديدة">
          {(p) => (
            <select {...p} {...register('newOrdersFrequency')} className={selectCls} disabled={!canManage}>
              <option value="instant">فوري</option>
              <option value="hourly">كل ساعة</option>
              <option value="daily">يومي</option>
              <option value="off">معطّل</option>
            </select>
          )}
        </Field>
        <Field label="التسلسل">
          {(p) => (
            <select {...p} {...register('sequence')} className={selectCls} disabled={!canManage}>
              <option value="instant">فوري</option>
              <option value="hourly">كل ساعة</option>
              <option value="daily">يومي</option>
              <option value="off">معطّل</option>
            </select>
          )}
        </Field>
        {canManage ? <SaveBar disabled={saving} loading={saving} /> : null}
      </SectionCard>
    </form>
  );
}

// ── سجل النشاط (إعادة استخدام موجز النشاط) ─────────────────────────────────────

function ActivityTab() {
  const { can } = useAuth();
  const canSee = can(PERMISSIONS.ACTIVITY_READ);
  const feed = useStoreActivityFeed({ pageSize: 15 }, canSee);
  return (
    <SectionCard title="سجل النشاط">
      {canSee ? (
        <ActivityFeed items={feed.data?.items ?? []} loading={feed.isLoading} emptyText="لا يوجد نشاط في المحل بعد." />
      ) : (
        <p className="py-8 text-center text-[13px] text-fg-subtle">لا تملك صلاحية عرض سجل النشاط.</p>
      )}
    </SectionCard>
  );
}

// ── إدارة الاشتراك (عرض الاشتراك القائم) ───────────────────────────────────────

function SubscriptionTab() {
  // تجنّبًا لتكرار منطق وحدة الاشتراك، نوجّه إلى شاشتها المخصّصة.
  return (
    <SectionCard title="إدارة الاشتراك">
      <p className="text-[13px] text-fg-muted">
        تُدار تفاصيل الباقة والفواتير والاستخدام من شاشة الاشتراك المخصّصة.
      </p>
      <a href="/subscription" className="text-[13px] font-medium text-accent hover:underline">
        فتح إدارة الاشتراك ←
      </a>
    </SectionCard>
  );
}

function ToggleRow({ label, checked, onChange, disabled }: { label: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-ctrl border border-border px-3 py-2.5">
      <span className="text-[13px] text-fg">{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} disabled={disabled} />
    </div>
  );
}
