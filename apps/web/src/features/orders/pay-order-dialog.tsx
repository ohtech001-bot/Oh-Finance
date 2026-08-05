import { useEffect, useState } from 'react';
import type { OrderDetail } from '@oh/contracts';
import { greaterThan, type CurrencyCode } from '@oh/money';
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
  Switch,
  toast,
} from '@oh/ui';
import { ApiRequestError } from '@/lib/api';
import { useAuth } from '@/app/auth-context';
import {
  useApplyCustomerCredit,
  useCreatePayment,
  useCustomerCredit,
} from '@/features/payments/api';
import { displayOrderNumber } from './order-number';

export function PayOrderDialog({
  order,
  open,
  onOpenChange,
}: {
  order?: OrderDetail;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { user } = useAuth();
  const currency = (user?.store?.currency ?? 'ILS') as CurrencyCode;
  const [amount, setAmount] = useState('');
  const [useCredit, setUseCredit] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());
  const credit = useCustomerCredit(order?.customerId, open);
  const createPayment = useCreatePayment();
  const applyCredit = useApplyCustomerCredit();
  const pending = createPayment.isPending || applyCredit.isPending;

  useEffect(() => {
    if (!open) return;
    setAmount(order?.remainingAmount ?? '');
    setUseCredit(false);
    setIdempotencyKey(crypto.randomUUID());
  }, [open, order?.id, order?.remainingAmount]);

  const submit = () => {
    if (!order || !/^\d+(\.\d{1,4})?$/.test(amount) || !greaterThan(amount, '0')) {
      toast.error('أدخل مبلغًا صحيحًا أكبر من صفر.');
      return;
    }
    if (greaterThan(amount, order.remainingAmount)) {
      toast.error('المبلغ يتجاوز المتبقي على الطلب.');
      return;
    }

    const callbacks = {
      onSuccess: () => {
        toast.success(
          useCredit
            ? `دُفع الطلب ${displayOrderNumber(order.number)} من رصيد الزبون`
            : `سُجّلت دفعة نقدية للطلب ${displayOrderNumber(order.number)}`,
        );
        onOpenChange(false);
      },
      onError: (error: unknown) => {
        if (error instanceof ApiRequestError) toast.apiError(error.message, error.requestId);
        else toast.error('تعذّر دفع الطلب.');
      },
    };

    if (useCredit) {
      if (greaterThan(amount, credit.data?.availableAmount ?? '0')) {
        toast.error('المبلغ يتجاوز رصيد الزبون المتاح.');
        return;
      }
      applyCredit.mutate({ body: { orderId: order.id, amount }, idempotencyKey }, callbacks);
      return;
    }

    createPayment.mutate(
      {
        body: {
          customerId: order.customerId,
          amount,
          method: 'CASH',
          strategy: 'MANUAL',
          allocations: [{ orderId: order.id, amount }],
        },
        idempotencyKey,
      },
      callbacks,
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>
            {order ? `دفع الطلب ${displayOrderNumber(order.number)}` : 'دفع الطلب'}
          </DialogTitle>
        </DialogHeader>
        <DialogBody className="space-y-4">
          {order ? (
            <div className="bg-card-muted rounded-ctrl border-border flex items-center justify-between border px-4 py-3">
              <span className="text-fg-muted text-sm">المتبقي على الطلب</span>
              <MoneyText value={order.remainingAmount} currency={currency} tone="debit" />
            </div>
          ) : null}

          <Field label="المبلغ" required>
            {(props) => (
              <Input
                {...props}
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                dir="ltr"
                inputMode="decimal"
                placeholder="0.00"
              />
            )}
          </Field>

          <div className="rounded-ctrl border-border flex items-center justify-between gap-4 border p-4">
            <div className="min-w-0">
              <p className="text-fg text-sm font-semibold">الدفع من رصيد الزبون</p>
              <div className="text-fg-muted mt-1 flex items-center gap-1 text-xs">
                <span>المتاح:</span>
                <MoneyText
                  value={credit.data?.availableAmount ?? '0.00'}
                  currency={currency}
                  tone="credit"
                  size="sm"
                />
              </div>
            </div>
            <Switch
              checked={useCredit}
              onCheckedChange={setUseCredit}
              disabled={credit.isLoading || !greaterThan(credit.data?.availableAmount ?? '0', '0')}
              aria-label="الدفع من رصيد الزبون"
            />
          </div>

          <p className="text-fg-muted text-xs">
            {useCredit
              ? 'لن تُسجّل دفعة نقدية جديدة؛ سيُستخدم الرصيد السابق فقط.'
              : 'سيُسجّل المبلغ كدفعة نقدية استلمها المحل.'}
          </p>
        </DialogBody>
        <DialogFooter>
          <Button variant="brand" onClick={submit} loading={pending}>
            دفع الطلب
          </Button>
          <DialogClose asChild>
            <Button variant="outline" disabled={pending}>
              إلغاء
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
