import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import type { Customer, OrderDetail, OrderItemInput, PaginatedResult } from '@oh/contracts';
import { greaterThan, negate, toMoneyString, type CurrencyCode } from '@oh/money';
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
import { useCreatePayment } from '@/features/payments/api';
import { useCreateOrder, usePreviewOrder, useUpdateOrder } from './api';

interface DraftItem {
  name: string;
  quantity: string;
  unitPrice: string;
  discount: string;
  taxRate: string;
}

const emptyItem = (): DraftItem => ({
  name: '',
  quantity: '1',
  unitPrice: '',
  discount: '0',
  taxRate: '0',
});

export interface CreateOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fixedCustomerId?: string;
  order?: OrderDetail;
}

/**
 * إنشاء طلب — إدخال بنود يدوي (المتطلب 5)، مع معاينة حيّة.
 *
 * ⚠️ الواجهة **لا تحسب الإجمالي**. ترسل البنود إلى `/orders/preview` ويعيد
 *    الخادم الأرقام. فما يراه المستخدم هو بالضبط ما سيُحفظ — لا فرق تقريب،
 *    ولا مبلغ يمكن تزويره.
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
  const [items, setItems] = useState<DraftItem[]>([emptyItem()]);
  const [discount, setDiscount] = useState('0');
  const [notes, setNotes] = useState('');
  const [paidAmount, setPaidAmount] = useState('0');
  const [paymentKey, setPaymentKey] = useState(() => crypto.randomUUID());

  const create = useCreateOrder();
  const update = useUpdateOrder(order?.id ?? '');
  const createPayment = useCreatePayment();
  const preview = usePreviewOrder();

  const customersQuery = useQuery({
    queryKey: ['customers', 'picker'],
    queryFn: () =>
      api.get<PaginatedResult<Customer>>('/customers?pageSize=100&sortBy=name&sortOrder=asc'),
    enabled: open && !fixedCustomerId && !order,
  });
  const fixedCustomerQuery = useQuery({
    queryKey: ['customers', fixedCustomerId ?? order?.customerId],
    queryFn: () => api.get<Customer>(`/customers/${fixedCustomerId ?? order?.customerId}`),
    enabled: open && Boolean(fixedCustomerId ?? order?.customerId),
  });

  useEffect(() => {
    if (open) {
      setCustomerId(order?.customerId ?? fixedCustomerId ?? '');
      setItems(
        order
          ? order.items.map((item) => ({
              name: item.name,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              discount: item.discount,
              taxRate: item.taxRate,
            }))
          : [emptyItem()],
      );
      setDiscount(order?.discountAmount ?? '0');
      setNotes(order?.notes ?? '');
      setPaidAmount('0');
      setPaymentKey(crypto.randomUUID());
      preview.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
          taxRate: it.taxRate || '0',
        })),
    [items],
  );

  const { mutate: previewOrder, reset: resetPreview } = preview;
  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => {
      if (validItems.length === 0) {
        resetPreview();
        return;
      }
      previewOrder({ items: validItems, discountAmount: discount || '0' });
    }, 150);
    return () => window.clearTimeout(timer);
  }, [discount, open, previewOrder, resetPreview, validItems]);

  const updateItem = (index: number, patch: Partial<DraftItem>) =>
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)));

  const submit = (confirm: boolean) => {
    if (!customerId) {
      toast.error('اختر الزبون.');
      return;
    }
    if (validItems.length === 0) {
      toast.error('أضف بندًا واحدًا صحيحًا على الأقل.');
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
            toast.success(`حُفظت تعديلات الطلب ${updated.number}`);
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
    if (greaterThan(paymentAmount, '0') && !totals) {
      toast.error('انتظر ظهور إجمالي الطلب قبل تسجيل الدفعة.');
      return;
    }
    if (totals && greaterThan(paymentAmount, totals.total)) {
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
            createPayment.mutate(
              {
                body: {
                  customerId,
                  amount: paymentAmount,
                  method: 'CASH',
                  strategy: 'MANUAL',
                  allocations: [{ orderId: createdOrder.id, amount: paymentAmount }],
                },
                idempotencyKey: paymentKey,
              },
              {
                onSuccess: () => {
                  toast.success(`حُفظ الطلب ${createdOrder.number} وسُجّلت الدفعة النقدية`);
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
                ? `أُكِّد الطلب ${createdOrder.number}`
                : `حُفظ الطلب ${createdOrder.number} كمسودة`,
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

  const customers = customersQuery.data?.items ?? [];
  const selectedCustomer =
    fixedCustomerId || order
      ? fixedCustomerQuery.data
      : customers.find((customer) => customer.id === customerId);
  const totals = preview.data;
  const cellClass =
    'h-10 rounded-ctrl border border-border bg-card px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="xl">
        <DialogHeader>
          <DialogTitle>{order ? `تعديل الطلب ${order.number}` : 'إضافة طلب جديد'}</DialogTitle>
        </DialogHeader>

        <DialogBody className="space-y-5">
          {!fixedCustomerId && !order ? (
            <Field label="الزبون" required>
              {(p) => (
                <select
                  {...p}
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value)}
                  className="rounded-ctrl border-border bg-card focus-visible:ring-ring h-11 w-full border px-3 text-sm focus-visible:outline-none focus-visible:ring-2"
                >
                  <option value="">اختر زبونًا…</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              )}
            </Field>
          ) : null}

          {/* البنود */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-fg text-[13px] font-semibold">البنود</h3>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setItems((p) => [...p, emptyItem()])}
              >
                <Plus aria-hidden />
                إضافة بند
              </Button>
            </div>

            <div className="space-y-2">
              {/* رؤوس الأعمدة */}
              <div className="text-fg-muted hidden grid-cols-[1fr_70px_90px_80px_70px_90px_36px] gap-2 px-1 text-[11px] font-medium sm:grid">
                <span>الوصف</span>
                <span className="text-center">الكمية</span>
                <span className="text-center">السعر</span>
                <span className="text-center">الخصم</span>
                <span className="text-center">ضريبة%</span>
                <span className="text-end">الإجمالي</span>
                <span />
              </div>

              {items.map((item, i) => {
                const lineTotal = totals?.lineTotals[i];
                return (
                  <div
                    key={i}
                    className="rounded-ctrl border-border-subtle grid grid-cols-2 gap-2 border p-2 sm:grid-cols-[1fr_70px_90px_80px_70px_90px_36px] sm:border-0 sm:p-0"
                  >
                    <input
                      value={item.name}
                      onChange={(e) => updateItem(i, { name: e.target.value })}
                      placeholder="اسم البند"
                      className={`${cellClass} col-span-2 sm:col-span-1`}
                    />
                    <input
                      value={item.quantity}
                      onChange={(e) => updateItem(i, { quantity: e.target.value })}
                      dir="ltr"
                      inputMode="decimal"
                      placeholder="الكمية"
                      className={`${cellClass} text-center`}
                    />
                    <input
                      value={item.unitPrice}
                      onChange={(e) => updateItem(i, { unitPrice: e.target.value })}
                      dir="ltr"
                      inputMode="decimal"
                      placeholder="السعر"
                      className={`${cellClass} text-center`}
                    />
                    <input
                      value={item.discount}
                      onChange={(e) => updateItem(i, { discount: e.target.value })}
                      dir="ltr"
                      inputMode="decimal"
                      className={`${cellClass} text-center`}
                    />
                    <input
                      value={item.taxRate}
                      onChange={(e) => updateItem(i, { taxRate: e.target.value })}
                      dir="ltr"
                      inputMode="decimal"
                      className={`${cellClass} text-center`}
                    />
                    <div className="flex items-center justify-end px-1">
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
                      className="rounded-ctrl text-fg-muted hover:bg-danger-soft hover:text-danger flex items-center justify-center"
                      aria-label="حذف البند"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="خصم على الطلب">
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
            <Field label="ملاحظات">
              {(p) => <Input {...p} value={notes} onChange={(e) => setNotes(e.target.value)} />}
            </Field>
          </div>

          {selectedCustomer ? (
            <div className="rounded-ctrl border-border bg-card flex items-center justify-between border px-4 py-3">
              <span className="text-fg-muted text-sm">الرصيد الحالي</span>
              <MoneyText
                value={toMoneyString(negate(selectedCustomer.balance), 2)}
                currency={currency}
                tone="auto"
                size="lg"
              />
            </div>
          ) : null}

          {!order ? (
            <Field label="المبلغ المدفوع الآن" hint="اختياري، ويُسجّل كدفعة نقدية لهذا الطلب">
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

          {/* الإجماليات — من الخادم */}
          {totals ? (
            <div className="rounded-card border-border bg-card-muted border p-4">
              <dl className="space-y-1.5 text-sm">
                <Row label="المجموع الفرعي" value={totals.subtotal} currency={currency} />
                <Row label="الخصم" value={totals.discountAmount} currency={currency} />
                <Row label="الضريبة" value={totals.taxAmount} currency={currency} />
                <div className="border-border flex items-center justify-between border-t pt-2">
                  <dt className="text-fg font-semibold">الإجمالي</dt>
                  <dd>
                    <MoneyText value={totals.total} currency={currency} tone="plain" size="lg" />
                  </dd>
                </div>
              </dl>
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
              variant="ghost"
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

function Row({ label, value, currency }: { label: string; value: string; currency: CurrencyCode }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-fg-muted">{label}</dt>
      <dd>
        <MoneyText value={value} currency={currency} tone="plain" withSymbol={false} />
      </dd>
    </div>
  );
}
