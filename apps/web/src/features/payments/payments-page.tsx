import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Banknote, CalendarDays, ChevronLeft, Plus, Wallet } from 'lucide-react';
import { PAYMENT_METHOD_LABELS, type Payment, type PaymentListQuery } from '@oh/contracts';
import type { CurrencyCode } from '@oh/money';
import {
  Button,
  DataTable,
  DateRangeFilter,
  FilterBar,
  MoneyText,
  PageHeader,
  Pagination,
  SearchFilter,
  StatCard,
  StatCardsSkeleton,
  StatusBadge,
  type Column,
} from '@oh/ui';
import { ApiRequestError } from '@/lib/api';
import { useAuth } from '@/app/auth-context';
import { usePayments, usePaymentStats } from './api';
import { RecordPaymentDialog } from './record-payment-dialog';

export function PaymentsPage() {
  const { t } = useTranslation();
  const { user, can } = useAuth();
  const currency = (user?.store?.currency ?? 'ILS') as CurrencyCode;

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const [recordOpen, setRecordOpen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

  // اختصار Ctrl+P: يفتح حوار تسجيل الدفعة عبر ?new=1 ثم يمسح المَعلمة.
  useEffect(() => {
    if (searchParams.get('new') === '1') {
      if (can('payments.create')) setRecordOpen(true);
      searchParams.delete('new');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams, can]);

  const query: Partial<PaymentListQuery> = {
    page,
    pageSize,
    search: search || undefined,
    from: from || undefined,
    to: to || undefined,
  };

  const list = usePayments(query);
  const stats = usePaymentStats({ from: from || undefined, to: to || undefined });

  const isFiltered = search !== '' || from !== '' || to !== '';
  const resetFilters = () => {
    setSearch('');
    setFrom('');
    setTo('');
    setPage(1);
  };

  const columns: Column<Payment>[] = [
    {
      key: 'number',
      header: 'رقم الدفعة',
      render: (row) => <span className="text-accent font-semibold">{row.number}</span>,
    },
    {
      header: 'الزبون',
      render: (row) => (
        <Link to={`/customers/${row.customerId}`} className="min-w-0 hover:underline">
          <p className="text-fg truncate text-sm">{row.customerName}</p>
          <p className="text-fg-muted truncate text-xs">{row.customerCode}</p>
        </Link>
      ),
    },
    {
      key: 'paidAt',
      header: 'التاريخ والوقت',
      hideBelow: 'md',
      render: (row) => {
        const d = new Date(row.paidAt);
        return (
          <div className="text-[13px]">
            <p className="text-fg tabular-nums" dir="ltr">
              {row.paidAt.slice(0, 10)}
            </p>
            <p className="text-fg-muted tabular-nums" dir="ltr">
              {d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
        );
      },
    },
    {
      header: 'طريقة الدفع',
      align: 'center',
      render: (row) => <StatusBadge tone="credit">{PAYMENT_METHOD_LABELS[row.method]}</StatusBadge>,
    },
    {
      key: 'amount',
      header: 'المبلغ المدفوع',
      align: 'end',
      render: (row) => <MoneyText value={row.amount} currency={currency} tone="credit" />,
    },
    {
      header: 'الرصيد قبل',
      align: 'end',
      hideBelow: 'lg',
      render: (row) => (
        <MoneyText
          value={row.balanceBefore}
          currency={currency}
          tone="balance"
          withSymbol={false}
        />
      ),
    },
    {
      header: 'الرصيد بعد',
      align: 'end',
      hideBelow: 'lg',
      render: (row) => (
        <MoneyText value={row.balanceAfter} currency={currency} tone="balance" withSymbol={false} />
      ),
    },
    {
      header: t('common.status'),
      align: 'center',
      render: (row) =>
        row.status === 'REVERSED' ? (
          <StatusBadge tone="debit">معكوسة</StatusBadge>
        ) : (
          <StatusBadge tone="credit">مقبوضة</StatusBadge>
        ),
    },
  ];

  const s = stats.data;

  return (
    <div className="space-y-5">
      <PageHeader
        title={t('nav.payments')}
        icon={Wallet}
        breadcrumbs={[{ label: t('nav.dashboard'), href: '/' }, { label: t('nav.payments') }]}
        linkAs={Link}
        actions={
          can('payments.create') ? (
            <Button variant="brand" onClick={() => setRecordOpen(true)}>
              <Plus aria-hidden />
              تسجيل دفعة جديدة
            </Button>
          ) : undefined
        }
      />

      {stats.isLoading ? (
        <StatCardsSkeleton count={2} />
      ) : s ? (
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          <StatCard
            label="إجمالي المدفوعات"
            money={s.totalAmount}
            currency={currency}
            moneyTone="credit"
            icon={Wallet}
            tone="credit"
            sublabel={`${s.totalCount} دفعة`}
          />
          <StatCard
            label="المدفوعات النقدية"
            money={s.byMethod.CASH.amount}
            currency={currency}
            icon={Banknote}
            tone="credit"
            sublabel={`${s.byMethod.CASH.count} دفعة`}
          />
        </div>
      ) : null}

      <FilterBar>
        <SearchFilter
          value={search}
          onChange={(v) => {
            setSearch(v);
            setPage(1);
          }}
          placeholder="ابحث برقم الدفعة أو الزبون…"
        />
        <DateRangeFilter
          from={from}
          to={to}
          onFromChange={(v) => {
            setFrom(v);
            setPage(1);
          }}
          onToChange={(v) => {
            setTo(v);
            setPage(1);
          }}
        />
      </FilterBar>

      <div>
        <DataTable
          caption="قائمة الدفعات المستلمة"
          columns={columns}
          rows={list.data?.items ?? []}
          rowKey={(r) => r.id}
          loading={list.isLoading}
          error={
            list.isError
              ? {
                  message:
                    list.error instanceof ApiRequestError
                      ? list.error.message
                      : 'تعذّر تحميل الدفعات.',
                  requestId:
                    list.error instanceof ApiRequestError ? list.error.requestId : undefined,
                }
              : null
          }
          onRetry={() => void list.refetch()}
          isFiltered={isFiltered}
          onResetFilters={resetFilters}
          empty={{
            title: 'لا توجد دفعات بعد',
            description: 'سجّل أول دفعة من زبائنك.',
            action: can('payments.create')
              ? { label: 'تسجيل دفعة', onClick: () => setRecordOpen(true) }
              : undefined,
          }}
          mobileRender={(row) => {
            const paidAt = new Date(row.paidAt);
            return (
              <article className="border-border bg-card rounded-card shadow-card border p-4">
                <div className="flex items-start gap-3">
                  <ChevronLeft className="text-fg-subtle mt-1 size-5 shrink-0" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <Link
                      to={`/customers/${row.customerId}`}
                      className="text-fg block truncate text-base font-bold hover:underline"
                    >
                      {row.customerName}
                    </Link>
                    <p className="text-fg-muted mt-0.5 text-xs">{row.number}</p>
                    <div className="text-fg-muted mt-2 flex items-center gap-1.5 text-xs">
                      <CalendarDays className="size-3.5" aria-hidden />
                      <span dir="ltr">{row.paidAt.slice(0, 10)}</span>
                      <span dir="ltr">
                        {paidAt.toLocaleTimeString('en-GB', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  </div>
                  <div className="text-end">
                    <MoneyText value={row.amount} currency={currency} tone="credit" size="lg" />
                    <StatusBadge tone={row.status === 'REVERSED' ? 'debit' : 'credit'}>
                      {row.status === 'REVERSED' ? 'معكوسة' : 'مقبوضة'}
                    </StatusBadge>
                  </div>
                </div>

                <div className="border-border-subtle mt-3 flex items-center justify-between gap-3 border-t pt-3">
                  <StatusBadge tone="credit">{PAYMENT_METHOD_LABELS[row.method]}</StatusBadge>
                </div>
              </article>
            );
          }}
        />

        {list.data && list.data.total > 0 ? (
          <div className="rounded-b-card border-border bg-card border-x border-b">
            <Pagination
              page={list.data.page}
              pageSize={list.data.pageSize}
              total={list.data.total}
              totalPages={list.data.totalPages}
              onPageChange={setPage}
              onPageSizeChange={(sz) => {
                setPageSize(sz);
                setPage(1);
              }}
              itemLabel="دفعة"
            />
          </div>
        ) : null}
      </div>

      <RecordPaymentDialog open={recordOpen} onOpenChange={setRecordOpen} />
    </div>
  );
}
