import { copy, useCopy } from '@/lib/copy';
import { useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  LEDGER_TYPE_LABELS,
  ORDER_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
  type LedgerEntry,
  type Order,
  type Payment,
} from '@oh/contracts';
import {
  formatMoney,
  greaterThan,
  greaterThanOrEqual,
  negate,
  toMoneyString,
  type CurrencyCode,
} from '@oh/money';
import {
  Button,
  WhatsAppIcon,
  Card,
  CardBody,
  CardHeader,
  CardSkeleton,
  DataTable,
  ErrorState,
  MoneyText,
  PageHeader,
  StatCard,
  StatCardsSkeleton,
  StatusBadge,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  ORDER_STATUS_BADGE,
  type Column,
} from '@oh/ui';
import {
  ArrowLeft,
  CreditCard,
  FileText,
  Pencil,
  Plus,
  ShoppingBag,
  RotateCcw,
  Users,
  Wallet,
} from 'lucide-react';
import { ApiRequestError } from '@/lib/api';
import { currentLocale } from '@/lib/i18n';
import { useAuth } from '@/app/auth-context';
import { useLedger } from '@/features/ledger/api';
import { useOrders } from '@/features/orders/api';
import { usePayments } from '@/features/payments/api';
import { RecordPaymentDialog } from '@/features/payments/record-payment-dialog';
import { CreateOrderDialog } from '@/features/orders/create-order-dialog';
import { OrderDetailsDialog } from '@/features/orders/order-details-dialog';
import { ReturnOrderDialog } from '@/features/orders/return-order-dialog';
import { displayOrderNumber } from '@/features/orders/order-number';
import { useCustomer, useCustomerSummary } from './api';
import { CustomerFormDialog } from './customer-form-dialog';
import { CustomerStatementDialog } from './customer-statement-dialog';

/**
 * صفحة كل زبون — مطابقة لـ`ui/other screens/صفحة كل زبون.jpeg`.
 *
 * بطاقة الزبون + بطاقات مالية مشتقة + تبويبات (ملخص، الحركات).
 * كل رقم من الخادم؛ الرصيد من دفتر الحركات.
 */
