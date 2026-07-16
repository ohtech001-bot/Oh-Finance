import { PrismaClient } from '@prisma/client';
import { HAS_TEST_DB, testDb } from './db.js';

/**
 * أدوات بناء بيانات الاختبار.
 *
 * كل شيء يمر بسياق مستأجر — كما يفعل الخادم بالضبط. لا نتجاوز RLS في
 * الاختبارات، وإلا لاختبرنا شيئًا غير ما ننشره.
 */

export interface TestTenant {
  tenantId: string;
  storeId: string;
  userId: string;
  planId: string;
}

type Tx = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

/**
 * ينفّذ ضمن سياق مستأجر — **نسخة طبق الأصل** من `PrismaService.runInTenant`.
 *
 * ⚠️ `SET LOCAL ROLE oh_app` إلزامي — نتصل كـ`postgres` (مستخدم فائق يتجاوز
 *    RLS). بدون التحويل إلى `oh_app` تكون الاختبارات تختبر قاعدة بلا عزل،
 *    فتمرّ كذبًا. يجب أن يعمل الاختبار بنفس دور التطبيق بالضبط، وإلا اختبرنا
 *    شيئًا غير ما ننشره.
 */
/**
 * مهلة سخية للمعاملات في الاختبار.
 *
 * ⚠️ قاعدة الاختبار **بعيدة** (Railway): كل عبارة ~300ms ذهابًا وإيابًا.
 *    اختبارات التزامن تُطلق 10–20 معاملة تفاعلية تتزاحم على القفل الاستشاري،
 *    فتنتظر المتأخرة طويلًا. مهلة Prisma الافتراضية (5s) تُسقطها فتتراجع —
 *    فيبدو الضمان مكسورًا بينما المشكلة في المهلة لا في المنطق.
 *
 *    في الإنتاج القاعدة قريبة (نفس الشبكة) والمهلة الافتراضية تكفي. هذه
 *    القيمة لبيئة الاختبار البعيدة حصرًا.
 */
const TX_OPTS = { maxWait: 30_000, timeout: 30_000 } as const;

export async function inTenant<T>(
  tenantId: string,
  fn: (tx: Tx) => Promise<T>,
): Promise<T> {
  const db = testDb();
  return db.$transaction(async (tx) => {
    await tx.$executeRawUnsafe('SET LOCAL ROLE oh_app');
    await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}::text, true)`;
    return fn(tx as Tx);
  }, TX_OPTS);
}

export async function asPlatform<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  const db = testDb();
  return db.$transaction(async (tx) => {
    await tx.$executeRawUnsafe('SET LOCAL ROLE oh_app');
    await tx.$executeRaw`SELECT set_config('app.is_platform', 'on', true)`;
    return fn(tx as Tx);
  }, TX_OPTS);
}

/** ينشئ مستأجرًا كاملًا (محل + صاحب + باقة) — بسياق المنصة، الطريق الشرعي. */
export async function createTestTenant(slug: string): Promise<TestTenant> {
  return asPlatform(async (tx) => {
    const plan = await tx.plan.upsert({
      where: { code: `test-${slug}` },
      create: {
        code: `test-${slug}`,
        nameAr: 'اختبار',
        nameHe: 'x',
        nameEn: 'x',
        priceMonthly: '99.00',
        currency: 'ILS',
      },
      update: {},
    });

    const tenant = await tx.tenant.create({
      data: { slug, name: `محل ${slug}`, status: 'ACTIVE', currency: 'ILS' },
    });

    const store = await tx.store.create({
      data: { tenantId: tenant.id, code: slug.slice(0, 12), name: `محل ${slug}`, currency: 'ILS' },
    });

    const role = await tx.role.create({
      data: { tenantId: tenant.id, name: 'OWNER', isSystem: true },
    });

    const user = await tx.user.create({
      data: {
        tenantId: tenant.id,
        storeId: store.id,
        roleId: role.id,
        email: `owner-${slug}@test.local`,
        name: 'صاحب المحل',
        passwordHash: 'argon2-placeholder',
      },
    });

    const now = new Date();
    const end = new Date(now);
    end.setFullYear(end.getFullYear() + 1);

    await tx.subscription.create({
      data: {
        tenantId: tenant.id,
        planId: plan.id,
        status: 'ACTIVE',
        currentPeriodStart: now,
        currentPeriodEnd: end,
      },
    });

    return { tenantId: tenant.id, storeId: store.id, userId: user.id, planId: plan.id };
  });
}

/** ينشئ زبونًا بلا رصيد افتتاحي. */
export async function createTestCustomer(
  t: TestTenant,
  name: string,
  opts: { creditLimit?: string; code?: string } = {},
): Promise<string> {
  return inTenant(t.tenantId, async (tx) => {
    const customer = await tx.customer.create({
      data: {
        tenantId: t.tenantId,
        storeId: t.storeId,
        code: opts.code ?? `CUST-${Math.random().toString(36).slice(2, 8)}`,
        name,
        creditLimit: opts.creditLimit ?? '0',
        createdBy: t.userId,
      },
      select: { id: true },
    });
    return customer.id;
  });
}

/**
 * ينظّف بيانات المرحلة 2 مع احترام الترتيب المرجعي.
 *
 * ⚠️ TRUNCATE لا DELETE على ledger_entries و payment_allocations:
 *    الـtriggers تمنع DELETE (append-only). TRUNCATE عملية DDL ولا تُطلقها —
 *    وهذا مقصود: نمنع الحذف من التطبيق، لا تنظيف قاعدة اختبار.
 */
export async function resetFinancialData(): Promise<void> {
  if (!HAS_TEST_DB) return;
  const db = testDb();

  await db.$executeRawUnsafe(`
    TRUNCATE TABLE
      payment_allocations, payments, ledger_entries,
      order_items, orders, customers,
      idempotency_keys, tenant_counters
    RESTART IDENTITY CASCADE
  `);
}

/** ينظّف كل شيء — بما فيه المستأجرين. */
export async function resetAll(): Promise<void> {
  if (!HAS_TEST_DB) return;
  const db = testDb();

  await db.$executeRawUnsafe(`
    TRUNCATE TABLE
      payment_allocations, payments, ledger_entries,
      order_items, orders, customers,
      idempotency_keys, tenant_counters,
      audit_logs, sessions, user_permissions, role_permissions,
      users, roles, branches, stores, subscriptions, tenants, plans
    RESTART IDENTITY CASCADE
  `);
}
