import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, MoreHorizontal, Plus, ShoppingBag, XCircle } from 'lucide-react';
import { type Order, type OrderListQuery } from '@oh/contracts';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Field,
  FilterBar,
  Input,
  MoneyText,
  PageHeader,
  Pagination,
  SearchFilter,
  SelectFilter,
  StatCard,
  StatCardsSkeleton,
  StatusBadge,
  ORDER_STATUS_BADGE,
  toast,
  type Column,
} from '@oh/ui';
import { ApiRequestError } from '@/lib/api';
import { useAuth } from '@/app/auth-context';
import { useCancelOrder, useConfirmOrder, useOrderStats, useOrders } from './api';
import { CreateOrderDialog } from './create-order-dialog';

export function OrdersPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, can } = useAuth();
  const currency = (user?.store?.currency ?? 'ILS') as CurrencyCode;

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [sort, setSort] = useState<{ key: string; order: 'asc' | 'desc' }>({
    key: 'issuedAt',
    order: 'desc',
  });

  const [createOpen, setCreateOpen] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<Order | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  const query: Partial<OrderListQuery> = {
    page,
    pageSize,
    search: search || undefined,
    status: (status || undefined) as OrderListQuery['status'],
    from: from || undefined,
    to: to || undefined,
    sortBy: sort.key as OrderListQuery['sortBy'],
    sortOrder: sort.order,
  };

  const list = useOrders(query);
  const stats = useOrderStats({});
  const cancel = useCancelOrder(cancelTarget?.id ?? '');

  const isFiltered = search !== '' || status !== '' || from !== '' || to !== '';
  const resetFilters = () => {
    setSearch('');
    setStatus('');
    setFrom('');
    setTo('');
    setPage(1);
  };
  const toggleSort = (key: string) =>
    setSort((c) => (c.key === key ? { key, order: c.order === 'asc' ? 'desc' : 'asc' } : { key, order: 'desc' }));

  const doCancel = () => {
    if (!cancelTarget || cancelReason.trim().length < 3) return;
    cancel.mutate(
      { version: cancelTarget.version, reason: cancelReason.trim() },
      {
        onSuccess: () => {
          toast.success('أُلغي الطلب');
          setCancelTarget(null);
          setCancelReason('');
        },
        onError: (e) => {
          if (e instanceof ApiRequestError) toast.apiError(e.message, e.requestId);
          else toast.error('تعذّر الإلغاء.');
        },
      },
    );
  };

  const columns: Column<Order>[] = [
    {
      key: 'number',
      header: 'رقم الطلب',
      render: (row) => (
        <Link to={`/orders/${row.id}`} className="font-semibold text-accent hover:underline">
          {row.number}
        </Link>
      ),
    },
    {
      header: 'الزبون',
      render: (row) => (
        <Link to={`/customers/${row.customerId}`} className="min-w-0 hover:underline">
          <p className="truncate text-sm text-fg">{row.customerName}</p>
          <p className="truncate text-xs text-fg-muted">{row.customerCode}</p>
        </Link>
      ),
    },
    {
      key: 'issuedAt',
      header: 'التاريخ',
      hideBelow: 'md',
      render: (row) => (
        <span className="tabular-nums text-[13px] text-fg" dir="ltr">
          {row.issuedAt.slice(0, 10)}
        </span>
      ),
    },
    {
      key: 'dueAt',
      header: 'الاستحقاق',
      hideBelow: 'lg',
      render: (row) =>
        row.dueAt ? (
          <span className={`tabular-nums text-[13px] ${row.isOverdue ? 'font-semibold text-danger' : 'text-fg-muted'}`} dir="ltr">
            {row.dueAt.slice(0, 10)}
          </span>
        ) : (
          <span className="text-fg-subtle">—</span>
        ),
    },
    {
      key: 'total',
      header: 'الإجمالي',
      align: 'end',
      render: (row) => <MoneyText value={row.total} currency={currency} tone="plain" />,
    },
    {
      header: 'المدفوع',
      align: 'end',
      hideBelow: 'lg',
      render: (row) => <MoneyText value={row.paidAmount} currency={currency} tone="credit" withSymbol={false} />,
    },
    {
      key: 'remainingAmount',
      header: 'المتبقي',
      align: 'end',
      render: (row) => (
        <MoneyText value={row.remainingAmount} currency={currency} tone={row.remainingAmount === '0.00' ? 'neutral' : 'debit'} withSymbol={false} />
      ),
    },
    {
      header: 'الحالة',
      align: 'center',
      render: (row) => {
        const badge = ORDER_STATUS_BADGE[row.status];
        return <StatusBadge tone={badge.tone}>{badge.label}</StatusBadge>;
      },
    },
    {
      header: t('common.actions'),
      align: 'end',
      width: '72px',
      render: (row) => {
        const canConfirm = can('orders.confirm') && (row.status === 'DRAFT' || row.status === 'QUOTE');
        const canCancel = can('orders.cancel') && row.status !== 'CANCELLED' && row.paidAmount === '0.00';
        if (!canConfirm && !canCancel) return <span className="text-fg-subtle">—</span>;

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" aria-label={`إجراءات ${row.number}`}>
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => navigate(`/orders/${row.id}`)}>فتح الطلب</DropdownMenuItem>
              {canConfirm ? (
                <ConfirmMenuItem orderId={row.id} version={row.version} />
              ) : null}
              {canCancel ? (
                <DropdownMenuItem destructive onClick={() => setCancelTarget(row)}>
                  <XCircle />
                  إلغاء الطلب
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];

  const s = stats.data;

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
      ) : s ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6">
          <StatCard label="إجمالي الطلبات" value={s.total} icon={ShoppingBag} tone="accent" />
          <StatCard label="مؤكد" value={s.confirmed} icon={CheckCircle2} tone="credit" />
          <StatCard label="مدفوع جزئيًا" value={s.partiallyPaid} icon={ShoppingBag} tone="partial" />
          <StatCard label="مدفوع" value={s.paid} icon={CheckCircle2} tone="credit" />
          <StatCard label="مسودة" value={s.draft + s.quote} icon={ShoppingBag} tone="neutral" />
          <StatCard
            label="المستحق"
            money={s.outstandingAmount}
            currency={currency}
            moneyTone="debit"
            icon={ShoppingBag}
            tone="debit"
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
          placeholder="ابحث برقم الطلب أو اسم الزبون…"
        />
        <SelectFilter
          value={status}
          onChange={(v) => {
            setStatus(v);
            setPage(1);
          }}
          allLabel="كل الحالات"
          label="الحالة"
          options={Object.entries(ORDER_STATUS_BADGE).map(([value, b]) => ({ value, label: (b as { label: string }).label }))}
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
          caption="قائمة الطلبات"
          columns={columns}
          rows={list.data?.items ?? []}
          rowKey={(r) => r.id}
          loading={list.isLoading}
          error={
            list.isError
              ? {
                  message:
                    list.error instanceof ApiRequestError ? list.error.message : 'تعذّر تحميل الطلبات.',
                  requestId: list.error instanceof ApiRequestError ? list.error.requestId : undefined,
                }
              : null
          }
          onRetry={() => void list.refetch()}
          isFiltered={isFiltered}
          onResetFilters={resetFilters}
          empty={{
            title: 'لا توجد طلبات بعد',
            description: 'أنشئ أول طلب لأحد زبائنك.',
            action: can('orders.create') ? { label: 'إضافة طلب جديد', onClick: () => setCreateOpen(true) } : undefined,
          }}
          sort={sort}
          onSortChange={toggleSort}
        />

        {list.data && list.data.total > 0 ? (
          <div className="rounded-b-card border-x border-b border-border bg-card">
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
              itemLabel="طلب"
            />
          </div>
        ) : null}
      </div>

      <CreateOrderDialog open={createOpen} onOpenChange={setCreateOpen} />

      <Dialog
        open={cancelTarget !== null}
        onOpenChange={(o) => {
          if (!o) {
            setCancelTarget(null);
            setCancelReason('');
          }
        }}
      >
        <DialogContent size="sm" onOpenAutoFocus={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>إلغاء الطلب {cancelTarget?.number}</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <p className="mb-4 text-sm text-fg-muted">
              الطلب المؤكد يولّد قيد عكس يُلغي أثره في دفتر الحركات. يبقى الطلب
              مرئيًا بحالة «ملغي».
            </p>
            <Field
              label="سبب الإلغاء"
              hint="يُسجَّل في سجل التدقيق."
              error={cancelReason.length > 0 && cancelReason.trim().length < 3 ? '3 أحرف على الأقل.' : undefined}
              required
            >
              {(p) => (
                <Input
                  {...p}
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="مثال: إلغاء بطلب الزبون"
                  autoFocus
                />
              )}
            </Field>
          </DialogBody>
          <DialogFooter>
            <Button variant="danger" onClick={doCancel} loading={cancel.isPending} disabled={cancelReason.trim().length < 3}>
              إلغاء الطلب
            </Button>
            <DialogClose asChild>
              <Button variant="outline" disabled={cancel.isPending}>
                تراجع
              </Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** عنصر قائمة يؤكّد الطلب مباشرة. */
function ConfirmMenuItem({ orderId, version }: { orderId: string; version: number }) {
  const confirm = useConfirmOrder(orderId);
  return (
    <DropdownMenuItem
      onClick={() =>
        confirm.mutate(
          { version, overrideCreditLimit: false },
          {
            onSuccess: (o) => toast.success(`أُكِّد الطلب ${o.number}`),
            onError: (e) => {
              if (e instanceof ApiRequestError) toast.apiError(e.message, e.requestId);
              else toast.error('تعذّر التأكيد.');
            },
          },
        )
      }
    >
      <CheckCircle2 />
      تأكيد الطلب
    </DropdownMenuItem>
  );
}
