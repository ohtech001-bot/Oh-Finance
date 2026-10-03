import { copy, useCopy } from '@/lib/copy';
import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import {
  Eye,
  EyeOff,
  KeyRound,
  Mail,
  Pencil,
  Phone,
  Plus,
  Power,
  Trash2,
  UserRound,
  Users,
} from 'lucide-react';
import {
  createWorkerSchema,
  updateWorkerSchema,
  type CreateWorkerRequest,
  type UpdateWorkerRequest,
  type Worker,
} from '@oh/contracts';
import {
  Button,
  ConfirmDialog,
  DataTable,
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  Input,
  PageHeader,
  StatusBadge,
  toast,
  type Column,
} from '@oh/ui';
import { useAuth } from '@/app/auth-context';
import { ApiRequestError, api } from '@/lib/api';

const QUERY_KEY = ['employees'] as const;

export function EmployeesPage() {
  useCopy();

  const { can } = useAuth();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [showCreatePassword, setShowCreatePassword] = useState(false);
  const [editTarget, setEditTarget] = useState<Worker | null>(null);
  const [showEditPassword, setShowEditPassword] = useState(false);
  const [statusTarget, setStatusTarget] = useState<Worker | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Worker | null>(null);

  const employees = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => api.get<Worker[]>('/employees'),
  });
  const createForm = useForm<CreateWorkerRequest>({
    resolver: zodResolver(createWorkerSchema),
    defaultValues: { name: '', phone: '', email: '', password: '' },
  });
  const editForm = useForm<UpdateWorkerRequest>({
    resolver: zodResolver(updateWorkerSchema),
    defaultValues: { name: '', phone: '', email: '', password: '' },
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: QUERY_KEY });
  const showMutationError = (error: unknown, fallback: string) => {
    if (error instanceof ApiRequestError) toast.apiError(error.message, error.requestId);
    else toast.error(fallback);
  };

  const create = useMutation({
    mutationFn: (body: CreateWorkerRequest) => api.post<Worker>('/employees', body),
    onSuccess: () => {
      void refresh();
      createForm.reset();
      setCreateOpen(false);
      setShowCreatePassword(false);
      toast.success(copy('تمت إضافة العامل بنجاح.'));
    },
    onError: (error) => showMutationError(error, copy('تعذّرت إضافة العامل.')),
  });
  const update = useMutation({
    mutationFn: (body: UpdateWorkerRequest) =>
      api.patch<Worker>(`/employees/${editTarget?.id}`, body),
    onSuccess: () => {
      void refresh();
      setEditTarget(null);
      setShowEditPassword(false);
      editForm.reset();
      toast.success(copy('تم تعديل بيانات العامل.'));
    },
    onError: (error) => showMutationError(error, copy('تعذّر تعديل العامل.')),
  });
  const setStatus = useMutation({
    mutationFn: (worker: Worker) =>
      api.patch<Worker>(`/employees/${worker.id}/status`, {
        status: worker.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE',
      }),
    onSuccess: () => {
      void refresh();
      setStatusTarget(null);
      toast.success(copy('تم تحديث حالة العامل.'));
    },
    onError: (error) => showMutationError(error, copy('تعذّر تحديث حالة العامل.')),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.delete<void>(`/employees/${id}`),
    onSuccess: () => {
      void refresh();
      setDeleteTarget(null);
      toast.success(copy('تم حذف العامل.'));
    },
    onError: (error) => showMutationError(error, copy('تعذّر حذف العامل.')),
  });

  const openEdit = (worker: Worker) => {
    editForm.reset({
      name: worker.name,
      phone: worker.phone,
      email: worker.email,
      password: '',
    });
    setShowEditPassword(false);
    setEditTarget(worker);
  };

  const actions = (worker: Worker) =>
    can('employees.manage') ? (
      <div
        className="flex flex-wrap items-center justify-end gap-2"
        onClick={(event) => event.stopPropagation()}
      >
        <Button variant="outline" size="sm" onClick={() => openEdit(worker)}>
          <Pencil aria-hidden />
          {copy('تعديل')}
        </Button>
        <Button variant="outline" size="sm" onClick={() => setStatusTarget(worker)}>
          <Power aria-hidden />
          {worker.status === 'ACTIVE' ? copy('تعطيل') : copy('تفعيل')}
        </Button>
        <Button variant="outline" size="sm" onClick={() => setDeleteTarget(worker)}>
          <Trash2 className="text-danger" aria-hidden />
          {copy('حذف')}
        </Button>
      </div>
    ) : null;

  const columns: Column<Worker>[] = [
    {
      header: copy('الاسم'),
      render: (row) => <span className="text-fg font-semibold">{row.name}</span>,
    },
    {
      header: copy('رقم الهاتف'),
      render: (row) => (
        <span className="text-fg tabular-nums" dir="ltr">
          {row.phone}
        </span>
      ),
    },
    {
      header: copy('البريد الإلكتروني'),
      render: (row) => (
        <span className="text-fg" dir="ltr">
          {row.email}
        </span>
      ),
    },
    {
      header: copy('الوظيفة'),
      render: () => <span className="text-fg">{copy('عامل')}</span>,
    },
    {
      header: copy('الحالة'),
      align: 'center',
      render: (row) => (
        <StatusBadge tone={row.status === 'ACTIVE' ? 'credit' : 'neutral'}>
          {row.status === 'ACTIVE' ? copy('نشط') : copy('متوقف')}
        </StatusBadge>
      ),
    },
    {
      header: copy('الإجراءات'),
      align: 'end',
      width: '290px',
      render: actions,
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title={copy('الموظفون')}
        description={copy('إدارة حسابات العاملين في المحل.')}
        icon={Users}
        actions={
          can('employees.manage') ? (
            <Button variant="brand" onClick={() => setCreateOpen(true)}>
              <Plus aria-hidden />
              {copy('إضافة عامل')}
            </Button>
          ) : undefined
        }
      />

      <DataTable
        caption={copy('عمال المحل')}
        columns={columns}
        rows={employees.data ?? []}
        rowKey={(row) => row.id}
        loading={employees.isLoading}
        error={
          employees.isError
            ? {
                message:
                  employees.error instanceof ApiRequestError
                    ? employees.error.message
                    : copy('تعذّر تحميل الموظفين.'),
                requestId:
                  employees.error instanceof ApiRequestError
                    ? employees.error.requestId
                    : undefined,
              }
            : null
        }
        onRetry={() => void employees.refetch()}
        empty={{
          title: copy('لا يوجد عمال بعد'),
          description: copy('أضف أول عامل ليتمكن من الدخول والعمل في المحل.'),
          action: can('employees.manage')
            ? { label: copy('إضافة عامل'), onClick: () => setCreateOpen(true) }
            : undefined,
        }}
        mobileRender={(row) => (
          <article className="border-border bg-card rounded-card border p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-fg truncate font-bold">{row.name}</p>
                <p className="text-fg-muted mt-1 flex items-center gap-1.5 text-xs" dir="ltr">
                  <Phone className="size-3.5" aria-hidden />
                  {row.phone}
                </p>
                <p
                  className="text-fg-muted mt-1 flex items-center gap-1.5 truncate text-xs"
                  dir="ltr"
                >
                  <Mail className="size-3.5 shrink-0" aria-hidden />
                  {row.email}
                </p>
              </div>
              <StatusBadge tone={row.status === 'ACTIVE' ? 'credit' : 'neutral'}>
                {row.status === 'ACTIVE' ? copy('نشط') : copy('متوقف')}
              </StatusBadge>
            </div>
            {can('employees.manage') ? (
              <div className="border-border-subtle mt-3 border-t pt-3">{actions(row)}</div>
            ) : null}
          </article>
        )}
      />

      <Dialog
        open={createOpen}
        onOpenChange={(value) => {
          setCreateOpen(value);
          if (!value && !create.isPending) {
            createForm.reset();
            setShowCreatePassword(false);
          }
        }}
      >
        <DialogContent size="md">
          <form onSubmit={createForm.handleSubmit((values) => create.mutate(values))}>
            <DialogHeader>
              <DialogTitle>{copy('إضافة عامل')}</DialogTitle>
              <DialogDescription>{copy('أدخل بيانات الدخول الخاصة بالعامل.')}</DialogDescription>
            </DialogHeader>
            <DialogBody className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <WorkerIdentityFields form={createForm} />
              <Field
                label={copy('كلمة السر للدخول')}
                error={createForm.formState.errors.password?.message}
                required
              >
                {(props) => (
                  <Input
                    {...props}
                    {...createForm.register('password')}
                    type={showCreatePassword ? 'text' : 'password'}
                    dir="ltr"
                    autoComplete="new-password"
                    startIcon={<KeyRound aria-hidden />}
                    endIcon={
                      <PasswordVisibilityButton
                        visible={showCreatePassword}
                        onToggle={() => setShowCreatePassword((value) => !value)}
                      />
                    }
                  />
                )}
              </Field>
            </DialogBody>
            <DialogFooter>
              <Button type="submit" variant="brand" loading={create.isPending}>
                <Plus aria-hidden />
                {copy('إضافة العامل')}
              </Button>
              <DialogClose asChild>
                <Button type="button" variant="outline" disabled={create.isPending}>
                  {copy('إلغاء')}
                </Button>
              </DialogClose>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={editTarget !== null}
        onOpenChange={(value) => {
          if (!value && !update.isPending) {
            setEditTarget(null);
            setShowEditPassword(false);
          }
        }}
      >
        <DialogContent size="md">
          <form onSubmit={editForm.handleSubmit((values) => update.mutate(values))}>
            <DialogHeader>
              <DialogTitle>{copy('تعديل العامل')}</DialogTitle>
              <DialogDescription>{copy('عدّل بيانات العامل ثم احفظ التغييرات.')}</DialogDescription>
            </DialogHeader>
            <DialogBody className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <WorkerIdentityFields form={editForm} />
              <Field
                label={copy('كلمة سر جديدة')}
                hint={copy('اتركها فارغة للاحتفاظ بكلمة السر الحالية.')}
                error={editForm.formState.errors.password?.message}
              >
                {(props) => (
                  <Input
                    {...props}
                    {...editForm.register('password')}
                    type={showEditPassword ? 'text' : 'password'}
                    dir="ltr"
                    autoComplete="new-password"
                    startIcon={<KeyRound aria-hidden />}
                    endIcon={
                      <PasswordVisibilityButton
                        visible={showEditPassword}
                        onToggle={() => setShowEditPassword((value) => !value)}
                      />
                    }
                  />
                )}
              </Field>
            </DialogBody>
            <DialogFooter>
              <Button type="submit" variant="brand" loading={update.isPending}>
                <Pencil aria-hidden />
                {copy('حفظ التغييرات')}
              </Button>
              <DialogClose asChild>
                <Button type="button" variant="outline" disabled={update.isPending}>
                  {copy('إلغاء')}
                </Button>
              </DialogClose>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={statusTarget !== null}
        onOpenChange={(value) => !value && setStatusTarget(null)}
        title={statusTarget?.status === 'ACTIVE' ? copy('تعطيل العامل') : copy('تفعيل العامل')}
        description={
          statusTarget?.status === 'ACTIVE'
            ? copy('سيُمنع "{{value0}}" من الدخول وتُنهي جلساته الحالية.', {
                value0: statusTarget?.name ?? '',
              })
            : copy('سيتمكن "{{value0}}" من تسجيل الدخول مجدداً.', {
                value0: statusTarget?.name ?? '',
              })
        }
        confirmLabel={statusTarget?.status === 'ACTIVE' ? copy('تعطيل') : copy('تفعيل')}
        variant={statusTarget?.status === 'ACTIVE' ? 'danger' : 'brand'}
        loading={setStatus.isPending}
        onConfirm={() => statusTarget && setStatus.mutate(statusTarget)}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(value) => !value && setDeleteTarget(null)}
        title={copy('حذف العامل')}
        description={copy('سيُحذف حساب "{{value0}}" نهائياً ولن يتمكن من الدخول.', {
          value0: deleteTarget?.name ?? '',
        })}
        confirmLabel={copy('حذف العامل')}
        variant="danger"
        loading={remove.isPending}
        onConfirm={() => deleteTarget && remove.mutate(deleteTarget.id)}
      />
    </div>
  );
}

