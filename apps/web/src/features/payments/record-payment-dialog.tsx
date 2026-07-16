import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ALLOCATION_STRATEGY_LABELS,
  PAYMENT_METHOD_LABELS,
  type AllocationStrategy,
  type Customer,
  type PaginatedResult,
  type PaymentMethod,
} from '@oh/contracts';
import type { CurrencyCode } from '@oh/money';
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
  MoneyText,
  cn,
  toast,
} from '@oh/ui';
import { ApiRequestError, api } from '@/lib/api';
import { useAuth } from '@/app/auth-context';
import { useCreatePayment, usePreviewAllocation } from './api';

export interface RecordPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** إن مُرّر: الزبون مثبّت (من صفحة الزبون). */
  fixedCustomerId?: string;
}

/**
 * تسجيل دفعة جديدة — مطابق لتدفق `ui/other screens/الدفعات.jpeg`.
 *
 * ── ثلاث نقاط أمان في الواجهة ──────────────────────────────────────────────
 * 1. `Idempotency-Key` يُولَّد **مرة واحدة** عند فتح النموذج. أي إعادة إرسال
 *    (نقرة ثانية، إعادة محاولة) تحمل نفس المفتاح ⇒ دفعة واحدة.
 * 2. معاينة التوزيع تُظهر **أين ستذهب الدفعة** قبل الحفظ.
 * 3. لا Optimistic UI — الرصيد الجديد يظهر بعد رد الخادم فقط.
 */
