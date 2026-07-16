import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MoreHorizontal, Pencil, Plus, Trash2, User, Users, Wallet } from 'lucide-react';
import {
  CUSTOMER_STATUS_LABELS,
  type Customer,
  type CustomerListQuery,
} from '@oh/contracts';
import type { CurrencyCode } from '@oh/money';
import {
  Button,
  ConfirmDialog,
  DataTable,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  FilterBar,
  MoneyText,
  PageHeader,
  Pagination,
  SearchFilter,
  SelectFilter,
  StatCard,
  StatCardsSkeleton,
  StatusBadge,
  ACCOUNT_STATUS_BADGE,
  toast,
  type Column,
} from '@oh/ui';
import { ApiRequestError } from '@/lib/api';
import { useAuth } from '@/app/auth-context';
import { useArchiveCustomer, useCustomerStats, useCustomers } from './api';
import { CustomerFormDialog } from './customer-form-dialog';

/**
 * شاشة الزبائن — مطابقة لـ`ui/other screens/الزبائن.jpeg`.
 *
 * جدول: رقم الزبون (رابط) · الاسم · الهاتف · المدينة · الرصيد الحالي (ملوّن) ·
 *        حالة الحساب (شارة) · آخر تحديث · إجراءات.
 * كل شيء موصول بالخادم فعليًا — لا بيانات وهمية.
 */
