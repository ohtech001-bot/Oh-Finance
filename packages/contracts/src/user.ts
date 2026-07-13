import { z } from 'zod';
import { ALL_PERMISSIONS, TENANT_ROLES } from '@oh/config';
import {
  activeStatusSchema,
  emailSchema,
  paginationQuerySchema,
  phoneSchema,
  sortOrderSchema,
  uuidSchema,
} from './common.js';
import { passwordSchema } from './auth.js';

/**
 * عقود الموظفين (المستخدمون داخل المحل).
 *
 * النطاق: مستخدمون + أدوار + صلاحيات فقط.
 * لا مواعيد ولا خدمات ولا تقييمات — تلك أعمدة ظهرت في الموك‌أب لكنها خارج
 * متطلبات النظام (قرار موثّق: ADR غير مطلوب، مذكور في خطة المرحلة 0، D10).
 */

export const tenantRoleSchema = z.enum(TENANT_ROLES as [string, ...string[]]);
export const permissionEnum = z.enum(ALL_PERMISSIONS as [string, ...string[]]);

export const employeeSchema = z.object({
  id: uuidSchema,
  name: z.string(),
  email: emailSchema,
  phone: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  role: tenantRoleSchema,
  jobTitle: z.string().nullable(),
  department: z.string().nullable(),
  status: activeStatusSchema,
  twoFactorEnabled: z.boolean(),
  lastLoginAt: z.string().nullable(),
  createdAt: z.string(),
  /** الصلاحيات الفعلية = صلاحيات الدور ± التجاوزات الفردية. */
  effectivePermissions: z.array(permissionEnum),
});
export type Employee = z.infer<typeof employeeSchema>;

export const createEmployeeSchema = z.object({
  name: z.string().trim().min(2, 'الاسم مطلوب.').max(120),
  email: emailSchema,
  password: passwordSchema,
  phone: phoneSchema.optional().or(z.literal('')),
  role: tenantRoleSchema,
  jobTitle: z.string().trim().max(80).optional().or(z.literal('')),
  department: z.string().trim().max(80).optional().or(z.literal('')),
  status: activeStatusSchema.default('ACTIVE'),
});
export type CreateEmployeeRequest = z.infer<typeof createEmployeeSchema>;

export const updateEmployeeSchema = createEmployeeSchema
  .omit({ password: true, email: true })
  .partial();
export type UpdateEmployeeRequest = z.infer<typeof updateEmployeeSchema>;

/**
 * تجاوزات الصلاحيات الفردية فوق الدور.
 * `granted: false` يسحب صلاحية يمنحها الدور — أقوى من مجرد الإضافة.
 */
export const setUserPermissionsSchema = z.object({
  overrides: z
    .array(
      z.object({
        permission: permissionEnum,
        granted: z.boolean(),
      }),
    )
    .max(ALL_PERMISSIONS.length),
});
export type SetUserPermissionsRequest = z.infer<typeof setUserPermissionsSchema>;

export const employeeListQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().max(120).optional(),
  role: tenantRoleSchema.optional(),
  status: activeStatusSchema.optional(),
  sortBy: z.enum(['name', 'role', 'createdAt', 'lastLoginAt']).default('createdAt'),
  sortOrder: sortOrderSchema,
});
export type EmployeeListQuery = z.infer<typeof employeeListQuerySchema>;

// ── الملف الشخصي ─────────────────────────────────────────────────────────────
export const updateProfileSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  phone: phoneSchema.optional().or(z.literal('')),
  locale: z.enum(['ar', 'he', 'en']).optional(),
});
export type UpdateProfileRequest = z.infer<typeof updateProfileSchema>;
