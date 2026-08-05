import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  AlertTriangle,
  ArchiveRestore,
  CalendarClock,
  CalendarDays,
  ChevronLeft,
  MessageCircle,
  Pencil,
  Plus,
  Trash2,
  Users,
  Wallet,
} from 'lucide-react';
import { type Customer, type CustomerListQuery } from '@oh/contracts';
import {
  formatMoney,
  greaterThan,
  greaterThanOrEqual,
  negate,
  toMoneyString,
  type CurrencyCode,
} from '@oh/money';
import {
  Button,
  cn,
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
import { currentLocale } from '@/lib/i18n';
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
  const [searchParams, setSearchParams] = useSearchParams();
  const { can, user } = useAuth();
  const currency = (user?.store?.currency ?? 'ILS') as CurrencyCode;
  const locale = currentLocale();
  const debtUsageLabels = {
    ar: {
      header: 'استخدام حد الدين',
      used: 'المستخدم',
      remaining: 'المتبقي',
      dueDate: 'يوم السداد الشهري',
      messageTitle: 'إرسال تذكير بالسداد',
      paymentDueToday: 'حلّ أو تجاوز موعد السداد وما زال الحساب مديونًا',
      allAccounts: 'كل الحسابات',
      accountState: 'حالة الحساب',
      debit: 'مديون',
      credit: 'له رصيد',
      settled: 'رصيد صفري',
    },
    he: {
      header: 'ניצול המסגרת',
      used: 'נוצל',
      remaining: 'נותר',
      dueDate: 'יום תשלום חודשי',
      messageTitle: 'שליחת תזכורת לתשלום',
      paymentDueToday: 'מועד התשלום הגיע או עבר והחשבון עדיין בחובה',
      allAccounts: 'כל החשבונות',
      accountState: 'מצב החשבון',
      debit: 'חייב',
      credit: 'יש לו יתרה',
      settled: 'יתרה אפס',
    },
    en: {
      header: 'Debt limit usage',
      used: 'Used',
      remaining: 'Remaining',
      dueDate: 'Monthly payment day',
      messageTitle: 'Send payment reminder',
      paymentDueToday: 'Payment is due or overdue and the account still has debt',
      allAccounts: 'All accounts',
      accountState: 'Account status',
      debit: 'Owes money',
      credit: 'Has credit',
      settled: 'Zero balance',
    },
  }[locale];
  const today = isoDateInTimeZone(
    new Date(),
    user?.store?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
  );

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState(() => searchParams.get('search') ?? '');
  const [accountState, setAccountState] = useState('');
  const [sort, setSort] = useState<{ key: string; order: 'asc' | 'desc' }>({
    key: 'createdAt',
    order: 'desc',
  });

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | undefined>();
  const [archiveTarget, setArchiveTarget] = useState<Customer | null>(null);

  useEffect(() => {
    setSearch(searchParams.get('search') ?? '');
    setPage(1);
  }, [searchParams]);

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
    const next = new URLSearchParams(searchParams);
    next.delete('search');
    setSearchParams(next, { replace: true });
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
      render: (row) => {
        const dueToday = isPaymentDue(row, today);
        return (
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-1.5">
              <p className="text-fg truncate font-medium">{row.name}</p>
              {dueToday ? (
                <AlertTriangle
                  className="text-danger size-4 shrink-0"
                  aria-label={debtUsageLabels.paymentDueToday}
                />
              ) : null}
              {dueToday && whatsappPhone(row.phone) ? (
                <Button
                  variant="outline"
                  size="icon"
                  className="size-7"
                  title={debtUsageLabels.messageTitle}
                  asChild
                >
                  <a
                    href={whatsappReminderUrl(row, currency, locale, 'DUE_TODAY')}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`${debtUsageLabels.messageTitle}: ${row.name}`}
                    onClick={(event) => event.stopPropagation()}
                  >
                    <MessageCircle className="text-success" aria-hidden />
                  </a>
                </Button>
              ) : null}
            </div>
            {row.company ? <p className="text-fg-muted truncate text-xs">{row.company}</p> : null}
          </div>
        );
      },
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
      header: debtUsageLabels.dueDate,
      render: (row) => (
        <span className="text-fg tabular-nums">{formatDueDay(row.paymentDueDay, locale)}</span>
      ),
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
      header: debtUsageLabels.header,
      align: 'end',
      render: (row) => {
        const used = row.accountState === 'DEBIT' ? row.balance : '0.00';
        const remaining = row.accountState === 'DEBIT' ? row.availableCredit : row.creditLimit;
        return (
          <div className="space-y-1 text-xs">
            <div className="flex items-center justify-end gap-2">
              <span className="text-fg-muted">{debtUsageLabels.used}</span>
              <MoneyText
                value={used}
                currency={currency}
                tone={used === '0.00' ? 'neutral' : 'debit'}
                withSymbol={false}
                size="sm"
              />
            </div>
            <div className="flex items-center justify-end gap-2">
              <span className="text-fg-muted">{debtUsageLabels.remaining}</span>
              <MoneyText
                value={remaining}
                currency={currency}
                tone="credit"
                withSymbol={false}
                size="sm"
              />
            </div>
          </div>
        );
      },
    },
    {
      header: t('common.actions'),
      align: 'end',
      render: (row) => {
        const dueToday = isPaymentDue(row, today);
        const overLimit =
          greaterThan(row.creditLimit, '0') && greaterThanOrEqual(row.balance, row.creditLimit);
        const reminderReason = dueToday ? 'DUE_TODAY' : 'OVER_LIMIT';
        return (
          <div
            className="flex items-center justify-end gap-1"
            onClick={(event) => event.stopPropagation()}
          >
            {!dueToday && overLimit ? (
              whatsappPhone(row.phone) ? (
                <Button variant="outline" size="icon" title={debtUsageLabels.messageTitle} asChild>
                  <a
                    href={whatsappReminderUrl(row, currency, locale, reminderReason)}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`${debtUsageLabels.messageTitle}: ${row.name}`}
                  >
                    <MessageCircle className="text-success" aria-hidden />
                  </a>
                </Button>
              ) : (
                <Button variant="outline" size="icon" title="لا يوجد رقم هاتف صالح للزبون" disabled>
                  <MessageCircle aria-hidden />
                </Button>
              )
            ) : null}
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
        );
      },
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
          <>
            <Button variant="outline" asChild>
              <Link to="/customers/archive">
                <ArchiveRestore aria-hidden />
                {t('nav.customerArchive')}
              </Link>
            </Button>
            {can('customers.write') ? (
              <Button variant="accent" onClick={openAdd}>
                <Plus aria-hidden />
                إضافة زبون جديد
              </Button>
            ) : null}
          </>
        }
      />

      {/* بطاقات الإحصاء */}
      {stats.isLoading ? (
        <StatCardsSkeleton count={4} />
      ) : stats.data ? (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
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
            label="تجاوزوا موعد السداد"
            value={stats.data.overduePaymentCustomers}
            icon={CalendarClock}
            tone="orange"
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
            const next = new URLSearchParams(searchParams);
            if (v) next.set('search', v);
            else next.delete('search');
            setSearchParams(next, { replace: true });
          }}
          placeholder="ابحث بالاسم أو الهاتف…"
        />
        <SelectFilter
          value={accountState}
          onChange={(v) => {
            setAccountState(v);
            setPage(1);
          }}
          allLabel={debtUsageLabels.allAccounts}
          label={debtUsageLabels.accountState}
          options={[
            { value: 'DEBIT', label: debtUsageLabels.debit },
            { value: 'CREDIT', label: debtUsageLabels.credit },
            { value: 'SETTLED', label: debtUsageLabels.settled },
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
          tableClassName="min-w-[1260px] table-fixed"
          mobileRender={(row) => (
            <article
              className={cn(
                'border-border bg-card rounded-card shadow-card border p-4',
                row.accountState === 'DEBIT' && 'bg-danger-soft',
              )}
              onClick={() => navigate(`/customers/${row.id}`)}
            >
              <div className="flex items-start gap-3">
                <ChevronLeft className="text-fg-subtle mt-1 size-5 shrink-0" aria-hidden />
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-center gap-1.5">
                    <p className="text-fg truncate text-base font-bold">{row.name}</p>
                    {isPaymentDue(row, today) ? (
                      <AlertTriangle
                        className="text-danger size-4 shrink-0"
                        aria-label={debtUsageLabels.paymentDueToday}
                      />
                    ) : null}
                    {isPaymentDue(row, today) && whatsappPhone(row.phone) ? (
                      <Button variant="outline" size="icon" className="size-8" asChild>
                        <a
                          href={whatsappReminderUrl(row, currency, locale, 'DUE_TODAY')}
                          target="_blank"
                          rel="noreferrer"
                          aria-label={`${debtUsageLabels.messageTitle}: ${row.name}`}
                          onClick={(event) => event.stopPropagation()}
                        >
                          <MessageCircle className="text-success" aria-hidden />
                        </a>
                      </Button>
                    ) : null}
                  </div>
                  <p className="text-fg-muted mt-1 text-sm tabular-nums" dir="ltr">
                    {row.phone ?? '—'}
                  </p>
                </div>
                <MoneyText
                  value={toMoneyString(negate(row.balance), 2)}
                  currency={currency}
                  tone="auto"
                  size="lg"
                />
              </div>

              <div className="border-border-subtle mt-3 flex items-center justify-between gap-3 border-t pt-3">
                <div className="text-fg-muted flex min-w-0 items-center gap-1.5 text-xs">
                  <CalendarDays className="size-4 shrink-0" aria-hidden />
                  <span>{debtUsageLabels.dueDate}</span>
                  <span className="text-fg tabular-nums" dir="ltr">
                    {formatDueDay(row.paymentDueDay, locale)}
                  </span>
                </div>
                <div
                  className="flex shrink-0 items-center gap-1"
                  onClick={(event) => event.stopPropagation()}
                >
                  {!isPaymentDue(row, today) &&
                  greaterThan(row.creditLimit, '0') &&
                  greaterThanOrEqual(row.balance, row.creditLimit) ? (
                    whatsappPhone(row.phone) ? (
                      <Button variant="outline" size="icon" asChild>
                        <a
                          href={whatsappReminderUrl(row, currency, locale, 'OVER_LIMIT')}
                          target="_blank"
                          rel="noreferrer"
                          aria-label={`${debtUsageLabels.messageTitle}: ${row.name}`}
                        >
                          <MessageCircle className="text-success" aria-hidden />
                        </a>
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="icon"
                        title="لا يوجد رقم هاتف صالح للزبون"
                        disabled
                      >
                        <MessageCircle aria-hidden />
                      </Button>
                    )
                  ) : null}
                  {can('customers.write') ? (
                    <Button
                      variant="outline"
                      size="icon"
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
                      aria-label={`أرشفة ${row.name}`}
                      onClick={() => setArchiveTarget(row)}
                    >
                      <Trash2 className="text-danger" aria-hidden />
                    </Button>
                  ) : null}
                </div>
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
        title="نقل الزبون إلى الأرشيف"
        description={
          archiveTarget
            ? `سيُنقل "${archiveTarget.name}" إلى الأرشيف لمدة 30 يومًا ويمكن استعادته خلالها. يجب أن يكون رصيده صفرًا وألا توجد طلبات مستقبلية أو مسودات باسمه.`
            : ''
        }
        confirmLabel="موافق"
        cancelLabel="إلغاء"
        variant="danger"
        loading={archive.isPending}
        onConfirm={doArchive}
      />
    </div>
  );
}

function whatsappPhone(phone: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 9) return null;
  if (digits.startsWith('0')) return `972${digits.slice(1)}`;
  return digits;
}

function whatsappReminderUrl(
  customer: Customer,
  currency: CurrencyCode,
  locale: 'ar' | 'he' | 'en',
  reason: 'DUE_TODAY' | 'OVER_LIMIT',
): string {
  const phone = whatsappPhone(customer.phone) ?? '';
  const debt = formatMoney(customer.balance, { currency });
  const limit = formatMoney(customer.creditLimit, { currency });
  const messages = {
    DUE_TODAY: {
      ar: `مرحبًا ${customer.name}، نود تذكيرك بأن موعد سداد الدين هو اليوم، والرصيد المستحق هو ${debt}. نرجو لطفًا المبادرة إلى السداد. شكرًا لتعاونك.`,
      he: `שלום ${customer.name}, ברצוננו להזכיר שמועד תשלום החוב הוא היום, והיתרה לתשלום היא ${debt}. נשמח להסדרת התשלום. תודה על שיתוף הפעולה.`,
      en: `Hello ${customer.name}, this is a kind reminder that the debt is due today and the outstanding balance is ${debt}. Please arrange payment. Thank you for your cooperation.`,
    },
    OVER_LIMIT: {
      ar: `مرحبًا ${customer.name}، نود تذكيرك بأن الدين الحالي بلغ ${debt} وقد وصل أو تخطى الحد الأقصى المسموح به وهو ${limit}. نرجو لطفًا المبادرة إلى سداد الدين في أقرب وقت. شكرًا لتعاونك.`,
      he: `שלום ${customer.name}, ברצוננו להזכיר כי החוב הנוכחי הגיע ל-${debt} והגיע או עבר את המסגרת המרבית המותרת בסך ${limit}. נשמח אם תפעל להסדרת החוב בהקדם. תודה על שיתוף הפעולה.`,
      en: `Hello ${customer.name}, this is a kind reminder that the current debt is ${debt} and has reached or exceeded the maximum allowed limit of ${limit}. Please arrange payment at your earliest convenience. Thank you for your cooperation.`,
    },
  };
  const message = messages[reason][locale];
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

function isPaymentDue(customer: Customer, today: string): boolean {
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7));
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return (
    customer.accountState === 'DEBIT' &&
    Number(today.slice(8, 10)) >= Math.min(customer.paymentDueDay, lastDay)
  );
}

function formatDueDay(day: number, locale: 'ar' | 'he' | 'en'): string {
  if (locale === 'ar') return `يوم ${day} من كل شهر`;
  if (locale === 'he') return `בכל ${day} בחודש`;
  return `Day ${day} of every month`;
}

function isoDateInTimeZone(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const values = new Map(parts.map((part) => [part.type, part.value]));
  return `${values.get('year')}-${values.get('month')}-${values.get('day')}`;
}
