import { useState } from 'react';
import { Check, Pencil, Printer, Trash2 } from 'lucide-react';
import type { OrderDetail, SessionUser } from '@oh/contracts';
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
import { printOrder } from './print-order';

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
  const locale = currentLocale();
  const [editingOrder, setEditingOrder] = useState<OrderDetail>();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
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

  const handlePrint = async () => {
    if (!order) return;
    const printWindow = window.open('', '_blank', 'width=420,height=720');
    if (!printWindow) {
      toast.error('اسمح بفتح نافذة الطباعة من المتصفح.');
      return;
    }

    try {
      const freshUser = await api.get<SessionUser>('/auth/me');
      printOrder(order, currency, { store: freshUser.store, targetWindow: printWindow });
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
                      <Info label="التاريخ" value={order.issuedAt.slice(0, 10)} ltr />
                      <Info
                        label="ساعة استلام الطلب"
                        value={new Date(order.issuedAt).toLocaleTimeString(locale, {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                        ltr
                      />
                      <div className="flex items-center justify-between gap-3">
                        <dt className="text-fg-muted">حالة الدفع</dt>
                        <dd>
                          <StatusBadge tone={paid ? 'credit' : 'debit'}>
                            {paid ? 'مدفوع' : 'غير مدفوع'}
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
                  <Amount label="قيمة الطلب" value={order.total} currency={currency} />
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

              {order ? (
                <Button variant="outline" onClick={() => void handlePrint()}>
                  <Printer aria-hidden />
                  طباعة الطلب
                </Button>
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
