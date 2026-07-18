import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  AUDIT_ACTION_LABELS,
  LEDGER_TYPE_LABELS,
  ORDER_STATUS_LABELS,
  type LedgerEntry,
} from '@oh/contracts';
import type { CurrencyCode } from '@oh/money';
import {
  Button,
  Card,
  CardBody,
  CardSkeleton,
  ConfirmDialog,
  DataTable,
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  ErrorState,
  Field,
  Input,
  MoneyText,
  ORDER_STATUS_BADGE,
  PageHeader,
  StatusBadge,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  toast,
  type Column,
} from '@oh/ui';
import {
  Archive,
  CheckCircle2,
  Copy,
  FileText,
  ListOrdered,
  Pencil,
  ShoppingBag,
  Trash2,
  Undo2,
  XCircle,
} from 'lucide-react';
import { ApiRequestError } from '@/lib/api';
import { useAuth } from '@/app/auth-context';
import { useLedger } from '@/features/ledger/api';
import { useEntityActivity } from '@/features/audit/api';
import {
  useArchiveOrder,
  useCancelOrder,
  useConfirmOrder,
  useDeleteOrder,
  useDuplicateOrder,
  useOrder,
  useRevertToDraft,
} from './api';

/**
 * تفاصيل الطلب — مطابقة لتصميم `ui`.
 *
 * تبويبات: البنود · الدفعات · قيود الدفتر · النشاط.
 * شريط إجراءات حسب الحالة والصلاحية: تأكيد · تعديل · نسخ · حذف · إلغاء ·
 * أرشفة · إرجاع لمسودة. كل عملية محكومة بالخادم أيضًا.
 */
