import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Building2, MoreHorizontal, PauseCircle, Pencil, PlayCircle, Plus } from 'lucide-react';
import type {
  PaginatedResult,
  SetTenantStatusRequest,
  Tenant,
  TenantStatus,
} from '@oh/contracts';
import {
  Button,
  DataTable,
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Field,
  FilterBar,
  Input,
  PageHeader,
  Pagination,
  SearchFilter,
  SelectFilter,
  StatusBadge,
  TENANT_STATUS_BADGE,
  toast,
  type Column,
} from '@oh/ui';
import { ApiRequestError, api, buildQuery } from '@/lib/api';

/**
 * قائمة المحلات — شاشة تعمل بالكامل ببيانات حقيقية.
 *
 * بحث · فلترة بالحالة · فرز · ترقيم — كلها تُنفَّذ **على الخادم**.
 *
 * ⚠️ لماذا لا نفلتر في المتصفح؟ لأن ذلك يتطلب تحميل كل المحلات أولًا. مع
 *    1000 محل يصير الطلب بطيئًا، ومع 100,000 يستحيل. الترقيم من جهة الخادم
 *    من اليوم الأول يعني أن الشاشة لا تنهار مع نمو المنصة.
 */
export function TenantsListPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [sort, setSort] = useState<{ key: string; order: 'asc' | 'desc' }>({
    key: 'createdAt',
    order: 'desc',
  });

  const [statusTarget, setStatusTarget] = useState<Tenant | null>(null);
  const [reason, setReason] = useState('');

  const isFiltered = search !== '' || status !== '';

  const query = useQuery({
    queryKey: ['platform', 'tenants', { page, pageSize, search, status, sort }],
    queryFn: () =>
      api.get<PaginatedResult<Tenant>>(
        `/platform/tenants${buildQuery({
          page,
          pageSize,
          search,
          status,
          sortBy: sort.key,
          sortOrder: sort.order,
        })}`,
      ),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: SetTenantStatusRequest }) =>
      api.post<Tenant>(`/platform/tenants/${id}/status`, body),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['platform'] });
      toast.success(
        variables.body.status === 'SUSPENDED' ? 'أُوقف المحل وأُنهيت جلساته.' : 'فُعّل المحل.',
      );
      setStatusTarget(null);
      setReason('');
    },
    onError: (error) => {
      if (error instanceof ApiRequestError) {
        toast.apiError(error.message, error.requestId);
      } else {
        toast.error(t('errors.network'));
      }
    },
  });

  const resetFilters = () => {
    setSearch('');
    setStatus('');
    setPage(1);
  };

  const toggleSort = (key: string) => {
    setSort((current) =>
      current.key === key
        ? { key, order: current.order === 'asc' ? 'desc' : 'asc' }
        : { key, order: 'desc' },
    );
  };

  const columns: Column<Tenant>[] = [
    {
      key: 'name',
      header: t('platform.tenantName'),
      render: (row) => (
        <div className="min-w-0">
          <Link
            to={`/platform/tenants/${row.id}`}
            className="block truncate font-semibold text-accent hover:underline"
          >
            {row.name}
          </Link>
          <p className="truncate text-xs text-fg-muted" dir="ltr">
            {row.slug}
          </p>
        </div>
      ),
    },
    {
      header: t('platform.ownerName'),
      hideBelow: 'md',
      render: (row) =>
        row.ownerName ? (
          <div className="min-w-0">
            <p className="truncate text-sm text-fg">{row.ownerName}</p>
            <p className="truncate text-xs text-fg-muted" dir="ltr">
              {row.ownerEmail}
            </p>
          </div>
        ) : (
          <span className="text-fg-subtle">—</span>
        ),
    },
    {
      header: t('platform.plan'),
      hideBelow: 'lg',
      render: (row) =>
        row.planName ? (
          <span className="text-sm text-fg">{row.planName}</span>
        ) : (
          <span className="text-fg-subtle">—</span>
        ),
    },
    {
      header: t('platform.storeCount'),
      align: 'center',
      hideBelow: 'xl',
      render: (row) => <span className="tabular-nums text-fg">{row.storeCount}</span>,
    },
    {
      header: t('platform.userCount'),
      align: 'center',
      hideBelow: 'xl',
      render: (row) => <span className="tabular-nums text-fg">{row.userCount}</span>,
    },
    {
      key: 'status',
      header: t('common.status'),
      align: 'center',
      render: (row) => {
        const badge = TENANT_STATUS_BADGE[row.status as TenantStatus];
        return (
          <StatusBadge tone={badge.tone} withDot>
            {badge.label}
          </StatusBadge>
        );
      },
    },
    {
      key: 'createdAt',
      header: t('platform.createdAt'),
      hideBelow: 'lg',
      render: (row) => (
        <span className="tabular-nums text-[13px] text-fg-muted" dir="ltr">
          {row.createdAt.slice(0, 10)}
        </span>
      ),
    },
    {
      header: t('common.actions'),
      align: 'end',
      width: '80px',
      render: (row) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon" aria-label={`إجراءات ${row.name}`}>
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => navigate(`/platform/tenants/${row.id}`)}>
              <Pencil />
              {t('common.edit')}
            </DropdownMenuItem>

            {row.status === 'SUSPENDED' ? (
              <DropdownMenuItem onClick={() => setStatusTarget(row)}>
                <PlayCircle />
                {t('platform.activate')}
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem destructive onClick={() => setStatusTarget(row)}>
                <PauseCircle />
                {t('platform.suspend')}
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  const suspending = statusTarget?.status !== 'SUSPENDED';

  return (
    <div className="space-y-5">
      <PageHeader
        title={t('platform.tenantsList')}
        icon={Building2}
        breadcrumbs={[
          { label: t('nav.platform'), href: '/platform' },
          { label: t('platform.tenantsList') },
        ]}
        linkAs={Link}
        actions={
          <Button variant="brand" asChild>
            <Link to="/platform/tenants/new">
              <Plus aria-hidden />
              {t('platform.addTenant')}
            </Link>
          </Button>
        }
      />

      <FilterBar>
        <SearchFilter
          value={search}
          onChange={(value) => {
            setSearch(value);
            setPage(1);
          }}
          placeholder="ابحث بالاسم أو المعرّف…"
        />
        <SelectFilter
          value={status}
          onChange={(value) => {
            setStatus(value);
            setPage(1);
          }}
          allLabel="كل الحالات"
          label={t('common.status')}
          options={[
            { value: 'ACTIVE', label: 'نشط' },
            { value: 'TRIAL', label: 'تجريبي' },
            { value: 'SUSPENDED', label: 'موقوف' },
            { value: 'CANCELLED', label: 'ملغى' },
          ]}
        />
      </FilterBar>

      <div>
        <DataTable
          caption="قائمة المحلات المسجّلة في المنصة"
          columns={columns}
          rows={query.data?.items ?? []}
          rowKey={(row) => row.id}
          loading={query.isLoading}
          error={
            query.isError
              ? {
                  message:
                    query.error instanceof ApiRequestError
                      ? query.error.message
                      : 'تعذّر تحميل المحلات.',
                  requestId:
                    query.error instanceof ApiRequestError ? query.error.requestId : undefined,
                }
              : null
          }
          onRetry={() => void query.refetch()}
          isFiltered={isFiltered}
          onResetFilters={resetFilters}
          empty={{
            title: t('platform.noTenants'),
            description: t('platform.noTenantsDescription'),
            action: {
              label: t('platform.addTenant'),
              onClick: () => navigate('/platform/tenants/new'),
            },
          }}
          sort={sort}
          onSortChange={toggleSort}
        />

        {query.data && query.data.total > 0 ? (
          <div className="rounded-b-card border-x border-b border-border bg-card">
            <Pagination
              page={query.data.page}
              pageSize={query.data.pageSize}
              total={query.data.total}
              totalPages={query.data.totalPages}
              onPageChange={setPage}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setPage(1);
              }}
              itemLabel="محل"
            />
          </div>
        ) : null}
      </div>

      {/*
        حوار تغيير الحالة.
        حوار مخصّص لا `ConfirmDialog`: السبب حقل **إلزامي** يجب أن يعيش داخل
        الحوار نفسه — لا معلّقًا فوقه. والسبب يُسجَّل في سجل التدقيق ولا يُحذف،
        فمن حق المستخدم أن يراه في نفس السياق الذي يؤكّد فيه.
      */}
      <Dialog
        open={statusTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setStatusTarget(null);
            setReason('');
          }
        }}
      >
        <DialogContent size="sm" onOpenAutoFocus={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>{suspending ? 'إيقاف المحل' : 'تفعيل المحل'}</DialogTitle>
            <DialogDescription>
              {suspending
                ? `سيُوقف "${statusTarget?.name}" وتُنهى جميع جلسات مستخدميه فورًا.`
                : `سيُعاد تفعيل "${statusTarget?.name}" ويستطيع مستخدموه الدخول مجددًا.`}
            </DialogDescription>
          </DialogHeader>

          <DialogBody>
            <Field
              label={suspending ? t('platform.suspendReason') : 'سبب التفعيل'}
              hint="يُسجَّل في سجل التدقيق ولا يمكن حذفه أو تعديله."
              error={
                reason.length > 0 && reason.trim().length < 3
                  ? 'السبب يجب أن يكون 3 أحرف على الأقل.'
                  : undefined
              }
              required
            >
              {(props) => (
                <Input
                  {...props}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="مثال: عدم سداد الاشتراك"
                  maxLength={500}
                  autoFocus
                />
              )}
            </Field>
          </DialogBody>

          <DialogFooter>
            <Button
              variant={suspending ? 'danger' : 'brand'}
              loading={statusMutation.isPending}
              // الزر معطّل حتى يكتمل السبب — لا نعتمد على تنبيه بعد النقر.
              disabled={reason.trim().length < 3}
              onClick={() => {
                if (!statusTarget) return;
                statusMutation.mutate({
                  id: statusTarget.id,
                  body: {
                    status: suspending ? 'SUSPENDED' : 'ACTIVE',
                    reason: reason.trim(),
                  },
                });
              }}
            >
              {suspending ? t('platform.suspend') : t('platform.activate')}
            </Button>

            <DialogClose asChild>
              <Button variant="outline" disabled={statusMutation.isPending}>
                {t('common.cancel')}
              </Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
