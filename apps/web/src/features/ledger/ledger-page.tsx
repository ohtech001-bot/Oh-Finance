import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowDownLeft, ArrowUpRight, Download, ListOrdered, Printer } from 'lucide-react';
import { LEDGER_TYPE_LABELS, type LedgerEntry, type LedgerListQuery } from '@oh/contracts';
import { isZero, type CurrencyCode } from '@oh/money';
import {
  Button,
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
  toast,
  type Column,
} from '@oh/ui';
import { ApiRequestError } from '@/lib/api';
import { currentLocale } from '@/lib/i18n';
import { useAuth } from '@/app/auth-context';
import { displayOrderNumber } from '@/features/orders/order-number';
import { fetchAllLedger, useLedger } from './api';
import { exportLedgerCsv, printLedger } from './export';
import { ledgerBalanceDisplay } from './balance-display';

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

/** Financial amounts come from the ledger; only their customer-facing sign is inverted. */
export function LedgerPage() {
  const { t, i18n } = useTranslation();
  const he = i18n.language.startsWith('he');
  const labels = {
    amount: he ? 'סכום התנועה' : 'مبلغ الحركة',
    debt: he ? 'חוב לאחר התנועה' : 'الدين بعد الحركة',
    balance: he ? 'יתרה לאחר התנועה' : 'الرصيد بعد الحركة',
    noDebt: he ? 'ללא חוב' : 'غير مديون',
    settled: he ? 'החשבון מאוזן' : 'الحساب مسدد',
    available: he ? 'יתרה לזכות הלקוח' : 'رصيد متاح للزبون',
  };
  const { user } = useAuth();
  const currency = (user?.store?.currency ?? 'ILS') as CurrencyCode;

  const [searchParams] = useSearchParams();
  const customerId = searchParams.get('customerId') ?? undefined;

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState('');
  const [entryType, setEntryType] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const query: Partial<LedgerListQuery> = {
    page,
    pageSize,
    customerId,
    search: search || undefined,
    entryType: (entryType || undefined) as LedgerListQuery['entryType'],
    from: from || undefined,
    to: to || undefined,
  };

  const list = useLedger(query);
  const totals = list.data?.totals;
  const customerName = list.data?.items[0]?.customerName;
  const locale = currentLocale();

  const [busy, setBusy] = useState<'csv' | 'print' | null>(null);

  const runExport = async (kind: 'csv' | 'print') => {
    setBusy(kind);
    try {
      const rows = await fetchAllLedger(query);
      if (rows.length === 0) {
        toast.error('لا توجد حركات للتصدير.');
        return;
      }
      const stamp = new Date().toISOString().slice(0, 10);
      if (kind === 'csv') exportLedgerCsv(rows, `ledger-${stamp}.csv`);
      else printLedger(rows, 'دفتر الحركات المالية');
    } catch (e) {
      if (e instanceof ApiRequestError) toast.apiError(e.message, e.requestId);
      else toast.error('تعذّر التصدير.');
    } finally {
      setBusy(null);
    }
  };

  const isFiltered = search !== '' || entryType !== '' || from !== '' || to !== '';
  const resetFilters = () => {
    setSearch('');
    setEntryType('');
    setFrom('');
    setTo('');
    setPage(1);
  };

  const allColumns: Column<LedgerEntry>[] = [
    {
      header: 'التاريخ والوقت',
      render: (row) => {
        const d = new Date(row.occurredAt);
        return (
          <div className="text-[13px]">
            <p className="text-fg">
              {new Intl.DateTimeFormat(locale, {
                weekday: 'long',
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
              }).format(d)}
            </p>
            <p className="text-fg-muted tabular-nums" dir="ltr">
              {d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
        );
      },
    },
    {
      header: 'نوع الحركة',
      render: (row) => (
        <StatusBadge tone={TYPE_TONE[row.entryType] ?? 'neutral'}>{movementLabel(row)}</StatusBadge>
      ),
    },
    {
      key: 'customer',
      header: 'الزبون',
      hideBelow: 'lg',
      render: (row) => (
        <div className="min-w-0">
          <p className="text-fg truncate text-sm">{row.customerName}</p>
        </div>
      ),
    },
    {
      header: 'المرجع',
      hideBelow: 'md',
      render: (row) =>
        row.refNumber ? (
          <span className="text-accent font-medium">
            {row.refType === 'ORDER' ? displayOrderNumber(row.refNumber) : row.refNumber}
          </span>
        ) : (
          <span className="text-fg-subtle">—</span>
        ),
    },
    {
      header: 'التفاصيل',
      hideBelow: 'xl',
      render: (row) => (
        <span className="text-fg-muted line-clamp-1 text-[13px]">
          {row.refType === 'ORDER'
            ? (row.notes?.replace(/ORD-?/gi, '') ?? '—')
            : (row.notes ?? '—')}
        </span>
      ),
    },
    {
      header: labels.amount,
      align: 'end',
      render: (row) => (
        <div className="space-y-1">
          <MoneyText
            value={!isZero(row.debit) ? row.debit : row.credit}
            currency={currency}
            tone={!isZero(row.debit) ? 'debit' : 'credit'}
            withSymbol={false}
          />
          <p className="text-fg-muted text-xs">
            {!isZero(row.debit)
              ? he
                ? 'חיוב'
                : 'زيادة على الحساب'
              : row.entryType === 'PAYMENT_CREDIT'
                ? he
                  ? 'תשלום שהתקבל'
                  : 'دفعة مقبوضة'
                : he
                  ? 'הפחתה מהחשבון'
                  : 'تخفيض من الحساب'}
          </p>
          <div className="text-fg-muted flex flex-wrap justify-end gap-1 text-xs">
            <span>{he ? 'לפני:' : 'قبل الحركة:'}</span>
            <MoneyText
              value={ledgerBalanceDisplay(row.openingBalance).signedBalance}
              currency={currency}
              tone="auto"
              size="sm"
              withSymbol={false}
              signDisplay
            />
          </div>
        </div>
      ),
    },
    {
      header: labels.debt,
      align: 'end',
      render: (row) =>
        !isZero(ledgerBalanceDisplay(row.runningBalance).debt) ? (
          <MoneyText
            value={ledgerBalanceDisplay(row.runningBalance).debt}
            currency={currency}
            tone="debit"
            withSymbol={false}
          />
        ) : (
          <span className="text-success text-xs font-medium">{labels.noDebt}</span>
        ),
    },
    {
      header: labels.balance,
      align: 'end',
      render: (row) => (
        <div>
          <MoneyText
            value={ledgerBalanceDisplay(row.runningBalance).signedBalance}
            currency={currency}
            tone="auto"
            withSymbol={false}
            signDisplay
          />
          <p className="text-fg-muted mt-1 text-xs">
            {!isZero(ledgerBalanceDisplay(row.runningBalance).credit)
              ? labels.available
              : isZero(row.runningBalance)
                ? labels.settled
                : he
                  ? 'חוב לתשלום'
                  : 'دين مطلوب سداده'}
          </p>
        </div>
      ),
    },
  ];
  const columns = customerId
    ? allColumns.filter((column) => column.key !== 'customer')
    : allColumns;

  return (
    <div className="space-y-5">
      <PageHeader
        title={customerId && customerName ? `كشف حساب ${customerName}` : t('nav.ledger')}
        icon={ListOrdered}
        breadcrumbs={[{ label: t('nav.dashboard'), href: '/' }, { label: t('nav.ledger') }]}
        linkAs={Link}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => void runExport('csv')}
              loading={busy === 'csv'}
              disabled={busy !== null}
            >
              <Download aria-hidden />
              تصدير CSV
            </Button>
            <Button
              variant="outline"
              onClick={() => void runExport('print')}
              loading={busy === 'print'}
              disabled={busy !== null}
            >
              <Printer aria-hidden />
              طباعة
            </Button>
          </div>
        }
      />

      {customerId && totals && list.data && list.data.total > 0 ? (
        <Card>
          <CardBody className="grid grid-cols-2 gap-3 py-5 text-center sm:gap-6">
            <Totals
              label={he ? 'החוב הנוכחי' : 'الدين الحالي'}
              value={ledgerBalanceDisplay(totals.currentBalance).debt}
              tone="debit"
              currency={currency}
            />
            <Totals
              label={labels.available}
              value={ledgerBalanceDisplay(totals.currentBalance).credit}
              tone="credit"
              currency={currency}
            />
          </CardBody>
        </Card>
      ) : null}

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
        {customerId ? (
          <h2 className="text-fg mb-3 text-center text-lg font-semibold">طلبات وحركات الزبون</h2>
        ) : null}
        <DataTable
          caption={customerId ? `طلبات وحركات ${customerName ?? 'الزبون'}` : 'جميع الحركات المالية'}
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
                      : 'تعذّر تحميل الحركات.',
                  requestId:
                    list.error instanceof ApiRequestError ? list.error.requestId : undefined,
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
          mobileRender={(row) => {
            const isDebit = row.debit !== '0.00';
            const occurredAt = new Date(row.occurredAt);
            return (
              <article className="border-border bg-card rounded-card shadow-card border p-4">
                <div className="flex items-start gap-3">
                  <span
                    className={
                      isDebit
                        ? 'bg-danger-soft text-danger rounded-icon flex size-10 shrink-0 items-center justify-center'
                        : 'bg-success-soft text-success rounded-icon flex size-10 shrink-0 items-center justify-center'
                    }
                  >
                    {isDebit ? (
                      <ArrowDownLeft className="size-5" aria-hidden />
                    ) : (
                      <ArrowUpRight className="size-5" aria-hidden />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-fg truncate text-sm font-bold">
                      {row.customerName || LEDGER_TYPE_LABELS[row.entryType]}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <StatusBadge tone={TYPE_TONE[row.entryType] ?? 'neutral'}>
                        {movementLabel(row)}
                      </StatusBadge>
                      {row.refNumber ? (
                        <span className="text-fg-muted text-xs">
                          {row.refType === 'ORDER'
                            ? displayOrderNumber(row.refNumber)
                            : row.refNumber}
                        </span>
                      ) : null}
                    </div>
                    <p className="text-fg-muted mt-2 text-xs">
                      {new Intl.DateTimeFormat(locale, {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                      }).format(occurredAt)}
                      {' · '}
                      <span dir="ltr">
                        {occurredAt.toLocaleTimeString('en-GB', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </p>
                  </div>
                  <div className="text-end">
                    <MoneyText
                      value={isDebit ? row.debit : row.credit}
                      currency={currency}
                      tone={isDebit ? 'debit' : 'credit'}
                      size="lg"
                    />
                    <p className="text-fg-muted mt-1 text-[11px]">{labels.balance}</p>
                    <MoneyText
                      value={ledgerBalanceDisplay(row.runningBalance).signedBalance}
                      currency={currency}
                      tone="auto"
                      withSymbol={false}
                      size="sm"
                      signDisplay
                    />
                    {isZero(row.runningBalance) ? (
                      <p className="text-fg-muted mt-1 text-xs">{labels.settled}</p>
                    ) : null}
                  </div>
                </div>
                <div className="border-border mt-3 flex items-center justify-between gap-3 border-t pt-3 text-sm">
                  <span className="text-fg-muted">{labels.debt}</span>
                  {isZero(ledgerBalanceDisplay(row.runningBalance).debt) ? (
                    <span className="text-success font-medium">{labels.noDebt}</span>
                  ) : (
                    <MoneyText
                      value={ledgerBalanceDisplay(row.runningBalance).debt}
                      currency={currency}
                      tone="debit"
                    />
                  )}
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
      {!customerId && totals && list.data && list.data.total > 0 ? (
        <Card>
          <CardBody className="flex flex-wrap items-center justify-around gap-4 py-4">
            <Totals
              label={he ? 'סך החיובים בתוצאות' : 'مجموع الزيادات ضمن النتائج'}
              value={totals.totalDebit}
              tone="debit"
              currency={currency}
            />
            <Totals
              label={he ? 'סך ההפחתות בתוצאות' : 'مجموع التخفيضات ضمن النتائج'}
              value={totals.totalCredit}
              tone="credit"
              currency={currency}
            />
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
      <p className="text-fg-muted text-[13px]">{label}</p>
      <MoneyText
        value={value}
        currency={currency}
        tone={tone === 'auto' ? 'balance' : tone}
        size="lg"
      />
    </div>
  );
}

function movementLabel(entry: LedgerEntry): string {
  if (entry.entryType !== 'PAYMENT_CREDIT') return LEDGER_TYPE_LABELS[entry.entryType];
  if (entry.relatedOrderNumbers.length === 0) return 'دفعة';

  const orderNumbers = entry.relatedOrderNumbers.map(displayOrderNumber);
  return orderNumbers.length === 1
    ? `دفعة للطلب ${orderNumbers[0]}`
    : `دفعة للطلبات ${orderNumbers.join('، ')}`;
}
