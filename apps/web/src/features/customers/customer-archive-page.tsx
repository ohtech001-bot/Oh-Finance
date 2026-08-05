import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArchiveRestore, CalendarClock, ChevronLeft, RotateCcw, Users } from 'lucide-react';
import type { Customer, CustomerListQuery } from '@oh/contracts';
import {
  Button,
  DataTable,
  FilterBar,
  PageHeader,
  Pagination,
  SearchFilter,
  toast,
  type Column,
} from '@oh/ui';
import { useAuth } from '@/app/auth-context';
import { ApiRequestError } from '@/lib/api';
import { currentLocale } from '@/lib/i18n';
import { useCustomers, useRestoreCustomer } from './api';

const RETENTION_DAYS = 30;

const COPY = {
  ar: {
    title: 'أرشيف الزبائن',
    description: 'يمكن استعادة الزبون خلال 30 يومًا من تاريخ الأرشفة، ثم يُحذف تلقائيًا.',
    customers: 'الزبائن',
    search: 'ابحث باسم الزبون أو رقم الهاتف…',
    name: 'اسم الزبون',
    phone: 'رقم الهاتف',
    archivedAt: 'تاريخ الأرشفة',
    deletionAt: 'تاريخ الحذف',
    remaining: 'المدة المتبقية',
    days: 'يوم',
    restore: 'استعادة',
    restored: 'تمت استعادة الزبون',
    restoreFailed: 'تعذرت استعادة الزبون.',
    loadFailed: 'تعذر تحميل أرشيف الزبائن.',
    empty: 'الأرشيف فارغ',
    emptyDescription: 'لا يوجد زبائن مؤرشفون خلال آخر 30 يومًا.',
    item: 'زبون',
  },
  he: {
    title: 'ארכיון לקוחות',
    description: 'ניתן לשחזר לקוח במשך 30 יום מתאריך ההעברה לארכיון, ולאחר מכן הוא יימחק אוטומטית.',
    customers: 'לקוחות',
    search: 'חיפוש לפי שם או טלפון…',
    name: 'שם הלקוח',
    phone: 'טלפון',
    archivedAt: 'תאריך העברה לארכיון',
    deletionAt: 'תאריך מחיקה',
    remaining: 'זמן שנותר',
    days: 'ימים',
    restore: 'שחזור',
    restored: 'הלקוח שוחזר',
    restoreFailed: 'לא ניתן לשחזר את הלקוח.',
    loadFailed: 'לא ניתן לטעון את ארכיון הלקוחות.',
    empty: 'הארכיון ריק',
    emptyDescription: 'אין לקוחות שהועברו לארכיון ב-30 הימים האחרונים.',
    item: 'לקוח',
  },
  en: {
    title: 'Customer Archive',
    description: 'Customers can be restored for 30 days after archiving, then they are deleted automatically.',
    customers: 'Customers',
    search: 'Search by customer name or phone…',
    name: 'Customer name',
    phone: 'Phone',
    archivedAt: 'Archived on',
    deletionAt: 'Deletion date',
    remaining: 'Time remaining',
    days: 'days',
    restore: 'Restore',
    restored: 'Customer restored',
    restoreFailed: 'Customer could not be restored.',
    loadFailed: 'Customer archive could not be loaded.',
    empty: 'Archive is empty',
    emptyDescription: 'No customers were archived in the last 30 days.',
    item: 'customer',
  },
} as const;

