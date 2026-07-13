/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  بذور البيانات — قابلة لإعادة التشغيل بأمان (idempotent).
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  كل عملية `upsert` بمفتاح طبيعي (code / slug / email). تشغيلها مرتين لا
 *  يُنشئ صفوفًا مكررة ولا يفشل.
 *
 *  ⚠️ كلمات المرور تُقرأ من البيئة ولا تُكتب في الكود إطلاقًا. غياب المتغير
 *     يوقف البذر برسالة واضحة — لا كلمة مرور افتراضية، ولو في التطوير.
 *     "admin123" في seed هي أشهر ثغرة في أنظمة SaaS المُسرَّبة.
 */
import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';
import {
  ALL_PERMISSIONS,
  PERMISSION_LABELS,
  ROLES,
  ROLE_DESCRIPTIONS,
  TENANT_ROLES,
  permissionsForRole,
} from '@oh/config';

const prisma = new PrismaClient();

const ARGON2_OPTIONS: argon2.Options = {
  type: argon2.argon2id,
  memoryCost: 65_536,
  timeCost: 3,
  parallelism: 4,
};

function required(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === '') {
    console.error(`
✗ المتغيّر ${name} مطلوب للبذر ولم يُضبط.

  البذر لا يستخدم كلمات مرور افتراضية — إطلاقًا.
  حساب بكلمة مرور معروفة في قاعدة إنتاج هو ثغرة، لا تسهيل.

  أضف إلى .env.development:
    SEED_SUPER_ADMIN_EMAIL=...
    SEED_SUPER_ADMIN_PASSWORD=...   (12 حرفًا على الأقل)
    SEED_OWNER_EMAIL=...
    SEED_OWNER_PASSWORD=...
`);
    process.exit(1);
  }
  if (name.endsWith('PASSWORD') && value.length < 12) {
    console.error(`✗ ${name} يجب أن يكون 12 حرفًا على الأقل.`);
    process.exit(1);
  }
  return value;
}

