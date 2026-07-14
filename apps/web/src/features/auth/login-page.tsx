import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Eye, EyeOff, Lock, Mail, ShieldCheck, Store } from 'lucide-react';
import { loginRequestSchema, type LoginRequest } from '@oh/contracts';
import { Button, Field, Input, cn, toast } from '@oh/ui';
import { ApiRequestError } from '@/lib/api';
import { useAuth } from '@/app/auth-context';
import { AuthLayout } from './auth-layout';

/**
 * شاشة تسجيل الدخول.
 *
 * ── نقطتان أمنيتان ملموستان في الواجهة ────────────────────────────────────
 *
 * 1. عند الفشل **لا نُبرز حقلًا بعينه**. لو أضأنا حقل البريد بالأحمر عند
 *    «بريد غير موجود» وحقل كلمة المرور عند «كلمة مرور خاطئة»، لكشفنا للمهاجم
 *    أي البُرد مسجّلة — بلا حاجة لقراءة الرسالة. الخطأ يظهر فوق النموذج.
 *
 * 2. الرمز لا يصل إلى JavaScript إطلاقًا. `login()` تعيد بيانات المستخدم فقط؛
 *    الرموز في كوكيز HttpOnly ضبطها الخادم.
 */
export function LoginPage() {
  const { t } = useTranslation();
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [showPassword, setShowPassword] = useState(false);
  const [needsTwoFactor, setNeedsTwoFactor] = useState(false);
  const [formError, setFormError] = useState<{ message: string; requestId?: string } | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginRequest>({
    resolver: zodResolver(loginRequestSchema),
    defaultValues: { email: '', password: '', rememberMe: false },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);

    try {
      const response = await login(values);
      const from = (location.state as { from?: string } | null)?.from;
      const fallback = response.user.isSuperAdmin ? '/platform' : '/';
      navigate(from ?? fallback, { replace: true });
      toast.success(`أهلًا ${response.user.name}`);
    } catch (error) {
      if (error instanceof ApiRequestError) {
        if (error.code === 'TWO_FACTOR_REQUIRED') {
          setNeedsTwoFactor(true);
          setFormError(null);
          return;
        }
        setFormError({ message: error.message, requestId: error.requestId });
        return;
      }
      setFormError({ message: t('errors.network') });
    }
  });

  return (
    <AuthLayout
      title={t('auth.loginTitle')}
      subtitle={t('auth.loginSubtitle')}
      icon={Store}
    >
      <form onSubmit={onSubmit} className="space-y-5" noValidate>
        {/*
          خطأ عام فوق النموذج — لا يُبرز حقلًا بعينه (منع تعداد المستخدمين).
          role="alert" يجعل قارئ الشاشة يُعلنه فور ظهوره.
        */}
        {formError ? (
          <div
            role="alert"
            className="rounded-ctrl border border-danger/30 bg-danger-soft px-4 py-3"
          >
            <p className="text-sm font-medium text-danger">{formError.message}</p>
            {formError.requestId ? (
              <p className="mt-1 font-mono text-[11px] text-danger/70" dir="ltr">
                {formError.requestId}
              </p>
            ) : null}
          </div>
        ) : null}

        <Field label={t('auth.email')} error={errors.email?.message} required>
          {(props) => (
            <Input
              {...props}
              {...register('email')}
              type="email"
              inputMode="email"
              autoComplete="username"
              dir="ltr"
              placeholder="owner@example.com"
              startIcon={<Mail className="size-4" />}
              error={Boolean(errors.email)}
              autoFocus
            />
          )}
        </Field>

        <Field label={t('auth.password')} error={errors.password?.message} required>
          {(props) => (
            <Input
              {...props}
              {...register('password')}
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="••••••••••••"
              startIcon={<Lock className="size-4" />}
              error={Boolean(errors.password)}
              endIcon={
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="text-fg-subtle transition-colors hover:text-fg"
                  aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              }
            />
          )}
        </Field>

        {/* حقل 2FA — يظهر فقط بعد أن يطلبه الخادم */}
        {needsTwoFactor ? (
          <Field
            label={t('auth.twoFactorCode')}
            hint={t('auth.twoFactorHint')}
            error={errors.totpCode?.message}
            required
          >
            {(props) => (
              <Input
                {...props}
                {...register('totpCode')}
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                dir="ltr"
                placeholder="000000"
                startIcon={<ShieldCheck className="size-4" />}
                error={Boolean(errors.totpCode)}
                className="text-center tracking-[0.4em]"
                autoFocus
              />
            )}
          </Field>
        ) : null}

        <div className="flex items-center justify-between">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-fg-muted">
            <input
              type="checkbox"
              {...register('rememberMe')}
              className={cn(
                'size-4 rounded border-border text-accent',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              )}
            />
            {t('auth.rememberMe')}
          </label>

          <Link
            to="/forgot-password"
            className="text-sm font-medium text-accent transition-colors hover:underline"
          >
            {t('auth.forgotPassword')}
          </Link>
        </div>

        <Button type="submit" variant="brand" size="lg" loading={isSubmitting} className="w-full">
          {isSubmitting ? t('auth.loggingIn') : t('auth.login')}
        </Button>
      </form>
    </AuthLayout>
  );
}
