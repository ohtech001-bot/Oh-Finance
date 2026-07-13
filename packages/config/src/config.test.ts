import { describe, expect, it } from 'vitest';
import {
  ALL_PERMISSIONS,
  DEFAULT_LOCALE,
  EnvValidationError,
  PERMISSIONS,
  PERMISSION_LABELS,
  PLATFORM_PERMISSIONS,
  ROLES,
  ROLE_PERMISSIONS,
  TENANT_PERMISSIONS,
  directionOf,
  isPermission,
  isRtl,
  parseEnv,
  permissionsForRole,
} from './index.js';

const VALID_SECRET = 'a'.repeat(48);
const VALID_DB = 'postgresql://user:pass@host.neon.tech/db?sslmode=require';

function baseEnv(overrides: Record<string, string> = {}): NodeJS.ProcessEnv {
  return {
    NODE_ENV: 'development',
    DATABASE_URL: VALID_DB,
    JWT_ACCESS_SECRET: `access-${VALID_SECRET}`,
    JWT_REFRESH_SECRET: `refresh-${VALID_SECRET}`,
    COOKIE_SECRET: `cookie-${VALID_SECRET}`,
    ...overrides,
  };
}

describe('parseEnv — يرفض الإقلاع بإعداد سيّئ', () => {
  it('يقبل بيئة تطوير صالحة ويطبّق الافتراضيات', () => {
    const env = parseEnv(baseEnv());
    expect(env.API_PORT).toBe(3001);
    expect(env.DEFAULT_CURRENCY).toBe('ILS');
    expect(env.DEFAULT_LOCALE).toBe('ar');
    expect(env.COOKIE_SECURE).toBe(false);
  });

  it('يرفض غياب DATABASE_URL', () => {
    const env = baseEnv();
    delete env.DATABASE_URL;
    expect(() => parseEnv(env)).toThrow(EnvValidationError);
  });

  it('يرفض أي مزوّد غير PostgreSQL — لا SQLite ولا MySQL', () => {
    expect(() => parseEnv(baseEnv({ DATABASE_URL: 'file:./dev.db' }))).toThrow(/PostgreSQL|رابط/);
    expect(() => parseEnv(baseEnv({ DATABASE_URL: 'mysql://u:p@h/db' }))).toThrow(/PostgreSQL/);
  });

  it('يرفض الأسرار القصيرة', () => {
    expect(() => parseEnv(baseEnv({ JWT_ACCESS_SECRET: 'short' }))).toThrow(/32 حرفًا/);
  });

  it('يرفض تطابق سر الوصول وسر التجديد في الإنتاج', () => {
    const same = `same-${VALID_SECRET}`;
    expect(() =>
      parseEnv(
        baseEnv({
          NODE_ENV: 'production',
          COOKIE_SECURE: 'true',
          REDIS_URL: 'rediss://h:1',
          JWT_ACCESS_SECRET: same,
          JWT_REFRESH_SECRET: same,
        }),
      ),
    ).toThrow(/يختلفا/);
  });

  it('يرفض COOKIE_SECURE=false في الإنتاج', () => {
    expect(() =>
      parseEnv(baseEnv({ NODE_ENV: 'production', REDIS_URL: 'rediss://h:1' })),
    ).toThrow(/COOKIE_SECURE/);
  });

  it('يرفض غياب REDIS_URL في الإنتاج', () => {
    expect(() =>
      parseEnv(baseEnv({ NODE_ENV: 'production', COOKIE_SECURE: 'true' })),
    ).toThrow(/REDIS_URL/);
  });

  it('يرفض LOG_LEVEL=debug في الإنتاج (تسريب بيانات)', () => {
    expect(() =>
      parseEnv(
        baseEnv({
          NODE_ENV: 'production',
          COOKIE_SECURE: 'true',
          REDIS_URL: 'rediss://h:1',
          LOG_LEVEL: 'debug',
        }),
      ),
    ).toThrow(/debug/);
  });

  it('يقبل إنتاجًا مُهيّأً بالكامل', () => {
    const env = parseEnv(
      baseEnv({
        NODE_ENV: 'production',
        COOKIE_SECURE: 'true',
        COOKIE_SAME_SITE: 'strict',
        REDIS_URL: 'rediss://user:pass@host:6379',
        LOG_LEVEL: 'info',
      }),
    );
    expect(env.NODE_ENV).toBe('production');
    expect(env.COOKIE_SECURE).toBe(true);
  });
});