export function CustomerDetailPage() {
  useCopy();

  const [returnOpen, setReturnOpen] = useState(false);
  const { id } = useParams<{ id: string }>();
  const { user, can } = useAuth();
  const currency = (user?.store?.currency ?? 'ILS') as CurrencyCode;
  const locale = currentLocale();
  const debtLimitLabel = { ar: 'حد الدين', he: 'מסגרת', en: 'Debt limit' }[locale];
  const paymentDueMessage = {
    ar: 'حان أو تجاوز موعد السداد المتفق عليه',
    he: 'מועד התשלום המוסכם הגיע או עבר',
    en: 'The agreed payment date has arrived or passed',
  }[locale];
  const outstandingBalanceLabel = {
    ar: 'الرصيد المستحق',
    he: 'היתרה לתשלום',
    en: 'Outstanding balance',
  }[locale];

  const [editOpen, setEditOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [orderOpen, setOrderOpen] = useState(false);
  const [statementOpen, setStatementOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string>();
  const [activeTab, setActiveTab] = useState('orders');

  const customerQuery = useCustomer(id);
  const summaryQuery = useCustomerSummary(id);
  const ledgerQuery = useLedger({ customerId: id, pageSize: 25 }, activeTab === 'ledger');
  const ordersQuery = useOrders({ customerId: id, pageSize: 25 }, activeTab === 'orders');
  const paymentsQuery = usePayments({ customerId: id, pageSize: 25 }, activeTab === 'payments');

  if (customerQuery.isLoading) {
    return (
      <div className="space-y-5">
        <CardSkeleton />
        <StatCardsSkeleton count={5} />
      </div>
    );
  }

  if (customerQuery.isError || !customerQuery.data) {
    return (
      <Card>
        <ErrorState
          message={
            customerQuery.error instanceof ApiRequestError
              ? customerQuery.error.message
              : copy('تعذّر تحميل الزبون.')
          }
          onRetry={() => void customerQuery.refetch()}
        />
      </Card>
    );
  }

  const customer = customerQuery.data;
  const summary = summaryQuery.data;
  const debtLimitReached =
    greaterThan(customer.creditLimit, '0') &&
    greaterThanOrEqual(customer.balance, customer.creditLimit);
  const reminderMessage = summary?.paymentDueReached
    ? paymentDueMessage
    : {
        ar: 'وصل الدين إلى الحد المسموح أو تجاوزه',
        he: 'החוב הגיע למסגרת המותרת או עבר אותה',
        en: 'The debt has reached or exceeded the allowed limit',
      }[locale];

  const ledgerColumns: Column<LedgerEntry>[] = [
    {
      header: copy('التاريخ'),
      render: (row) => (
        <span className="text-fg text-[13px] tabular-nums" dir="ltr">
          {row.occurredAt.slice(0, 10)}
        </span>
      ),
    },
    {
      header: copy('الساعة'),
      render: (row) => (
        <span className="text-fg text-[13px] tabular-nums" dir="ltr">
          {new Date(row.occurredAt).toLocaleTimeString(locale, {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </span>
      ),
    },
    {
      header: copy('نوع الحركة'),
      render: (row) => (
        <span className="text-fg text-[13px]">{copy(LEDGER_TYPE_LABELS[row.entryType])}</span>
      ),
    },
    {
      header: copy('الدين'),
      align: 'end',
      render: (row) =>
        row.debit !== '0.00' ? (
          <MoneyText value={row.debit} currency={currency} tone="debit" withSymbol={false} />
        ) : (
          <span className="text-fg-subtle">—</span>
        ),
    },
    {
      header: copy('المدفوع'),
      align: 'end',
      render: (row) =>
        row.credit !== '0.00' ? (
          <MoneyText value={row.credit} currency={currency} tone="credit" withSymbol={false} />
        ) : (
          <span className="text-fg-subtle">—</span>
        ),
    },
    {
      header: copy('الرصيد بعد'),
      align: 'end',
      render: (row) => (
        <MoneyText value={row.runningBalance} currency={currency} tone="auto" withSymbol={false} />
      ),
    },
  ];

  const orderColumns: Column<Order>[] = [
    {
      header: copy('رقم الطلب'),
      render: (row) => (
        <span className="text-accent font-medium">{displayOrderNumber(row.number)}</span>
      ),
    },
    {
      header: copy('التاريخ'),
      hideBelow: 'md',
      render: (row) => (
        <span className="text-fg text-[13px] tabular-nums" dir="ltr">
          {row.issuedAt.slice(0, 10)}
        </span>
      ),
    },
    {
      header: copy('الحالة'),
      render: (row) => (
        <StatusBadge tone={ORDER_STATUS_BADGE[row.status].tone}>
          {row.netTotal === '0.00' && row.returnedAmount !== '0.00'
            ? currentLocale() === 'he'
              ? 'הוחזר במלואו'
              : copy('مرتجع بالكامل')
            : ORDER_STATUS_LABELS[row.status]}
        </StatusBadge>
      ),
    },
    {
      header: copy('الإجمالي'),
      align: 'end',
      render: (row) => (
        <MoneyText value={row.netTotal ?? row.total} currency={currency} withSymbol={false} />
      ),
    },
    {
      header: copy('المتبقي'),
      align: 'end',
      hideBelow: 'sm',
      render: (row) =>
        row.remainingAmount !== '0.00' ? (
          <MoneyText
            value={row.remainingAmount}
            currency={currency}
            tone="debit"
            withSymbol={false}
          />
        ) : (
          <span className="text-success">{copy('مسدَّد')}</span>
        ),
    },
  ];

  const paymentColumns: Column<Payment>[] = [
    {
      header: copy('رقم الدفعة'),
      render: (row) => <span className="text-accent font-medium">{row.number}</span>,
    },
    {
      header: copy('التاريخ'),
      render: (row) => (
        <span className="text-fg text-[13px] tabular-nums" dir="ltr">
          {row.paidAt.slice(0, 10)}
        </span>
      ),
    },
    {
      header: copy('الساعة'),
      render: (row) => (
        <span className="text-fg text-[13px] tabular-nums" dir="ltr">
          {new Date(row.paidAt).toLocaleTimeString(locale, {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </span>
      ),
    },
    {
      header: copy('الطريقة'),
      hideBelow: 'sm',
      render: (row) => (
        <span className="text-fg text-[13px]">{copy(PAYMENT_METHOD_LABELS[row.method])}</span>
      ),
    },
    {
      header: copy('المبلغ'),
      align: 'end',
      render: (row) => (
        <MoneyText value={row.amount} currency={currency} tone="credit" withSymbol={false} />
      ),
    },
    {
      header: copy('الحالة'),
      align: 'end',
      render: (row) =>
        row.status === 'REVERSED' ? (
          <StatusBadge tone="debit">{copy('معكوسة')}</StatusBadge>
        ) : (
          <StatusBadge tone="credit">{copy('مقبوضة')}</StatusBadge>
        ),
    },
  ];

  return (
    <div className="space-y-5">
      <Button variant="outline" size="icon" asChild title={copy('العودة إلى الزبائن')}>
        <Link to="/customers" aria-label={copy('العودة إلى صفحة الزبائن')}>
          <ArrowLeft className="rtl:rotate-180" aria-hidden />
        </Link>
      </Button>

      <PageHeader
        title={customer.name}
        icon={Users}
        className="flex-col sm:flex-row"
        breadcrumbs={[{ label: copy('الزبائن'), href: '/customers' }, { label: customer.name }]}
        linkAs={Link}
        actions={
          <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap">
            {can('orders.cancel') && can('orders.read') ? (
              <Button variant="outline" onClick={() => setReturnOpen(true)}>
                <RotateCcw aria-hidden />
                {currentLocale() === 'he' ? 'החזרת הזמנה' : copy('إرجاع طلبية')}
              </Button>
            ) : null}
            {can('orders.create') ? (
              <Button variant="brand" onClick={() => setOrderOpen(true)}>
                <ShoppingBag aria-hidden />
                {copy('طلب جديد')}
              </Button>
            ) : null}
            {can('payments.create') ? (
              <Button variant="accent" onClick={() => setPayOpen(true)}>
                <Plus aria-hidden />
                {copy('تسجيل دفعة')}
              </Button>
            ) : null}
            {can('ledger.read') ? (
              <Button variant="outline" onClick={() => setStatementOpen(true)}>
                <FileText aria-hidden />
                {copy('كشف الحساب')}
              </Button>
            ) : null}
            {can('customers.write') ? (
              <Button variant="outline" onClick={() => setEditOpen(true)}>
                <Pencil aria-hidden />
                {copy('تعديل')}
              </Button>
            ) : null}
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* بطاقة الزبون */}
        <Card className="lg:col-span-1">
          <CardBody className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="min-w-0">
                <p className="text-fg truncate text-lg font-bold">{customer.name}</p>
              </div>
            </div>

            <dl className="border-border space-y-2.5 border-t pt-4 text-[13px]">
              {customer.company ? <Info label={copy('الشركة')} value={customer.company} /> : null}
              {customer.phone ? <Info label={copy('الهاتف')} value={customer.phone} ltr /> : null}
              {customer.email ? <Info label={copy('البريد')} value={customer.email} ltr /> : null}
              {customer.city ? <Info label={copy('المدينة')} value={customer.city} /> : null}
              {customer.taxNumber ? (
                <Info label={copy('الرقم الضريبي')} value={customer.taxNumber} ltr />
              ) : null}
              <Info
                label={copy('يوم السداد الشهري')}
                value={formatDueDay(customer.paymentDueDay, locale)}
              />
            </dl>
          </CardBody>
        </Card>

        {/* البطاقات المالية */}
        <div className="lg:col-span-2">
          {summaryQuery.isLoading ? (
            <StatCardsSkeleton count={3} />
          ) : summary ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
              <StatCard
                label={copy('الرصيد الحالي')}
                money={toMoneyString(negate(customer.balance), 2)}
                currency={currency}
                moneyTone="auto"
                icon={Wallet}
                tone={
                  customer.accountState === 'DEBIT'
                    ? 'debit'
                    : customer.accountState === 'CREDIT'
                      ? 'credit'
                      : 'neutral'
                }
                className={
                  customer.accountState === 'DEBIT'
                    ? '!border-danger/30 !bg-danger-soft'
                    : customer.accountState === 'CREDIT'
                      ? '!border-success/30 !bg-success-soft'
                      : '!bg-card'
                }
              />
              <StatCard
                label={debtLimitLabel}
                money={customer.creditLimit}
                currency={currency}
                icon={CreditCard}
                tone="accent"
                sublabel={copy('المتاح: {{value0}}', { value0: customer.availableCredit })}
              />
              <StatCard
                label={copy('مجموع الطلبات')}
                value={summary.totalOrders}
                icon={ShoppingBag}
                tone="purple"
                className="col-span-2 sm:col-span-1"
              />
            </div>
          ) : null}

          {summary?.paymentDueReached || debtLimitReached ? (
            <div className="rounded-card border-danger/30 bg-danger-soft mt-4 flex flex-wrap items-center justify-between gap-3 border px-4 py-3">
              <p className="text-danger text-sm font-semibold">
                {reminderMessage} — {outstandingBalanceLabel}:{' '}
                <MoneyText value={customer.balance} currency={currency} tone="debit" />
              </p>
              {whatsappPhone(customer.phone) ? (
                <Button variant="outline" size="sm" asChild>
                  <a
                    href={whatsappPaymentReminderUrl(
                      customer.phone!,
                      customer.name,
                      customer.balance,
                      currency,
                      locale,
                      summary?.paymentDueReached ? undefined : customer.creditLimit,
                    )}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <WhatsAppIcon className="text-success" aria-hidden />
                    {
                      {
                        ar: 'إرسال تذكير بالسداد',
                        he: 'שליחת תזכורת לתשלום',
                        en: 'Send payment reminder',
                      }[locale]
                    }
                  </a>
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      {/* ── معلومات الحساب المختصرة ───────────────────────────────────── */}
      {summary ? (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
          <InsightCard label={copy('استخدام الائتمان')}>
            {summary.creditUsagePct === null ? (
              <span className="text-fg-subtle text-sm">{copy('بلا حد')}</span>
            ) : (
              <div className="space-y-1">
                <span className="text-fg text-sm font-semibold tabular-nums">
                  {summary.creditUsagePct}%
                </span>
                <div className="rounded-pill bg-card-muted h-1.5 w-full overflow-hidden">
                  <div
                    className={`rounded-pill h-full ${
                      summary.creditUsagePct >= 100
                        ? 'bg-danger'
                        : summary.creditUsagePct >= 80
                          ? 'bg-warning'
                          : 'bg-success'
                    }`}
                    style={{ width: `${Math.min(100, summary.creditUsagePct)}%` }}
                  />
                </div>
              </div>
            )}
          </InsightCard>
          <InsightCard label={copy('آخر طلب')}>
            <DateOrDash value={summary.lastOrderAt} />
          </InsightCard>
          <InsightCard label={copy('آخر دفعة')}>
            <DateOrDash value={summary.lastPaymentAt} />
          </InsightCard>
          <InsightCard label={copy('زبون منذ')}>
            <DateOrDash value={customer.createdAt} />
          </InsightCard>
        </div>
      ) : null}

      {/* ── تفاصيل حساب الزبون ─────────────────────────────────────────── */}
      <Card>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="overflow-x-auto px-5 pt-2">
            <TabsList>
              <TabsTrigger value="orders">{copy('الطلبات')}</TabsTrigger>
              {can('ledger.read') ? (
                <TabsTrigger value="ledger">{copy('دفتر الحركات')}</TabsTrigger>
              ) : null}
              <TabsTrigger value="payments">{copy('الدفعات')}</TabsTrigger>
              <TabsTrigger value="notes">{copy('الملاحظات')}</TabsTrigger>
            </TabsList>
          </div>

          {/* الطلبات */}
          <TabsContent value="orders">
            <DataTable
              caption={copy('طلبات {{value0}}', { value0: customer.name })}
              columns={orderColumns}
              rows={ordersQuery.data?.items ?? []}
              rowKey={(r) => r.id}
              loading={ordersQuery.isLoading}
              onRowClick={(r) => setSelectedOrderId(r.id)}
              empty={{ title: copy('لا توجد طلبات لهذا الزبون') }}
              className="border-0 shadow-none"
            />
          </TabsContent>

          {/* دفتر الحركات */}
          {can('ledger.read') ? (
            <TabsContent value="ledger">
              <CardHeader
                title={copy('الحركات المالية')}
                action={
                  <button
                    type="button"
                    onClick={() => setStatementOpen(true)}
                    className="text-accent text-[13px] font-medium hover:underline"
                  >
                    {copy('كشف الحساب الكامل')}
                  </button>
                }
              />
              <DataTable
                caption={copy('حركات حساب {{value0}}', { value0: customer.name })}
                columns={ledgerColumns}
                rows={ledgerQuery.data?.items ?? []}
                rowKey={(r) => r.id}
                loading={ledgerQuery.isLoading}
                empty={{
                  title: copy('لا توجد حركات بعد'),
                  description: copy('تظهر الحركات عند تأكيد طلب أو تسجيل دفعة.'),
                }}
                className="border-0 shadow-none"
              />
            </TabsContent>
          ) : null}

          {/* الدفعات */}
          <TabsContent value="payments">
            <DataTable
              caption={copy('دفعات {{value0}}', { value0: customer.name })}
              columns={paymentColumns}
              rows={paymentsQuery.data?.items ?? []}
              rowKey={(r) => r.id}
              loading={paymentsQuery.isLoading}
              empty={{ title: copy('لا توجد دفعات لهذا الزبون') }}
              className="border-0 shadow-none"
            />
          </TabsContent>

          {/* الملاحظات */}
          <TabsContent value="notes">
            <CardBody>
              <div className="flex items-start gap-3">
                <FileText className="text-fg-subtle mt-0.5 size-5" aria-hidden />
                <p className="text-fg-muted text-sm">
                  {customer.notes || copy('لا توجد ملاحظات.')}
                </p>
              </div>
            </CardBody>
          </TabsContent>
        </Tabs>
      </Card>

      <CustomerFormDialog open={editOpen} onOpenChange={setEditOpen} customer={customer} />
      <ReturnOrderDialog
        key={customer.id}
        open={returnOpen}
        onOpenChange={setReturnOpen}
        customerId={customer.id}
      />
      <RecordPaymentDialog open={payOpen} onOpenChange={setPayOpen} fixedCustomerId={customer.id} />
      <CreateOrderDialog
        open={orderOpen}
        onOpenChange={setOrderOpen}
        fixedCustomerId={customer.id}
      />
      <CustomerStatementDialog
        open={statementOpen}
        onOpenChange={setStatementOpen}
        customer={customer}
        currency={currency}
      />
      <OrderDetailsDialog
        orderId={selectedOrderId}
        open={Boolean(selectedOrderId)}
        onOpenChange={(open) => {
          if (!open) setSelectedOrderId(undefined);
        }}
      />
    </div>
  );
}

function InsightCard({ label, children }: { label: string; children: ReactNode }) {
  useCopy();

  return (
    <Card>
      <CardBody className="min-h-28 p-5">
        <p className="text-fg-muted mb-3 text-sm font-medium">{label}</p>
        {children}
      </CardBody>
    </Card>
  );
}

function DateOrDash({ value }: { value: string | null }) {
  useCopy();

  if (!value) return <span className="text-fg-subtle text-sm">—</span>;
  return (
    <span className="text-fg text-sm tabular-nums" dir="ltr">
      {value.slice(0, 10)}
    </span>
  );
}

function Info({ label, value, ltr }: { label: string; value: string; ltr?: boolean }) {
  useCopy();

  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-fg-muted shrink-0">{label}</dt>
      <dd className={`text-fg truncate ${ltr ? 'tabular-nums' : ''}`} dir={ltr ? 'ltr' : undefined}>
        {value}
      </dd>
    </div>
  );
}

function formatDueDay(day: number, locale: 'ar' | 'he' | 'en'): string {
  if (locale === 'ar') return copy('يوم {{value0}} من كل شهر', { value0: day });
  if (locale === 'he') return `בכל ${day} בחודש`;
  return `Day ${day} of every month`;
}

function whatsappPhone(phone: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 9) return null;
  return digits.startsWith('0') ? `972${digits.slice(1)}` : digits;
}

function whatsappPaymentReminderUrl(
  phone: string,
  customerName: string,
  balance: string,
  currency: CurrencyCode,
  locale: 'ar' | 'he' | 'en',
  creditLimit?: string,
): string {
  const amount = formatMoney(balance, { currency });
  const limit = creditLimit === undefined ? null : formatMoney(creditLimit, { currency });
  const message = limit
    ? {
        ar: `مرحبًا ${customerName}، نود تذكيرك بأن الدين الحالي بلغ ${amount} وقد وصل أو تخطى الحد الأقصى المسموح به وهو ${limit}. نرجو لطفًا المبادرة إلى سداد الدين في أقرب وقت. شكرًا لتعاونك.`,
        he: `שלום ${customerName}, החוב הנוכחי הוא ${amount} והגיע או עבר את המסגרת המותרת של ${limit}. נשמח להסדרת התשלום בהקדם. תודה.`,
        en: `Hello ${customerName}, your current debt of ${amount} has reached or exceeded your limit of ${limit}. Please arrange payment. Thank you.`,
      }[locale]
    : {
        ar: `مرحبًا ${customerName}، نود تذكيرك بأن موعد سداد الحساب قد حل، والرصيد المستحق حاليًا هو ${amount}. نرجو لطفًا المبادرة إلى السداد. شكرًا لتعاونك.`,
        he: `שלום ${customerName}, ברצוננו להזכיר שמועד תשלום החשבון הגיע, והיתרה לתשלום כעת היא ${amount}. נשמח להסדרת התשלום. תודה על שיתוף הפעולה.`,
        en: `Hello ${customerName}, this is a kind reminder that your account payment is due. The current outstanding balance is ${amount}. Please arrange payment at your earliest convenience. Thank you.`,
      }[locale];
  return `https://wa.me/${whatsappPhone(phone) ?? ''}?text=${encodeURIComponent(message)}`;
}
