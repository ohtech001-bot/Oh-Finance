import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { KeyRound, Lock } from 'lucide-react';
import { changePasswordRequestSchema, type ChangePasswordRequest } from '@oh/contracts';
import { Button, Field, Input, toast } from '@oh/ui';
import { api } from '@/lib/api';
import { AuthLayout } from './auth-layout';

export function ChangeInitialPasswordPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { register, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm<ChangePasswordRequest>({
    resolver: zodResolver(changePasswordRequestSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });
  const submit = handleSubmit(async (values) => {
    try {
      await api.post<void>('/auth/change-initial-password', values);
      queryClient.clear();
      toast.success(t('auth.passwordChanged'));
      navigate('/login', { replace: true });
    } catch (error) {
      setError('currentPassword', { message: error instanceof Error ? error.message : t('errors.generic') });
    }
  });
  return <AuthLayout title={t('auth.changeTemporaryTitle')} subtitle={t('auth.changeTemporarySubtitle')} icon={KeyRound}>
    <form onSubmit={submit} className="space-y-4">
      <Field label={t('auth.temporaryPassword')} error={errors.currentPassword?.message} required>{(props) => <Input {...props} {...register('currentPassword')} type="password" dir="ltr" startIcon={<Lock className="size-4" />} />}</Field>
      <Field label={t('auth.newPassword')} error={errors.newPassword?.message} required>{(props) => <Input {...props} {...register('newPassword')} type="password" dir="ltr" startIcon={<Lock className="size-4" />} />}</Field>
      <Field label={t('auth.confirmPassword')} error={errors.confirmPassword?.message} required>{(props) => <Input {...props} {...register('confirmPassword')} type="password" dir="ltr" startIcon={<Lock className="size-4" />} />}</Field>
      <Button type="submit" variant="brand" size="lg" loading={isSubmitting} className="w-full">{t('auth.changePassword')}</Button>
    </form>
  </AuthLayout>;
}
