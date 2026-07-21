import { describe, expect, it } from 'vitest';
import {
  createTenantSchema,
  createPlatformStaffInviteSchema,
  dateRangeSchema,
  loginRequestSchema,
  moneySchema,
  nonNegativeMoneySchema,
  paginationQuerySchema,
  passwordSchema,
  positiveMoneySchema,
  setTenantStatusSchema,
} from './index.js';

describe('moneySchema — المبالغ نصوص لا أرقام', () => {
  it('يقبل النصوص العشرية الصالحة', () => {
    for (const v of ['0', '1250.00', '-42.5', '999999999999.9999']) {
      expect(moneySchema.safeParse(v).success).toBe(true);
    }
  });

  it('يرفض أرقام JSON — هذا هو الحاجز على حدود الـAPI', () => {
    expect(moneySchema.safeParse(1250.5).success).toBe(false);
    expect(moneySchema.safeParse(0).success).toBe(false);
  });

  it('يرفض الصيغ التي تكسر NUMERIC في Postgres', () => {
    expect(moneySchema.safeParse('1e5').success).toBe(false);
    expect(moneySchema.safeParse('1,250.00').success).toBe(false);
    expect(moneySchema.safeParse('NaN').success).toBe(false);
    expect(moneySchema.safeParse('Infinity').success).toBe(false);
    expect(moneySchema.safeParse('12.345678').success).toBe(false); // > 4 خانات
  });

  it('positiveMoneySchema يرفض الصفر والسالب بلا تحويل إلى number', () => {
    expect(positiveMoneySchema.safeParse('0').success).toBe(false);
    expect(positiveMoneySchema.safeParse('0.00').success).toBe(false);
    expect(positiveMoneySchema.safeParse('-0.00').success).toBe(false);
    expect(positiveMoneySchema.safeParse('-5.00').success).toBe(false);
    expect(positiveMoneySchema.safeParse('0.01').success).toBe(true);
  });

  it('nonNegativeMoneySchema يقبل الصفر ويرفض السالب', () => {
    expect(nonNegativeMoneySchema.safeParse('0.00').success).toBe(true);
    expect(nonNegativeMoneySchema.safeParse('-0.01').success).toBe(false);
  });
});

describe('loginRequestSchema', () => {
  it('يطبّع البريد (قص + أحرف صغيرة)', () => {
    const parsed = loginRequestSchema.parse({
      email: '  Owner@Shop.COM ',
      password: 'secret',
    });
    expect(parsed.email).toBe('owner@shop.com');
    expect(parsed.rememberMe).toBe(false);
  });

  it('لا يحتوي على tenantId — المستأجر من الجلسة حصرًا', () => {
    const parsed = loginRequestSchema.parse({
      email: 'a@b.com',
      password: 'x',
      // @ts-expect-error — الحقل غير موجود في العقد عمدًا
      tenantId: 'attacker-controlled-tenant',
    });
    expect(parsed).not.toHaveProperty('tenantId');
  });

  it('رمز TOTP ستة أرقام', () => {
    expect(
      loginRequestSchema.safeParse({ email: 'a@b.com', password: 'x', totpCode: '12345' }).success,
    ).toBe(false);
    expect(
      loginRequestSchema.safeParse({ email: 'a@b.com', password: 'x', totpCode: '123456' }).success,
    ).toBe(true);
  });
});

describe('passwordSchema', () => {
  it('يفرض 12 حرفًا على الأقل', () => {
    expect(passwordSchema.safeParse('short').success).toBe(false);
    expect(passwordSchema.safeParse('Passw0rd!').success).toBe(false); // 9 أحرف
    expect(passwordSchema.safeParse('a-long-enough-passphrase').success).toBe(true);
  });
});

