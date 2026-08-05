import { useNavigate } from 'react-router-dom';
import { MailCheck } from 'lucide-react';
import { Button } from '@oh/ui';
import { useAuth } from '@/app/auth-context';
import { AuthLayout } from './auth-layout';

export function ChangeInitialPasswordPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const leave = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <AuthLayout
      title="تحقّق من بريدك الإلكتروني"
      subtitle="أرسلنا رابطاً آمناً لتعيين كلمة السر"
      icon={MailCheck}
    >
      <div className="space-y-5 text-center">
        <p className="text-fg-muted text-sm leading-7">
          أُرسل رابط تعيين كلمة السر إلى
          <strong className="text-fg mx-1" dir="ltr">
            {user?.email}
          </strong>
          . تنتهي صلاحيته خلال 30 دقيقة.
        </p>
        <p className="text-fg-muted text-xs">
          افتح الرسالة واضغط الرابط، ثم عيّن كلمة سر جديدة لتفعيل الدخول إلى المنظومة.
        </p>
        <Button variant="outline" className="w-full" onClick={() => void leave()}>
          العودة إلى تسجيل الدخول
        </Button>
      </div>
    </AuthLayout>
  );
}