export function RecordPaymentDialog({ open, onOpenChange, fixedCustomerId }: RecordPaymentDialogProps) {
  const { user } = useAuth();
  const currency = (user?.store?.currency ?? 'ILS') as CurrencyCode;

  const [customerId, setCustomerId] = useState(fixedCustomerId ?? '');
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('CASH');
  const [strategy, setStrategy] = useState<AllocationStrategy>('AUTO_OLDEST_FIRST');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');

  // ⚠️ مفتاح واحد لكل فتح للنموذج — لا يتغيّر عبر إعادة الإرسال.
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());

  const create = useCreatePayment();
  const preview = usePreviewAllocation();

  // قائمة زبائن للاختيار (عند عدم تثبيت الزبون).
  const customersQuery = useQuery({
    queryKey: ['customers', 'picker'],
    queryFn: () => api.get<PaginatedResult<Customer>>('/customers?pageSize=100&sortBy=name&sortOrder=asc'),
    enabled: open && !fixedCustomerId,
  });

  // إعادة الضبط عند كل فتح — بما فيه مفتاح جديد.
  useEffect(() => {
    if (open) {
      setCustomerId(fixedCustomerId ?? '');
      setAmount('');
      setMethod('CASH');
      setStrategy('AUTO_OLDEST_FIRST');
      setReference('');
      setNotes('');
      setIdempotencyKey(crypto.randomUUID());
      preview.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, fixedCustomerId]);

  const canPreview = customerId !== '' && /^\d+(\.\d{1,4})?$/.test(amount) && Number(amount) > 0;

  const runPreview = () => {
    if (!canPreview) return;
    preview.mutate(
      { customerId, amount, strategy },
      { onError: (e) => toast.error(e instanceof ApiRequestError ? e.message : 'تعذّرت المعاينة.') },
    );
  };

  const submit = () => {
    if (!canPreview) {
      toast.error('اختر الزبون وأدخل مبلغًا صحيحًا.');
      return;
    }
    create.mutate(
      {
        body: {
          customerId,
          amount,
          method,
          strategy,
          reference: reference || undefined,
          notes: notes || undefined,
        },
        idempotencyKey,
      },
      {
        onSuccess: (payment) => {
          toast.success(`سُجّلت الدفعة ${payment.number}`, `الرصيد الجديد: ${payment.balanceAfter}`);
          onOpenChange(false);
        },
        onError: (e) => {
          if (e instanceof ApiRequestError) toast.apiError(e.message, e.requestId);
          else toast.error('تعذّر تسجيل الدفعة.');
        },
      },
    );
  };

  const customers = customersQuery.data?.items ?? [];
  const previewData = preview.data;

  const inputClass = useMemo(
    () =>
      'h-11 w-full rounded-ctrl border border-border bg-card px-3 text-sm text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
    [],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>تسجيل دفعة جديدة</DialogTitle>
        </DialogHeader>

        <DialogBody className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {!fixedCustomerId ? (
              <Field label="الزبون" required>
                {(p) => (
                  <select
                    {...p}
                    value={customerId}
                    onChange={(e) => {
                      setCustomerId(e.target.value);
                      preview.reset();
                    }}
                    className={inputClass}
                  >
                    <option value="">اختر زبونًا…</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.code} — {c.name} ({c.balance})
                      </option>
                    ))}
                  </select>
                )}
              </Field>
            ) : null}

            <Field label="المبلغ" required>
              {(p) => (
                <Input
                  {...p}
                  value={amount}
                  onChange={(e) => {
                    setAmount(e.target.value);
                    preview.reset();
                  }}
                  onBlur={runPreview}
                  dir="ltr"
                  inputMode="decimal"
                  placeholder="0.00"
                />
              )}
            </Field>

            <Field label="طريقة الدفع" required>
              {(p) => (
                <select
                  {...p}
                  value={method}
                  onChange={(e) => setMethod(e.target.value as PaymentMethod)}
                  className={inputClass}
                >
                  {Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              )}
            </Field>

            <Field label="توزيع الدفعة" hint="على الطلبات غير المسدَّدة">
              {(p) => (
                <select
                  {...p}
                  value={strategy}
                  onChange={(e) => {
                    setStrategy(e.target.value as AllocationStrategy);
                    preview.reset();
                  }}
                  className={inputClass}
                >
                  {Object.entries(ALLOCATION_STRATEGY_LABELS)
                    .filter(([v]) => v !== 'MANUAL') // التوزيع اليدوي: شاشة منفصلة (مرحلة لاحقة)
                    .map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                </select>
              )}
            </Field>

            <Field label="مرجع (شيك/حوالة)">
              {(p) => <Input {...p} value={reference} onChange={(e) => setReference(e.target.value)} dir="ltr" />}
            </Field>

            <Field label="ملاحظات" className="sm:col-span-2">
              {(p) => <Input {...p} value={notes} onChange={(e) => setNotes(e.target.value)} />}
            </Field>
          </div>

          {/* معاينة التوزيع */}
          <div className="rounded-card border border-border bg-card-muted p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-[13px] font-semibold text-fg">معاينة التوزيع</h3>
              <Button variant="outline" size="sm" onClick={runPreview} loading={preview.isPending} disabled={!canPreview}>
                تحديث المعاينة
              </Button>
            </div>

            {previewData ? (
              <div className="mt-3 space-y-2">
                {previewData.allocations.length === 0 ? (
                  <p className="text-[13px] text-fg-muted">
                    لا طلبات غير مسدَّدة — ستُسجَّل كدفعة مقدّمة (رصيد دائن).
                  </p>
                ) : (
                  previewData.allocations.map((a) => (
                    <div
                      key={a.orderId}
                      className="flex items-center justify-between rounded-ctrl bg-card px-3 py-2 text-[13px]"
                    >
                      <span className="font-medium text-accent">{a.orderNumber}</span>
                      <span className="text-fg-muted">
                        المتبقي: <MoneyText value={a.remaining} currency={currency} tone="plain" withSymbol={false} />
                      </span>
                      <MoneyText value={a.willAllocate} currency={currency} tone="credit" />
                    </div>
                  ))
                )}

                <div className="flex items-center justify-between border-t border-border pt-2 text-[13px]">
                  <span className="text-fg-muted">الرصيد بعد الدفعة</span>
                  <MoneyText value={previewData.balanceAfter} currency={currency} tone="auto" size="md" />
                </div>
                {previewData.unallocatedAmount !== '0.00' ? (
                  <p className="text-xs text-warning">
                    غير موزَّع (دفعة مقدّمة):{' '}
                    <MoneyText value={previewData.unallocatedAmount} currency={currency} tone="plain" withSymbol={false} />
                  </p>
                ) : null}
              </div>
            ) : (
              <p className={cn('mt-2 text-xs text-fg-subtle')}>
                أدخل الزبون والمبلغ ثم حدّث المعاينة لترى أين ستذهب الدفعة.
              </p>
            )}
          </div>
        </DialogBody>

        <DialogFooter>
          <Button variant="brand" onClick={submit} loading={create.isPending}>
            تسجيل الدفعة
          </Button>
          <DialogClose asChild>
            <Button variant="outline" disabled={create.isPending}>
              إلغاء
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