async function main(): Promise<void> {
  console.log('▶ بدء البذر...\n');

  const superAdminEmail = required('SEED_SUPER_ADMIN_EMAIL').toLowerCase();
  const superAdminPassword = required('SEED_SUPER_ADMIN_PASSWORD');
  const ownerEmail = required('SEED_OWNER_EMAIL').toLowerCase();
  const ownerPassword = required('SEED_OWNER_PASSWORD');

  // ── 1) كتالوج الصلاحيات ────────────────────────────────────────────────
  // مرآة لـ@oh/config. وجودها كجدول يسمح بمفاتيح أجنبية حقيقية.
  for (const key of ALL_PERMISSIONS) {
    await prisma.permission.upsert({
      where: { key },
      create: {
        key,
        label: PERMISSION_LABELS[key],
        category: key.split('.')[0] ?? 'other',
        isPlatform: key.startsWith('platform.'),
      },
      update: {
        label: PERMISSION_LABELS[key],
        isPlatform: key.startsWith('platform.'),
      },
    });
  }
  console.log(`  ✓ الصلاحيات: ${ALL_PERMISSIONS.length}`);

  // ── 2) الباقات ─────────────────────────────────────────────────────────
  const plans = [
    {
      code: 'basic',
      nameAr: 'الباقة الأساسية',
      nameHe: 'חבילה בסיסית',
      nameEn: 'Basic',
      priceMonthly: '99.00',
      maxStores: 1,
      maxUsers: 5,
      maxCustomers: 1_000,
      maxOrdersPerMonth: 5_000,
      maxStorageMb: 1_024,
    },
    {
      code: 'pro',
      nameAr: 'الباقة الاحترافية',
      nameHe: 'חבילה מקצועית',
      nameEn: 'Professional',
      priceMonthly: '249.00',
      maxStores: 3,
      maxUsers: 20,
      maxCustomers: 10_000,
      maxOrdersPerMonth: 50_000,
      maxStorageMb: 10_240,
    },
    {
      code: 'enterprise',
      nameAr: 'باقة المؤسسات',
      nameHe: 'חבילה ארגונית',
      nameEn: 'Enterprise',
      priceMonthly: '599.00',
      maxStores: 20,
      maxUsers: 100,
      maxCustomers: 100_000,
      maxOrdersPerMonth: 500_000,
      maxStorageMb: 102_400,
    },
  ];

  for (const plan of plans) {
    await prisma.plan.upsert({
      where: { code: plan.code },
      create: { ...plan, currency: 'ILS', isActive: true },
      update: { ...plan, currency: 'ILS' },
    });
  }
  const basicPlan = await prisma.plan.findUniqueOrThrow({ where: { code: 'basic' } });
  console.log(`  ✓ الباقات: ${plans.length}`);

  // ── 3) المدير العام ────────────────────────────────────────────────────
  // tenantId = null — لا ينتمي لأي محل. قيد CHECK في القاعدة يفرض ذلك.
  const superAdminHash = await argon2.hash(superAdminPassword, ARGON2_OPTIONS);
  await prisma.user.upsert({
    where: { email: superAdminEmail },
    create: {
      email: superAdminEmail,
      name: 'المدير العام',
      passwordHash: superAdminHash,
      isSuperAdmin: true,
      tenantId: null,
      status: 'ACTIVE',
      locale: 'ar',
      passwordChangedAt: new Date(),
    },
    update: {
      // إعادة التشغيل لا تُعيد ضبط كلمة المرور — قد تكون غُيّرت عمدًا.
      name: 'المدير العام',
      isSuperAdmin: true,
      status: 'ACTIVE',
    },
  });
  console.log(`  ✓ المدير العام: ${superAdminEmail}`);

  // ── 4) محل النجاح ──────────────────────────────────────────────────────
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'al-najah' },
    create: {
      slug: 'al-najah',
      name: 'محل النجاح',
      status: 'ACTIVE',
      locale: 'ar',
      currency: 'ILS',
      timezone: 'Asia/Jerusalem',
    },
    update: { name: 'محل النجاح', status: 'ACTIVE' },
  });

  const store = await prisma.store.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: '1001' } },
    create: {
      tenantId: tenant.id,
      code: '1001',
      name: 'محل النجاح',
      phone: '050-1234567',
      email: 'info@alnajah.com',
      address: 'شارع النجاح، حي النور',
      city: 'الرياض',
      currency: 'ILS',
      settings: {},
    },
    update: { name: 'محل النجاح' },
  });

  await prisma.branch.upsert({
    where: {
      tenantId_storeId_code: { tenantId: tenant.id, storeId: store.id, code: 'MAIN' },
    },
    create: {
      tenantId: tenant.id,
      storeId: store.id,
      code: 'MAIN',
      name: 'الفرع الرئيسي',
      isMain: true,
      city: 'الرياض',
    },
    update: { name: 'الفرع الرئيسي', isMain: true },
  });
  console.log(`  ✓ المحل: محل النجاح (1001)`);

  // ── 5) الأدوار النظامية + صلاحياتها ────────────────────────────────────
  const roleIds: Record<string, string> = {};

  for (const roleName of TENANT_ROLES) {
    const role = await prisma.role.upsert({
      where: { tenantId_name: { tenantId: tenant.id, name: roleName } },
      create: {
        tenantId: tenant.id,
        name: roleName,
        description: ROLE_DESCRIPTIONS[roleName],
        isSystem: true,
      },
      update: { description: ROLE_DESCRIPTIONS[roleName], isSystem: true },
    });
    roleIds[roleName] = role.id;

    // نُزامن الصلاحيات: نحذف القديمة ونضع الحالية.
    // آمن لأن مصدر الحقيقة هو @oh/config، وهذا يعكس أي تغيير فيه.
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    const permissions = permissionsForRole(roleName);
    if (permissions.length > 0) {
      await prisma.rolePermission.createMany({
        data: permissions.map((permissionKey) => ({
          roleId: role.id,
          permissionKey,
          tenantId: tenant.id,
        })),
        skipDuplicates: true,
      });
    }
  }
  console.log(`  ✓ الأدوار: ${TENANT_ROLES.join('، ')}`);

  // ── 6) صاحب المحل ──────────────────────────────────────────────────────
  const ownerRoleId = roleIds[ROLES.OWNER];
  if (!ownerRoleId) throw new Error('دور صاحب المحل غير موجود.');

  const ownerHash = await argon2.hash(ownerPassword, ARGON2_OPTIONS);
  await prisma.user.upsert({
    where: { email: ownerEmail },
    create: {
      tenantId: tenant.id,
      storeId: store.id,
      roleId: ownerRoleId,
      email: ownerEmail,
      name: 'أحمد محمود',
      phone: '050-1234567',
      passwordHash: ownerHash,
      jobTitle: 'صاحب المحل',
      isSuperAdmin: false,
      status: 'ACTIVE',
      locale: 'ar',
      passwordChangedAt: new Date(),
    },
    update: {
      tenantId: tenant.id,
      storeId: store.id,
      roleId: ownerRoleId,
      name: 'أحمد محمود',
      status: 'ACTIVE',
    },
  });
  console.log(`  ✓ صاحب المحل: ${ownerEmail}`);

  // ── 7) الاشتراك ────────────────────────────────────────────────────────
  const existing = await prisma.subscription.findFirst({
    where: { tenantId: tenant.id, status: { in: ['ACTIVE', 'TRIALING'] } },
  });

  if (!existing) {
    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setFullYear(periodEnd.getFullYear() + 1);

    await prisma.subscription.create({
      data: {
        tenantId: tenant.id,
        planId: basicPlan.id,
        status: 'ACTIVE',
        startedAt: now,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
      },
    });
    console.log(`  ✓ الاشتراك: الباقة الأساسية (نشط)`);
  } else {
    console.log(`  ✓ الاشتراك: موجود مسبقًا — لم يُنشأ مكرر`);
  }

  console.log(`
✓ اكتمل البذر.

  المدير العام : ${superAdminEmail}   → /platform
  صاحب المحل   : ${ownerEmail}   → /
`);
}

main()
  .catch((error: unknown) => {
    console.error('\n✗ فشل البذر:', error);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