export function CustomersPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { can } = useAuth();
  const { user } = useAuth();
  const currency = (user?.store?.currency ?? 'ILS') as CurrencyCode;

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [accountState, setAccountState] = useState('');
  const [sort, setSort] = useState<{ key: string; order: 'asc' | 'desc' }>({
    key: 'createdAt',
    order: 'desc',
  });

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | undefined>();
  const [archiveTarget, setArchiveTarget] = useState<Customer | null>(null);

  const query: Partial<CustomerListQuery> = {
    page,
    pageSize,
    search: search || undefined,
    status: (status || undefined) as CustomerListQuery['status'],
    accountState: (accountState || undefined) as CustomerListQuery['accountState'],
    sortBy: sort.key as CustomerListQuery['sortBy'],
    sortOrder: sort.order,
  };

  const list = useCustomers(query);
  const stats = useCustomerStats();
  const archive = useArchiveCustomer();

  const isFiltered = search !== '' || status !== '' || accountState !== '';
  const resetFilters = () => {
    setSearch('');
    setStatus('');
    setAccountState('');
    setPage(1);
  };

  const toggleSort = (key: string) =>
    setSort((c) => (c.key === key ? { key, order: c.order === 'asc' ? 'desc' : 'asc' } : { key, order: 'desc' }));

  const openAdd = () => {
    setEditing(undefined);
    setFormOpen(true);
  };
  const openEdit = (customer: Customer) => {
    setEditing(customer);
    setFormOpen(true);
  };

  const doArchive = () => {
    if (!archiveTarget) return;
    archive.mutate(archiveTarget.id, {
      onSuccess: () => {
        toast.success('أُرشف الزبون');
        setArchiveTarget(null);
      },
      onError: (e) => {
        if (e instanceof ApiRequestError) toast.apiError(e.message, e.requestId);
        else toast.error('تعذّرت الأرشفة.');
      },
    });
  };

  const columns: Column<Customer>[] = [
    {
      key: 'code',
      header: 'رقم الزبون',
      render: (row) => (
        <Link
          to={`/customers/${row.id}`}
          className="inline-flex items-center gap-2 font-semibold text-accent hover:underline"
        >
          <User className="size-3.5" aria-hidden />
          {row.code}
        </Link>
      ),
    },
    {
      key: 'name',
      header: 'الاسم',
      render: (row) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-fg">{row.name}</p>
          {row.company ? <p className="truncate text-xs text-fg-muted">{row.company}</p> : null}
        </div>
      ),
    },
    {
      header: 'الهاتف',
      hideBelow: 'md',
      render: (row) =>
        row.phone ? (
          <span className="tabular-nums text-fg" dir="ltr">
            {row.phone}
          </span>
        ) : (
          <span className="text-fg-subtle">—</span>
        ),
    },
    {
      header: 'المدينة',
      hideBelow: 'lg',
      render: (row) => row.city ?? <span className="text-fg-subtle">—</span>,
    },
    {
      key: 'balance',
      header: 'الرصيد الحالي',
      align: 'end',
      render: (row) => <MoneyText value={row.balance} currency={currency} tone="auto" />,
    },
    {
      header: 'حالة الحساب',
      align: 'center',
      render: (row) => {
        const badge = ACCOUNT_STATUS_BADGE[row.accountState];
        return <StatusBadge tone={badge.tone}>{badge.label}</StatusBadge>;
      },
    },
    {
      header: t('common.status'),
      align: 'center',
      hideBelow: 'xl',
      render: (row) => (
        <span className="text-[13px] text-fg-muted">{CUSTOMER_STATUS_LABELS[row.status]}</span>
      ),
    },
    {
      header: t('common.actions'),
      align: 'end',
      width: '72px',
      render: (row) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon" aria-label={`إجراءات ${row.name}`}>
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => navigate(`/customers/${row.id}`)}>
              <User />
              فتح الملف
            </DropdownMenuItem>
            {can('customers.write') ? (
              <DropdownMenuItem onClick={() => openEdit(row)}>
                <Pencil />
                تعديل
              </DropdownMenuItem>
            ) : null}
            {can('customers.delete') ? (
              <DropdownMenuItem destructive onClick={() => setArchiveTarget(row)}>
                <Trash2 />
                أرشفة
              </DropdownMenuItem>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title={t('nav.customers')}
        icon={Users}
        breadcrumbs={[{ label: t('nav.dashboard'), href: '/' }, { label: t('nav.customers') }]}
        linkAs={Link}
        actions={
          can('customers.write') ? (
            <Button variant="accent" onClick={openAdd}>
              <Plus aria-hidden />
              إضافة زبون جديد
            </Button>
          ) : undefined
        }
      />

      {/* بطاقات الإحصاء */}
      {stats.isLoading ? (
        <StatCardsSkeleton count={4} />
      ) : stats.data ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="إجمالي الزبائن" value={stats.data.total} icon={Users} tone="accent" />
          <StatCard label="الزبائن النشطون" value={stats.data.active} icon={User} tone="credit" />
          <StatCard
            label="إجمالي الديون"
            money={stats.data.totalDebt}
            currency={currency}
            moneyTone="debit"
            icon={Wallet}
            tone="debit"
            sublabel={`${stats.data.withDebt} زبون مدين`}
          />
          <StatCard
            label="تجاوزوا حد الائتمان"
            value={stats.data.overCreditLimit}
            icon={Wallet}
            tone="orange"
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
          placeholder="ابحث بالاسم أو الرقم أو الهاتف…"
        />
        <SelectFilter
          value={accountState}
          onChange={(v) => {
            setAccountState(v);
            setPage(1);
          }}
          allLabel="كل الحسابات"
          label="حالة الحساب"
          options={[
            { value: 'DEBIT', label: 'مدين' },
            { value: 'CREDIT', label: 'دائن' },
            { value: 'SETTLED', label: 'لا يوجد رصيد' },
          ]}
        />
        <SelectFilter
          value={status}
          onChange={(v) => {
            setStatus(v);
            setPage(1);
          }}
          allLabel="كل الحالات"
          label={t('common.status')}
          options={[
            { value: 'ACTIVE', label: 'نشط' },
            { value: 'INACTIVE', label: 'غير نشط' },
            { value: 'BLOCKED', label: 'محظور' },
          ]}
        />
      </FilterBar>

      <div>
        <DataTable
          caption="قائمة زبائن المحل مع أرصدتهم"
          columns={columns}
          rows={list.data?.items ?? []}
          rowKey={(r) => r.id}
          loading={list.isLoading}
          error={
            list.isError
              ? {
                  message:
                    list.error instanceof ApiRequestError ? list.error.message : 'تعذّر تحميل الزبائن.',
                  requestId: list.error instanceof ApiRequestError ? list.error.requestId : undefined,
                }
              : null
          }
          onRetry={() => void list.refetch()}
          isFiltered={isFiltered}
          onResetFilters={resetFilters}
          empty={{
            title: 'لا يوجد زبائن بعد',
            description: 'ابدأ بإضافة أول زبون إلى محلك.',
            action: can('customers.write') ? { label: 'إضافة زبون جديد', onClick: openAdd } : undefined,
          }}
          sort={sort}
          onSortChange={toggleSort}
          onRowClick={(row) => navigate(`/customers/${row.id}`)}
        />

        {list.data && list.data.total > 0 ? (
          <div className="rounded-b-card border-x border-b border-border bg-card">
            <Pagination
              page={list.data.page}
              pageSize={list.data.pageSize}
              total={list.data.total}
              totalPages={list.data.totalPages}
              onPageChange={setPage}
              onPageSizeChange={(s) => {
                setPageSize(s);
                setPage(1);
              }}
              itemLabel="زبون"
            />
          </div>
        ) : null}
      </div>

      <CustomerFormDialog open={formOpen} onOpenChange={setFormOpen} customer={editing} />

      <ConfirmDialog
        open={archiveTarget !== null}
        onOpenChange={(o) => !o && setArchiveTarget(null)}
        title="أرشفة الزبون"
        description={
          archiveTarget
            ? `سيُؤرشف "${archiveTarget.name}". يُرفض إن كان له رصيد قائم أو طلبات مفتوحة. لا يُحذف تاريخه.`
            : ''
        }
        confirmLabel="أرشفة"
        variant="danger"
        loading={archive.isPending}
        onConfirm={doArchive}
      />
    </div>
  );
}
