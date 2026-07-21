import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Ban, CheckCircle2, MailCheck, Pencil, Plus, Power, Trash2, UserCog, Users } from 'lucide-react';
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
import { api } from '@/lib/api';
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
  const [inviteId, setInviteId] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [editInviteId, setEditInviteId] = useState<string | null>(null);
  const [editCode, setEditCode] = useState('');
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
      identityNumber: '',
      jobTitle: '',
      platformRole: 'EMPLOYEE',
      locale: 'ar',
    },
  });
  const editForm = useForm<UpdatePlatformStaffRequest>({
    resolver: zodResolver(updatePlatformStaffSchema),
  });

  const invite = useMutation({
    mutationFn: (body: CreatePlatformStaffInviteRequest) =>
      api.post<{ inviteId: string }>('/platform/staff/invitations', body),
    onSuccess: (data) => {
      setInviteId(data.inviteId);
      toast.success(t('staff.codeSent'));
    },
  });
  const verify = useMutation({
    mutationFn: () =>
      api.post<PlatformStaff>('/platform/staff/invitations/verify', { inviteId, code }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['platform', 'staff'] });
      setSuccessMessage(t('staff.created'));
      setOpen(false);
      setInviteId(null);
      setCode('');
      form.reset();
    },
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
  const updateInvite = useMutation({
    mutationFn: (body: UpdatePlatformStaffRequest) =>
      api.post<{ inviteId: string }>(`/platform/staff/${editTarget?.id}/update-invitations`, body),
    onSuccess: (data) => {
      setEditInviteId(data.inviteId);
      setEditConfirmOpen(false);
      toast.success(t('staff.codeSent'));
    },
  });
  const verifyEdit = useMutation({
    mutationFn: () =>
      api.post<PlatformStaff>(`/platform/staff/${editTarget?.id}/update-invitations/verify`, {
        inviteId: editInviteId,
        code: editCode,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['platform', 'staff'] });
      setSuccessMessage(t('staff.updated'));
      setEditTarget(null);
      setEditInviteId(null);
      setEditCode('');
    },
  });

  const openEdit = (staff: PlatformStaff) => {
    editForm.reset({
      name: staff.name,
      email: staff.email,
      phone: staff.phone,
      dateOfBirth: staff.dateOfBirth,
      identityNumber: staff.identityNumber,
      jobTitle: staff.jobTitle,
      platformRole: staff.platformRole,
      locale: staff.locale,
    });
    setEditInviteId(null);
    setEditCode('');
    setEditTarget(staff);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('staff.title')}
        description={t('staff.subtitle')}
        icon={Users}
        actions={
          <Button variant="brand" onClick={() => setOpen(true)}>
            <Plus aria-hidden />
            {t('staff.add')}
          </Button>
        }
      />

      <div className="rounded-card border-border bg-card overflow-hidden border">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-bg-subtle text-fg-muted">
              <tr>
                <th className="px-4 py-3 text-start">{t('staff.name')}</th>
                <th className="px-4 py-3 text-start">{t('auth.email')}</th>
                <th className="px-4 py-3 text-start">{t('staff.phone')}</th>
                <th className="px-4 py-3 text-start">{t('staff.jobTitle')}</th>
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
                  <td className="px-4 py-3">{staff.jobTitle}</td>
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
                  <td colSpan={6} className="text-fg-muted px-4 py-10 text-center">
                    {t('staff.empty')}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog
        open={open}
        onOpenChange={(value) => {
          setOpen(value);
          if (!value) {
            setInviteId(null);
            setCode('');
          }
        }}
      >
        <DialogContent size="lg">
          <DialogHeader>
            <DialogTitle>{inviteId ? t('staff.verifyTitle') : t('staff.add')}</DialogTitle>
          </DialogHeader>
          {inviteId ? (
            <>
              <DialogBody className="space-y-4">
                <div className="rounded-ctrl bg-brand-soft text-fg flex items-center gap-3 p-4 text-sm">
                  <MailCheck className="text-brand size-5" />
                  {t('staff.verifyHint')}
                </div>
                <Field label={t('staff.verificationCode')} required>
                  {(props) => (
                    <Input
                      {...props}
                      value={code}
                      onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      inputMode="numeric"
                      dir="ltr"
                      className="text-center text-lg"
                      autoFocus
                    />
                  )}
                </Field>
              </DialogBody>
              <DialogFooter>
                <Button
                  variant="brand"
                  loading={verify.isPending}
                  disabled={code.length !== 6}
                  onClick={() => verify.mutate()}
                >
                  {t('common.confirm')}
                </Button>
              </DialogFooter>
            </>
          ) : (
            <form onSubmit={form.handleSubmit((values) => invite.mutate(values))}>
              <DialogBody className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <StaffInput label={t('staff.name')} name="name" form={form} />
                <StaffInput
                  label={t('auth.email')}
                  name="email"
                  form={form}
                  type="email"
                  dir="ltr"
                />
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
                <StaffInput
                  label={t('staff.identityNumber')}
                  name="identityNumber"
                  form={form}
                  dir="ltr"
                />
                <StaffInput label={t('staff.jobTitle')} name="jobTitle" form={form} />
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
              </DialogBody>
              <DialogFooter>
                <Button type="submit" variant="brand" loading={invite.isPending}>
                  <UserCog aria-hidden />
                  {t('staff.sendCode')}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={editTarget !== null}
        onOpenChange={(value) => {
          if (!value && !updateInvite.isPending && !verifyEdit.isPending) {
            setEditTarget(null);
            setEditInviteId(null);
            setEditCode('');
          }
        }}
      >
        <DialogContent size="lg">
          <DialogHeader>
            <DialogTitle>{t('staff.edit')}</DialogTitle>
            <DialogDescription>{editTarget?.email}</DialogDescription>
          </DialogHeader>
          {editInviteId ? (
            <>
              <DialogBody className="space-y-4">
                <div className="rounded-ctrl bg-brand-soft text-fg flex items-center gap-3 p-4 text-sm">
                  <MailCheck className="text-brand size-5" />
                  {t('staff.verifyHint')}
                </div>
                <Field label={t('staff.verificationCode')} required>
                  {(props) => (
                    <Input
                      {...props}
                      value={editCode}
                      onChange={(event) =>
                        setEditCode(event.target.value.replace(/\D/g, '').slice(0, 6))
                      }
                      inputMode="numeric"
                      dir="ltr"
                      className="text-center text-lg"
                      autoFocus
                    />
                  )}
                </Field>
              </DialogBody>
              <DialogFooter>
                <Button
                  variant="brand"
                  loading={verifyEdit.isPending}
                  disabled={editCode.length !== 6}
                  onClick={() => verifyEdit.mutate()}
                >
                  {t('common.confirm')}
                </Button>
              </DialogFooter>
            </>
          ) : (
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
                <EditStaffInput
                  label={t('staff.identityNumber')}
                  name="identityNumber"
                  form={editForm}
                  dir="ltr"
                />
                <EditStaffInput label={t('staff.jobTitle')} name="jobTitle" form={editForm} />
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
              </DialogBody>
              <DialogFooter>
                <Button type="submit" variant="brand" loading={updateInvite.isPending}>
                  <Pencil aria-hidden />
                  {t('common.saveChanges')}
                </Button>
                <DialogClose asChild>
                  <Button type="button" variant="outline" disabled={updateInvite.isPending}>
                    {t('common.cancel')}
                  </Button>
                </DialogClose>
              </DialogFooter>
            </form>
          )}
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
        loading={updateInvite.isPending}
        onConfirm={() => updateInvite.mutate(editForm.getValues())}
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
}: {
  label: string;
  name: keyof UpdatePlatformStaffRequest;
  form: ReturnType<typeof useForm<UpdatePlatformStaffRequest>>;
  type?: string;
  dir?: 'ltr';
  placeholder?: string;
}) {
  const error = form.formState.errors[name]?.message;
  return (
    <Field label={label} error={typeof error === 'string' ? error : undefined} required>
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
}: {
  label: string;
  name: keyof CreatePlatformStaffInviteRequest;
  form: ReturnType<typeof useForm<CreatePlatformStaffInviteRequest>>;
  type?: string;
  dir?: 'ltr';
  placeholder?: string;
}) {
  const error = form.formState.errors[name]?.message;
  return (
    <Field label={label} error={typeof error === 'string' ? error : undefined} required>
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
