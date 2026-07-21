import { SetMetadata, createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Permission } from '@oh/config';
import type { AccessTokenPayload } from './token.service.js';

/** مسار عام — بلا مصادقة. الافتراضي هو العكس: كل شيء محمي. */
export const IS_PUBLIC = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC, true);

/** يتطلب صلاحية واحدة أو أكثر (AND — كلها مطلوبة). */
export const REQUIRED_PERMISSIONS = 'requiredPermissions';
export const RequirePermissions = (...permissions: Permission[]) =>
  SetMetadata(REQUIRED_PERMISSIONS, permissions);

/** يتطلب مديرًا عامًا — مسارات /platform. */
export const IS_SUPER_ADMIN_ONLY = 'isSuperAdminOnly';
export const ALLOW_PENDING_PASSWORD_CHANGE = 'allowPendingPasswordChange';
export const SuperAdminOnly = () => SetMetadata(IS_SUPER_ADMIN_ONLY, true);
export const AllowPendingPasswordChange = () => SetMetadata(ALLOW_PENDING_PASSWORD_CHANGE, true);

/**
 * يتخطى فحص CSRF.
 *
 * يُستخدم لمسار تسجيل الدخول وحده: لا جلسة بعد ⇒ لا رمز CSRF بعد.
 * أي استخدام آخر يجب أن يُبرَّر في مراجعة الكود.
 */
export const SKIP_CSRF = 'skipCsrf';
export const SkipCsrf = () => SetMetadata(SKIP_CSRF, true);

/** المستخدم الحالي من الرمز الموثّق. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AccessTokenPayload => {
    const request = ctx.switchToHttp().getRequest<{ user?: AccessTokenPayload }>();
    if (!request.user) {
      throw new Error('CurrentUser استُخدم على مسار غير محمي بـJwtAuthGuard.');
    }
    return request.user;
  },
);
