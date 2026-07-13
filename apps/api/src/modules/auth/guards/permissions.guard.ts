import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Permission } from '@oh/config';
import { AppError } from '../../../core/errors/app-error.js';
import { TenantContext } from '../../../core/tenancy/tenant-context.js';
import { IS_PUBLIC, IS_SUPER_ADMIN_ONLY, REQUIRED_PERMISSIONS } from '../decorators.js';

/**
 * الحارس الثاني: التفويض.
 *
 * يعمل بعد `JwtAuthGuard` (الترتيب مضمون بترتيب تسجيل APP_GUARD).
 *
 * ── قاعدة العزل الصارمة ────────────────────────────────────────────────────
 * مسارات المنصة تتطلب `isSuperAdmin = true` **و** `tenantId = null`.
 * مسارات المحل تتطلب `tenantId != null` **و** `isSuperAdmin = false`.
 *
 * الشرطان معًا مقصودان: مستخدم بـ`isSuperAdmin = true` و`tenantId` غير فارغ
 * هو حالة يجب ألا تُوجد (قيد CHECK في القاعدة يمنعها) — وإن وُجدت بطريقة ما،
 * نرفضها هنا أيضًا بدل أن نمنحها امتيازات الطرفين.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const ctx = TenantContext.get();
    if (!ctx?.userId) {
      throw AppError.unauthenticated();
    }

    const superAdminOnly = this.reflector.getAllAndOverride<boolean>(IS_SUPER_ADMIN_ONLY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (superAdminOnly) {
      if (!ctx.isSuperAdmin || ctx.tenantId !== null) {
        throw AppError.forbidden('هذا المسار للمدير العام فقط.');
      }
    } else {
      // مسار محل: المدير العام لا يدخله — لا يرى بيانات أعمال أي محل.
      if (ctx.isSuperAdmin) {
        throw AppError.forbidden(
          'المدير العام لا يصل إلى بيانات المحلات. استخدم لوحة المنصة.',
        );
      }
      if (!ctx.tenantId) {
        throw AppError.forbidden('لا يوجد محل مرتبط بهذا الحساب.');
      }
    }

    const required = this.reflector.getAllAndOverride<Permission[]>(REQUIRED_PERMISSIONS, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!required || required.length === 0) {
      return true; // موثّق يكفي (مثل /auth/me)
    }

    const granted = new Set(ctx.permissions);
    const missing = required.filter((p) => !granted.has(p));

    if (missing.length > 0) {
      throw AppError.forbidden(
        `ينقصك: ${missing.join('، ')}. راجع صاحب المحل لمنحك الصلاحية.`,
      );
    }

    return true;
  }
}
