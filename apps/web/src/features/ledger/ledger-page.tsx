import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ListOrdered } from 'lucide-react';
import {
  LEDGER_TYPE_LABELS,
  type LedgerEntry,
  type LedgerListQuery,
} from '@oh/contracts';
import type { CurrencyCode } from '@oh/money';
import {
  Card,
  CardBody,
  DataTable,
  DateRangeFilter,
  FilterBar,
  MoneyText,
  PageHeader,
  Pagination,
  SearchFilter,
  SelectFilter,
  StatusBadge,
  type Column,
} from '@oh/ui';
import { ApiRequestError } from '@/lib/api';
import { useAuth } from '@/app/auth-context';
import { useLedger } from './api';

/** لون شارة نوع الحركة. */
const TYPE_TONE: Record<string, 'debit' | 'credit' | 'partial' | 'info' | 'neutral' | 'purple'> = {
  OPENING_BALANCE: 'neutral',
  ORDER_DEBIT: 'info',
  PAYMENT_CREDIT: 'credit',
  ADJUSTMENT_DEBIT: 'partial',
  ADJUSTMENT_CREDIT: 'partial',
  REVERSAL: 'purple',
  WRITE_OFF: 'debit',
};

/**
 * شاشة الحساب والحركات — مطابقة لـ`ui/other screens/الحساب والحركات.jpeg`.
 *
 * الجدول يعرض العمود الأهم: «الرصيد بعد الحركة» — وهو ما يجعل هذا دفتر أستاذ
 * حقيقيًا لا مجرد سجل. المدين والدائن في عمودين منفصلين، كما في المرجع.
 *
 * كل رقم هنا من دفتر الحركات على الخادم. لا رصيد محسوب في الواجهة.
 */
export function LedgerPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const currency = (user?.store?.currency ?? 'ILS') as CurrencyCode;

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState('');
  const [entryType, setEntryType] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const query: Partial<LedgerListQuery> = {
    page,
    pageSize,
    search: search || undefined,
    entryType: (entryType || undefined) as LedgerListQuery['entryType'],
    from: from || undefined,
    to: to || undefined,
  };

  const list = useLedger(query);
  const totals = list.data?.totals;

  const isFiltered = search !== '' || entryType !== '' || from !== '' || to !== '';
  const resetFilters = () => {
    setSearch('');
    setEntryType('');
    setFrom('');
    setTo('');
    setPage(1);
  };

  const columns: Column<LedgerEntry>[] = [
    {
      header: 'التاريخ والوقت',
      render: (row) => {
        const d = new Date(row.occurredAt);
        return (
          <div className="text-[13px]">
            <p className="tabular-nums text-fg" dir="ltr">
              {row.occurredAt.slice(0, 10)}
            </p>
            <p className="tabular-nums text-fg-muted" dir="ltr">
              {d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
        );
      },
    },
    {
      header: 'نوع الحركة',
      render: (row) => (
        <StatusBadge tone={TYPE_TONE[row.entryType] ?? 'neutral'}>
          {LEDGER_TYPE_LABELS[row.entryType]}
        </StatusBadge>
      ),
    },
    {
      header: 'الزبون',
      hideBelow: 'lg',
      render: (row) => (
        <div className="min-w-0">
          <p className="truncate text-sm text-fg">{row.customerName}</p>
          <p className="truncate text-xs text-fg-muted">{row.customerCode}</p>
        </div>
      ),
    },
    {
      header: 'المرجع',
      hideBelow: 'md',
      render: (row) =>
        row.refNumber ? (
          <span className="font-medium text-accent">{row.refNumber}</span>
        ) : (
          <span className="text-fg-subtle">—</span>
        ),
    },
    {
      header: 'التفاصيل',
      hideBelow: 'xl',
      render: (row) => (
        <span className="line-clamp-1 text-[13px] text-fg-muted">{row.notes ?? '—'}</span>
      ),
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
      header: 'الرصيد بعد الحركة',
      align: 'end',
      render: (row) => (
        <span className={row.isReversed ? 'line-through opacity-50' : ''}>
          <MoneyText value={row.runningBalance} currency={currency} tone="balance" withSymbol={false} />
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title={t('nav.ledger')}
        icon={ListOrdered}
        breadcrumbs={[{ label: t('nav.dashboard'), href: '/' }, { label: t('nav.ledger') }]}
        linkAs={Link}
      />

      <FilterBar>
        <SearchFilter
          value={search}
          onChange={(v) => {
            setSearch(v);
            setPage(1);
          }}
          placeholder="ابحث في الحركات أو الزبائن…"
        />
        <SelectFilter
          value={entryType}
          onChange={(v) => {
            setEntryType(v);
            setPage(1);
          }}
          allLabel="كل أنواع الحركات"
          label="نوع الحركة"
          options={Object.entries(LEDGER_TYPE_LABELS).map(([value, label]) => ({ value, label }))}
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
          caption="جميع الحركات المالية"
          columns={columns}
          rows={list.data?.items ?? []}
          rowKey={(r) => r.id}
          loading={list.isLoading}
          error={
            list.isError
              ? {
                  message:
                    list.error instanceof ApiRequestError ? list.error.message : 'تعذّر تحميل الحركات.',
                  requestId: list.error instanceof ApiRequestError ? list.error.requestId : undefined,
                }
              : null
          }
          onRetry={() => void list.refetch()}
          isFiltered={isFiltered}
          onResetFilters={resetFilters}
          empty={{
            title: 'لا توجد حركات مالية بعد',
            description: 'تظهر الحركات هنا عند تأكيد الطلبات وتسجيل الدفعات.',
          }}
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
              itemLabel="حركة"
            />
          </div>
        ) : null}
      </div>

      {/* إجماليات — كما في المرجع (أسفل الجدول) */}
      {totals && list.data && list.data.total > 0 ? (
        <Card>
          <CardBody className="flex flex-wrap items-center justify-around gap-4 py-4">
            <Totals label="إجمالي المدين" value={totals.totalDebit} tone="debit" currency={currency} />
            <Totals label="إجمالي الدائن" value={totals.totalCredit} tone="credit" currency={currency} />
            <Totals label="الرصيد الحالي" value={totals.currentBalance} tone="auto" currency={currency} />
          </CardBody>
        </Card>
      ) : null}
    </div>
  );
}

function Totals({
  label,
  value,
  tone,
  currency,
}: {
  label: string;
  value: string;
  tone: 'debit' | 'credit' | 'auto';
  currency: CurrencyCode;
}) {
  return (
    <div className="text-center">
      <p className="text-[13px] text-fg-muted">{label}</p>
      <MoneyText value={value} currency={currency} tone={tone === 'auto' ? 'balance' : tone} size="lg" />
    </div>
  );
}
