import { useState } from 'react';
import { Check, Pencil, Trash2, WalletCards } from 'lucide-react';
import type { Customer, OrderDetail, Payment, StoreSettings } from '@oh/contracts';
import type { CurrencyCode } from '@oh/money';
import {
  Button,
  ConfirmDialog,
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  ErrorState,
  MoneyText,
  Skeleton,
  StatusBadge,
  toast,
} from '@oh/ui';
import { ApiRequestError, api } from '@/lib/api';
import { useAuth } from '@/app/auth-context';
import { currentLocale } from '@/lib/i18n';
import { useCustomer } from '@/features/customers/api';
import { useConfirmOrder, useDeleteOrder, useOrder } from './api';
import { CreateOrderDialog } from './create-order-dialog';
import { displayOrderNumber } from './order-number';
import { formatOrderDate, formatOrderTime, orderSettlementDate, printOrder } from './print-order';
import type { PrintPaperSize } from './print-order';
import { PrintOrderMenu } from './print-order-menu';
import { PayOrderDialog } from './pay-order-dialog';

const DATE_COPY = {
  ar: {
    receivedDate: 'تاريخ استلام الطلب',
    receivedTime: 'ساعة استلام الطلب',
    settlementDate: 'تاريخ السداد',
    settlementTime: 'ساعة السداد',
  },
  he: {
    receivedDate: 'תאריך קבלת ההזמנה',
    receivedTime: 'שעת קבלת ההזמנה',
    settlementDate: 'תאריך התשלום',
    settlementTime: 'שעת התשלום',
  },
  en: {
    receivedDate: 'Order received date',
    receivedTime: 'Order received time',
    settlementDate: 'Payment date',
    settlementTime: 'Payment time',
  },
} as const;

