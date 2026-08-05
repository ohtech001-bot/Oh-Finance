import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Eye, EyeOff, KeyRound } from 'lucide-react';
import { resetPasswordRequestSchema, type ResetPasswordRequest } from '@oh/contracts';
import { Button, Field, Input } from '@oh/ui';
import { ApiRequestError, api } from '@/lib/api';
import { AuthLayout } from './auth-layout';

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const [done, setDone] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const form = useForm<ResetPasswordRequest>({
    resolver: zodResolver(resetPasswordRequestSchema),
    defaultValues: { token, password: '', confirmPassword: '' },
  });

  const submit = form.handleSubmit(async (values) => {
    setRequestError(null);
    try {
      await api.post<void>('/auth/reset-initial-password', values);
      setDone(true);
    } catch (error) {
      setRequestError(
        error instanceof ApiRequestError
          ? error.message
          : 'تعذّر تعيين كلمة السر. حاول فتح الرابط مرة أخرى.',
      );
    }
  });

  if (done) {
    return (
      <AuthLayout
        title="تم تعيين كلمة السر"
        subtitle="يمكنك الآن الدخول إلى المنظومة"
        icon={CheckCircle2}
      >
        <Button variant="brand" className="w-full" asChild>
          <Link to="/login">تسجيل الدخول</Link>
        </Button>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="تعيين كلمة سر جديدة" subtitle="اختر كلمة سر قوية لحسابك" icon={KeyRound}>
      <form onSubmit={submit} className="space-y-4">
        {!token ? (
          <p className="text-danger text-sm" role="alert">
            رابط تعيين كلمة السر غير مكتمل.
          </p>
        ) : null}
        {requestError ? (
          <p className="bg-danger-soft text-danger rounded-ctrl p-3 text-sm" role="alert">
            {requestError}
          </p>
        ) : null}
        <Field label="كلمة السر الجديدة" error={form.formState.errors.password?.message} required>
          {(props) => (
            <Input
              {...props}
              {...form.register('password')}
              type={showPassword ? 'text' : 'password'}
              dir="ltr"
              autoComplete="new-password"
              endIcon={
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? 'إخفاء كلمة السر' : 'إظهار كلمة السر'}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              }
            />
          )}
        </Field>
        <Field
          label="تأكيد كلمة السر"
          error={form.formState.errors.confirmPassword?.message}
          required
        >
          {(props) => (
            <Input
              {...props}
              {...form.register('confirmPassword')}
              type={showPassword ? 'text' : 'password'}
              dir="ltr"
              autoComplete="new-password"
            />
          )}
        </Field>
        <Button
          type="submit"
          variant="brand"
          className="w-full"
          loading={form.formState.isSubmitting}
          disabled={!token}
        >
          تعيين كلمة السر
        </Button>
      </form>
    </AuthLayout>
  );
}
