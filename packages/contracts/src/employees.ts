import { z } from 'zod';
import { emailSchema, isoDateTimeSchema, uuidSchema } from './common.js';

/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  عقود الموظفين — المرحلة 4 / Increment 4.3. مطابقة لـ`ui/other screens/الموظفون.jpeg`.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  الموظف = مستخدم داخل المحل بدور وصلاحيات. النطاق:
 *    CRUD · أدوار وصلاحيات · دور مخصّص · فرع · حالة · آخر دخول · إدارة الجلسات
 *    · تفعيل/تعطيل · 2FA اختياري (TOTP) · تقارير نشاط الموظف.
 */

export const employeeStatusSchema = z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']);
export type EmployeeStatus = z.infer<typeof employeeStatusSchema>;

/** صف الموظف في القائمة/التفاصيل. لا يُنقل هاش كلمة المرور ولا سرّ 2FA أبدًا. */
export const employeeSchema = z.object({
  id: uuidSchema,
  name: z.string(),
  email: z.string(),
  roleId: uuidSchema.nullable(),
  roleName: z.string().nullable(),
  branchId: uuidSchema.nullable(),
  branchName: z.string().nullable(),
  status: employeeStatusSchema,
  totpEnabled: z.boolean(),
  lastLoginAt: isoDateTimeSchema.nullable(),
  createdAt: isoDateTimeSchema,
  /** المستخدم الحالي لا يستطيع تعطيل/حذف نفسه. */
  isSelf: z.boolean(),
});
export type Employee = z.infer<typeof employeeSchema>;

export const createEmployeeSchema = z.object({
  name: z.string().trim().min(1, 'الاسم مطلوب.').max(120),
  email: emailSchema,
  password: z.string().min(8, 'كلمة المرور ٨ أحرف على الأقل.').max(200),
  roleId: uuidSchema,
  branchId: uuidSchema.nullable().optional(),
  status: employeeStatusSchema.default('ACTIVE'),
});
export type CreateEmployeeRequest = z.infer<typeof createEmployeeSchema>;

export const updateEmployeeSchema = z.object({
  name: z.string().trim().min(1).max(120),
  roleId: uuidSchema,
  branchId: uuidSchema.nullable().optional(),
  status: employeeStatusSchema,
});
export type UpdateEmployeeRequest = z.infer<typeof updateEmployeeSchema>;

/** إعادة تعيين كلمة المرور (صاحب المحل). */
export const resetEmployeePasswordSchema = z.object({
  password: z.string().min(8).max(200),
});
export type ResetEmployeePasswordRequest = z.infer<typeof resetEmployeePasswordSchema>;

// ── الأدوار والصلاحيات ───────────────────────────────────────────────────────

export const roleSchema = z.object({
  id: uuidSchema,
  name: z.string(),
  isSystem: z.boolean(),
  permissions: z.array(z.string()),
  /** عدد المستخدمين على هذا الدور (لمنع حذف دور مستخدَم). */
  userCount: z.number().int(),
});
export type Role = z.infer<typeof roleSchema>;

export const createRoleSchema = z.object({
  name: z.string().trim().min(1, 'اسم الدور مطلوب.').max(32),
  permissions: z.array(z.string()).min(1, 'اختر صلاحية واحدة على الأقل.'),
});
export type CreateRoleRequest = z.infer<typeof createRoleSchema>;

export const updateRoleSchema = z.object({
  name: z.string().trim().min(1).max(32),
  permissions: z.array(z.string()).min(1),
});
export type UpdateRoleRequest = z.infer<typeof updateRoleSchema>;

// ── الجلسات ──────────────────────────────────────────────────────────────────

export const employeeSessionSchema = z.object({
  id: uuidSchema,
  userAgent: z.string().nullable(),
  ipAddress: z.string().nullable(),
  createdAt: isoDateTimeSchema,
  expiresAt: isoDateTimeSchema,
  /** هل هي جلسة الطلب الحالي؟ (لا نعرض «إنهاء» لها بنفس معنى الأخرى). */
  current: z.boolean(),
});
export type EmployeeSession = z.infer<typeof employeeSessionSchema>;

// ── 2FA (TOTP) ───────────────────────────────────────────────────────────────

/** بدء تفعيل 2FA — يعيد السرّ وotpauth URI لعرض QR (مرة واحدة). */
export const totpSetupSchema = z.object({
  secret: z.string(),
  otpauthUri: z.string(),
});
export type TotpSetup = z.infer<typeof totpSetupSchema>;

export const totpVerifySchema = z.object({
  code: z.string().trim().regex(/^\d{6}$/, 'رمز مكوّن من ٦ أرقام.'),
});
export type TotpVerifyRequest = z.infer<typeof totpVerifySchema>;

export const EMPLOYEE_STATUS_LABELS: Record<EmployeeStatus, string> = {
  ACTIVE: 'نشط',
  INACTIVE: 'غير نشط',
  SUSPENDED: 'موقوف',
};