export function OrderDetailsDialog({
  orderId,
  open,
  onOpenChange,
  onEdit,
}: {
  orderId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit?: (orderId: string) => void;
}) {
  const { user, can } = useAuth();
  const currency = (user?.store?.currency ?? 'ILS') as CurrencyCode;
  const orderQuery = useOrder(open ? orderId : undefined);
  const order = orderQuery.data;
  const customerQuery = useCustomer(order?.customerId);
  const editable = order?.status === 'DRAFT' || order?.status === 'QUOTE';
  const isDraft = order?.status === 'DRAFT';
  const paid = order?.remainingAmount === '0.00';
  const partiallyPaid = order?.status === 'PARTIALLY_PAID';
  const locale = currentLocale();
  const dateCopy = DATE_COPY[locale];
  const settledAt = order ? orderSettlementDate(order) : null;
  const [editingOrder, setEditingOrder] = useState<OrderDetail>();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const confirmOrder = useConfirmOrder(order?.id ?? '');
  const deleteOrder = useDeleteOrder();

  const handleConfirm = () => {
    if (!order || order.status !== 'DRAFT') return;

    confirmOrder.mutate(
      { version: order.version, overrideCreditLimit: false },
      {
        onSuccess: (confirmed) => {
          toast.success(`أُكِّد الطلب ${displayOrderNumber(confirmed.number)}`);
          setConfirmOpen(false);
        },
        onError: (error) => {
          if (error instanceof ApiRequestError) toast.apiError(error.message, error.requestId);
          else toast.error('تعذّر تأكيد الطلب.');
        },
      },
    );
  };

  const handleDelete = () => {
    if (!order || order.status !== 'DRAFT') return;

    deleteOrder.mutate(
      { id: order.id, version: order.version },
      {
        onSuccess: () => {
          toast.success(`حُذفت مسودة الطلب ${displayOrderNumber(order.number)}`);
          setDeleteOpen(false);
          onOpenChange(false);
        },
        onError: (error) => {
          if (error instanceof ApiRequestError) toast.apiError(error.message, error.requestId);
          else toast.error('تعذّر حذف مسودة الطلب.');
        },
      },
    );
  };

  const handlePrint = async (paperSize: PrintPaperSize) => {
    if (!order) return;
    const printWindow = window.open(
      '',
      '_blank',
      paperSize === 'A4' ? 'width=1000,height=850' : 'width=420,height=720',
    );
    if (!printWindow) {
      toast.error('اسمح بفتح نافذة الطباعة من المتصفح.');
      return;
    }

    try {
      const latestAllocation = order.allocations.at(-1);
      const [settings, customer, payment] = await Promise.all([
        api.get<StoreSettings>('/settings'),
        customerQuery.data
          ? Promise.resolve(customerQuery.data)
          : api.get<Customer>(`/customers/${order.customerId}`),
        latestAllocation
          ? api.get<Payment>(`/payments/${latestAllocation.paymentId}`)
          : Promise.resolve(null),
      ]);
      printOrder(order, currency, {
        store: user?.store
          ? {
              ...user.store,
              logoUrl: settings.general.logoUrl || user.store.logoUrl,
              email: settings.general.email,
              address: settings.general.address,
            }
          : null,
        customer,
        payment,
        paperSize,
        targetWindow: printWindow,
      });
    } catch (error) {
      printWindow.close();
      if (error instanceof ApiRequestError) toast.apiError(error.message, error.requestId);
      else toast.error('تعذّرت طباعة الطلب.');
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent size="xl">
          <DialogHeader>
            <DialogTitle>
              {order ? `الطلب ${displayOrderNumber(order.number)}` : 'تفاصيل الطلب'}
            </DialogTitle>
          </DialogHeader>
          <DialogBody className="space-y-5">
            {orderQuery.isLoading ? (
              <div className="space-y-4" aria-busy="true">
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-52 w-full" />
              </div>
            ) : orderQuery.isError || !order ? (
              <ErrorState
                message={
                  orderQuery.error instanceof ApiRequestError
                    ? orderQuery.error.message
                    : 'تعذّر تحميل الطلب.'
                }
                onRetry={() => void orderQuery.refetch()}
              />
            ) : (
              <>
                <section className="border-border grid grid-cols-1 gap-4 border-b pb-5 md:grid-cols-2">
                  <div>
                    <h3 className="text-fg mb-3 text-sm font-semibold">تفاصيل الزبون</h3>
                    <dl className="space-y-2 text-sm">
                      <Info label="الاسم" value={order.customerName} />
                      {customerQuery.data?.phone ? (
                        <Info label="الهاتف" value={customerQuery.data.phone} ltr />
                      ) : null}
                      {customerQuery.data?.email ? (
                        <Info label="البريد الإلكتروني" value={customerQuery.data.email} ltr />
                      ) : null}
                      {customerQuery.data?.city ? (
                        <Info label="المدينة" value={customerQuery.data.city} />
                      ) : null}
                    </dl>
                  </div>
                  <div>
                    <h3 className="text-fg mb-3 text-sm font-semibold">تفاصيل الطلب</h3>
                    <dl className="space-y-2 text-sm">
                      <Info label="رقم الطلب" value={displayOrderNumber(order.number)} ltr />
                      <Info
                        label={dateCopy.receivedDate}
                        value={formatOrderDate(order.issuedAt)}
                        ltr
                      />
                      <Info
                        label={dateCopy.receivedTime}
                        value={formatOrderTime(order.issuedAt)}
                        ltr
                      />
                      {settledAt ? (
                        <>
                          <Info
                            label={dateCopy.settlementDate}
                            value={formatOrderDate(settledAt)}
                            ltr
                          />
                          <Info
                            label={dateCopy.settlementTime}
                            value={formatOrderTime(settledAt)}
                            ltr
                          />
                        </>
                      ) : null}
                      <div className="flex items-center justify-between gap-3">
                        <dt className="text-fg-muted">حالة الدفع</dt>
                        <dd>
                          <StatusBadge tone={paid ? 'credit' : partiallyPaid ? 'partial' : 'debit'}>
                            {paid ? 'مدفوع' : partiallyPaid ? 'مدفوع جزئيًا' : 'غير مدفوع'}
                          </StatusBadge>
                        </dd>
                      </div>
                    </dl>
                  </div>
                </section>

                <section>
                  <h3 className="text-fg mb-3 text-sm font-semibold">منتجات الطلب</h3>
                  <div className="rounded-card border-border overflow-x-auto border">
                    <table className="w-full border-collapse text-sm">
                      <thead className="bg-card-muted text-fg-muted">
                        <tr>
                          <th className="p-3 text-start">المنتج</th>
                          <th className="p-3 text-center">الكمية</th>
                          <th className="p-3 text-end">السعر</th>
                          <th className="p-3 text-end">الإجمالي</th>
                        </tr>
                      </thead>
                      <tbody>
                        {order.items.map((item) => (
                          <tr key={item.id} className="border-border-subtle border-t">
                            <td className="text-fg p-3 font-medium">{item.name}</td>
                            <td className="p-3 text-center tabular-nums">{item.quantity}</td>
                            <td className="p-3 text-end">
                              <MoneyText
                                value={item.unitPrice}
                                currency={currency}
                                withSymbol={false}
                              />
                            </td>
                            <td className="p-3 text-end">
                              <MoneyText value={item.lineTotal} currency={currency} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>

                <section className="border-border border-t pt-5">
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <Amount label="قيمة الطلب" value={order.total} currency={currency} />
                    <Amount
                      label="المسحوب من رصيد الزبون"
                      value={order.creditAppliedAmount}
                      currency={currency}
                      tone="credit"
                    />
                    <Amount
                      label="إجمالي المسدد"
                      value={order.paidAmount}
                      currency={currency}
                      tone="credit"
                    />
                    <Amount
                      label="المتبقي للسداد"
                      value={order.remainingAmount}
                      currency={currency}
                      tone={paid ? 'plain' : 'debit'}
                    />
                  </div>
                </section>
              </>
            )}
          </DialogBody>
          <DialogFooter>
            <div className="grid w-full gap-2">
              <div className="grid grid-cols-2 gap-2">
                {order && editable && can('orders.update') ? (
                  <Button
                    variant="brand"
                    onClick={() => {
                      if (onEdit) {
                        onEdit(order.id);
                      } else {
                        setEditingOrder(order);
                        onOpenChange(false);
                      }
                    }}
                  >
                    <Pencil aria-hidden />
                    تعديل
                  </Button>
                ) : null}
                <DialogClose asChild>
                  <Button
                    variant="outline"
                    className={order && editable && can('orders.update') ? undefined : 'col-span-2'}
                  >
                    إغلاق
                  </Button>
                </DialogClose>
              </div>

              {order && isDraft && (can('orders.cancel') || can('orders.confirm')) ? (
                <div className="grid grid-cols-2 gap-2">
                  {can('orders.cancel') ? (
                    <Button
                      variant="danger"
                      className={can('orders.confirm') ? undefined : 'col-span-2'}
                      onClick={() => setDeleteOpen(true)}
                    >
                      <Trash2 aria-hidden />
                      حذف الطلب
                    </Button>
                  ) : null}
                  {can('orders.confirm') ? (
                    <Button
                      variant="brand"
                      className={can('orders.cancel') ? undefined : 'col-span-2'}
                      onClick={() => setConfirmOpen(true)}
                    >
                      <Check aria-hidden />
                      تأكيد الطلب
                    </Button>
                  ) : null}
                </div>
              ) : null}

              {order &&
              (order.status === 'CONFIRMED' || order.status === 'PARTIALLY_PAID') &&
              can('payments.create') ? (
                <Button variant="brand" onClick={() => setPayOpen(true)}>
                  <WalletCards aria-hidden />
                  دفع الطلب
                </Button>
              ) : null}

              {order ? (
                <PrintOrderMenu className="w-full" onSelect={(size) => void handlePrint(size)} />
              ) : null}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <CreateOrderDialog
        open={Boolean(editingOrder)}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setEditingOrder(undefined);
        }}
        order={editingOrder}
      />
      <PayOrderDialog order={order} open={payOpen} onOpenChange={setPayOpen} />
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="تأكيد الطلب"
        description={
          order
            ? `هل تريد تأكيد الطلب ${displayOrderNumber(order.number)}؟ سيُسجّل المبلغ على حساب الزبون ولا يمكن تعديل الطلب بعد التأكيد.`
            : ''
        }
        confirmLabel="تأكيد الطلب"
        variant="brand"
        loading={confirmOrder.isPending}
        onConfirm={handleConfirm}
      />
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="حذف مسودة الطلب"
        description={
          order
            ? `هل تريد حذف مسودة الطلب ${displayOrderNumber(order.number)} نهائيًا؟ لا يمكن التراجع عن هذا الإجراء.`
            : ''
        }
        confirmLabel="حذف الطلب"
        variant="danger"
        loading={deleteOrder.isPending}
        onConfirm={handleDelete}
      />
    </>
  );
}

function Info({ label, value, ltr }: { label: string; value: string; ltr?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-fg-muted">{label}</dt>
      <dd className="text-fg truncate font-medium" dir={ltr ? 'ltr' : undefined}>
        {value}
      </dd>
    </div>
  );
}

function Amount({
  label,
  value,
  currency,
  tone = 'plain',
}: {
  label: string;
  value: string;
  currency: CurrencyCode;
  tone?: 'plain' | 'credit' | 'debit';
}) {
  return (
    <div className="rounded-card border-border bg-card-muted border p-4 text-center">
      <p className="text-fg-muted mb-2 text-sm">{label}</p>
      <MoneyText value={value} currency={currency} tone={tone} size="lg" />
    </div>
  );
}