export function CustomerArchivePage() {
  const locale = currentLocale();
  const labels = COPY[locale];
  const { can } = useAuth();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState('');
  const restore = useRestoreCustomer();

  const query: Partial<CustomerListQuery> = {
    page,
    pageSize,
    search: search || undefined,
    archivedOnly: true,
    sortBy: 'createdAt',
    sortOrder: 'desc',
  };
  const list = useCustomers(query);

  const restoreCustomer = (customer: Customer) => {
    restore.mutate(customer.id, {
      onSuccess: () => toast.success(labels.restored),
      onError: (error) => {
        if (error instanceof ApiRequestError) toast.apiError(error.message, error.requestId);
        else toast.error(labels.restoreFailed);
      },
    });
  };

  const columns: Column<Customer>[] = [
    {
      key: 'name',
      header: labels.name,
      render: (customer) => <span className="text-fg font-semibold">{customer.name}</span>,
    },
    {
      header: labels.phone,
      render: (customer) => (
        <span className="tabular-nums" dir="ltr">
          {customer.phone ?? '—'}
        </span>
      ),
    },
    {
      header: labels.archivedAt,
      render: (customer) => <ArchiveDate value={customer.archivedAt} locale={locale} />,
    },
    {
      header: labels.deletionAt,
      render: (customer) => (
        <span className="tabular-nums" dir="ltr">
          {formatDate(expiryDate(customer.archivedAt), locale)}
        </span>
      ),
    },
    {
      header: labels.remaining,
      align: 'center',
      render: (customer) => (
        <span className="bg-warning-soft text-warning-fg rounded-badge inline-flex px-2.5 py-1 text-xs font-semibold">
          {remainingDays(customer.archivedAt)} {labels.days}
        </span>
      ),
    },
    {
      header: labels.restore,
      align: 'end',
      render: (customer) =>
        can('customers.delete') ? (
          <Button
            variant="outline"
            size="sm"
            loading={restore.isPending && restore.variables === customer.id}
            onClick={() => restoreCustomer(customer)}
          >
            <RotateCcw aria-hidden />
            {labels.restore}
          </Button>
        ) : null,
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title={labels.title}
        description={labels.description}
        icon={ArchiveRestore}
        breadcrumbs={[{ label: labels.customers, href: '/customers' }, { label: labels.title }]}
        linkAs={Link}
      />

      <FilterBar>
        <SearchFilter
          value={search}
          onChange={(value) => {
            setSearch(value);
            setPage(1);
          }}
          placeholder={labels.search}
        />
      </FilterBar>

      <div>
        <DataTable<Customer>
          caption={labels.title}
          columns={columns}
          rows={list.data?.items ?? []}
          rowKey={(customer) => customer.id}
          loading={list.isLoading}
          error={
            list.isError
              ? {
                  message:
                    list.error instanceof ApiRequestError ? list.error.message : labels.loadFailed,
                  requestId:
                    list.error instanceof ApiRequestError ? list.error.requestId : undefined,
                }
              : null
          }
          onRetry={() => void list.refetch()}
          isFiltered={Boolean(search)}
          onResetFilters={() => {
            setSearch('');
            setPage(1);
          }}
          empty={{ title: labels.empty, description: labels.emptyDescription }}
          tableClassName="table-fixed"
          mobileRender={(customer) => (
            <article className="border-border bg-card rounded-card shadow-card border p-4">
              <div className="flex items-start gap-3">
                <div className="bg-warning-soft text-warning-fg rounded-icon flex size-10 shrink-0 items-center justify-center">
                  <Users className="size-5" aria-hidden />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-fg truncate font-bold">{customer.name}</p>
                  <p className="text-fg-muted mt-1 text-sm tabular-nums" dir="ltr">
                    {customer.phone ?? '—'}
                  </p>
                </div>
                <ChevronLeft className="text-fg-subtle size-5 shrink-0" aria-hidden />
              </div>

              <div className="border-border-subtle mt-4 grid grid-cols-2 gap-3 border-t pt-4 text-sm">
                <ArchiveMetric
                  label={labels.archivedAt}
                  value={formatDate(customer.archivedAt, locale)}
                />
                <ArchiveMetric
                  label={labels.deletionAt}
                  value={formatDate(expiryDate(customer.archivedAt), locale)}
                />
              </div>

              <div className="mt-4 flex items-center justify-between gap-3">
                <span className="text-warning-fg flex items-center gap-1.5 text-xs font-semibold">
                  <CalendarClock className="size-4" aria-hidden />
                  {remainingDays(customer.archivedAt)} {labels.days}
                </span>
                {can('customers.delete') ? (
                  <Button
                    variant="outline"
                    size="sm"
                    loading={restore.isPending && restore.variables === customer.id}
                    onClick={() => restoreCustomer(customer)}
                  >
                    <RotateCcw aria-hidden />
                    {labels.restore}
                  </Button>
                ) : null}
              </div>
            </article>
          )}
        />

        {list.data && list.data.total > 0 ? (
          <div className="rounded-b-card border-border bg-card border-x border-b">
            <Pagination
              page={list.data.page}
              pageSize={list.data.pageSize}
              total={list.data.total}
              totalPages={list.data.totalPages}
              onPageChange={setPage}
              onPageSizeChange={(value) => {
                setPageSize(value);
                setPage(1);
              }}
              itemLabel={labels.item}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ArchiveDate({ value, locale }: { value: string | null; locale: keyof typeof COPY }) {
  return (
    <span className="tabular-nums" dir="ltr">
      {formatDate(value, locale)}
    </span>
  );
}

function ArchiveMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-fg-muted text-xs">{label}</p>
      <p className="text-fg mt-1 truncate tabular-nums" dir="ltr">
        {value}
      </p>
    </div>
  );
}

function expiryDate(archivedAt: string | null): string | null {
  if (!archivedAt) return null;
  return new Date(
    new Date(archivedAt).getTime() + RETENTION_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();
}

function remainingDays(archivedAt: string | null): number {
  const expiry = expiryDate(archivedAt);
  if (!expiry) return 0;
  return Math.max(0, Math.ceil((new Date(expiry).getTime() - Date.now()) / (24 * 60 * 60 * 1000)));
}

function formatDate(value: string | null, locale: keyof typeof COPY): string {
  if (!value) return '—';
  return new Date(value).toLocaleDateString(
    locale === 'ar' ? 'ar' : locale === 'he' ? 'he' : 'en-GB',
  );
}