describe('createTenantSchema — إنشاء محل من لوحة المدير العام', () => {
  const valid = {
    name: 'محل النجاح',
    ownerName: 'أحمد محمود',
    ownerEmail: 'owner@alnajah.com',
    ownerPassword: 'a-long-enough-passphrase',
    planId: '3f1b6e2a-9c4d-4b8e-9f2a-7d5c1e3a8b6f',
    subscriptionStartDate: '2026-07-01',
    subscriptionEndDate: '2026-08-01',
    agreedMonthlyAmount: '250.00',
  };

  it('يقبل حمولة صالحة ويطبّق الافتراضيات', () => {
    const parsed = createTenantSchema.parse(valid);
    expect(parsed.currency).toBe('ILS');
    expect(parsed.locale).toBe('ar');
    expect(parsed.timezone).toBe('Asia/Jerusalem');
    expect(parsed.paymentStatus).toBe('UNPAID');
    expect(parsed.paidAmount).toBe('0.00');
  });

  it('لا يطلب معرّفًا أو اسمًا تجاريًا إضافيًا', () => {
    const parsed = createTenantSchema.parse(valid);
    expect('slug' in parsed).toBe(false);
    expect('storeName' in parsed).toBe(false);
  });

  it('يرفض كلمة مرور ضعيفة لصاحب المحل', () => {
    expect(createTenantSchema.safeParse({ ...valid, ownerPassword: '123' }).success).toBe(false);
  });
});

describe('createPlatformStaffInviteSchema', () => {
  const valid = {
    name: 'موظف جديد', email: 'staff@example.com', phone: '0501234567',
    dateOfBirth: '1995-05-10', identityNumber: '123456789', jobTitle: 'خدمة العملاء',
    platformRole: 'EMPLOYEE', locale: 'ar',
  } as const;

  it('يقبل كل الحقول الإلزامية', () => {
    expect(createPlatformStaffInviteSchema.safeParse(valid).success).toBe(true);
  });

  it('يرفض هاتفًا لا يبدأ بـ05 أو لا يتكون من 10 أرقام', () => {
    expect(createPlatformStaffInviteSchema.safeParse({ ...valid, phone: '0401234567' }).success).toBe(false);
    expect(createPlatformStaffInviteSchema.safeParse({ ...valid, phone: '050123456' }).success).toBe(false);
  });
});

describe('setTenantStatusSchema — السبب إلزامي عند تغيير الحالة', () => {
  it('يرفض الإيقاف بلا سبب', () => {
    expect(setTenantStatusSchema.safeParse({ status: 'SUSPENDED' }).success).toBe(false);
    expect(setTenantStatusSchema.safeParse({ status: 'SUSPENDED', reason: 'ab' }).success).toBe(
      false,
    );
  });

  it('يقبل مع سبب — يُسجَّل في سجل التدقيق', () => {
    expect(
      setTenantStatusSchema.safeParse({ status: 'SUSPENDED', reason: 'عدم سداد الاشتراك' }).success,
    ).toBe(true);
  });
});

describe('paginationQuerySchema', () => {
  it('يطبّق الافتراضيات ويحوّل النصوص من query string', () => {
    const parsed = paginationQuerySchema.parse({});
    expect(parsed).toEqual({ page: 1, pageSize: 10 });
    expect(paginationQuerySchema.parse({ page: '3', pageSize: '25' })).toEqual({
      page: 3,
      pageSize: 25,
    });
  });

  it('يرفض حجم صفحة غير مسموح (يمنع استنزاف الخادم بـ pageSize=100000)', () => {
    expect(paginationQuerySchema.safeParse({ pageSize: 100_000 }).success).toBe(false);
    expect(paginationQuerySchema.safeParse({ page: 0 }).success).toBe(false);
  });
});

describe('dateRangeSchema', () => {
  it('يرفض مدى مقلوبًا', () => {
    expect(dateRangeSchema.safeParse({ from: '2024-05-20', to: '2024-05-01' }).success).toBe(false);
    expect(dateRangeSchema.safeParse({ from: '2024-05-01', to: '2024-05-20' }).success).toBe(true);
    expect(dateRangeSchema.safeParse({}).success).toBe(true);
  });

  it('يرفض صيغة تاريخ غير ISO', () => {
    expect(dateRangeSchema.safeParse({ from: '20/05/2024' }).success).toBe(false);
  });
});
