import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createCustomerSchema, type CreateCustomerRequest, type Customer } from '@oh/contracts';
import {
  Button,
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  Input,
  toast,
} from '@oh/ui';
import { ApiRequestError } from '@/lib/api';
import { currentLocale } from '@/lib/i18n';
import { useUnsavedChangesWarning } from '@/lib/use-unsaved-changes';
import { useCreateCustomer, useUpdateCustomer } from './api';

export interface CustomerFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** موجود = تعديل. غائب = إضافة. */
  customer?: Customer;
}

/**
 * نموذج إضافة/تعديل زبون.
 *
 * ⚠️ الرصيد الافتتاحي يظهر **عند الإضافة فقط**. عند التعديل يُخفى — تغييره
 *    بعد الإنشاء يعني تعديل الرصيد بلا قيد محاسبي، وهو ما يمنعه العقد نفسه
 *    (`.omit` في updateCustomerSchema).
 */
export function CustomerFormDialog({ open, onOpenChange, customer }: CustomerFormDialogProps) {
  const isEdit = Boolean(customer);
  const locale = currentLocale();
  const labels = {
    ar: {
      debtLimit: 'حد الدين',
      debtLimitHint: 'الحد الافتراضي 1500 شيكل ويمكن تعديله.',
      openingHint: 'الرقم الموجب رصيد للزبون. الرقم السالب (-x أو x-) دين على الزبون.',
    },
    he: {
      debtLimit: 'מסגרת',
      debtLimitHint: 'ברירת המחדל היא 1,500 ₪ וניתן לשנות אותה.',
      openingHint: 'מספר חיובי הוא יתרה לזכות הלקוח. מספר שלילי (-x או x-) הוא חוב.',
    },
    en: {
      debtLimit: 'Debt limit',
      debtLimitHint: 'The default is ILS 1,500 and can be changed.',
      openingHint: 'A positive number is customer credit. A negative number (-x or x-) is debt.',
    },
  }[locale];
  const create = useCreateCustomer();
  const update = useUpdateCustomer(customer?.id ?? '');

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<CreateCustomerRequest>({
    resolver: zodResolver(createCustomerSchema),
    defaultValues: {
      name: '',
      company: '',
      phone: '',
      email: '',
      city: '',
      taxNumber: '',
      address: '',
      notes: '',
      tags: [],
      creditLimit: '1500',
      paymentTermDays: 30,
      status: 'ACTIVE',
      openingBalance: '0',
    },
  });

  useEffect(() => {
    if (!open) return;
    if (customer) {
      reset({
        name: customer.name,
        company: customer.company ?? '',
        phone: customer.phone ?? '',
        email: customer.email ?? '',
        city: customer.city ?? '',
        taxNumber: customer.taxNumber ?? '',
        address: customer.address ?? '',
        notes: customer.notes ?? '',
        tags: customer.tags,
        creditLimit: customer.creditLimit,
        paymentTermDays: customer.paymentTermDays,
        status: customer.status,
        openingBalance: '0',
      });
    } else {
      reset();
    }
  }, [open, customer, reset]);

  // تحذير قبل مغادرة الصفحة بتغييرات غير محفوظة.
  useUnsavedChangesWarning(open && isDirty && !isSubmitting);

  const onSubmit = handleSubmit(async (values) => {
    try {
      if (isEdit && customer) {
        const { openingBalance: _drop, ...rest } = values;
        await update.mutateAsync(rest);
        toast.success('حُدّثت بيانات الزبون');
      } else {
        await create.mutateAsync(values);
        toast.success('أُضيف الزبون بنجاح');
      }
      onOpenChange(false);
    } catch (error) {
      if (error instanceof ApiRequestError) {
        if (error.fields) {
          for (const [field, messages] of Object.entries(error.fields)) {
            setError(field as keyof CreateCustomerRequest, { message: messages.join('، ') });
          }
          return;
        }
        toast.apiError(error.message, error.requestId);
        return;
      }
      toast.error('تعذّر الحفظ. حاول مجددًا.');
    }
  });

  const pending = isSubmitting || create.isPending || update.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'تعديل بيانات الزبون' : 'إضافة زبون جديد'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={onSubmit} noValidate>
          <DialogBody className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="اسم الزبون" error={errors.name?.message} required>
              {(p) => (
                <Input {...p} {...register('name')} placeholder="أحمد محمود" error={Boolean(errors.name)} autoFocus />
              )}
            </Field>

            <Field label="الشركة" error={errors.company?.message}>
              {(p) => <Input {...p} {...register('company')} placeholder="اختياري" />}
            </Field>

            <Field label="الهاتف" error={errors.phone?.message}>
              {(p) => <Input {...p} {...register('phone')} dir="ltr" placeholder="050-1234567" />}
            </Field>

            <Field label="البريد الإلكتروني" error={errors.email?.message}>
              {(p) => <Input {...p} {...register('email')} type="email" dir="ltr" placeholder="name@example.com" />}
            </Field>

            <Field label="المدينة" error={errors.city?.message}>
              {(p) => <Input {...p} {...register('city')} placeholder="الرياض" />}
            </Field>

            <Field label="الرقم الضريبي" error={errors.taxNumber?.message}>
              {(p) => <Input {...p} {...register('taxNumber')} dir="ltr" placeholder="اختياري" />}
            </Field>

            <Field label="العنوان" error={errors.address?.message} className="sm:col-span-2">
              {(p) => <Input {...p} {...register('address')} placeholder="الحي، الشارع" />}
            </Field>

            <Field
              label={labels.debtLimit}
              hint={labels.debtLimitHint}
              error={errors.creditLimit?.message}
            >
              {(p) => <Input {...p} {...register('creditLimit')} dir="ltr" inputMode="decimal" placeholder="1500.00" />}
            </Field>

            <Field label="مدة السداد (يوم)" error={errors.paymentTermDays?.message}>
              {(p) => (
                <Input
                  {...p}
                  {...register('paymentTermDays', { valueAsNumber: true })}
                  type="number"
                  dir="ltr"
                  min={0}
                  max={365}
                />
              )}
            </Field>

            {/* الرصيد الافتتاحي — عند الإضافة فقط */}
            {!isEdit ? (
              <Field
                label="الرصيد الافتتاحي"
                hint={labels.openingHint}
                error={errors.openingBalance?.message}
                className="sm:col-span-2"
              >
                {(p) => (
                  <Input
                    {...p}
                    {...register('openingBalance', {
                      setValueAs: (raw: unknown) => {
                        const value = String(raw ?? '').trim();
                        return /^\d+(?:\.\d+)?-$/.test(value) ? `-${value.slice(0, -1)}` : value;
                      },
                    })}
                    dir="ltr"
                    inputMode="decimal"
                    placeholder="0.00"
                  />
                )}
              </Field>
            ) : null}
          </DialogBody>

          <DialogFooter>
            <Button type="submit" variant="brand" loading={pending}>
              {isEdit ? 'حفظ التغييرات' : 'إضافة الزبون'}
            </Button>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={pending}>
                إلغاء
              </Button>
            </DialogClose>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
