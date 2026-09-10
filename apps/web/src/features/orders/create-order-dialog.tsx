import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, ChevronDown, ChevronUp, Plus, Search, Trash2 } from 'lucide-react';
import type { Customer, OrderDetail, OrderItemInput } from '@oh/contracts';
import {
  add,
  greaterThan,
  max,
  min,
  multiply,
  subtract,
  toMoneyString,
  zero,
  type CurrencyCode,
} from '@oh/money';
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
  toast,
} from '@oh/ui';
import { ApiRequestError, api } from '@/lib/api';
import { useUnsavedChangesWarning } from '@/lib/use-unsaved-changes';
import { useAuth } from '@/app/auth-context';
import { useCreatePayment, useCustomerCredit } from '@/features/payments/api';
import { useCreateOrder, useUpdateOrder } from './api';
import { displayOrderNumber } from './order-number';

interface DraftItem {
  name: string;
  quantity: string;
  unitPrice: string;
  discount: string;
  collapsed: boolean;
}

const emptyItem = (): DraftItem => ({
  name: '',
  quantity: '1',
  unitPrice: '',
  discount: '',
  collapsed: false,
});

export interface CreateOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fixedCustomerId?: string;
  order?: OrderDetail;
}

/**
 * إنشاء طلب — إدخال منتجات يدويًا مع مجموع حيّ باستخدام طبقة المال العشرية.
 * يعيد الخادم الحساب نفسه عند الحفظ، ويبقى المرجع النهائي للمبالغ المحفوظة.
 *
 * الحفظ: مسودة أو تأكيد مباشر (يولّد قيدًا مدينًا).
 */