describe('الصلاحيات', () => {
  it('لكل صلاحية وصف عربي — لا صلاحية يتيمة في شاشة الموظفين', () => {
    for (const permission of ALL_PERMISSIONS) {
      expect(PERMISSION_LABELS[permission], `ينقص وصف: ${permission}`).toBeTruthy();
    }
  });

  it('صلاحيات المنصة والمحل منفصلتان تمامًا', () => {
    const overlap = PLATFORM_PERMISSIONS.filter((p) => TENANT_PERMISSIONS.includes(p));
    expect(overlap).toEqual([]);
    expect(PLATFORM_PERMISSIONS.length + TENANT_PERMISSIONS.length).toBe(ALL_PERMISSIONS.length);
  });

  it('isPermission يرفض المجهول', () => {
    expect(isPermission('customers.read')).toBe(true);
    expect(isPermission('customers.hack')).toBe(false);
    expect(isPermission(null)).toBe(false);
  });
});

describe('الأدوار', () => {
  it('المدير العام لا يملك أي صلاحية على بيانات المحلات — عزل كامل', () => {
    const superAdmin = permissionsForRole(ROLES.SUPER_ADMIN);
    expect(superAdmin.every((p) => p.startsWith('platform.'))).toBe(true);
    expect(superAdmin).not.toContain(PERMISSIONS.CUSTOMERS_READ);
    expect(superAdmin).not.toContain(PERMISSIONS.LEDGER_READ);
    expect(superAdmin).not.toContain(PERMISSIONS.PAYMENTS_READ);
  });

  it('صاحب المحل لا يملك أي صلاحية منصة', () => {
    const owner = permissionsForRole(ROLES.OWNER);
    expect(owner.some((p) => p.startsWith('platform.'))).toBe(false);
  });

  it('العمليات المالية العكسية محصورة بصاحب المحل', () => {
    for (const role of [ROLES.MANAGER, ROLES.CASHIER, ROLES.VIEWER] as const) {
      expect(ROLE_PERMISSIONS[role]).not.toContain(PERMISSIONS.PAYMENTS_REVERSE);
      expect(ROLE_PERMISSIONS[role]).not.toContain(PERMISSIONS.LEDGER_ADJUST);
    }
    expect(ROLE_PERMISSIONS.OWNER).toContain(PERMISSIONS.PAYMENTS_REVERSE);
    expect(ROLE_PERMISSIONS.OWNER).toContain(PERMISSIONS.LEDGER_ADJUST);
  });

  it('المُطّلع قراءة فقط — لا كتابة إطلاقًا', () => {
    const viewer = permissionsForRole(ROLES.VIEWER);
    const writeLike = viewer.filter((p) =>
      /\.(write|create|update|confirm|cancel|delete|manage|reverse|adjust|send)$/.test(p),
    );
    expect(writeLike).toEqual([]);
  });

  it('الكاشير لا يلغي ولا يرى التقارير', () => {
    const cashier = permissionsForRole(ROLES.CASHIER);
    expect(cashier).not.toContain(PERMISSIONS.ORDERS_CANCEL);
    expect(cashier).not.toContain(PERMISSIONS.REPORTS_READ);
    expect(cashier).toContain(PERMISSIONS.PAYMENTS_CREATE);
  });

  it('كل صلاحيات كل دور موجودة في الكتالوج', () => {
    for (const [role, permissions] of Object.entries(ROLE_PERMISSIONS)) {
      for (const p of permissions) {
        expect(isPermission(p), `${role} يملك صلاحية غير معرّفة: ${p}`).toBe(true);
      }
    }
  });
});

describe('اللغات والاتجاه', () => {
  it('العربية هي الافتراضية', () => {
    expect(DEFAULT_LOCALE).toBe('ar');
  });

  it('العربية والعبرية RTL، الإنجليزية LTR', () => {
    expect(directionOf('ar')).toBe('rtl');
    expect(directionOf('he')).toBe('rtl');
    expect(directionOf('en')).toBe('ltr');
    expect(isRtl('ar')).toBe(true);
    expect(isRtl('en')).toBe(false);
  });
});
