import type { Permission } from '@oh/config';
/**
 * حراس المسارات في الواجهة.
 *
 * ⚠️ مرة أخرى — هذه **تجربة مستخدم**، لا أمان. تمنع المستخدم من رؤية شاشة
 *    فارغة أو نصف محمّلة، وتوجّهه للمكان الصحيح. لكن كل بيانات تلك الشاشة
 *    تأتي من الـAPI، وهو المكان الذي تُفرض فيه الحماية فعلًا.
 */
/** يتطلب تسجيل دخول. */
export declare function RequireAuth(): import("react").JSX.Element;
/** مسارات المحل — يمنع المدير العام (لا يرى بيانات الأعمال). */
export declare function RequireTenant(): import("react").JSX.Element;
/** مسارات المنصة — للمدير العام حصرًا. */
export declare function RequireSuperAdmin(): import("react").JSX.Element;
/** يتطلب صلاحية محددة. */
export declare function RequirePermission({ permission }: {
    permission: Permission;
}): import("react").JSX.Element;
/** يمنع الوصول لصفحة الدخول وأنت مسجّل أصلًا. */
export declare function RedirectIfAuthenticated(): import("react").JSX.Element;
//# sourceMappingURL=guards.d.ts.map