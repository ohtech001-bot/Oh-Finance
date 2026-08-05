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
import { formatMoney, negate, toMoneyString, type CurrencyCode } from '@oh/money';
import {
  Button,
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
  MessageCircle,
  Pencil,
  Plus,
  ShoppingBag,
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
              : 'تعذّر تحميل الزبون.'
          }
          onRetry={() => void customerQuery.refetch()}
        />
      </Card>
    );
  }

  const customer = customerQuery.data;
  const summary = summaryQuery.data;

  const ledgerColumns: Column<LedgerEntry>[] = [
    {
      header: 'التاريخ',
      render: (row) => (
        <span className="text-fg text-[13px] tabular-nums" dir="ltr">
          {row.occurredAt.slice(0, 10)}
        </span>
      ),
    },
    {
      header: 'الساعة',
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
      header: 'نوع الحركة',
      render: (row) => (
        <span className="text-fg text-[13px]">{LEDGER_TYPE_LABELS[row.entryType]}</span>
      ),
    },
    {
      header: 'الدين',
      align: 'end',
      render: (row) =>
        row.debit !== '0.00' ? (
          <MoneyText value={row.debit} currency={currency} tone="debit" withSymbol={false} />
        ) : (
          <span className="text-fg-subtle">—</span>
        ),
    },
    {
      header: 'المدفوع',
      align: 'end',
      render: (row) =>
        row.credit !== '0.00' ? (
          <MoneyText value={row.credit} currency={currency} tone="credit" withSymbol={false} />
        ) : (
          <span className="text-fg-subtle">—</span>
        ),
    },
    {
      header: 'الرصيد بعد',
      align: 'end',
      render: (row) => (
        <MoneyText value={row.runningBalance} currency={currency} tone="auto" withSymbol={false} />
      ),
    },
  ];

  const orderColumns: Column<Order>[] = [
    {
      header: 'رقم الطلب',
      render: (row) => (
        <span className="text-accent font-medium">{displayOrderNumber(row.number)}</span>
      ),
    },
    {
      header: 'التاريخ',
      hideBelow: 'md',
      render: (row) => (
        <span className="text-fg text-[13px] tabular-nums" dir="ltr">
          {row.issuedAt.slice(0, 10)}
        </span>
      ),
    },
    {
      header: 'الحالة',
      render: (row) => (
        <StatusBadge tone={ORDER_STATUS_BADGE[row.status].tone}>
          {ORDER_STATUS_LABELS[row.status]}
        </StatusBadge>
      ),
    },
    {
      header: 'الإجمالي',
      align: 'end',
      render: (row) => <MoneyText value={row.total} currency={currency} withSymbol={false} />,
    },
    {
      header: 'المتبقي',
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
          <span className="text-success">مسدَّد</span>
        ),
    },
  ];

  const paymentColumns: Column<Payment>[] = [
    {
      header: 'رقم الدفعة',
      render: (row) => <span className="text-accent font-medium">{row.number}</span>,
    },
    {
      header: 'التاريخ',
      render: (row) => (
        <span className="text-fg text-[13px] tabular-nums" dir="ltr">
          {row.paidAt.slice(0, 10)}
        </span>
      ),
    },
    {
      header: 'الساعة',
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
      header: 'الطريقة',
      hideBelow: 'sm',
      render: (row) => (
        <span className="text-fg text-[13px]">{PAYMENT_METHOD_LABELS[row.method]}</span>
      ),
    },
    {
      header: 'المبلغ',
      align: 'end',
      render: (row) => (
        <MoneyText value={row.amount} currency={currency} tone="credit" withSymbol={false} />
      ),
    },
    {
      header: 'الحالة',
      align: 'end',
      render: (row) =>
        row.status === 'REVERSED' ? (
          <StatusBadge tone="debit">معكوسة</StatusBadge>
        ) : (
          <StatusBadge tone="credit">مقبوضة</StatusBadge>
        ),
    },
  ];

  return (
    <div className="space-y-5">
      <Button variant="outline" size="icon" asChild title="العودة إلى الزبائن">
        <Link to="/customers" aria-label="العودة إلى صفحة الزبائن">
          <ArrowLeft className="rtl:rotate-180" aria-hidden />
        </Link>
      </Button>

      <PageHeader
        title={customer.name}
        icon={Users}
        className="flex-col sm:flex-row"
        breadcrumbs={[{ label: 'الزبائن', href: '/customers' }, { label: customer.name }]}
        linkAs={Link}
        actions={
          <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap">
            {can('orders.create') ? (
              <Button variant="brand" onClick={() => setOrderOpen(true)}>
                <ShoppingBag aria-hidden />
                طلب جديد
              </Button>
            ) : null}
            {can('payments.create') ? (
              <Button variant="accent" onClick={() => setPayOpen(true)}>
                <Plus aria-hidden />
                تسجيل دفعة
              </Button>
            ) : null}
            {can('ledger.read') ? (
              <Button variant="outline" onClick={() => setStatementOpen(true)}>
                <FileText aria-hidden />
                كشف الحساب
              </Button>
            ) : null}
            {can('customers.write') ? (
              <Button variant="outline" onClick={() => setEditOpen(true)}>
                <Pencil aria-hidden />
                تعديل
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
              {customer.company ? <Info label="الشركة" value={customer.company} /> : null}
              {customer.phone ? <Info label="الهاتف" value={customer.phone} ltr /> : null}
              {customer.email ? <Info label="البريد" value={customer.email} ltr /> : null}
              {customer.city ? <Info label="المدينة" value={customer.city} /> : null}
              {customer.taxNumber ? (
                <Info label="الرقم الضريبي" value={customer.taxNumber} ltr />
              ) : null}
              <Info
                label="يوم السداد الشهري"
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
                label="الرصيد الحالي"
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
                sublabel={`المتاح: ${customer.availableCredit}`}
              />
              <StatCard
                label="مجموع الطلبات"
                value={summary.totalOrders}
                icon={ShoppingBag}
                tone="purple"
                className="col-span-2 sm:col-span-1"
              />
            </div>
          ) : null}

          {summary?.paymentDueReached ? (
            <div className="rounded-card border-danger/30 bg-danger-soft mt-4 flex flex-wrap items-center justify-between gap-3 border px-4 py-3">
              <p className="text-danger text-sm font-semibold">
                {paymentDueMessage} — {outstandingBalanceLabel}:{' '}
                <MoneyText value={summary.paymentDueAmount} currency={currency} tone="debit" />
              </p>
              {whatsappPhone(customer.phone) ? (
                <Button variant="outline" size="sm" asChild>
                  <a
                    href={whatsappPaymentReminderUrl(
                      customer.phone!,
                      customer.name,
                      summary.paymentDueAmount,
                      currency,
                      locale,
                    )}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <MessageCircle className="text-success" aria-hidden />
                    إرسال تذكير
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
          <InsightCard label="استخدام الائتمان">
            {summary.creditUsagePct === null ? (
              <span className="text-fg-subtle text-sm">بلا حد</span>
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
          <InsightCard label="آخر طلب">
            <DateOrDash value={summary.lastOrderAt} />
          </InsightCard>
          <InsightCard label="آخر دفعة">
            <DateOrDash value={summary.lastPaymentAt} />
          </InsightCard>
          <InsightCard label="زبون منذ">
            <DateOrDash value={customer.createdAt} />
          </InsightCard>
        </div>
      ) : null}

      {/* ── تفاصيل حساب الزبون ─────────────────────────────────────────── */}
      <Card>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="overflow-x-auto px-5 pt-2">
            <TabsList>
              <TabsTrigger value="orders">الطلبات</TabsTrigger>
              {can('ledger.read') ? <TabsTrigger value="ledger">دفتر الحركات</TabsTrigger> : null}
              <TabsTrigger value="payments">الدفعات</TabsTrigger>
              <TabsTrigger value="notes">الملاحظات</TabsTrigger>
            </TabsList>
          </div>

          {/* الطلبات */}
          <TabsContent value="orders">
            <DataTable
              caption={`طلبات ${customer.name}`}
              columns={orderColumns}
              rows={ordersQuery.data?.items ?? []}
              rowKey={(r) => r.id}
              loading={ordersQuery.isLoading}
              onRowClick={(r) => setSelectedOrderId(r.id)}
              empty={{ title: 'لا توجد طلبات لهذا الزبون' }}
              className="border-0 shadow-none"
            />
          </TabsContent>

          {/* دفتر الحركات */}
          {can('ledger.read') ? (
            <TabsContent value="ledger">
              <CardHeader
                title="الحركات المالية"
                action={
                  <button
                    type="button"
                    onClick={() => setStatementOpen(true)}
                    className="text-accent text-[13px] font-medium hover:underline"
                  >
                    كشف الحساب الكامل
                  </button>
                }
              />
              <DataTable
                caption={`حركات حساب ${customer.name}`}
                columns={ledgerColumns}
                rows={ledgerQuery.data?.items ?? []}
                rowKey={(r) => r.id}
                loading={ledgerQuery.isLoading}
                empty={{
                  title: 'لا توجد حركات بعد',
                  description: 'تظهر الحركات عند تأكيد طلب أو تسجيل دفعة.',
                }}
                className="border-0 shadow-none"
              />
            </TabsContent>
          ) : null}

          {/* الدفعات */}
          <TabsContent value="payments">
            <DataTable
              caption={`دفعات ${customer.name}`}
              columns={paymentColumns}
              rows={paymentsQuery.data?.items ?? []}
              rowKey={(r) => r.id}
              loading={paymentsQuery.isLoading}
              empty={{ title: 'لا توجد دفعات لهذا الزبون' }}
              className="border-0 shadow-none"
            />
          </TabsContent>

          {/* الملاحظات */}
          <TabsContent value="notes">
            <CardBody>
              <div className="flex items-start gap-3">
                <FileText className="text-fg-subtle mt-0.5 size-5" aria-hidden />
                <p className="text-fg-muted text-sm">{customer.notes || 'لا توجد ملاحظات.'}</p>
              </div>
            </CardBody>
          </TabsContent>
        </Tabs>
      </Card>

      <CustomerFormDialog open={editOpen} onOpenChange={setEditOpen} customer={customer} />
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
  if (!value) return <span className="text-fg-subtle text-sm">—</span>;
  return (
    <span className="text-fg text-sm tabular-nums" dir="ltr">
      {value.slice(0, 10)}
    </span>
  );
}

function Info({ label, value, ltr }: { label: string; value: string; ltr?: boolean }) {
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
  if (locale === 'ar') return `يوم ${day} من كل شهر`;
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
): string {
  const amount = formatMoney(balance, { currency });
  const message = {
    ar: `مرحبًا ${customerName}، نود تذكيرك بأن موعد سداد الحساب قد حل، والرصيد المستحق حاليًا هو ${amount}. نرجو لطفًا المبادرة إلى السداد. شكرًا لتعاونك.`,
    he: `שלום ${customerName}, ברצוננו להזכיר שמועד תשלום החשבון הגיע, והיתרה לתשלום כעת היא ${amount}. נשמח להסדרת התשלום. תודה על שיתוף הפעולה.`,
    en: `Hello ${customerName}, this is a kind reminder that your account payment is due. The current outstanding balance is ${amount}. Please arrange payment at your earliest convenience. Thank you.`,
  }[locale];
  return `https://wa.me/${whatsappPhone(phone) ?? ''}?text=${encodeURIComponent(message)}`;
}
