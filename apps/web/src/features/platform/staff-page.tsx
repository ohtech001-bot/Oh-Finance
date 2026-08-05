import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  Ban,
  CheckCircle2,
  Eye,
  EyeOff,
  Pencil,
  Plus,
  Power,
  Trash2,
  UserCog,
  Users,
} from 'lucide-react';
import {
  createPlatformStaffInviteSchema,
  updatePlatformStaffSchema,
  type CreatePlatformStaffInviteRequest,
  type PlatformStaff,
  type UpdatePlatformStaffRequest,
} from '@oh/contracts';
import {
  Button,
  ConfirmDialog,
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
  toast,
} from '@oh/ui';
import { ApiRequestError, api } from '@/lib/api';
import { useAuth } from '@/app/auth-context';

export function StaffPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<PlatformStaff | null>(null);
  const [editTarget, setEditTarget] = useState<PlatformStaff | null>(null);
  const [statusTarget, setStatusTarget] = useState<PlatformStaff | null>(null);
  const [editConfirmOpen, setEditConfirmOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showInitialPassword, setShowInitialPassword] = useState(false);
  const [showEditInitialPassword, setShowEditInitialPassword] = useState(false);
  const query = useQuery({
    queryKey: ['platform', 'staff'],
    queryFn: () => api.get<PlatformStaff[]>('/platform/staff'),
  });
  const form = useForm<CreatePlatformStaffInviteRequest>({
    resolver: zodResolver(createPlatformStaffInviteSchema),
    defaultValues: {
      name: '',
      email: '',
      phone: '',
      dateOfBirth: '',
      jobTitle: '',
      platformRole: 'EMPLOYEE',
      locale: 'ar',
      initialPassword: '',
    },
  });
  const editForm = useForm<UpdatePlatformStaffRequest>({
    resolver: zodResolver(updatePlatformStaffSchema),
  });
  const showMutationError = (error: unknown, fallback: string) => {
    if (error instanceof ApiRequestError) toast.apiError(error.message, error.requestId);
    else toast.error(fallback);
  };

  const create = useMutation({
    mutationFn: (body: CreatePlatformStaffInviteRequest) =>
      api.post<PlatformStaff>('/platform/staff', body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['platform', 'staff'] });
      setSuccessMessage(t('staff.created'));
      setOpen(false);
      form.reset();
      setShowInitialPassword(false);
    },
    onError: (error) => showMutationError(error, t('staff.createFailed')),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.delete<void>(`/platform/staff/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['platform', 'staff'] });
      setSuccessMessage(t('staff.deleted'));
      setDeleteTarget(null);
    },
  });
  const setStatus = useMutation({
    mutationFn: (staff: PlatformStaff) =>
      api.post<PlatformStaff>(`/platform/staff/${staff.id}/status`, {
        status: staff.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE',
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['platform', 'staff'] });
      setSuccessMessage(t('staff.statusUpdated'));
      setStatusTarget(null);
    },
  });
  const update = useMutation({
    mutationFn: (body: UpdatePlatformStaffRequest) =>
      api.patch<PlatformStaff>(`/platform/staff/${editTarget?.id}`, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['platform', 'staff'] });
      setSuccessMessage(t('staff.updated'));
      setEditConfirmOpen(false);
      setEditTarget(null);
      setShowEditInitialPassword(false);
    },
    onError: (error) => showMutationError(error, t('staff.updateFailed')),
  });

  const openEdit = (staff: PlatformStaff) => {
    editForm.reset({
      name: staff.name,
      email: staff.email,
      phone: staff.phone,
      dateOfBirth: staff.dateOfBirth,
      jobTitle: staff.jobTitle,
      platformRole: staff.platformRole,
      locale: staff.locale,
      initialPassword: '',
    });
    setShowEditInitialPassword(false);
    setEditTarget(staff);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('staff.title')}
        description={t('staff.subtitle')}
        icon={Users}
        className="max-sm:flex-col"
        actions={
          <Button variant="brand" className="max-sm:w-full" onClick={() => setOpen(true)}>
            <Plus aria-hidden />
            {t('staff.add')}
          </Button>
        }
      />

      <div className="rounded-card border-border bg-card hidden overflow-hidden border md:block">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-bg-subtle text-fg-muted">
              <tr>
                <th className="px-4 py-3 text-start">{t('staff.name')}</th>
                <th className="px-4 py-3 text-start">{t('auth.email')}</th>
                <th className="px-4 py-3 text-start">{t('staff.phone')}</th>
                <th className="px-4 py-3 text-start">{t('common.status')}</th>
                <th className="px-4 py-3 text-end">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {(query.data ?? []).map((staff) => (
                <tr key={staff.id}>
                  <td className="text-fg px-4 py-3 font-medium">{staff.name}</td>
                  <td className="px-4 py-3 text-start">
                    <span className="inline-block" dir="ltr">
                      {staff.email}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-start">
                    <span className="inline-block tabular-nums" dir="ltr">
                      {staff.phone || '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {staff.status === 'ACTIVE' ? t('staff.active') : t('staff.inactive')}
                  </td>
                  <td className="px-4 py-3 text-end">
                    <div className="flex items-center justify-end gap-2 whitespace-nowrap">
                      <Button variant="outline" size="sm" onClick={() => openEdit(staff)}>
                        <Pencil aria-hidden />
                        {t('common.edit')}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={staff.id === user?.id}
                        onClick={() => setStatusTarget(staff)}
                      >
                        {staff.status === 'ACTIVE' ? <Ban aria-hidden /> : <Power aria-hidden />}
                        {staff.status === 'ACTIVE' ? t('staff.disable') : t('staff.enable')}
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        disabled={staff.id === user?.id}
                        onClick={() => setDeleteTarget(staff)}
                      >
                        <Trash2 aria-hidden />
                        {t('common.delete')}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {!query.isLoading && (query.data?.length ?? 0) === 0 ? (
                <tr>
                  <td colSpan={5} className="text-fg-muted px-4 py-10 text-center">
                    {t('staff.empty')}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <div className="space-y-3 md:hidden">
        {query.isLoading
          ? Array.from({ length: 3 }, (_, index) => (
              <div
                key={index}
                className="rounded-card border-border bg-card shadow-card space-y-4 border p-4"
              >
                <div className="bg-card-muted h-5 w-2/3 animate-pulse rounded" />
                <div className="bg-card-muted h-12 animate-pulse rounded" />
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-card-muted h-10 animate-pulse rounded" />
                  <div className="bg-card-muted h-10 animate-pulse rounded" />
                </div>
              </div>
            ))
          : null}

        {(query.data ?? []).map((staff) => (
          <article
            key={staff.id}
            className="rounded-card border-border bg-card shadow-card overflow-hidden border"
          >
            <div className="border-border-subtle flex items-start justify-between gap-3 border-b p-4">
              <div className="min-w-0">
                <h2 className="text-fg truncate text-base font-semibold">{staff.name}</h2>
                <p className="text-fg-muted mt-1 break-all text-xs" dir="ltr">
                  {staff.email}
                </p>
              </div>
              <span
                className={
                  staff.status === 'ACTIVE'
                    ? 'bg-success-soft text-success rounded-full px-2.5 py-1 text-xs font-medium'
                    : 'bg-card-muted text-fg-muted rounded-full px-2.5 py-1 text-xs font-medium'
                }
              >
                {staff.status === 'ACTIVE' ? t('staff.active') : t('staff.inactive')}
              </span>
            </div>

            <div className="border-border-subtle flex items-center justify-between gap-3 border-b px-4 py-3">
              <span className="text-fg-muted text-xs">{t('staff.phone')}</span>
              <span className="text-fg text-sm tabular-nums" dir="ltr">
                {staff.phone || '—'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 p-3">
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => openEdit(staff)}
              >
                <Pencil aria-hidden />
                {t('common.edit')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                disabled={staff.id === user?.id}
                onClick={() => setStatusTarget(staff)}
              >
                {staff.status === 'ACTIVE' ? <Ban aria-hidden /> : <Power aria-hidden />}
                {staff.status === 'ACTIVE' ? t('staff.disable') : t('staff.enable')}
              </Button>
              <Button
                variant="danger"
                size="sm"
                className="col-span-2 w-full"
                disabled={staff.id === user?.id}
                onClick={() => setDeleteTarget(staff)}
              >
                <Trash2 aria-hidden />
                {t('common.delete')}
              </Button>
            </div>
          </article>
        ))}

        {!query.isLoading && (query.data?.length ?? 0) === 0 ? (
          <div className="rounded-card border-border bg-card text-fg-muted border px-4 py-10 text-center text-sm">
            {t('staff.empty')}
          </div>
        ) : null}
      </div>

      <Dialog
        open={open}
        onOpenChange={(value) => {
          setOpen(value);
          if (!value) setShowInitialPassword(false);
        }}
      >
        <DialogContent size="lg">
          <DialogHeader>
            <DialogTitle>{t('staff.add')}</DialogTitle>
            <DialogDescription>{t('staff.initialPasswordCreateHint')}</DialogDescription>
          </DialogHeader>
          <form onSubmit={form.handleSubmit((values) => create.mutate(values))}>
            <DialogBody className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <StaffInput label={t('staff.name')} name="name" form={form} />
              <StaffInput label={t('auth.email')} name="email" form={form} type="email" dir="ltr" />
              <StaffInput
                label={t('staff.phone')}
                name="phone"
                form={form}
                dir="ltr"
                placeholder="0501234567"
              />
              <StaffInput
                label={t('staff.dateOfBirth')}
                name="dateOfBirth"
                form={form}
                type="date"
                dir="ltr"
              />
              <Field
                label={t('staff.role')}
                error={form.formState.errors.platformRole?.message}
                required
              >
                {(props) => (
                  <select
                    {...props}
                    {...form.register('platformRole')}
                    className="rounded-ctrl border-border bg-card h-11 w-full border px-3 text-sm"
                  >
                    <option value="GENERAL_MANAGER">{t('staff.roles.GENERAL_MANAGER')}</option>
                    <option value="MANAGER">{t('staff.roles.MANAGER')}</option>
                    <option value="EMPLOYEE">{t('staff.roles.EMPLOYEE')}</option>
                  </select>
                )}
              </Field>
              <PasswordInput
                label={t('staff.initialPassword')}
                name="initialPassword"
                form={form}
                visible={showInitialPassword}
                onToggle={() => setShowInitialPassword((value) => !value)}
                toggleLabel={
                  showInitialPassword ? t('staff.hidePassword') : t('staff.showPassword')
                }
              />
            </DialogBody>
            <DialogFooter>
              <Button type="submit" variant="brand" loading={create.isPending}>
                <UserCog aria-hidden />
                {t('staff.createAccount')}
              </Button>
              <DialogClose asChild>
                <Button type="button" variant="outline" disabled={create.isPending}>
                  {t('common.cancel')}
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
            setShowEditInitialPassword(false);
          }
        }}
      >
        <DialogContent size="lg">
          <DialogHeader>
            <DialogTitle>{t('staff.edit')}</DialogTitle>
            <DialogDescription>{editTarget?.email}</DialogDescription>
          </DialogHeader>
          <form onSubmit={editForm.handleSubmit(() => setEditConfirmOpen(true))}>
            <DialogBody className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <EditStaffInput label={t('staff.name')} name="name" form={editForm} />
              <EditStaffInput
                label={t('auth.email')}
                name="email"
                form={editForm}
                type="email"
                dir="ltr"
              />
              <EditStaffInput
                label={t('staff.phone')}
                name="phone"
                form={editForm}
                dir="ltr"
                placeholder="0501234567"
              />
              <EditStaffInput
                label={t('staff.dateOfBirth')}
                name="dateOfBirth"
                form={editForm}
                type="date"
                dir="ltr"
              />
              <Field
                label={t('staff.role')}
                error={editForm.formState.errors.platformRole?.message}
                required
              >
                {(props) => (
                  <select
                    {...props}
                    {...editForm.register('platformRole')}
                    className="rounded-ctrl border-border bg-card h-11 w-full border px-3 text-sm"
                  >
                    <option value="GENERAL_MANAGER">{t('staff.roles.GENERAL_MANAGER')}</option>
                    <option value="MANAGER">{t('staff.roles.MANAGER')}</option>
                    <option value="EMPLOYEE">{t('staff.roles.EMPLOYEE')}</option>
                  </select>
                )}
              </Field>
              <PasswordInput
                label={t('staff.initialPassword')}
                name="initialPassword"
                form={editForm}
                visible={showEditInitialPassword}
                onToggle={() => setShowEditInitialPassword((value) => !value)}
                toggleLabel={
                  showEditInitialPassword ? t('staff.hidePassword') : t('staff.showPassword')
                }
                required={false}
                placeholder={t('staff.initialPasswordEditHint')}
              />
            </DialogBody>
            <DialogFooter>
              <Button type="submit" variant="brand" loading={update.isPending}>
                <Pencil aria-hidden />
                {t('common.saveChanges')}
              </Button>
              <DialogClose asChild>
                <Button type="button" variant="outline" disabled={update.isPending}>
                  {t('common.cancel')}
                </Button>
              </DialogClose>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={statusTarget !== null}
        onOpenChange={(open) => !open && setStatusTarget(null)}
        title={statusTarget?.status === 'ACTIVE' ? t('staff.disable') : t('staff.enable')}
        description={t('staff.statusConfirm', { name: statusTarget?.name })}
        confirmLabel={statusTarget?.status === 'ACTIVE' ? t('staff.disable') : t('staff.enable')}
        cancelLabel={t('common.cancel')}
        variant={statusTarget?.status === 'ACTIVE' ? 'danger' : 'brand'}
        loading={setStatus.isPending}
        onConfirm={() => statusTarget && setStatus.mutate(statusTarget)}
      />

      <ConfirmDialog
        open={editConfirmOpen}
        onOpenChange={setEditConfirmOpen}
        title={t('staff.editConfirmTitle')}
        description={t('staff.editConfirmDescription', { name: editTarget?.name })}
        confirmLabel={t('common.confirm')}
        cancelLabel={t('common.cancel')}
        variant="brand"
        loading={update.isPending}
        onConfirm={() => update.mutate(editForm.getValues())}
      />

      <Dialog
        open={successMessage !== null}
        onOpenChange={(open) => !open && setSuccessMessage(null)}
      >
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="text-success size-5" aria-hidden />
              {t('common.success')}
            </DialogTitle>
            <DialogDescription>{successMessage}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="brand" onClick={() => setSuccessMessage(null)}>
              {t('common.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(value) => {
          if (!value) setDeleteTarget(null);
        }}
      >
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>{t('staff.deleteTitle')}</DialogTitle>
            <DialogDescription>
              {t('staff.deleteDescription', { name: deleteTarget?.name })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="danger"
              loading={remove.isPending}
              onClick={() => deleteTarget && remove.mutate(deleteTarget.id)}
            >
              <Trash2 aria-hidden />
              {t('common.delete')}
            </Button>
            <DialogClose asChild>
              <Button variant="outline" disabled={remove.isPending}>
                {t('common.cancel')}
              </Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EditStaffInput({
  label,
  name,
  form,
  type = 'text',
  dir,
  placeholder,
  required = true,
}: {
  label: string;
  name: keyof UpdatePlatformStaffRequest;
  form: ReturnType<typeof useForm<UpdatePlatformStaffRequest>>;
  type?: string;
  dir?: 'ltr';
  placeholder?: string;
  required?: boolean;
}) {
  const error = form.formState.errors[name]?.message;
  return (
    <Field label={label} error={typeof error === 'string' ? error : undefined} required={required}>
      {(props) => (
        <Input
          {...props}
          {...form.register(name)}
          type={type}
          dir={dir}
          placeholder={placeholder}
        />
      )}
    </Field>
  );
}

function StaffInput({
  label,
  name,
  form,
  type = 'text',
  dir,
  placeholder,
  required = true,
}: {
  label: string;
  name: keyof CreatePlatformStaffInviteRequest;
  form: ReturnType<typeof useForm<CreatePlatformStaffInviteRequest>>;
  type?: string;
  dir?: 'ltr';
  placeholder?: string;
  required?: boolean;
}) {
  const error = form.formState.errors[name]?.message;
  return (
    <Field label={label} error={typeof error === 'string' ? error : undefined} required={required}>
      {(props) => (
        <Input
          {...props}
          {...form.register(name)}
          type={type}
          dir={dir}
          placeholder={placeholder}
        />
      )}
    </Field>
  );
}

function PasswordInput<T extends CreatePlatformStaffInviteRequest | UpdatePlatformStaffRequest>({
  label,
  name,
  form,
  visible,
  onToggle,
  toggleLabel,
  required = true,
  placeholder,
}: {
  label: string;
  name: 'initialPassword';
  form: ReturnType<typeof useForm<T>>;
  visible: boolean;
  onToggle: () => void;
  toggleLabel: string;
  required?: boolean;
  placeholder?: string;
}) {
  const error = form.formState.errors.initialPassword?.message;
  return (
    <Field label={label} error={typeof error === 'string' ? error : undefined} required={required}>
      {(props) => (
        <Input
          {...props}
          {...form.register(name as never)}
          type={visible ? 'text' : 'password'}
          dir="ltr"
          className="ps-14"
          autoComplete="new-password"
          placeholder={placeholder}
          endIcon={
            <button
              type="button"
              onClick={onToggle}
              className="border-border bg-card text-fg-muted hover:border-accent hover:text-fg focus-visible:ring-ring flex size-8 items-center justify-center rounded-md border transition-colors focus-visible:outline-none focus-visible:ring-2"
              aria-label={toggleLabel}
              title={toggleLabel}
            >
              {visible ? <EyeOff className="size-[18px]" /> : <Eye className="size-[18px]" />}
            </button>
          }
        />
      )}
    </Field>
  );
}