type WorkerIdentityForm =
  ReturnType<typeof useForm<CreateWorkerRequest>> | ReturnType<typeof useForm<UpdateWorkerRequest>>;

function WorkerIdentityFields({ form }: { form: WorkerIdentityForm }) {
  useCopy();

  return (
    <>
      <Field label={copy('الاسم')} error={form.formState.errors.name?.message} required>
        {(props) => (
          <Input
            {...props}
            {...form.register('name')}
            autoComplete="name"
            startIcon={<UserRound aria-hidden />}
          />
        )}
      </Field>
      <Field label={copy('رقم الهاتف')} error={form.formState.errors.phone?.message} required>
        {(props) => (
          <Input
            {...props}
            {...form.register('phone')}
            dir="ltr"
            inputMode="tel"
            placeholder="0501234567"
            autoComplete="tel"
            startIcon={<Phone aria-hidden />}
          />
        )}
      </Field>
      <Field
        label={copy('البريد الإلكتروني')}
        error={form.formState.errors.email?.message}
        required
      >
        {(props) => (
          <Input
            {...props}
            {...form.register('email')}
            type="email"
            dir="ltr"
            autoComplete="email"
            startIcon={<Mail aria-hidden />}
          />
        )}
      </Field>
    </>
  );
}

function PasswordVisibilityButton({
  visible,
  onToggle,
}: {
  visible: boolean;
  onToggle: () => void;
}) {
  useCopy();

  return (
    <button
      type="button"
      className="text-fg-muted hover:text-fg rounded-icon p-1"
      onClick={onToggle}
      title={visible ? copy('إخفاء كلمة السر') : copy('إظهار كلمة السر')}
      aria-label={visible ? copy('إخفاء كلمة السر') : copy('إظهار كلمة السر')}
    >
      {visible ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
    </button>
  );
}
