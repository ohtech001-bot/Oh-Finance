import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  Pencil,
  Plus,
  Printer,
  ShoppingBag,
  Wallet,
} from 'lucide-react';
import type { Order, OrderDetail, OrderListQuery, SessionUser } from '@oh/contracts';
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
  SelectFilter,
  StatCard,
  StatCardsSkeleton,
  StatusBadge,
  toast,
  type Column,
} from '@oh/ui';
import { ApiRequestError, api } from '@/lib/api';
import { useAuth } from '@/app/auth-context';
import { CreateOrderDialog } from './create-order-dialog';
import { OrderDetailsDialog } from './order-details-dialog';
import { useOrderStats, useOrders } from './api';
import { displayOrderNumber } from './order-number';
import { printOrder } from './print-order';

export function OrdersPage() {
  const { t } = useTranslation();
  const { user, can } = useAuth();
  const currency = (user?.store?.currency ?? 'ILS') as CurrencyCode;
  const [searchParams, setSearchParams] = useSearchParams();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState('');
  const [paymentState, setPaymentState] = useState('');
  const [classification, setClassification] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [sort, setSort] = useState<{ key: string; order: 'asc' | 'desc' }>({
    key: 'issuedAt',
    order: 'desc',
  });
  const [createOpen, setCreateOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<OrderDetail | undefined>();
  const detailOrderId = searchParams.get('orderId') ?? undefined;

  useEffect(() => {
    if (searchParams.get('new') !== '1') return;
    if (can('orders.create')) setCreateOpen(true);
    const next = new URLSearchParams(searchParams);
    next.delete('new');
    setSearchParams(next, { replace: true });
  }, [can, searchParams, setSearchParams]);

  const query: Partial<OrderListQuery> = {
    page,
    pageSize,
    search: search || undefined,
    status: paymentState === 'paid' ? 'PAID' : undefined,
    unpaidOnly: paymentState === 'unpaid' ? true : undefined,
    classification:
      classification === 'draft'
        ? 'DRAFT'
        : classification === 'confirmed'
          ? 'CONFIRMED'
          : undefined,
    from: from || undefined,
    to: to || undefined,
    sortBy: sort.key as OrderListQuery['sortBy'],
    sortOrder: sort.order,
  };
  const list = useOrders(query);
  const stats = useOrderStats({});
  const isFiltered =
    search !== '' || paymentState !== '' || classification !== '' || from !== '' || to !== '';

  const setDetailOrder = (id?: string) => {
    const next = new URLSearchParams(searchParams);
    if (id) next.set('orderId', id);
    else next.delete('orderId');
    setSearchParams(next, { replace: true });
  };

  const loadOrder = async (id: string) => api.get<OrderDetail>(`/orders/${id}`);

  const openEdit = async (row: Order) => {
    if (row.status !== 'DRAFT' && row.status !== 'QUOTE') return;
    try {
      setEditingOrder(await loadOrder(row.id));
    } catch (error) {
      if (error instanceof ApiRequestError) toast.apiError(error.message, error.requestId);
      else toast.error('تعذّر تحميل الطلب للتعديل.');
    }
  };

  const runPrint = async (row: Order) => {
    const printWindow = window.open('', '_blank', 'width=420,height=720');
    if (!printWindow) {
      toast.error('اسمح بفتح نافذة الطباعة من المتصفح.');
      return;
    }
    try {
      const [order, freshUser] = await Promise.all([
        loadOrder(row.id),
        api.get<SessionUser>('/auth/me'),
      ]);
      printOrder(order, currency, {
        store: freshUser.store,
        targetWindow: printWindow,
      });
    } catch (error) {
      printWindow.close();
      if (error instanceof ApiRequestError) toast.apiError(error.message, error.requestId);
      else toast.error('تعذّرت طباعة الطلب.');
    }
  };

  const toggleSort = (key: string) =>
    setSort((current) =>
      current.key === key
        ? { key, order: current.order === 'asc' ? 'desc' : 'asc' }
        : { key, order: 'desc' },
    );

  const columns: Column<Order>[] = [
    {
      key: 'number',
      header: 'رقم الطلب',
      render: (row) => (
        <span className="text-accent font-semibold">{displayOrderNumber(row.number)}</span>
      ),
    },
    {
      header: 'الزبون',
      render: (row) => <span className="text-fg font-medium">{row.customerName}</span>,
    },
    {
      key: 'issuedAt',
      header: 'التاريخ',
      hideBelow: 'md',
      render: (row) => (
        <span className="text-fg text-[13px] tabular-nums" dir="ltr">
          {row.issuedAt.slice(0, 10)}
        </span>
      ),
    },
    {
      key: 'total',
      header: 'تكلفة الطلب',
      align: 'end',
      render: (row) => {
        const isDraft = row.status === 'DRAFT' || row.status === 'QUOTE';
        const isPaid = row.status === 'PAID' || row.remainingAmount === '0.00';
        return (
          <div className="space-y-1">
            <MoneyText
              value={row.total}
              currency={currency}
              tone={isDraft ? 'neutral' : isPaid ? 'credit' : 'debit'}
            />
            <p
              className={
                isDraft
                  ? 'text-fg-muted text-xs'
                  : isPaid
                    ? 'text-success text-xs font-medium'
                    : 'text-danger text-xs font-medium'
              }
            >
              {isDraft ? 'مسودة' : isPaid ? 'مدفوع' : 'غير مدفوع'}
            </p>
          </div>
        );
      },
    },
    {
      header: 'المدفوع',
      align: 'end',
      hideBelow: 'lg',
      render: (row) => (
        <MoneyText value={row.paidAmount} currency={currency} tone="credit" withSymbol={false} />
      ),
    },
    {
      header: 'الدين',
      align: 'end',
      render: (row) => (
        <MoneyText
          value={row.remainingAmount}
          currency={currency}
          tone={row.remainingAmount === '0.00' ? 'neutral' : 'debit'}
          withSymbol={false}
        />
      ),
    },
    {
      header: 'الحالة',
      align: 'center',
      render: (row) => (
        <StatusBadge
          tone={
            row.status === 'DRAFT' || row.status === 'QUOTE'
              ? 'neutral'
              : row.remainingAmount === '0.00'
                ? 'credit'
                : 'debit'
          }
        >
          {row.status === 'DRAFT' || row.status === 'QUOTE'
            ? 'مسودة'
            : row.remainingAmount === '0.00'
              ? 'مدفوع'
              : 'غير مدفوع'}
        </StatusBadge>
      ),
    },
    {
      header: t('common.actions'),
      align: 'end',
      width: '230px',
      render: (row) => {
        const editable = row.status === 'DRAFT' || row.status === 'QUOTE';
        return (
          <div
            className="flex items-center justify-end gap-2"
            onClick={(event) => event.stopPropagation()}
          >
            <Button
              variant="outline"
              size="sm"
              disabled={!editable || !can('orders.update')}
              title={editable ? 'تعديل الطلب' : 'لا يمكن تعديل طلب مؤكد'}
              onClick={() => void openEdit(row)}
            >
              <Pencil aria-hidden />
              تعديل
            </Button>
            <Button variant="outline" size="sm" onClick={() => void runPrint(row)}>
              <Printer aria-hidden />
              طباعة
            </Button>
          </div>
        );
      },
    },
  ];

  const summary = stats.data;
  const unpaidCount = summary ? summary.confirmed + summary.partiallyPaid : 0;

  return (
    <div className="space-y-5">
      <PageHeader
        title={t('nav.orders')}
        icon={ShoppingBag}
        breadcrumbs={[{ label: t('nav.dashboard'), href: '/' }, { label: t('nav.orders') }]}
        linkAs={Link}
        actions={
          can('orders.create') ? (
            <Button variant="brand" onClick={() => setCreateOpen(true)}>
              <Plus aria-hidden />
              إضافة طلب جديد
            </Button>
          ) : undefined
        }
      />

      {stats.isLoading ? (
        <StatCardsSkeleton count={4} />
      ) : summary ? (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
          <StatCard label="إجمالي الطلبات" value={summary.total} icon={ShoppingBag} tone="accent" />
          <StatCard label="مدفوع" value={summary.paid} icon={CheckCircle2} tone="credit" />
          <StatCard label="غير مدفوع" value={unpaidCount} icon={Wallet} tone="debit" />
          <StatCard
            label="إجمالي الدين"
            money={summary.outstandingAmount}
            currency={currency}
            moneyTone="debit"
            icon={Wallet}
            tone="debit"
          />
        </div>
      ) : null}

      <FilterBar>
        <SearchFilter
          value={search}
          onChange={(value) => {
            setSearch(value);
            setPage(1);
          }}
          placeholder="ابحث برقم الطلب أو اسم الزبون…"
        />
        <SelectFilter
          value={paymentState}
          onChange={(value) => {
            setPaymentState(value);
            if (value) setClassification('confirmed');
            setPage(1);
          }}
          allLabel="كل الحالات"
          label="الحالة"
          options={[
            { value: 'paid', label: 'مدفوع' },
            { value: 'unpaid', label: 'غير مدفوع' },
          ]}
        />
        <SelectFilter
          value={classification}
          onChange={(value) => {
            setClassification(value);
            if (value === 'draft') setPaymentState('');
            setPage(1);
          }}
          allLabel="كل التصنيفات"
          label="التصنيف"
          options={[
            { value: 'draft', label: 'مسودة' },
            { value: 'confirmed', label: 'مؤكدة' },
          ]}
        />
        <DateRangeFilter
          from={from}
          to={to}
          onFromChange={(value) => {
            setFrom(value);
            setPage(1);
          }}
          onToChange={(value) => {
            setTo(value);
            setPage(1);
          }}
        />
      </FilterBar>

      <div>
        <DataTable
          caption="قائمة الطلبات"
          columns={columns}
          rows={list.data?.items ?? []}
          rowKey={(row) => row.id}
          loading={list.isLoading}
          error={
            list.isError
              ? {
                  message:
                    list.error instanceof ApiRequestError
                      ? list.error.message
                      : 'تعذّر تحميل الطلبات.',
                  requestId:
                    list.error instanceof ApiRequestError ? list.error.requestId : undefined,
                }
              : null
          }
          onRetry={() => void list.refetch()}
          isFiltered={isFiltered}
          onResetFilters={() => {
            setSearch('');
            setPaymentState('');
            setClassification('');
            setFrom('');
            setTo('');
            setPage(1);
          }}
          empty={{
            title: 'لا توجد طلبات بعد',
            description: 'أنشئ أول طلب لأحد زبائنك.',
            action: can('orders.create')
              ? { label: 'إضافة طلب جديد', onClick: () => setCreateOpen(true) }
              : undefined,
          }}
          sort={sort}
          onSortChange={toggleSort}
          onRowClick={(row) => setDetailOrder(row.id)}
          mobileRender={(row) => {
            const editable = row.status === 'DRAFT' || row.status === 'QUOTE';
            const isDraft = row.status === 'DRAFT' || row.status === 'QUOTE';
            const isPaid = row.status === 'PAID' || row.remainingAmount === '0.00';
            return (
              <article
                className="border-border bg-card rounded-card shadow-card border p-4"
                onClick={() => setDetailOrder(row.id)}
              >
                <div className="flex items-start gap-3">
                  <ChevronLeft className="text-fg-subtle mt-1 size-5 shrink-0" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-fg font-bold">{displayOrderNumber(row.number)}</p>
                      <StatusBadge tone={isDraft ? 'neutral' : isPaid ? 'credit' : 'debit'}>
                        {isDraft ? 'مسودة' : isPaid ? 'مدفوع' : 'غير مدفوع'}
                      </StatusBadge>
                    </div>
                    <p className="text-fg mt-1 truncate text-sm font-medium">{row.customerName}</p>
                    <p className="text-fg-muted mt-1 flex items-center gap-1.5 text-xs">
                      <CalendarDays className="size-3.5" aria-hidden />
                      <span dir="ltr">{row.issuedAt.slice(0, 10)}</span>
                    </p>
                  </div>
                  <div className="text-end">
                    <MoneyText
                      value={row.total}
                      currency={currency}
                      tone={isDraft ? 'neutral' : isPaid ? 'credit' : 'debit'}
                      size="lg"
                    />
                    <p
                      className={
                        isDraft
                          ? 'text-fg-muted mt-1 text-xs'
                          : isPaid
                            ? 'text-success mt-1 text-xs font-medium'
                            : 'text-danger mt-1 text-xs font-medium'
                      }
                    >
                      {isDraft ? 'مسودة' : isPaid ? 'مدفوع' : 'غير مدفوع'}
                    </p>
                  </div>
                </div>

                <div
                  className="border-border-subtle mt-3 flex justify-end gap-2 border-t pt-3"
                  onClick={(event) => event.stopPropagation()}
                >
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!editable || !can('orders.update')}
                    onClick={() => void openEdit(row)}
                  >
                    <Pencil aria-hidden />
                    تعديل
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => void runPrint(row)}>
                    <Printer aria-hidden />
                    طباعة
                  </Button>
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
              onPageSizeChange={(size) => {
                setPageSize(size);
                setPage(1);
              }}
              itemLabel="طلب"
            />
          </div>
        ) : null}
      </div>

      <CreateOrderDialog open={createOpen} onOpenChange={setCreateOpen} />
      <CreateOrderDialog
        open={Boolean(editingOrder)}
        onOpenChange={(open) => !open && setEditingOrder(undefined)}
        order={editingOrder}
      />
      <OrderDetailsDialog
        orderId={detailOrderId}
        open={Boolean(detailOrderId)}
        onOpenChange={(open) => !open && setDetailOrder()}
        onEdit={async (id) => {
          try {
            setEditingOrder(await loadOrder(id));
            setDetailOrder();
          } catch (error) {
            if (error instanceof ApiRequestError) toast.apiError(error.message, error.requestId);
            else toast.error('تعذّر تحميل الطلب للتعديل.');
          }
        }}
      />
    </div>
  );
}
