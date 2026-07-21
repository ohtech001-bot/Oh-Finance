import { z } from 'zod';
import { CURRENCY_CODES } from '@oh/money';
import { LOCALE_CODES } from './locales.js';

/**
 * التحقق من متغيّرات البيئة — fail fast عند الإقلاع.
 *
 * الفلسفة: خادم مالي يجب أن **يرفض الإقلاع** بإعداد ناقص أو ضعيف، بدل أن
 * يعمل ثم ينهار عند أول طلب — أو أسوأ: يعمل بسر افتراضي ضعيف.
 *
 * ملاحظة أمنية: لا توجد قيمة افتراضية لأي سر. غيابه = رفض الإقلاع.
 */

const SECRET_MIN = 32;

const secret = (name: string) =>
  z
    .string({ required_error: `${name} مطلوب — ولّده بـ: node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"` })
    .min(SECRET_MIN, `${name} يجب أن يكون ${SECRET_MIN} حرفًا على الأقل.`);

const postgresUrl = z
  .string()
  .url('يجب أن يكون رابط اتصال صالحًا.')
  .refine((v) => v.startsWith('postgresql://') || v.startsWith('postgres://'), {
    message: 'المزوّد PostgreSQL حصرًا (postgresql://). النظام يعتمد على RLS و NUMERIC.',
  });

const boolish = z
  .enum(['true', 'false', '1', '0'])
  .transform((v) => v === 'true' || v === '1');

export const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    API_PORT: z.coerce.number().int().min(1).max(65535).default(3001),
    API_HOST: z.string().default('127.0.0.1'),
    WEB_ORIGIN: z.string().url().default('http://localhost:5173'),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),

    // قاعدة البيانات
    DATABASE_URL: postgresUrl,
    DIRECT_DATABASE_URL: postgresUrl.optional(),

    // Redis — اختياري في التطوير؛ إن غاب تُستخدم حدود معدل بالذاكرة.
    REDIS_URL: z.string().url().optional(),

    // المصادقة
    JWT_ACCESS_SECRET: secret('JWT_ACCESS_SECRET'),
    JWT_REFRESH_SECRET: secret('JWT_REFRESH_SECRET'),
    COOKIE_SECRET: secret('COOKIE_SECRET'),
    JWT_ACCESS_TTL: z.string().default('15m'),
    JWT_REFRESH_TTL: z.string().default('30d'),

    // الكوكيز
    COOKIE_SECURE: boolish.default('false'),
    COOKIE_DOMAIN: z.string().optional(),
    COOKIE_SAME_SITE: z.enum(['strict', 'lax', 'none']).default('lax'),

    // حدود المعدل
    RATE_LIMIT_TTL_SECONDS: z.coerce.number().int().positive().default(60),
    RATE_LIMIT_MAX: z.coerce.number().int().positive().default(120),
    AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(5),
    AUTH_LOCKOUT_THRESHOLD: z.coerce.number().int().positive().default(10),
    AUTH_LOCKOUT_MINUTES: z.coerce.number().int().positive().default(15),

    // التوطين والعملة
    DEFAULT_LOCALE: z.enum(LOCALE_CODES as [string, ...string[]]).default('ar'),
    DEFAULT_CURRENCY: z.enum(CURRENCY_CODES as [string, ...string[]]).default('ILS'),
    DEFAULT_TIMEZONE: z.string().default('Asia/Jerusalem'),

    // أعلام المميزات
    FEATURE_2FA: boolish.default('false'),
    FEATURE_MESSAGING: boolish.default('false'),
    FEATURE_PRODUCTS: boolish.default('false'),

    // البريد الصادر — اختياري عند الإقلاع، وتتعطل ميزة الدعوات بوضوح إن غاب.
    SMTP_HOST: z.string().min(1).optional(),
    SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(587),
    SMTP_SECURE: boolish.default('false'),
    SMTP_USER: z.string().min(1).optional(),
    SMTP_PASSWORD: z.string().min(1).optional(),
    SMTP_FROM_EMAIL: z.string().email().default('info@oh-tech.co'),
    SMTP_FROM_NAME: z.string().default('OH Finance'),
  })
  .superRefine((env, ctx) => {
    // ── قيود الإنتاج: لا تنازل ─────────────────────────────────────────────
    if (env.NODE_ENV !== 'production') return;

    if (!env.COOKIE_SECURE) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['COOKIE_SECURE'],
        message: 'COOKIE_SECURE=true إلزامي في الإنتاج — بدونه تُرسل الكوكيز عبر HTTP.',
      });
    }

    if (env.COOKIE_SAME_SITE === 'none' && !env.COOKIE_SECURE) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['COOKIE_SAME_SITE'],
        message: 'SameSite=None يتطلب Secure=true (شرط المتصفحات).',
      });
    }

    if (env.JWT_ACCESS_SECRET === env.JWT_REFRESH_SECRET) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['JWT_REFRESH_SECRET'],
        message:
          'سر الوصول وسر التجديد يجب أن يختلفا — وإلا صلح رمز الوصول كرمز تجديد.',
      });
    }

    if (!env.REDIS_URL) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['REDIS_URL'],
        message:
          'REDIS_URL إلزامي في الإنتاج — حدود المعدل بالذاكرة لا تعمل عبر عدة نسخ من الخادم.',
      });
    }

    if (env.LOG_LEVEL === 'trace' || env.LOG_LEVEL === 'debug') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['LOG_LEVEL'],
        message: 'مستوى السجل debug/trace يسرّب تفاصيل حسّاسة في الإنتاج.',
      });
    }
  });

export type Env = z.infer<typeof envSchema>;

export class EnvValidationError extends Error {
  constructor(public readonly issues: z.ZodIssue[]) {
    const lines = issues.map((i) => `  • ${i.path.join('.') || '(جذر)'}: ${i.message}`);
    super(`إعداد البيئة غير صالح — الخادم لن يُقلع:\n${lines.join('\n')}\n`);
    this.name = 'EnvValidationError';
  }
}

/** يتحقق ويُرجع بيئة مُطابِقة للنوع، أو يرمي خطأً مفصّلًا. */
export function parseEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    throw new EnvValidationError(result.error.issues);
  }
  return result.data;
}

/** المفاتيح التي يجب تنقيحها من السجلات دائمًا. */
export const REDACTED_KEYS = [
  'password',
  'passwordHash',
  'password_hash',
  'currentPassword',
  'newPassword',
  'token',
  'accessToken',
  'refreshToken',
  'refresh_token',
  'authorization',
  'cookie',
  'set-cookie',
  'secret',
  'jwt',
  'totpSecret',
  'totp_secret',
  'recoveryCodes',
  'apiKey',
  'api_key',
  'DATABASE_URL',
  'DIRECT_DATABASE_URL',
  'REDIS_URL',
  'SMTP_PASSWORD',
] as const;
