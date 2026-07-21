import { Pencil, Printer } from 'lucide-react';
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
  ErrorState,
  MoneyText,
  Skeleton,
  StatusBadge,
} from '@oh/ui';
import { ApiRequestError } from '@/lib/api';
import { useAuth } from '@/app/auth-context';
import { useCustomer } from '@/features/customers/api';
import { useOrder } from './api';
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
  const paid = order?.remainingAmount === '0.00';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="xl">
        <DialogHeader>
          <DialogTitle>{order ? `الطلب ${order.number}` : 'تفاصيل الطلب'}</DialogTitle>
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
                    <Info label="رقم الطلب" value={order.number} ltr />
                    <Info label="التاريخ" value={order.issuedAt.slice(0, 10)} ltr />
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
                <h3 className="text-fg mb-3 text-sm font-semibold">بنود الطلب</h3>
                <div className="rounded-card border-border overflow-x-auto border">
                  <table className="w-full border-collapse text-sm">
                    <thead className="bg-card-muted text-fg-muted">
                      <tr>
                        <th className="p-3 text-start">البند</th>
                        <th className="p-3 text-center">الكمية</th>
                        <th className="p-3 text-end">السعر</th>
                        <th className="p-3 text-center">الضريبة</th>
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
                          <td className="p-3 text-center tabular-nums">{item.taxRate}%</td>
                          <td className="p-3 text-end">
                            <MoneyText value={item.lineTotal} currency={currency} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="border-border grid grid-cols-1 gap-3 border-t pt-5 sm:grid-cols-3">
                <Amount label="تكلفة الطلب" value={order.total} currency={currency} />
                <Amount
                  label="المدفوع"
                  value={order.paidAmount}
                  currency={currency}
                  tone="credit"
                />
                <Amount
                  label="الدين"
                  value={order.remainingAmount}
                  currency={currency}
                  tone="debit"
                />
              </section>
            </>
          )}
        </DialogBody>
        <DialogFooter>
          {order ? (
            <Button variant="outline" onClick={() => printOrder(order, currency)}>
              <Printer aria-hidden />
              طباعة الطلب
            </Button>
          ) : null}
          {order && editable && can('orders.update') && onEdit ? (
            <Button variant="brand" onClick={() => onEdit(order.id)}>
              <Pencil aria-hidden />
              تعديل
            </Button>
          ) : null}
          <DialogClose asChild>
            <Button variant="ghost">إغلاق</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
