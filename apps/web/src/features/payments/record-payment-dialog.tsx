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
import { add, greaterThan, subtract, toMoneyString, type CurrencyCode } from '@oh/money';
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
import { useCreatePayment, useOpenOrders, usePreviewAllocation } from './api';

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
  /** توزيع يدوي: orderId → المبلغ (نص). */
  const [manualAlloc, setManualAlloc] = useState<Record<string, string>>({});

  // ⚠️ مفتاح واحد لكل فتح للنموذج — لا يتغيّر عبر إعادة الإرسال.
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());

  const create = useCreatePayment();
  const preview = usePreviewAllocation();

  // طلبات الزبون غير المسدَّدة — للتوزيع اليدوي فقط.
  const openOrdersQuery = useOpenOrders(strategy === 'MANUAL' && customerId ? customerId : undefined);

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
      setManualAlloc({});
      setIdempotencyKey(crypto.randomUUID());
      preview.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, fixedCustomerId]);

  const canPreview = customerId !== '' && /^\d+(\.\d{1,4})?$/.test(amount) && Number(amount) > 0;

  const isManual = strategy === 'MANUAL';
  const openOrders = openOrdersQuery.data ?? [];

  // مجموع التوزيع اليدوي — بحساب مالي دقيق (@oh/money)، لا جمع أعداد عائمة.
  const amountStr = /^\d+(\.\d{1,4})?$/.test(amount) ? amount : '0';
  const manualTotalStr = Object.values(manualAlloc).reduce(
    (acc, v) => (/^\d+(\.\d{1,4})?$/.test(v) && Number(v) > 0 ? toMoneyString(add(acc, v), 2) : acc),
    '0.00',
  );
  const manualOverAllocated = isManual && greaterThan(manualTotalStr, amountStr);
  const manualEmpty = isManual && !greaterThan(manualTotalStr, '0');
  const unallocatedStr = greaterThan(amountStr, manualTotalStr)
    ? toMoneyString(subtract(amountStr, manualTotalStr), 2)
    : '0.00';

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
    if (isManual && manualEmpty) {
      toast.error('التوزيع اليدوي يتطلب تحديد مبلغ لطلب واحد على الأقل.');
      return;
    }
    if (manualOverAllocated) {
      toast.error('مجموع التوزيع يتجاوز مبلغ الدفعة.');
      return;
    }

    // التوزيع اليدوي: نرسل البنود ذات المبلغ الموجب فقط.
    const allocations = isManual
      ? openOrders
          .map((o) => ({ orderId: o.id, amount: manualAlloc[o.id] ?? '' }))
          .filter((a) => Number(a.amount) > 0)
      : undefined;

    create.mutate(
      {
        body: {
          customerId,
          amount,
          method,
          strategy,
          reference: reference || undefined,
          notes: notes || undefined,
          ...(allocations ? { allocations } : {}),
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
                    setManualAlloc({});
                    preview.reset();
                  }}
                  className={inputClass}
                >
                  {Object.entries(ALLOCATION_STRATEGY_LABELS).map(([value, label]) => (
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

          {/* التوزيع اليدوي: جدول مبالغ قابل للتعديل قبل التأكيد */}
          {isManual ? (
            <div className="rounded-card border border-border bg-card-muted p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-[13px] font-semibold text-fg">توزيع يدوي على الطلبات</h3>
                <span className="text-xs text-fg-muted">
                  الموزَّع:{' '}
                  <MoneyText value={manualTotalStr} currency={currency} tone="plain" withSymbol={false} />{' '}
                  / <MoneyText value={amountStr} currency={currency} tone="plain" withSymbol={false} />
                </span>
              </div>

              {openOrdersQuery.isLoading ? (
                <p className="mt-3 text-[13px] text-fg-muted">جارٍ تحميل الطلبات…</p>
              ) : openOrders.length === 0 ? (
                <p className="mt-3 text-[13px] text-fg-muted">
                  لا طلبات غير مسدَّدة لهذا الزبون — اختر توزيعًا تلقائيًا أو دفعة مقدّمة.
                </p>
              ) : (
                <div className="mt-3 space-y-2">
                  {openOrders.map((o) => (
                    <div
                      key={o.id}
                      className="flex flex-wrap items-center gap-2 rounded-ctrl bg-card px-3 py-2 text-[13px]"
                    >
                      <span className="font-medium text-accent">{o.number}</span>
                      {o.isOverdue ? <span className="text-xs font-semibold text-danger">متأخر</span> : null}
                      <span className="text-fg-muted">
                        المتبقي:{' '}
                        <MoneyText value={o.remaining} currency={currency} tone="plain" withSymbol={false} />
                      </span>
                      <div className="ms-auto flex items-center gap-2">
                        <Input
                          value={manualAlloc[o.id] ?? ''}
                          onChange={(e) => setManualAlloc((m) => ({ ...m, [o.id]: e.target.value }))}
                          dir="ltr"
                          inputMode="decimal"
                          placeholder="0.00"
                          className="h-9 w-28"
                          aria-label={`مبلغ توزيع الطلب ${o.number}`}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setManualAlloc((m) => ({ ...m, [o.id]: o.remaining }))}
                        >
                          الكل
                        </Button>
                      </div>
                    </div>
                  ))}

                  {manualOverAllocated ? (
                    <p className="text-xs font-semibold text-danger">
                      مجموع التوزيع يتجاوز مبلغ الدفعة.
                    </p>
                  ) : greaterThan(unallocatedStr, '0') ? (
                    <p className="flex items-center gap-1 text-xs text-warning">
                      المتبقي غير موزَّع سيصبح دفعة مقدّمة (رصيد دائن):{' '}
                      <MoneyText value={unallocatedStr} currency={currency} tone="plain" withSymbol={false} />
                    </p>
                  ) : null}
                </div>
              )}
            </div>
          ) : (
          /* معاينة التوزيع التلقائي */
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
          )}
        </DialogBody>

        <DialogFooter>
          <Button variant="brand" onClick={submit} loading={create.isPending} disabled={manualOverAllocated}>
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
