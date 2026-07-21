import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Banknote, Plus, Undo2, Wallet } from 'lucide-react';
import { PAYMENT_METHOD_LABELS, type Payment, type PaymentListQuery } from '@oh/contracts';
import type { CurrencyCode } from '@oh/money';
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
  DateRangeFilter,
  Field,
  FilterBar,
  Input,
  MoneyText,
  PageHeader,
  Pagination,
  SearchFilter,
  StatCard,
  StatCardsSkeleton,
  StatusBadge,
  toast,
  type Column,
} from '@oh/ui';
import { ApiRequestError } from '@/lib/api';
import { useAuth } from '@/app/auth-context';
import { usePayments, usePaymentStats, useReversePayment } from './api';
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
  const [reverseTarget, setReverseTarget] = useState<Payment | null>(null);
  const [reverseReason, setReverseReason] = useState('');

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
  const reverse = useReversePayment(reverseTarget?.id ?? '');

  const isFiltered = search !== '' || from !== '' || to !== '';
  const resetFilters = () => {
    setSearch('');
    setFrom('');
    setTo('');
    setPage(1);
  };

  const doReverse = () => {
    if (!reverseTarget || reverseReason.trim().length < 5) return;
    reverse.mutate(
      { reason: reverseReason.trim() },
      {
        onSuccess: () => {
          toast.success('عُكست الدفعة');
          setReverseTarget(null);
          setReverseReason('');
        },
        onError: (e) => {
          if (e instanceof ApiRequestError) toast.apiError(e.message, e.requestId);
          else toast.error('تعذّر عكس الدفعة.');
        },
      },
    );
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
          <StatusBadge tone="credit">مُسجَّلة</StatusBadge>
        ),
    },
    {
      header: t('common.actions'),
      align: 'end',
      width: '130px',
      render: (row) =>
        can('payments.reverse') && row.status === 'POSTED' ? (
          <Button variant="outline" size="sm" onClick={() => setReverseTarget(row)}>
            <Undo2 className="text-danger" aria-hidden />
            عكس الدفعة
          </Button>
        ) : (
          <span className="text-fg-subtle">—</span>
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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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

      {/* حوار عكس الدفعة — السبب إلزامي */}
      <Dialog
        open={reverseTarget !== null}
        onOpenChange={(o) => {
          if (!o) {
            setReverseTarget(null);
            setReverseReason('');
          }
        }}
      >
        <DialogContent size="sm" onOpenAutoFocus={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>عكس الدفعة {reverseTarget?.number}</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <p className="text-fg-muted mb-4 text-sm">
              يُنشأ قيد عكس مضاد يعيد أثر الدفعة على رصيد الزبون. تبقى الدفعة مرئية بحالة «معكوسة»
              ولا تُحذف.
            </p>
            <Field
              label="سبب العكس"
              hint="يُسجَّل في سجل التدقيق."
              error={
                reverseReason.length > 0 && reverseReason.trim().length < 5
                  ? '5 أحرف على الأقل.'
                  : undefined
              }
              required
            >
              {(p) => (
                <Input
                  {...p}
                  value={reverseReason}
                  onChange={(e) => setReverseReason(e.target.value)}
                  placeholder="مثال: دفعة مسجّلة بالخطأ"
                  autoFocus
                />
              )}
            </Field>
          </DialogBody>
          <DialogFooter>
            <Button
              variant="danger"
              onClick={doReverse}
              loading={reverse.isPending}
              disabled={reverseReason.trim().length < 5}
            >
              عكس الدفعة
            </Button>
            <DialogClose asChild>
              <Button variant="outline" disabled={reverse.isPending}>
                إلغاء
              </Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
