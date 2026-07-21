import { useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ACTIVITY_CATEGORY_LABELS,
  LEDGER_TYPE_LABELS,
  ORDER_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
  type ActivityCategory,
  type LedgerEntry,
  type Order,
  type Payment,
} from '@oh/contracts';
import { negate, toMoneyString, type CurrencyCode } from '@oh/money';
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
  Pagination,
  SelectFilter,
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
import { CreditCard, FileText, Pencil, Plus, ShoppingBag, Users, Wallet } from 'lucide-react';
import { ApiRequestError } from '@/lib/api';
import { currentLocale } from '@/lib/i18n';
import { useAuth } from '@/app/auth-context';
import { useLedger } from '@/features/ledger/api';
import { useOrders } from '@/features/orders/api';
import { usePayments } from '@/features/payments/api';
import { ActivityFeed } from '@/features/activity/activity-feed';
import { useCustomerActivityFeed } from '@/features/activity/api';
import { RecordPaymentDialog } from '@/features/payments/record-payment-dialog';
import { CreateOrderDialog } from '@/features/orders/create-order-dialog';
import { useCustomer, useCustomerSummary } from './api';
import { CustomerFormDialog } from './customer-form-dialog';

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
  const debtLimitLabel = { ar: 'حد الدين', he: 'מסגרת', en: 'Debt limit' }[currentLocale()];

  const [editOpen, setEditOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [orderOpen, setOrderOpen] = useState(false);
  const [activityPage, setActivityPage] = useState(1);
  const [activityCategory, setActivityCategory] = useState('');

  const customerQuery = useCustomer(id);
  const summaryQuery = useCustomerSummary(id);
  const ledgerQuery = useLedger({ customerId: id, pageSize: 25 });
  const ordersQuery = useOrders({ customerId: id, pageSize: 25 });
  const paymentsQuery = usePayments({ customerId: id, pageSize: 25 });
  const activityFeed = useCustomerActivityFeed(
    id ?? '',
    {
      page: activityPage,
      pageSize: 25,
      category: (activityCategory || undefined) as ActivityCategory | undefined,
    },
    Boolean(id),
  );

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
      header: 'نوع الحركة',
      render: (row) => (
        <span className="text-fg text-[13px]">{LEDGER_TYPE_LABELS[row.entryType]}</span>
      ),
    },
    {
      header: 'المرجع',
      hideBelow: 'md',
      render: (row) => (row.refNumber ? <span className="text-accent">{row.refNumber}</span> : '—'),
    },
    {
      header: 'المدين',
      align: 'end',
      render: (row) =>
        row.debit !== '0.00' ? (
          <MoneyText value={row.debit} currency={currency} tone="debit" withSymbol={false} />
        ) : (
          <span className="text-fg-subtle">—</span>
        ),
    },
    {
      header: 'الدائن',
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
        <MoneyText
          value={row.runningBalance}
          currency={currency}
          tone="balance"
          withSymbol={false}
        />
      ),
    },
  ];

  const orderColumns: Column<Order>[] = [
    {
      header: 'رقم الطلب',
      render: (row) => <span className="text-accent font-medium">{row.number}</span>,
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
      hideBelow: 'md',
      render: (row) => (
        <span className="text-fg text-[13px] tabular-nums" dir="ltr">
          {row.paidAt.slice(0, 10)}
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
          <StatusBadge tone="credit">مُسجَّلة</StatusBadge>
        ),
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title={customer.name}
        icon={Users}
        breadcrumbs={[{ label: 'الزبائن', href: '/customers' }, { label: customer.name }]}
        linkAs={Link}
        actions={
          <div className="flex flex-wrap gap-2">
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
              <Button variant="outline" asChild>
                <Link to={`/ledger?customerId=${customer.id}`}>
                  <FileText aria-hidden />
                  كشف الحساب
                </Link>
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
              <Info label="مدة السداد" value={`${customer.paymentTermDays} يوم`} />
            </dl>
          </CardBody>
        </Card>

        {/* البطاقات المالية */}
        <div className="lg:col-span-2">
          {summaryQuery.isLoading ? (
            <StatCardsSkeleton count={4} />
          ) : summary ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
              />
              <StatCard
                label="إجمالي المدفوعات"
                money={summary.totalPaymentsAmount}
                currency={currency}
                moneyTone="credit"
                icon={CreditCard}
                tone="credit"
                sublabel={`${summary.totalPayments} دفعة`}
              />
            </div>
          ) : null}

          {summary && summary.overdueOrders > 0 ? (
            <div className="rounded-card border-danger/30 bg-danger-soft mt-4 border px-4 py-3">
              <p className="text-danger text-sm font-semibold">
                {summary.overdueOrders} طلب متأخر عن الاستحقاق — بمبلغ{' '}
                <MoneyText
                  value={summary.overdueAmount}
                  currency={currency}
                  tone="debit"
                  withSymbol={false}
                />
              </p>
            </div>
          ) : null}
        </div>
      </div>

      {/* ── معلومات الحساب المختصرة ───────────────────────────────────── */}
      {summary ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
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

      {/* ── التبويبات الستة ────────────────────────────────────────────── */}
      <Card>
        <Tabs defaultValue="overview">
          <div className="overflow-x-auto px-5 pt-2">
            <TabsList>
              <TabsTrigger value="overview">نظرة عامة</TabsTrigger>
              <TabsTrigger value="orders">الطلبات</TabsTrigger>
              {can('ledger.read') ? <TabsTrigger value="ledger">دفتر الحركات</TabsTrigger> : null}
              <TabsTrigger value="payments">الدفعات</TabsTrigger>
              <TabsTrigger value="notes">الملاحظات</TabsTrigger>
              <TabsTrigger value="activity">الخط الزمني</TabsTrigger>
            </TabsList>
          </div>

          {/* نظرة عامة: آخر طلبات + آخر دفعات */}
          <TabsContent value="overview">
            <div className="grid grid-cols-1 gap-4 p-5 lg:grid-cols-2">
              <div>
                <h3 className="text-fg mb-2 text-[13px] font-semibold">آخر الطلبات</h3>
                {(ordersQuery.data?.items ?? []).slice(0, 5).map((o) => (
                  <Link
                    key={o.id}
                    to={`/orders/${o.id}`}
                    className="rounded-ctrl hover:bg-card-muted flex items-center justify-between gap-2 px-2 py-2"
                  >
                    <MoneyText value={o.total} currency={currency} tone="plain" size="sm" />
                    <StatusBadge tone={ORDER_STATUS_BADGE[o.status].tone}>
                      {ORDER_STATUS_BADGE[o.status].label}
                    </StatusBadge>
                    <span className="text-accent flex-1 text-end text-[13px] font-medium">
                      {o.number}
                    </span>
                  </Link>
                ))}
                {(ordersQuery.data?.total ?? 0) === 0 ? (
                  <p className="text-fg-subtle py-4 text-center text-[13px]">لا طلبات.</p>
                ) : null}
              </div>
              <div>
                <h3 className="text-fg mb-2 text-[13px] font-semibold">آخر الدفعات</h3>
                {(paymentsQuery.data?.items ?? []).slice(0, 5).map((p) => (
                  <div
                    key={p.id}
                    className="rounded-ctrl flex items-center justify-between gap-2 px-2 py-2"
                  >
                    <MoneyText value={p.amount} currency={currency} tone="credit" size="sm" />
                    <span className="text-fg-muted text-xs">{PAYMENT_METHOD_LABELS[p.method]}</span>
                    <span className="text-accent flex-1 text-end text-[13px] font-medium">
                      {p.number}
                    </span>
                  </div>
                ))}
                {(paymentsQuery.data?.total ?? 0) === 0 ? (
                  <p className="text-fg-subtle py-4 text-center text-[13px]">لا دفعات.</p>
                ) : null}
              </div>
            </div>
          </TabsContent>

          {/* الطلبات */}
          <TabsContent value="orders">
            <DataTable
              caption={`طلبات ${customer.name}`}
              columns={orderColumns}
              rows={ordersQuery.data?.items ?? []}
              rowKey={(r) => r.id}
              loading={ordersQuery.isLoading}
              onRowClick={(r) => (window.location.href = `/orders/${r.id}`)}
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
                  <Link
                    to={`/ledger?customerId=${customer.id}`}
                    className="text-accent text-[13px] font-medium hover:underline"
                  >
                    كشف الحساب الكامل
                  </Link>
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

          {/* الخط الزمني — أحداث موحّدة من الطلبات والدفعات والحركات والتعديلات */}
          <TabsContent value="activity">
            <div className="flex items-center justify-between px-5 pt-4">
              <h3 className="text-fg text-[13px] font-semibold">الخط الزمني للزبون</h3>
              <SelectFilter
                value={activityCategory}
                onChange={(v) => {
                  setActivityCategory(v);
                  setActivityPage(1);
                }}
                allLabel="كل الأنواع"
                label="النوع"
                options={(['ORDER', 'PAYMENT', 'CUSTOMER', 'LEDGER'] as ActivityCategory[]).map(
                  (c) => ({
                    value: c,
                    label: ACTIVITY_CATEGORY_LABELS[c],
                  }),
                )}
              />
            </div>
            <div className="px-3 pb-2">
              <ActivityFeed
                items={activityFeed.data?.items ?? []}
                loading={activityFeed.isLoading}
                emptyText="لا يوجد نشاط لهذا الزبون بعد."
              />
            </div>
            {activityFeed.data && activityFeed.data.total > activityFeed.data.pageSize ? (
              <Pagination
                page={activityFeed.data.page}
                pageSize={activityFeed.data.pageSize}
                total={activityFeed.data.total}
                totalPages={activityFeed.data.totalPages}
                onPageChange={setActivityPage}
                itemLabel="حدث"
              />
            ) : null}
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
