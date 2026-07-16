import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ACCOUNT_STATE_LABELS,
  LEDGER_TYPE_LABELS,
  type LedgerEntry,
} from '@oh/contracts';
import type { CurrencyCode } from '@oh/money';
import {
  Avatar,
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
  ACCOUNT_STATUS_BADGE,
  type Column,
} from '@oh/ui';
import { CreditCard, FileText, Pencil, Plus, ShoppingBag, Users, Wallet } from 'lucide-react';
import { ApiRequestError } from '@/lib/api';
import { useAuth } from '@/app/auth-context';
import { useLedger } from '@/features/ledger/api';
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

  const [editOpen, setEditOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [orderOpen, setOrderOpen] = useState(false);

  const customerQuery = useCustomer(id);
  const summaryQuery = useCustomerSummary(id);
  const ledgerQuery = useLedger({ customerId: id, pageSize: 25 });

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
  const badge = ACCOUNT_STATUS_BADGE[customer.accountState];

  const ledgerColumns: Column<LedgerEntry>[] = [
    {
      header: 'التاريخ',
      render: (row) => (
        <span className="tabular-nums text-[13px] text-fg" dir="ltr">
          {row.occurredAt.slice(0, 10)}
        </span>
      ),
    },
    {
      header: 'نوع الحركة',
      render: (row) => <span className="text-[13px] text-fg">{LEDGER_TYPE_LABELS[row.entryType]}</span>,
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
      render: (row) => <MoneyText value={row.runningBalance} currency={currency} tone="balance" withSymbol={false} />,
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title={customer.name}
        icon={Users}
        breadcrumbs={[
          { label: 'الزبائن', href: '/customers' },
          { label: customer.code },
        ]}
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
              <Avatar name={customer.name} size="lg" />
              <div className="min-w-0">
                <p className="truncate text-lg font-bold text-fg">{customer.name}</p>
                <StatusBadge tone={badge.tone}>{badge.label}</StatusBadge>
              </div>
            </div>

            <dl className="space-y-2.5 border-t border-border pt-4 text-[13px]">
              <Info label="رقم الزبون" value={customer.code} />
              {customer.company ? <Info label="الشركة" value={customer.company} /> : null}
              {customer.phone ? <Info label="الهاتف" value={customer.phone} ltr /> : null}
              {customer.email ? <Info label="البريد" value={customer.email} ltr /> : null}
              {customer.city ? <Info label="المدينة" value={customer.city} /> : null}
              {customer.taxNumber ? <Info label="الرقم الضريبي" value={customer.taxNumber} ltr /> : null}
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
                money={customer.balance}
                currency={currency}
                moneyTone="balance"
                icon={Wallet}
                tone={customer.accountState === 'DEBIT' ? 'debit' : 'credit'}
                sublabel={ACCOUNT_STATE_LABELS[customer.accountState]}
              />
              <StatCard
                label="حد الائتمان"
                money={customer.creditLimit}
                currency={currency}
                icon={CreditCard}
                tone="accent"
                sublabel={`المتاح: ${customer.availableCredit}`}
              />
              <StatCard
                label="إجمالي الطلبات"
                money={summary.totalOrdersAmount}
                currency={currency}
                icon={ShoppingBag}
                tone="purple"
                sublabel={`${summary.totalOrders} طلب`}
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
            <div className="mt-4 rounded-card border border-danger/30 bg-danger-soft px-4 py-3">
              <p className="text-sm font-semibold text-danger">
                {summary.overdueOrders} طلب متأخر عن الاستحقاق — بمبلغ{' '}
                <MoneyText value={summary.overdueAmount} currency={currency} tone="debit" withSymbol={false} />
              </p>
            </div>
          ) : null}
        </div>
      </div>

      {/* التبويبات */}
      <Card>
        <Tabs defaultValue="ledger">
          <div className="px-5 pt-2">
            <TabsList>
              <TabsTrigger value="ledger">الحركات المالية</TabsTrigger>
              <TabsTrigger value="notes">الملاحظات</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="ledger">
            <CardHeader
              title="الحركات المالية"
              action={
                <Link to={`/ledger?customerId=${customer.id}`} className="text-[13px] font-medium text-accent hover:underline">
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

          <TabsContent value="notes">
            <CardBody>
              <div className="flex items-start gap-3">
                <FileText className="mt-0.5 size-5 text-fg-subtle" aria-hidden />
                <p className="text-sm text-fg-muted">{customer.notes || 'لا توجد ملاحظات.'}</p>
              </div>
            </CardBody>
          </TabsContent>
        </Tabs>
      </Card>

      <CustomerFormDialog open={editOpen} onOpenChange={setEditOpen} customer={customer} />
      <RecordPaymentDialog open={payOpen} onOpenChange={setPayOpen} fixedCustomerId={customer.id} />
      <CreateOrderDialog open={orderOpen} onOpenChange={setOrderOpen} fixedCustomerId={customer.id} />
    </div>
  );
}

function Info({ label, value, ltr }: { label: string; value: string; ltr?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="shrink-0 text-fg-muted">{label}</dt>
      <dd className={`truncate text-fg ${ltr ? 'tabular-nums' : ''}`} dir={ltr ? 'ltr' : undefined}>
        {value}
      </dd>
    </div>
  );
}
