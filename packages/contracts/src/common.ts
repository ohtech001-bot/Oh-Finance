import { z } from 'zod';
import { CURRENCY_CODES } from '@oh/money';
import { LOCALE_CODES } from '@oh/config';

/**
 * لبنات مشتركة لكل عقود الـAPI.
 *
 * هذه الحزمة هي **المصدر الوحيد** لأشكال البيانات: الخادم يتحقق بها،
 * والواجهة تستنتج أنواعها منها (`z.infer`). لا يوجد تعريف مكرر لأي DTO.
 * أي تغيير هنا يكسر البناء على الطرفين فورًا — بدل أن يظهر كخطأ وقت التشغيل.
 */

// ── مبلغ مالي ────────────────────────────────────────────────────────────────
/**
 * المبالغ تعبر الـAPI **كنصوص** لا كأرقام JSON.
 *
 * `JSON.parse('{"amount": 1250.10}')` يعطي `1250.1` كـ IEEE-754 double.
 * القيم فوق 2^53 أو ذات كسور دقيقة تفقد الدقة بلا إنذار. النص يعبر سليمًا.
 */
export const moneySchema = z
  .string()
  .regex(/^-?\d+(\.\d{1,4})?$/, 'مبلغ غير صالح. الصيغة: "1250.00" (حتى 4 خانات عشرية).');

/**
 * مبلغ موجب تمامًا (> 0) — للدفعات والأسعار.
 *
 * الفحص نصّي بالكامل: لا `parseFloat` ولا `Number()`. تحويل المبلغ إلى
 * `number` ولو لمجرد مقارنته بصفر يفتح الباب الذي أغلقناه.
 * "0" و "0.00" و "-0.0" كلها صفر → مرفوضة.
 */
const isZeroString = (v: string) => /^-?0+(\.0+)?$/.test(v);

export const positiveMoneySchema = moneySchema.refine(
  (v) => !v.startsWith('-') && !isZeroString(v),
  'يجب أن يكون المبلغ أكبر من صفر.',
);

/** مبلغ ≥ 0 (الأرصدة، الحدود الائتمانية). */
export const nonNegativeMoneySchema = moneySchema.refine(
  (v) => !v.startsWith('-'),
  'لا يُسمح بمبلغ سالب هنا.',
);

// ── معرّفات ──────────────────────────────────────────────────────────────────
export const uuidSchema = z.string().uuid('معرّف غير صالح.');
export const cuidSchema = z.string().min(1);

// ── حقول شائعة ───────────────────────────────────────────────────────────────
export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email('بريد إلكتروني غير صالح.')
  .max(254);

/** هاتف دولي مرن — التحقق الدقيق يتم حسب الدولة في طبقة الأعمال. */
export const phoneSchema = z
  .string()
  .trim()
  .regex(/^[+]?[\d\s()-]{7,20}$/, 'رقم هاتف غير صالح.');

export const localeSchema = z.enum(LOCALE_CODES as [string, ...string[]]);
export const currencySchema = z.enum(CURRENCY_CODES as [string, ...string[]]);

/** تاريخ ISO-8601 بصيغة نصية (التخزين والنقل بالـUTC دائمًا). */
export const isoDateTimeSchema = z.string().datetime({ offset: true });
export const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'صيغة التاريخ: YYYY-MM-DD');

// ── الترقيم والفرز ───────────────────────────────────────────────────────────
export const PAGE_SIZES = [10, 25, 50, 100] as const;

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce
    .number()
    .int()
    .refine((v) => (PAGE_SIZES as readonly number[]).includes(v), {
      message: `حجم الصفحة يجب أن يكون أحد: ${PAGE_SIZES.join(', ')}`,
    })
    .default(10),
});
export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

export const sortOrderSchema = z.enum(['asc', 'desc']).default('desc');
export type SortOrder = z.infer<typeof sortOrderSchema>;

export interface PaginatedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export function paginatedSchema<T extends z.ZodTypeAny>(item: T) {
  return z.object({
    items: z.array(item),
    page: z.number().int(),
    pageSize: z.number().int(),
    total: z.number().int(),
    totalPages: z.number().int(),
  });
}

/** مدى تاريخي — يُستخدم في كل الفلاتر والتقارير. */
export const dateRangeSchema = z
  .object({
    from: isoDateSchema.optional(),
    to: isoDateSchema.optional(),
  })
  .refine((r) => !r.from || !r.to || r.from <= r.to, {
    message: 'تاريخ البداية يجب أن يسبق تاريخ النهاية.',
    path: ['to'],
  });
export type DateRange = z.infer<typeof dateRangeSchema>;

// ── الأخطاء ──────────────────────────────────────────────────────────────────
/**
 * أكواد أخطاء موحّدة — الواجهة تتفرّع عليها بدل مطابقة نصوص الرسائل.
 * الرسائل قابلة للترجمة والتغيير؛ الأكواد عقد ثابت.
 */
export const ERROR_CODES = {
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  ACCOUNT_LOCKED: 'ACCOUNT_LOCKED',
  ACCOUNT_INACTIVE: 'ACCOUNT_INACTIVE',
  TWO_FACTOR_REQUIRED: 'TWO_FACTOR_REQUIRED',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  TOKEN_REUSED: 'TOKEN_REUSED',
  CSRF_INVALID: 'CSRF_INVALID',
  FORBIDDEN: 'FORBIDDEN',
  TENANT_MISMATCH: 'TENANT_MISMATCH',
  TENANT_SUSPENDED: 'TENANT_SUSPENDED',
  SUBSCRIPTION_INACTIVE: 'SUBSCRIPTION_INACTIVE',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  IDEMPOTENCY_KEY_REQUIRED: 'IDEMPOTENCY_KEY_REQUIRED',
  IDEMPOTENCY_PAYLOAD_MISMATCH: 'IDEMPOTENCY_PAYLOAD_MISMATCH',
  PLAN_LIMIT_EXCEEDED: 'PLAN_LIMIT_EXCEEDED',
  RATE_LIMITED: 'RATE_LIMITED',
  INTERNAL: 'INTERNAL',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

export const apiErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  /** أخطاء الحقول — تُربط مباشرة بـ React Hook Form. */
  fields: z.record(z.array(z.string())).optional(),
  /** معرّف الطلب — يربط الخطأ الظاهر للمستخدم بسطر السجل على الخادم. */
  requestId: z.string().optional(),
});
export type ApiError = z.infer<typeof apiErrorSchema>;

// ── حالات عامة ───────────────────────────────────────────────────────────────
export const activeStatusSchema = z.enum(['ACTIVE', 'INACTIVE']);
export type ActiveStatus = z.infer<typeof activeStatusSchema>;
