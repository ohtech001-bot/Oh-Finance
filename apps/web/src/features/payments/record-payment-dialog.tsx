import { copy, useCopy } from '@/lib/copy';
import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Customer, PaginatedResult } from '@oh/contracts';
import { negate, toMoneyString, type CurrencyCode } from '@oh/money';
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
import { useAuth } from '@/app/auth-context';
import { useCreatePayment } from './api';

export interface RecordPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fixedCustomerId?: string;
}

export function RecordPaymentDialog({
  open,
  onOpenChange,
  fixedCustomerId,
}: RecordPaymentDialogProps) {
  useCopy();

  const { user } = useAuth();
  const currency = (user?.store?.currency ?? 'ILS') as CurrencyCode;
  const [customerId, setCustomerId] = useState(fixedCustomerId ?? '');
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());
  const create = useCreatePayment();

  const customersQuery = useQuery({
    queryKey: ['customers', 'picker'],
    queryFn: () =>
      api.get<PaginatedResult<Customer>>('/customers?pageSize=100&sortBy=name&sortOrder=asc'),
    enabled: open && !fixedCustomerId,
  });
  const fixedCustomerQuery = useQuery({
    queryKey: ['customers', fixedCustomerId],
    queryFn: () => api.get<Customer>(`/customers/${fixedCustomerId}`),
    enabled: open && Boolean(fixedCustomerId),
  });

  useEffect(() => {
    if (!open) return;
    setCustomerId(fixedCustomerId ?? '');
    setAmount('');
    setNotes('');
    setIdempotencyKey(crypto.randomUUID());
  }, [fixedCustomerId, open]);

  const validAmount = /^\d+(\.\d{1,4})?$/.test(amount) && Number(amount) > 0;
  const selectedCustomer = fixedCustomerId
    ? fixedCustomerQuery.data
    : customersQuery.data?.items.find((customer) => customer.id === customerId);
  const inputClass = useMemo(
    () =>
      'h-11 w-full rounded-ctrl border border-border bg-card px-3 text-sm text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
    [],
  );

  const submit = () => {
    if (!customerId || !validAmount) {
      toast.error(copy('اختر الزبون وأدخل مبلغًا صحيحًا.'));
      return;
    }
    create.mutate(
      {
        body: {
          customerId,
          amount,
          method: 'CASH',
          strategy: 'AUTO_OLDEST_FIRST',
          notes: notes || undefined,
        },
        idempotencyKey,
      },
      {
        onSuccess: (payment) => {
          toast.success(
            copy('سُجّلت الدفعة {{value0}}', { value0: payment.number }),
            copy('الرصيد الجديد: {{value0}}', { value0: payment.balanceAfter }),
          );
          onOpenChange(false);
        },
        onError: (error) => {
          if (error instanceof ApiRequestError) toast.apiError(error.message, error.requestId);
          else toast.error(copy('تعذّر تسجيل الدفعة.'));
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>{copy('تسجيل دفعة نقدية')}</DialogTitle>
        </DialogHeader>
        <DialogBody className="space-y-4">
          {!fixedCustomerId ? (
            <Field label={copy('الزبون')} required>
              {(props) => (
                <select
                  {...props}
                  value={customerId}
                  onChange={(event) => setCustomerId(event.target.value)}
                  className={inputClass}
                >
                  <option value="">{copy('اختر زبونًا…')}</option>
                  {(customersQuery.data?.items ?? []).map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.name}
                    </option>
                  ))}
                </select>
              )}
            </Field>
          ) : null}

          {selectedCustomer ? (
            <div className="rounded-ctrl border-border bg-card-muted flex items-center justify-between border px-4 py-3">
              <span className="text-fg-muted text-sm">{copy('الرصيد الحالي')}</span>
              <MoneyText
                value={toMoneyString(negate(selectedCustomer.balance), 2)}
                currency={currency}
                tone="auto"
              />
            </div>
          ) : null}

          <Field label={copy('المبلغ')} required>
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

          <Field label={copy('طريقة الدفع')}>
            {(props) => <Input {...props} value={copy('نقدي')} readOnly />}
          </Field>

          <Field label={copy('ملاحظات')}>
            {(props) => (
              <Input {...props} value={notes} onChange={(event) => setNotes(event.target.value)} />
            )}
          </Field>
        </DialogBody>
        <DialogFooter>
          <Button variant="brand" onClick={submit} loading={create.isPending}>
            {copy('تسجيل الدفعة')}
          </Button>
          <DialogClose asChild>
            <Button variant="outline" disabled={create.isPending}>
              {copy('إلغاء')}
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