export function CreateOrderDialog({
  open,
  onOpenChange,
  fixedCustomerId,
  order,
}: CreateOrderDialogProps) {
  const { user } = useAuth();
  const currency = (user?.store?.currency ?? 'ILS') as CurrencyCode;

  const [customerId, setCustomerId] = useState(fixedCustomerId ?? '');
  const [customerSearch, setCustomerSearch] = useState('');
  const [debouncedCustomerSearch, setDebouncedCustomerSearch] = useState('');
  const [customerPickerOpen, setCustomerPickerOpen] = useState(false);
  const [items, setItems] = useState<DraftItem[]>([emptyItem()]);
  const [discount, setDiscount] = useState('0');
  const [notes, setNotes] = useState('');
  const [paidAmount, setPaidAmount] = useState('0');
  const [paymentKey, setPaymentKey] = useState(() => crypto.randomUUID());

  const create = useCreateOrder();
  const update = useUpdateOrder(order?.id ?? '');
  const createPayment = useCreatePayment();
  const customerCredit = useCustomerCredit(customerId || undefined, open && !order);

  const customersQuery = useQuery({
    queryKey: ['customers', 'picker', debouncedCustomerSearch],
    queryFn: ({ signal }) =>
      api.get<Pick<Customer, 'id' | 'name' | 'phone'>[]>(
        `/customers/lookup?search=${encodeURIComponent(debouncedCustomerSearch)}`,
        { signal },
      ),
    enabled:
      open &&
      !fixedCustomerId &&
      !order &&
      customerSearch.trim().length > 0 &&
      debouncedCustomerSearch.length > 0,
    retry: false,
  });

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedCustomerSearch(customerSearch.trim()), 150);
    return () => window.clearTimeout(timer);
  }, [customerSearch]);

  useEffect(() => {
    if (open) {
      setCustomerId(order?.customerId ?? fixedCustomerId ?? '');
      setCustomerSearch('');
      setDebouncedCustomerSearch('');
      setCustomerPickerOpen(false);
      setItems(
        order
          ? order.items.map((item) => ({
              name: item.name,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              discount: /^0(?:\.0+)?$/.test(item.discount) ? '' : item.discount,
              collapsed: false,
            }))
          : [emptyItem()],
      );
      setDiscount(order?.discountAmount ?? '0');
      setNotes(order?.notes ?? '');
      setPaidAmount('0');
      setPaymentKey(crypto.randomUUID());
    }
  }, [open, fixedCustomerId, order]);

  // متسخ = المستخدم أدخل شيئًا ذا قيمة (زبون، بند مُسمّى، خصم، أو ملاحظة).
  const isDirty =
    (!fixedCustomerId && customerId !== '') ||
    items.some((it) => it.name.trim() !== '') ||
    discount !== '0' ||
    paidAmount !== '0' ||
    notes.trim() !== '';
  useUnsavedChangesWarning(
    open && isDirty && !create.isPending && !update.isPending && !createPayment.isPending,
  );

  const validItems: OrderItemInput[] = useMemo(
    () =>
      items
        .filter(
          (it) =>
            it.name.trim() &&
            /^\d+(\.\d{1,4})?$/.test(it.unitPrice) &&
            /^\d+(\.\d{1,4})?$/.test(it.quantity),
        )
        .map((it) => ({
          sourceType: 'MANUAL' as const,
          name: it.name.trim(),
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          discount: it.discount || '0',
          taxRate: '0',
        })),
    [items],
  );

  const liveLineTotals = useMemo(() => items.map(calculateLineTotal), [items]);
  const liveTotal = useMemo(
    () => calculateOrderTotal(liveLineTotals, discount),
    [discount, liveLineTotals],
  );
  const automaticCreditAmount = liveTotal
    ? toMoneyString(min(customerCredit.data?.availableAmount ?? '0', liveTotal), 2)
    : '0.00';
  const remainingAfterCredit = liveTotal
    ? toMoneyString(subtract(liveTotal, automaticCreditAmount), 2)
    : '0.00';

  const updateItem = (index: number, patch: Partial<DraftItem>) =>
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)));

  const submit = (confirm: boolean) => {
    if (!customerId) {
      toast.error('اختر الزبون.');
      return;
    }
    if (validItems.length === 0) {
      toast.error('أضف منتجًا واحدًا صحيحًا على الأقل.');
      return;
    }
    if (order) {
      update.mutate(
        {
          version: order.version,
          customerId,
          discountAmount: discount || '0',
          notes: notes || undefined,
          items: validItems,
        },
        {
          onSuccess: (updated) => {
            toast.success(`حُفظت تعديلات الطلب ${displayOrderNumber(updated.number)}`);
            onOpenChange(false);
          },
          onError: (e) => {
            if (e instanceof ApiRequestError) toast.apiError(e.message, e.requestId);
            else toast.error('تعذّر تعديل الطلب.');
          },
        },
      );
      return;
    }

    if (!/^\d+(\.\d{1,4})?$/.test(paidAmount)) {
      toast.error('أدخل مبلغًا مدفوعًا صحيحًا، أو اكتب 0 عند عدم الدفع.');
      return;
    }
    const paymentAmount = paidAmount;
    if (!confirm && greaterThan(paymentAmount, '0')) {
      toast.error('سجّل الطلب كمؤكد حتى يمكن حفظ الدفعة معه.');
      return;
    }
    if (greaterThan(paymentAmount, '0') && !liveTotal) {
      toast.error('انتظر ظهور إجمالي الطلب قبل تسجيل الدفعة.');
      return;
    }
    if (liveTotal && greaterThan(paymentAmount, liveTotal)) {
      toast.error('المبلغ المدفوع لا يمكن أن يتجاوز إجمالي الطلب.');
      return;
    }
    create.mutate(
      {
        customerId,
        status: confirm ? 'CONFIRMED' : 'DRAFT',
        discountAmount: discount || '0',
        notes: notes || undefined,
        items: validItems,
      },
      {
        onSuccess: (createdOrder) => {
          if (confirm && greaterThan(paymentAmount, '0')) {
            const allocationAmount = toMoneyString(
              min(paymentAmount, createdOrder.remainingAmount),
              2,
            );
            createPayment.mutate(
              {
                body: {
                  customerId,
                  amount: paymentAmount,
                  method: 'CASH',
                  strategy: greaterThan(allocationAmount, '0') ? 'MANUAL' : 'NONE',
                  allocations: greaterThan(allocationAmount, '0')
                    ? [{ orderId: createdOrder.id, amount: allocationAmount }]
                    : undefined,
                },
                idempotencyKey: paymentKey,
              },
              {
                onSuccess: () => {
                  toast.success(
                    `حُفظ الطلب ${displayOrderNumber(createdOrder.number)} وسُجّلت الدفعة النقدية`,
                  );
                  onOpenChange(false);
                },
                onError: (e) => {
                  toast.error(
                    e instanceof ApiRequestError
                      ? `حُفظ الطلب، لكن تعذّر تسجيل الدفعة: ${e.message}`
                      : 'حُفظ الطلب، لكن تعذّر تسجيل الدفعة.',
                  );
                  onOpenChange(false);
                },
              },
            );
          } else {
            toast.success(
              confirm
                ? `أُكِّد الطلب ${displayOrderNumber(createdOrder.number)}`
                : `حُفظ الطلب ${displayOrderNumber(createdOrder.number)} كمسودة`,
              confirm ? `الإجمالي: ${createdOrder.total}` : undefined,
            );
            onOpenChange(false);
          }
        },
        onError: (e) => {
          if (e instanceof ApiRequestError) toast.apiError(e.message, e.requestId);
          else toast.error('تعذّر حفظ الطلب.');
        },
      },
    );
  };

  const customers = customersQuery.data ?? [];
  const cellClass =
    'h-10 rounded-ctrl border border-border bg-card px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="xl">
        <DialogHeader>
          <DialogTitle>
            {order ? `تعديل الطلب ${displayOrderNumber(order.number)}` : 'إضافة طلب جديد'}
          </DialogTitle>
        </DialogHeader>

        <DialogBody className="space-y-5">
          {!fixedCustomerId && !order ? (
            <Field label="الزبون" required>
              {(p) => (
                <div className="relative">
                  <Input
                    {...p}
                    value={customerSearch}
                    onChange={(event) => {
                      setCustomerSearch(event.target.value);
                      setCustomerId('');
                      setCustomerPickerOpen(true);
                    }}
                    onFocus={() => setCustomerPickerOpen(true)}
                    onBlur={() => window.setTimeout(() => setCustomerPickerOpen(false), 150)}
                    placeholder="اكتب اسم الزبون…"
                    startIcon={<Search className="size-4" />}
                    autoComplete="off"
                  />
                  {customerPickerOpen && customerSearch.trim().length > 0 ? (
                    <div className="border-border bg-card shadow-pop rounded-card absolute inset-x-0 top-[calc(100%+6px)] z-50 max-h-64 overflow-y-auto border p-1.5">
                      {customerSearch.trim() !== debouncedCustomerSearch ||
                      customersQuery.isLoading ? (
                        <p className="text-fg-muted px-3 py-4 text-center text-sm">جارٍ البحث…</p>
                      ) : customersQuery.isError ? (
                        <div className="text-danger px-3 py-3 text-sm" role="alert">
                          تعذر تحميل الزبائن. تحقق من الاتصال وحاول مجددًا.
                          <button
                            type="button"
                            className="mt-2 block underline"
                            onClick={() => void customersQuery.refetch()}
                          >
                            إعادة المحاولة
                          </button>
                        </div>
                      ) : customers.length === 0 ? (
                        <p className="text-fg-muted px-3 py-4 text-center text-sm">
                          لا يوجد زبون مطابق.
                        </p>
                      ) : (
                        customers.map((customer) => (
                          <button
                            key={customer.id}
                            type="button"
                            className="hover:bg-card-muted rounded-ctrl flex w-full items-center gap-3 px-3 py-2.5 text-start transition-colors"
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => {
                              setCustomerId(customer.id);
                              setCustomerSearch(customer.name);
                              setCustomerPickerOpen(false);
                            }}
                          >
                            <span className="min-w-0 flex-1">
                              <span className="text-fg block truncate text-sm font-semibold">
                                {customer.name}
                              </span>
                              {customer.phone ? (
                                <span className="text-fg-muted mt-0.5 block text-xs" dir="ltr">
                                  {customer.phone}
                                </span>
                              ) : null}
                            </span>
                            {customerId === customer.id ? (
                              <Check className="text-brand size-4 shrink-0" aria-hidden />
                            ) : null}
                          </button>
                        ))
                      )}
                    </div>
                  ) : null}
                </div>
              )}
            </Field>
          ) : null}

          {/* المنتجات */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-fg text-[13px] font-semibold">المنتجات</h3>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setItems((previous) => [
                    ...previous.map((item) => ({ ...item, collapsed: true })),
                    emptyItem(),
                  ])
                }
              >
                <Plus aria-hidden />
                إضافة منتج
              </Button>
            </div>

            <div className="space-y-2">
              {/* رؤوس الأعمدة */}
              <div className="text-fg-muted hidden grid-cols-[1fr_70px_90px_80px_120px] gap-2 px-1 text-[11px] font-medium sm:grid">
                <span>اسم المنتج</span>
                <span className="text-center">الكمية</span>
                <span className="text-center">السعر للوحدة</span>
                <span className="text-center">خصم المنتج</span>
                <span className="text-end">المجموع</span>
              </div>

              {items.map((item, i) => {
                const lineTotal = liveLineTotals[i];
                if (item.collapsed) {
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() =>
                        setItems((previous) =>
                          previous.map((current, index) => ({
                            ...current,
                            collapsed: index !== i,
                          })),
                        )
                      }
                      className="border-border bg-card hover:bg-card-muted rounded-ctrl flex h-11 w-full items-center gap-2 border px-3 text-start transition-colors"
                      aria-expanded="false"
                    >
                      <ChevronDown className="text-fg-muted size-4 shrink-0" aria-hidden />
                      <span className="text-fg min-w-0 flex-1 truncate text-sm font-semibold">
                        {item.name.trim() || `منتج ${i + 1}`}
                      </span>
                      {lineTotal ? (
                        <MoneyText value={lineTotal} currency={currency} tone="plain" size="sm" />
                      ) : null}
                    </button>
                  );
                }
                return (
                  <div
                    key={i}
                    className="rounded-ctrl border-accent/40 bg-card grid grid-cols-2 gap-2 border-2 p-3 shadow-sm sm:grid-cols-[1fr_70px_90px_80px_120px]"
                  >
                    <button
                      type="button"
                      onClick={() => updateItem(i, { collapsed: true })}
                      className="text-fg-muted hover:text-fg col-span-2 flex items-center gap-1.5 py-0.5 text-xs sm:col-span-5"
                      aria-expanded="true"
                    >
                      <ChevronUp className="size-4" aria-hidden />
                      <span>{item.name.trim() || `تفاصيل المنتج ${i + 1}`}</span>
                      <span className="ms-auto">إخفاء التفاصيل</span>
                    </button>
                    <label className="col-span-2 sm:col-span-1">
                      <span className="text-fg-muted mb-1 block text-xs sm:hidden">اسم المنتج</span>
                      <input
                        value={item.name}
                        onChange={(e) => updateItem(i, { name: e.target.value })}
                        placeholder="شوال رمل"
                        className={`${cellClass} w-full`}
                      />
                    </label>
                    <label>
                      <span className="text-fg-muted mb-1 block text-xs sm:hidden">الكمية</span>
                      <input
                        value={item.quantity}
                        onChange={(e) => updateItem(i, { quantity: e.target.value })}
                        dir="ltr"
                        inputMode="decimal"
                        placeholder="1"
                        className={`${cellClass} w-full text-center`}
                      />
                    </label>
                    <label>
                      <span className="text-fg-muted mb-1 block text-xs sm:hidden">
                        السعر للوحدة
                      </span>
                      <input
                        value={item.unitPrice}
                        onChange={(e) => updateItem(i, { unitPrice: e.target.value })}
                        dir="ltr"
                        inputMode="decimal"
                        placeholder="0.00"
                        className={`${cellClass} w-full text-center`}
                      />
                    </label>
                    <label>
                      <span className="text-fg-muted mb-1 block text-xs sm:hidden">خصم المنتج</span>
                      <input
                        value={item.discount}
                        onChange={(e) => updateItem(i, { discount: e.target.value })}
                        onFocus={() => {
                          if (/^0(?:\.0+)?$/.test(item.discount)) {
                            updateItem(i, { discount: '' });
                          }
                        }}
                        dir="ltr"
                        inputMode="decimal"
                        placeholder="0.00"
                        className={`${cellClass} w-full text-center`}
                      />
                    </label>
                    <div className="flex items-end justify-between gap-2 px-1">
                      <div className="flex min-w-0 flex-1 flex-col justify-end">
                        <span className="text-fg-muted mb-1 text-xs sm:hidden">المجموع</span>
                        {lineTotal ? (
                          <MoneyText
                            value={lineTotal}
                            currency={currency}
                            tone="plain"
                            withSymbol={false}
                            size="sm"
                          />
                        ) : (
                          <span className="text-fg-subtle text-xs">—</span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setItems((p) => (p.length > 1 ? p.filter((_, idx) => idx !== i) : p));
                        }}
                        className="rounded-ctrl text-fg-muted hover:bg-danger-soft hover:text-danger flex size-9 shrink-0 items-center justify-center"
                        aria-label="حذف المنتج"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div
            className={
              order
                ? 'border-border grid grid-cols-1 gap-4 border-t pt-5'
                : 'border-border grid grid-cols-2 gap-3 border-t pt-5 sm:gap-4'
            }
          >
            <Field label="خصم على الطلب" hint="أدخل قيمة الخصم على كامل الطلب">
              {(p) => (
                <Input
                  {...p}
                  value={discount}
                  onChange={(e) => setDiscount(e.target.value)}
                  dir="ltr"
                  inputMode="decimal"
                  placeholder="0.00"
                />
              )}
            </Field>
            {!order ? (
              <Field label="المبلغ المدفوع الآن" hint="المبلغ النقدي الذي دفعه الزبون لهذا الطلب">
                {(p) => (
                  <Input
                    {...p}
                    value={paidAmount}
                    onChange={(event) => setPaidAmount(event.target.value)}
                    dir="ltr"
                    inputMode="decimal"
                    placeholder="0.00"
                  />
                )}
              </Field>
            ) : null}
          </div>

          {!order && customerId && greaterThan(automaticCreditAmount, '0') ? (
            <div className="rounded-ctrl border-success/30 bg-success-soft border p-4">
              <p className="text-fg text-sm font-semibold">سيُستخدم رصيد الزبون تلقائيًا</p>
              <div className="mt-2 grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-fg-muted block">المسحوب من الرصيد</span>
                  <MoneyText value={automaticCreditAmount} currency={currency} tone="credit" />
                </div>
                <div>
                  <span className="text-fg-muted block">المتبقي بعد الرصيد</span>
                  <MoneyText value={remainingAfterCredit} currency={currency} tone="debit" />
                </div>
              </div>
            </div>
          ) : null}

          <Field label="ملاحظات" hint="اكتب أي تفاصيل إضافية تخص الطلب">
            {(p) => (
              <Input
                {...p}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="ملاحظات اختيارية"
              />
            )}
          </Field>

          {/* تفاصيل الطلب والمجموع الحي */}
          {liveTotal && validItems.length > 0 ? (
            <div>
              <h3 className="text-fg mb-3 text-sm font-bold">تفاصيل الطلب</h3>
              <div className="border-border rounded-ctrl overflow-hidden border">
                <table className="w-full table-fixed border-collapse text-[11px] sm:text-xs">
                  <colgroup>
                    <col className="w-[40%]" />
                    <col className="w-[14%]" />
                    <col className="w-[22%]" />
                    <col className="w-[24%]" />
                  </colgroup>
                  <thead className="bg-card-muted text-fg-muted">
                    <tr className="border-border border-b">
                      <th className="px-2 py-2.5 text-start font-semibold">المنتج</th>
                      <th className="px-1 py-2.5 text-center font-semibold">الكمية</th>
                      <th className="px-1 py-2.5 text-center font-semibold">سعر الوحدة</th>
                      <th className="px-2 py-2.5 text-end font-semibold">السعر الكلي</th>
                    </tr>
                  </thead>
                  <tbody>
                    {validItems.map((item, index) => (
                      <tr
                        key={`${item.name}-${index}`}
                        className="border-border-subtle even:bg-card-muted/50 border-b last:border-b-0"
                      >
                        <td className="text-fg break-words px-2 py-3 font-semibold">{item.name}</td>
                        <td className="text-fg px-1 py-3 text-center tabular-nums">
                          {item.quantity}
                        </td>
                        <td className="px-1 py-3 text-center">
                          <MoneyText
                            value={item.unitPrice}
                            currency={currency}
                            tone="plain"
                            withSymbol={false}
                            className="w-full text-center text-[11px] sm:text-xs"
                          />
                        </td>
                        <td className="px-2 py-3 text-end">
                          <MoneyText
                            value={calculateLineTotal(item) ?? '0.00'}
                            currency={currency}
                            tone="plain"
                            withSymbol={false}
                            className="w-full text-end text-[11px] font-bold sm:text-xs"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="border-border mt-3 flex items-center justify-between border-t pt-3">
                <span className="text-fg font-bold">المجموع</span>
                <MoneyText value={liveTotal} currency={currency} tone="plain" size="lg" />
              </div>
            </div>
          ) : null}
        </DialogBody>

        <DialogFooter>
          {order ? (
            <Button variant="brand" onClick={() => submit(false)} loading={update.isPending}>
              حفظ التعديلات
            </Button>
          ) : (
            <>
              <Button
                variant="brand"
                onClick={() => submit(true)}
                loading={create.isPending || createPayment.isPending}
              >
                تأكيد الطلب
              </Button>
              <Button
                variant="outline"
                onClick={() => submit(false)}
                disabled={create.isPending || createPayment.isPending}
              >
                حفظ كمسودة
              </Button>
            </>
          )}
          <DialogClose asChild>
            <Button
              variant="outline"
              disabled={create.isPending || update.isPending || createPayment.isPending}
            >
              إلغاء
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function calculateLineTotal(
  item: Pick<DraftItem, 'quantity' | 'unitPrice' | 'discount'>,
): string | undefined {
  if (!/^\d+(\.\d{1,4})?$/.test(item.quantity) || !/^\d+(\.\d{1,4})?$/.test(item.unitPrice)) {
    return undefined;
  }
  try {
    const base = multiply(item.unitPrice, item.quantity);
    return toMoneyString(max(subtract(base, item.discount || '0'), zero()), 2);
  } catch {
    return undefined;
  }
}

export function calculateOrderTotal(
  lineTotals: Array<string | undefined>,
  discount: string,
): string | undefined {
  try {
    const productsTotal = lineTotals.reduce(
      (sum, value) => (value ? add(sum, value) : sum),
      zero(),
    );
    return toMoneyString(max(subtract(productsTotal, discount || '0'), zero()), 2);
  } catch {
    return undefined;
  }
}