export function OrderDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, can } = useAuth();
  const currency = (user?.store?.currency ?? 'ILS') as CurrencyCode;

  const orderQuery = useOrder(id);
  const ledgerQuery = useLedger({ refId: id, refType: 'ORDER', pageSize: 25 });
  const activityQuery = useEntityActivity('Order', id, can('audit.read'));

  const confirm = useConfirmOrder(id ?? '');
  const cancel = useCancelOrder(id ?? '');
  const duplicate = useDuplicateOrder();
  const del = useDeleteOrder();
  const archive = useArchiveOrder();
  const revert = useRevertToDraft();

  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [deleteOpen, setDeleteOpen] = useState(false);

  if (orderQuery.isLoading) {
    return (
      <div className="space-y-5">
        <CardSkeleton />
        <CardSkeleton />
      </div>
    );
  }
  if (orderQuery.isError || !orderQuery.data) {
    return (
      <Card>
        <ErrorState
          message={
            orderQuery.error instanceof ApiRequestError ? orderQuery.error.message : 'تعذّر تحميل الطلب.'
          }
          onRetry={() => void orderQuery.refetch()}
        />
      </Card>
    );
  }

  const order = orderQuery.data;
  const badge = ORDER_STATUS_BADGE[order.status];
  const editable = order.status === 'DRAFT' || order.status === 'QUOTE';

  const onError = (e: unknown) => {
    if (e instanceof ApiRequestError) toast.apiError(e.message, e.requestId);
    else toast.error('تعذّرت العملية.');
  };

  const doConfirm = () =>
    confirm.mutate(
      { version: order.version, overrideCreditLimit: false },
      { onSuccess: (o) => toast.success(`أُكِّد الطلب ${o.number}`), onError },
    );

  const doDuplicate = () =>
    duplicate.mutate(order.id, {
      onSuccess: (o) => {
        toast.success(`نُسخ إلى مسودة ${o.number}`);
        navigate(`/orders/${o.id}`);
      },
      onError,
    });

  const doArchive = () =>
    archive.mutate(
      { id: order.id, version: order.version, archived: !order.isArchived },
      { onSuccess: () => toast.success(order.isArchived ? 'أُلغيت الأرشفة' : 'أُرشف الطلب'), onError },
    );

  const doRevert = () =>
    revert.mutate(
      { id: order.id, version: order.version },
      { onSuccess: () => toast.success('أُرجع إلى مسودة'), onError },
    );

  // ── أعمدة البنود ─────────────────────────────────────────────────────────
  const itemColumns: Column<(typeof order.items)[number]>[] = [
    { header: 'البند', render: (r) => <span className="font-medium text-fg">{r.name}</span> },
    {
      header: 'الكمية',
      align: 'center',
      render: (r) => (
        <span className="tabular-nums" dir="ltr">
          {r.quantity}
        </span>
      ),
    },
    {
      header: 'السعر',
      align: 'end',
      render: (r) => <MoneyText value={r.unitPrice} currency={currency} tone="plain" withSymbol={false} />,
    },
    {
      header: 'الخصم',
      align: 'end',
      hideBelow: 'sm',
      render: (r) =>
        r.discount !== '0.00' ? (
          <MoneyText value={r.discount} currency={currency} tone="plain" withSymbol={false} />
        ) : (
          <span className="text-fg-subtle">—</span>
        ),
    },
    {
      header: 'ضريبة%',
      align: 'center',
      hideBelow: 'sm',
      render: (r) => (
        <span className="tabular-nums text-fg-muted" dir="ltr">
          {r.taxRate}
        </span>
      ),
    },
    {
      header: 'الإجمالي',
      align: 'end',
      render: (r) => <MoneyText value={r.lineTotal} currency={currency} tone="plain" />,
    },
  ];

  const ledgerColumns: Column<LedgerEntry>[] = [
    { header: 'التاريخ', render: (r) => <span className="tabular-nums text-[13px]" dir="ltr">{r.occurredAt.slice(0, 10)}</span> },
    { header: 'النوع', render: (r) => <span className="text-[13px]">{LEDGER_TYPE_LABELS[r.entryType]}</span> },
    {
      header: 'مدين',
      align: 'end',
      render: (r) => (r.debit !== '0.00' ? <MoneyText value={r.debit} currency={currency} tone="debit" withSymbol={false} /> : '—'),
    },
    {
      header: 'دائن',
      align: 'end',
      render: (r) => (r.credit !== '0.00' ? <MoneyText value={r.credit} currency={currency} tone="credit" withSymbol={false} /> : '—'),
    },
    {
      header: 'الرصيد بعد',
      align: 'end',
      render: (r) => <MoneyText value={r.runningBalance} currency={currency} tone="balance" withSymbol={false} />,
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title={`الطلب ${order.number}`}
        icon={ShoppingBag}
        breadcrumbs={[{ label: 'الطلبات', href: '/orders' }, { label: order.number }]}
        linkAs={Link}
        actions={
          <div className="flex flex-wrap gap-2">
            {editable && can('orders.confirm') ? (
              <Button variant="brand" onClick={doConfirm} loading={confirm.isPending}>
                <CheckCircle2 aria-hidden />
                تأكيد
              </Button>
            ) : null}
            {order.status === 'QUOTE' && can('orders.update') ? (
              <Button variant="outline" onClick={doRevert} loading={revert.isPending}>
                <Undo2 aria-hidden />
                إرجاع لمسودة
              </Button>
            ) : null}
            {can('orders.create') ? (
              <Button variant="outline" onClick={doDuplicate} loading={duplicate.isPending}>
                <Copy aria-hidden />
                نسخ
              </Button>
            ) : null}
            {can('orders.update') && order.status !== 'CANCELLED' ? (
              <Button variant="outline" onClick={doArchive} loading={archive.isPending}>
                {order.isArchived ? 'إلغاء الأرشفة' : 'أرشفة'}
              </Button>
            ) : null}
            {editable && can('orders.cancel') ? (
              <Button variant="ghost" onClick={() => setDeleteOpen(true)}>
                <Trash2 aria-hidden />
                حذف
              </Button>
            ) : null}
            {!editable && order.status !== 'CANCELLED' && can('orders.cancel') && order.paidAmount === '0.00' ? (
              <Button variant="danger" onClick={() => setCancelOpen(true)}>
                <XCircle aria-hidden />
                إلغاء
              </Button>
            ) : null}
          </div>
        }
      />

      {/* ── ملخص الطلب ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardBody>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge tone={badge.tone}>{badge.label}</StatusBadge>
                {/* مؤشّر أرشفة صريح — الطلب المؤرشف مخفي من القوائم لكنه قابل للفتح. */}
                {order.isArchived ? (
                  <StatusBadge tone="neutral">
                    <Archive className="size-3" aria-hidden />
                    مؤرشف
                  </StatusBadge>
                ) : null}
              </div>
              <Link to={`/customers/${order.customerId}`} className="text-sm font-medium text-accent hover:underline">
                {order.customerName} · {order.customerCode}
              </Link>
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-[13px] sm:grid-cols-4">
              <Meta label="تاريخ الإصدار" value={order.issuedAt.slice(0, 10)} />
              <Meta label="تاريخ الاستحقاق" value={order.dueAt?.slice(0, 10) ?? '—'} danger={order.isOverdue} />
              <Meta label="الحالة" value={ORDER_STATUS_LABELS[order.status]} />
              <Meta label="عدد البنود" value={String(order.itemCount)} />
            </dl>
            {order.notes ? (
              <p className="mt-4 rounded-ctrl bg-card-muted px-3 py-2 text-[13px] text-fg-muted">
                {order.notes}
              </p>
            ) : null}
          </CardBody>
        </Card>

        {/* الإجماليات */}
        <Card>
          <CardBody>
            <dl className="space-y-2 text-sm">
              <Row label="المجموع الفرعي" value={order.subtotal} currency={currency} />
              <Row label="الخصم" value={order.discountAmount} currency={currency} />
              <Row label="الضريبة" value={order.taxAmount} currency={currency} />
              <div className="flex items-center justify-between border-t border-border pt-2">
                <dt className="font-semibold text-fg">الإجمالي</dt>
                <dd><MoneyText value={order.total} currency={currency} tone="plain" size="lg" /></dd>
              </div>
              <Row label="المدفوع" value={order.paidAmount} currency={currency} tone="credit" />
              <div className="flex items-center justify-between border-t border-border pt-2">
                <dt className="font-semibold text-fg">المتبقي</dt>
                <dd>
                  <MoneyText
                    value={order.remainingAmount}
                    currency={currency}
                    tone={order.remainingAmount === '0.00' ? 'neutral' : 'debit'}
                    size="lg"
                  />
                </dd>
              </div>
            </dl>
          </CardBody>
        </Card>
      </div>

      {/* ── التبويبات ──────────────────────────────────────────────────── */}
      <Card>
        <Tabs defaultValue="items">
          <div className="px-5 pt-2">
            <TabsList>
              <TabsTrigger value="items">البنود</TabsTrigger>
              <TabsTrigger value="payments">الدفعات</TabsTrigger>
              {can('ledger.read') ? <TabsTrigger value="ledger">قيود الدفتر</TabsTrigger> : null}
              {can('audit.read') ? <TabsTrigger value="activity">النشاط</TabsTrigger> : null}
            </TabsList>
          </div>

          <TabsContent value="items">
            <DataTable
              caption={`بنود الطلب ${order.number}`}
              columns={itemColumns}
              rows={order.items}
              rowKey={(r) => r.id}
              empty={{ title: 'لا توجد بنود' }}
              className="border-0 shadow-none"
            />
          </TabsContent>

          <TabsContent value="payments">
            {order.allocations.length === 0 ? (
              <p className="px-5 py-10 text-center text-[13px] text-fg-subtle">
                لا توجد دفعات موزَّعة على هذا الطلب بعد.
              </p>
            ) : (
              <ul className="divide-y divide-border-subtle">
                {order.allocations.map((a) => (
                  <li key={a.paymentId} className="flex items-center justify-between px-5 py-3">
                    <MoneyText value={a.amount} currency={currency} tone="credit" />
                    <span className="text-xs text-fg-muted">{a.paidAt.slice(0, 10)}</span>
                    <Link to="/payments" className="text-[13px] font-medium text-accent hover:underline">
                      {a.paymentNumber}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>

          {can('ledger.read') ? (
            <TabsContent value="ledger">
              <DataTable
                caption={`قيود الطلب ${order.number}`}
                columns={ledgerColumns}
                rows={ledgerQuery.data?.items ?? []}
                rowKey={(r) => r.id}
                loading={ledgerQuery.isLoading}
                empty={{ title: 'لا توجد قيود', description: 'يظهر القيد المدين عند تأكيد الطلب.' }}
                className="border-0 shadow-none"
              />
            </TabsContent>
          ) : null}

          {can('audit.read') ? (
            <TabsContent value="activity">
              <ActivityTimeline
                items={activityQuery.data ?? []}
                loading={activityQuery.isLoading}
              />
            </TabsContent>
          ) : null}
        </Tabs>
      </Card>

      {/* حوار الإلغاء */}
      <Dialog open={cancelOpen} onOpenChange={(o) => { if (!o) { setCancelOpen(false); setCancelReason(''); } }}>
        <DialogContent size="sm" onOpenAutoFocus={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>إلغاء الطلب {order.number}</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <p className="mb-4 text-sm text-fg-muted">يولّد قيد عكس يُلغي أثر الطلب في الدفتر. يبقى مرئيًا بحالة «ملغي».</p>
            <Field label="سبب الإلغاء" required error={cancelReason.length > 0 && cancelReason.trim().length < 3 ? '3 أحرف على الأقل.' : undefined}>
              {(p) => <Input {...p} value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} autoFocus />}
            </Field>
          </DialogBody>
          <DialogFooter>
            <Button
              variant="danger"
              disabled={cancelReason.trim().length < 3}
              loading={cancel.isPending}
              onClick={() =>
                cancel.mutate(
                  { version: order.version, reason: cancelReason.trim() },
                  { onSuccess: () => { toast.success('أُلغي الطلب'); setCancelOpen(false); setCancelReason(''); }, onError },
                )
              }
            >
              إلغاء الطلب
            </Button>
            <DialogClose asChild><Button variant="outline">تراجع</Button></DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* تأكيد الحذف */}
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`حذف المسودة ${order.number}`}
        description="سيُحذف الطلب نهائيًا. متاح للمسودات وعروض الأسعار فقط (بلا أثر محاسبي)."
        confirmLabel="حذف"
        variant="danger"
        loading={del.isPending}
        onConfirm={() =>
          del.mutate(
            { id: order.id, version: order.version },
            { onSuccess: () => { toast.success('حُذفت المسودة'); navigate('/orders'); }, onError },
          )
        }
      />
    </div>
  );
}

function Meta({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <div>
      <dt className="text-fg-muted">{label}</dt>
      <dd className={`mt-0.5 font-medium ${danger ? 'text-danger' : 'text-fg'}`} dir={/^\d/.test(value) ? 'ltr' : undefined}>
        {value}
      </dd>
    </div>
  );
}

function Row({
  label,
  value,
  currency,
  tone = 'plain',
}: {
  label: string;
  value: string;
  currency: CurrencyCode;
  tone?: 'plain' | 'credit';
}) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-fg-muted">{label}</dt>
      <dd><MoneyText value={value} currency={currency} tone={tone} withSymbol={false} /></dd>
    </div>
  );
}

/** خط زمني للنشاط — مشترك مع ملف الزبون. */
export function ActivityTimeline({
  items,
  loading,
}: {
  items: { id: string; action: string; summary: string; actorName: string | null; createdAt: string }[];
  loading?: boolean;
}) {
  if (loading) {
    return <p className="px-5 py-10 text-center text-[13px] text-fg-subtle">جارٍ التحميل…</p>;
  }
  if (items.length === 0) {
    return <p className="px-5 py-10 text-center text-[13px] text-fg-subtle">لا يوجد نشاط مسجّل.</p>;
  }

  return (
    <ul className="space-y-0 px-5 py-2">
      {items.map((a) => (
        <li key={a.id} className="flex gap-3 border-s border-border-subtle ps-4 pb-4 last:pb-2">
          <FileText className="-ms-[26px] size-4 shrink-0 rounded-full bg-card text-fg-subtle" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-medium text-fg">
              {AUDIT_ACTION_LABELS[a.action] ?? a.action}
            </p>
            <p className="truncate text-xs text-fg-muted">{a.summary}</p>
            <p className="mt-0.5 text-[11px] text-fg-subtle">
              {a.actorName ?? 'النظام'} · {a.createdAt.slice(0, 16).replace('T', ' ')}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}

export { ListOrdered, Pencil };
