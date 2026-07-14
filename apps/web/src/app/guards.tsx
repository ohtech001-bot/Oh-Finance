import { Navigate, Outlet, useLocation } from 'react-router-dom';
import type { Permission } from '@oh/config';
import { useAuth } from './auth-context';
import { FullPageLoader } from '@/components/full-page-loader';

/**
 * حراس المسارات في الواجهة.
 *
 * ⚠️ مرة أخرى — هذه **تجربة مستخدم**، لا أمان. تمنع المستخدم من رؤية شاشة
 *    فارغة أو نصف محمّلة، وتوجّهه للمكان الصحيح. لكن كل بيانات تلك الشاشة
 *    تأتي من الـAPI، وهو المكان الذي تُفرض فيه الحماية فعلًا.
 */

/** يتطلب تسجيل دخول. */
export function RequireAuth() {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) return <FullPageLoader />;

  if (!isAuthenticated) {
    // نحفظ الوجهة كي نعيده إليها بعد الدخول — بدلًا من رميه في الرئيسية.
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  return <Outlet />;
}

/** مسارات المحل — يمنع المدير العام (لا يرى بيانات الأعمال). */
export function RequireTenant() {
  const { user, isLoading } = useAuth();

  if (isLoading) return <FullPageLoader />;
  if (!user) return <Navigate to="/login" replace />;

  // المدير العام لا مكان له هنا — نوجّهه للوحته بدل عرض 403 مربك.
  if (user.isSuperAdmin) return <Navigate to="/platform" replace />;

  if (!user.tenant) return <Navigate to="/403" replace />;

  return <Outlet />;
}

/** مسارات المنصة — للمدير العام حصرًا. */
export function RequireSuperAdmin() {
  const { user, isLoading } = useAuth();

  if (isLoading) return <FullPageLoader />;
  if (!user) return <Navigate to="/login" replace />;

  if (!user.isSuperAdmin) return <Navigate to="/403" replace />;

  return <Outlet />;
}

/** يتطلب صلاحية محددة. */
export function RequirePermission({ permission }: { permission: Permission }) {
  const { can, isLoading, isAuthenticated } = useAuth();

  if (isLoading) return <FullPageLoader />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!can(permission)) return <Navigate to="/403" replace />;

  return <Outlet />;
}

/** يمنع الوصول لصفحة الدخول وأنت مسجّل أصلًا. */
export function RedirectIfAuthenticated() {
  const { user, isLoading } = useAuth();

  if (isLoading) return <FullPageLoader />;

  if (user) {
    return <Navigate to={user.isSuperAdmin ? '/platform' : '/'} replace />;
  }

  return <Outlet />;
}
