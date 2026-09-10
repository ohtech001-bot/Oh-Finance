import { useState } from 'react';
import { CircleCheck, CircleDollarSign, Printer, WalletCards } from 'lucide-react';
import {
  LEDGER_TYPE_LABELS,
  type Customer,
  type LedgerEntry,
  type OrderDetail,
  type StatementOrderPaymentState,
} from '@oh/contracts';
import { abs, isNegative, isPositive, toMoneyString, type CurrencyCode } from '@oh/money';
import {
  Button,
  DataTable,
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
  type Column,
} from '@oh/ui';
import { ApiRequestError, api } from '@/lib/api';
import { currentLocale } from '@/lib/i18n';
import { useAuth } from '@/app/auth-context';
import { useStatement } from '@/features/ledger/api';
import { displayOrderNumber } from '@/features/orders/order-number';
import { printCustomerStatement } from './print-customer-statement';

interface CustomerStatementDialogProps {
  customer: Customer;
  currency: CurrencyCode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CustomerStatementDialog({
  customer,
  currency,
  open,
  onOpenChange,
}: CustomerStatementDialogProps) {
  const { user } = useAuth();
  const locale = currentLocale();
  const statementQuery = useStatement(open ? customer.id : undefined);
  const statement = statementQuery.data;
  const orderPaymentStates = new Map(
    statement?.orders.map((order) => [order.orderId, order.paymentState]) ?? [],
  );
  const [printing, setPrinting] = useState(false);
  const settledOrder = (entry: LedgerEntry) => {
    const state = entry.refId ? orderPaymentStates.get(entry.refId) : undefined;
    return entry.entryType === 'ORDER_DEBIT' && (state === 'PAID' || state === 'PAID_FROM_CREDIT');
  };

  const handlePrint = async () => {
    if (!statement) return;
    const targetWindow = window.open('', '_blank', 'width=980,height=760');
    if (!targetWindow) {
      toast.error('اسمح بفتح نافذة الطباعة من المتصفح.');
      return;
    }

    setPrinting(true);
    try {
      const orderIds = [
        ...new Set(
          statement.entries
            .filter((entry) => entry.refType === 'ORDER' && entry.refId)
            .map((entry) => entry.refId as string),
        ),
      ];
      const orders = await Promise.all(
        orderIds.map((orderId) => api.get<OrderDetail>(`/orders/${orderId}`)),
      );
      printCustomerStatement({
        statement,
        customer,
        currency,
        locale,
        store: user?.store ?? null,
        orders,
        targetWindow,
      });
    } catch (error) {
      targetWindow.close();
      if (error instanceof ApiRequestError) toast.apiError(error.message, error.requestId);
      else toast.error('تعذّر تجهيز كشف الحساب للطباعة.');
    } finally {
      setPrinting(false);
    }
  };

  const columns: Column<LedgerEntry>[] = [
    {
      header: 'التاريخ والوقت',
      render: (row) => <StatementDate value={row.occurredAt} locale={locale} />,
    },
    {
      header: 'الحركة',
      render: (row) => (
        <div>
          <p className="text-fg text-sm font-medium">{LEDGER_TYPE_LABELS[row.entryType]}</p>
          {row.refNumber ? (
            <p className="text-fg-muted text-xs">
              {row.refType === 'ORDER' ? displayOrderNumber(row.refNumber) : row.refNumber}
            </p>
          ) : null}
          {row.refType === 'ORDER' && row.refId && orderPaymentStates.has(row.refId) ? (
            <OrderPaymentBadge state={orderPaymentStates.get(row.refId)!} locale={locale} />
          ) : null}
        </div>
      ),
    },
    {
      header: 'الدين',
      align: 'end',
      render: (row) =>
        row.debit !== '0.00' ? (
          <span className={settledOrder(row) ? 'text-fg-muted line-through' : undefined}>
            <MoneyText
              value={row.debit}
              currency={currency}
              tone={settledOrder(row) ? 'neutral' : 'debit'}
              withSymbol={false}
            />
          </span>
        ) : (
          <span className="text-fg-subtle">—</span>
        ),
    },
    {
      header: 'مدفوع',
      align: 'end',
      render: (row) =>
        row.credit !== '0.00' ? (
          <MoneyText value={row.credit} currency={currency} tone="credit" withSymbol={false} />
        ) : (
          <span className="text-fg-subtle">—</span>
        ),
    },
    {
      header: 'الرصيد بعد الحركة',
      align: 'end',
      render: (row) => (
        <MoneyText value={row.runningBalance} currency={currency} tone="auto" withSymbol={false} />
      ),
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="xl">
        <DialogHeader>
          <DialogTitle>كشف حساب {customer.name}</DialogTitle>
        </DialogHeader>

        <DialogBody className="space-y-4">
          {statementQuery.isLoading ? (
            <div className="space-y-3" aria-busy="true">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-72 w-full" />
            </div>
          ) : statementQuery.isError || !statement ? (
            <ErrorState
              message={
                statementQuery.error instanceof ApiRequestError
                  ? statementQuery.error.message
                  : 'تعذّر تحميل كشف الحساب.'
              }
              onRetry={() => void statementQuery.refetch()}
            />
          ) : (
            <>
              <AccountBalanceSummary
                balance={statement.totals.currentBalance}
                currency={currency}
              />

              <DataTable
                caption={`كشف حساب ${customer.name}`}
                columns={columns}
                rows={statement.entries}
                rowKey={(row) => row.id}
                empty={{
                  title: 'لا توجد حركات مالية',
                  description: 'ستظهر الطلبات والدفعات هنا عند تسجيلها.',
                }}
                mobileRender={(row) => (
                  <article className="border-border rounded-card border p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-fg truncate text-sm font-semibold">
                          {LEDGER_TYPE_LABELS[row.entryType]}
                        </p>
                        <StatementDate value={row.occurredAt} locale={locale} />
                        {row.refType === 'ORDER' &&
                        row.refId &&
                        orderPaymentStates.has(row.refId) ? (
                          <OrderPaymentBadge
                            state={orderPaymentStates.get(row.refId)!}
                            locale={locale}
                          />
                        ) : null}
                      </div>
                      <MoneyText value={row.runningBalance} currency={currency} tone="auto" />
                    </div>
                    <div className="border-border-subtle mt-3 grid grid-cols-2 gap-3 border-t pt-3">
                      <MovementAmount
                        label="الدين"
                        value={row.debit}
                        currency={currency}
                        tone="debit"
                        settled={settledOrder(row)}
                      />
                      <MovementAmount
                        label="المدفوع"
                        value={row.credit}
                        currency={currency}
                        tone="credit"
                      />
                    </div>
                  </article>
                )}
              />
            </>
          )}
        </DialogBody>

        <DialogFooter>
          {statement && statement.entries.length > 0 ? (
            <Button variant="outline" onClick={() => void handlePrint()} loading={printing}>
              <Printer aria-hidden />
              طباعة
            </Button>
          ) : null}
          <DialogClose asChild>
            <Button variant="outline">إغلاق</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function OrderPaymentBadge({
  state,
  locale,
}: {
  state: StatementOrderPaymentState;
  locale: ReturnType<typeof currentLocale>;
}) {
  const labels = {
    ar: {
      PAID_FROM_CREDIT: 'مدفوع من رصيد الزبون',
      PAID: 'مدفوع',
      PARTIALLY_PAID: 'مدفوع جزئيًا',
      UNPAID: 'غير مدفوع',
    },
    he: {
      PAID_FROM_CREDIT: 'שולם מיתרת הלקוח',
      PAID: 'שולם',
      PARTIALLY_PAID: 'שולם חלקית',
      UNPAID: 'לא שולם',
    },
    en: {
      PAID_FROM_CREDIT: 'Paid from customer credit',
      PAID: 'Paid',
      PARTIALLY_PAID: 'Partially paid',
      UNPAID: 'Unpaid',
    },
  } as const;

  return (
    <StatusBadge
      className="mt-1"
      tone={
        state === 'PAID' || state === 'PAID_FROM_CREDIT'
          ? 'credit'
          : state === 'PARTIALLY_PAID'
            ? 'partial'
            : 'debit'
      }
    >
      {labels[locale][state]}
    </StatusBadge>
  );
}

function AccountBalanceSummary({ balance, currency }: { balance: string; currency: CurrencyCode }) {
  const owesMoney = isPositive(balance);
  const hasCredit = isNegative(balance);
  const title = owesMoney ? 'دين حالي على الزبون' : hasCredit ? 'رصيد متاح للزبون' : 'الحساب مسدّد';
  const description = owesMoney
    ? 'هذا هو المبلغ المطلوب من الزبون سداده للمحل.'
    : hasCredit
      ? 'يمكن للزبون استخدام هذا الرصيد في طلباته القادمة.'
      : 'لا يوجد دين على الزبون ولا رصيد مدفوع مسبقًا.';
  const value = owesMoney || hasCredit ? toMoneyString(abs(balance), 2) : '0.00';
  const Icon = owesMoney ? CircleDollarSign : hasCredit ? WalletCards : CircleCheck;
  const tone = owesMoney ? 'debit' : hasCredit ? 'credit' : 'neutral';

  return (
    <section
      className={
        owesMoney
          ? 'border-danger/30 bg-danger-soft rounded-card border p-4 sm:p-5'
          : hasCredit
            ? 'border-success/30 bg-success-soft rounded-card border p-4 sm:p-5'
            : 'border-border bg-card-muted rounded-card border p-4 sm:p-5'
      }
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-4">
          <span
            className={
              owesMoney
                ? 'bg-danger/10 text-danger rounded-icon flex size-12 shrink-0 items-center justify-center'
                : hasCredit
                  ? 'bg-success/10 text-success rounded-icon flex size-12 shrink-0 items-center justify-center'
                  : 'bg-card text-fg-muted rounded-icon flex size-12 shrink-0 items-center justify-center'
            }
            aria-hidden
          >
            <Icon className="size-6" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-fg text-base font-bold">{title}</p>
            <p className="text-fg-muted mt-1 text-sm">{description}</p>
          </div>
        </div>
        <div className="self-end sm:self-auto">
          <MoneyText value={value} currency={currency} tone={tone} size="lg" />
        </div>
      </div>
    </section>
  );
}

function MovementAmount({
  label,
  value,
  currency,
  tone,
  settled = false,
}: {
  label: string;
  value: string;
  currency: CurrencyCode;
  tone: 'debit' | 'credit';
  settled?: boolean;
}) {
  return (
    <div>
      <p className="text-fg-muted mb-1 text-xs">{label}</p>
      {value !== '0.00' ? (
        <span className={settled ? 'text-fg-muted line-through' : undefined}>
          <MoneyText
            value={value}
            currency={currency}
            tone={settled ? 'neutral' : tone}
            withSymbol={false}
          />
        </span>
      ) : (
        <span className="text-fg-subtle text-sm">—</span>
      )}
    </div>
  );
}

function StatementDate({ value, locale }: { value: string; locale: string }) {
  const date = new Date(value);
  return (
    <div className="text-xs">
      <p className="text-fg">
        {new Intl.DateTimeFormat(locale, {
          weekday: 'long',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        }).format(date)}
      </p>
      <p className="text-fg-muted tabular-nums" dir="ltr">
        {date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
      </p>
    </div>
  );
}
