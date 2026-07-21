import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Pencil, Plus, Trash2, Users, Wallet } from 'lucide-react';
import { type Customer, type CustomerListQuery } from '@oh/contracts';
import { negate, toMoneyString, type CurrencyCode } from '@oh/money';
import {
  Button,
  ConfirmDialog,
  DataTable,
  FilterBar,
  MoneyText,
  PageHeader,
  Pagination,
  SearchFilter,
  SelectFilter,
  StatCard,
  StatCardsSkeleton,
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
  const { can, user } = useAuth();
  const currency = (user?.store?.currency ?? 'ILS') as CurrencyCode;

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState('');
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
    accountState: (accountState || undefined) as CustomerListQuery['accountState'],
    sortBy: sort.key as CustomerListQuery['sortBy'],
    sortOrder: sort.order,
  };

  const list = useCustomers(query);
  const stats = useCustomerStats();
  const archive = useArchiveCustomer();

  const isFiltered = search !== '' || accountState !== '';
  const resetFilters = () => {
    setSearch('');
    setAccountState('');
    setPage(1);
  };

  const toggleSort = (key: string) =>
    setSort((c) =>
      c.key === key ? { key, order: c.order === 'asc' ? 'desc' : 'asc' } : { key, order: 'desc' },
    );

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
      key: 'name',
      header: 'الاسم',
      render: (row) => (
        <div className="min-w-0">
          <p className="text-fg truncate font-medium">{row.name}</p>
          {row.company ? <p className="text-fg-muted truncate text-xs">{row.company}</p> : null}
        </div>
      ),
    },
    {
      header: 'الهاتف',
      hideBelow: 'md',
      render: (row) =>
        row.phone ? (
          <span className="text-fg tabular-nums" dir="ltr">
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
      render: (row) => (
        <MoneyText value={toMoneyString(negate(row.balance), 2)} currency={currency} tone="auto" />
      ),
    },
    {
      header: t('common.actions'),
      align: 'end',
      width: '112px',
      render: (row) => (
        <div
          className="flex items-center justify-end gap-1"
          onClick={(event) => event.stopPropagation()}
        >
          {can('customers.write') ? (
            <Button
              variant="outline"
              size="icon"
              title="تعديل"
              aria-label={`تعديل ${row.name}`}
              onClick={() => openEdit(row)}
            >
              <Pencil aria-hidden />
            </Button>
          ) : null}
          {can('customers.delete') ? (
            <Button
              variant="outline"
              size="icon"
              title="أرشفة"
              aria-label={`أرشفة ${row.name}`}
              onClick={() => setArchiveTarget(row)}
            >
              <Trash2 className="text-danger" aria-hidden />
            </Button>
          ) : null}
        </div>
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
        <StatCardsSkeleton count={3} />
      ) : stats.data ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <StatCard label="إجمالي الزبائن" value={stats.data.total} icon={Users} tone="accent" />
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
          placeholder="ابحث بالاسم أو الهاتف…"
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
                    list.error instanceof ApiRequestError
                      ? list.error.message
                      : 'تعذّر تحميل الزبائن.',
                  requestId:
                    list.error instanceof ApiRequestError ? list.error.requestId : undefined,
                }
              : null
          }
          onRetry={() => void list.refetch()}
          isFiltered={isFiltered}
          onResetFilters={resetFilters}
          empty={{
            title: 'لا يوجد زبائن بعد',
            description: 'ابدأ بإضافة أول زبون إلى محلك.',
            action: can('customers.write')
              ? { label: 'إضافة زبون جديد', onClick: openAdd }
              : undefined,
          }}
          sort={sort}
          onSortChange={toggleSort}
          onRowClick={(row) => navigate(`/customers/${row.id}`)}
          rowClassName={(row) => (row.accountState === 'DEBIT' ? 'bg-danger-soft' : undefined)}
        />

        {list.data && list.data.total > 0 ? (
          <div className="rounded-b-card border-border bg-card border-x border-b">
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
