import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight, KeyRound, Mail, MailCheck } from 'lucide-react';
import { forgotPasswordRequestSchema, type ForgotPasswordRequest } from '@oh/contracts';
import { Button, Field, Input } from '@oh/ui';
import { ApiRequestError, api } from '@/lib/api';
import { AuthLayout } from './auth-layout';

/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  استعادة كلمة المرور.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  ── لماذا الرسالة نفسها دائمًا؟ ──────────────────────────────────────────
 *  الشاشة تعرض **نفس** رسالة النجاح سواء كان البريد مسجّلًا أم لا. هذا ليس
 *  غموضًا، بل حماية: لو قلنا «هذا البريد غير مسجّل»، لصارت هذه الشاشة أداة
 *  مجانية لتعداد عملائنا — يجرّب المهاجم قائمة بريد ويعرف من يستخدم النظام.
 *
 *  ── الصدق مع المستخدم ────────────────────────────────────────────────────
 *  الإرسال الفعلي للبريد يُنفَّذ في المرحلة 7 (وحدة الرسائل). نُصرّح بذلك في
 *  الشاشة بدل أن نتظاهر بالإرسال ونترك المستخدم ينتظر رسالة لن تصل.
 *
 *  الرسالة نفسها صادقة تمامًا: «إن كان مسجّلًا، فستصلك رسالة» — نحن لا نعِد
 *  بالإرسال الآن، بل نصف السلوك النهائي. والشارة أسفلها تقول الحقيقة كاملة.
 */
export function ForgotPasswordPage() {
  const { t } = useTranslation();
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordRequest>({
    resolver: zodResolver(forgotPasswordRequestSchema),
    defaultValues: { email: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setError(null);
    try {
      await api.post<{ message: string }>('/auth/forgot-password', values);
      setSent(true);
    } catch (err) {
      // حتى الخطأ لا يكشف وجود البريد — 429 (حد المعدل) هو الوحيد الممكن.
      if (err instanceof ApiRequestError && err.code === 'RATE_LIMITED') {
        setError('محاولات كثيرة. انتظر قليلًا ثم أعد المحاولة.');
        return;
      }
      setError(t('errors.network'));
    }
  });

  if (sent) {
    return (
      <AuthLayout
        title={t('auth.resetSent')}
        subtitle="تحقّق من بريدك الإلكتروني"
        icon={MailCheck}
      >
        <div className="space-y-5 text-center">
          <p className="text-sm text-fg-muted">
            إن كان هذا البريد مسجّلًا لدينا، فستصلك رسالة تحتوي على رابط إعادة
            تعيين كلمة المرور خلال دقائق.
          </p>

          {/* الحقيقة كاملة — لا نترك المستخدم ينتظر رسالة لن تصل. */}
          <div className="rounded-ctrl border border-warning/30 bg-warning-soft px-4 py-3 text-start">
            <p className="text-[13px] font-semibold text-warning">
              إرسال البريد قيد التطوير (المرحلة 7)
            </p>
            <p className="mt-1 text-xs text-warning/90">
              وحدة الرسائل لم تُفعَّل بعد. للاستعادة الآن، راجع صاحب المحل أو
              المدير العام لإعادة تعيين كلمة مرورك يدويًا.
            </p>
          </div>

          <Button variant="outline" asChild className="w-full">
            <Link to="/login">
              <ArrowRight className="rtl:rotate-180" aria-hidden />
              {t('auth.backToLogin')}
            </Link>
          </Button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title={t('auth.forgotTitle')}
      subtitle={t('auth.forgotSubtitle')}
      icon={KeyRound}
    >
      <form onSubmit={onSubmit} className="space-y-5" noValidate>
        {error ? (
          <div role="alert" className="rounded-ctrl border border-danger/30 bg-danger-soft px-4 py-3">
            <p className="text-sm font-medium text-danger">{error}</p>
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

        <Button type="submit" variant="brand" size="lg" loading={isSubmitting} className="w-full">
          {t('auth.sendResetLink')}
        </Button>

        <Button variant="ghost" asChild className="w-full">
          <Link to="/login">
            <ArrowRight className="rtl:rotate-180" aria-hidden />
            {t('auth.backToLogin')}
          </Link>
        </Button>
      </form>
    </AuthLayout>
  );
}
