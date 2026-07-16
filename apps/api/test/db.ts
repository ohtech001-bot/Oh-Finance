/**
 * أدوات اختبارات التكامل.
 *
 * ── سياسة عدم توفر قاعدة البيانات ─────────────────────────────────────────
 * إن غاب `TEST_DATABASE_URL`، تتخطى الاختبارات نفسها **برسالة صريحة** بدل
 * أن تفشل. السبب: فشل أحمر كاذب يعلّم الفريق تجاهل اللون الأحمر — وهذه أخطر
 * عادة يمكن أن يكتسبها فريق يعمل على نظام مالي.
 *
 * لكن التخطي **يُعلَن بصوت عالٍ**: عدد الاختبارات المتخطاة يظهر في التقرير،
 * ولا يمكن الادّعاء بأن العزل مُختبَر بينما هو غير مُختبَر.
 */
import { PrismaClient } from '@prisma/client';

export const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL ?? '';
export const HAS_TEST_DB = TEST_DATABASE_URL.trim().length > 0;

export const SKIP_REASON =
  'TEST_DATABASE_URL غير مضبوط — تُخطّى اختبارات التكامل. ' +
  'انسخ .env.test.example إلى .env.test وضع رابط قاعدة اختبار مستقلة.';

let client: PrismaClient | null = null;

export function testDb(): PrismaClient {
  if (!HAS_TEST_DB) {
    throw new Error('testDb() استُدعيت بلا TEST_DATABASE_URL. استخدم describe.skipIf(!HAS_TEST_DB).');
  }

  // حدّ اتصالات أوسع: اختبارات التزامن تُطلق ~20 معاملة تفاعلية معًا.
  // بلا هذا تختنق على تجمّع Prisma الافتراضي (num_cpus×2+1) وتتجاوز maxWait.
  const url = new URL(TEST_DATABASE_URL);
  if (!url.searchParams.has('connection_limit')) {
    url.searchParams.set('connection_limit', '25');
  }

  client ??= new PrismaClient({
    datasources: { db: { url: url.toString() } },
  });
  return client;
}

export async function closeTestDb(): Promise<void> {
  if (client) {
    await client.$disconnect();
    client = null;
  }
}

/**
 * تفريغ الجداول بين الاختبارات.
 *
 * `permissions` مستثناة — كتالوج ثابت تحتاجه المفاتيح الأجنبية.
 * `TRUNCATE ... CASCADE` أسرع بكثير من DELETE ويعيد ضبط التسلسلات.
 *
 * ⚠️ audit_logs محمي بـtrigger يمنع DELETE — لكن TRUNCATE عملية DDL ولا
 *    يطلقه. هذا مقصود: نريد منع الحذف من التطبيق، لا منع تنظيف قاعدة اختبار.
 */
export async function resetDb(): Promise<void> {
  const db = testDb();
  await db.$executeRawUnsafe(`
    TRUNCATE TABLE
      audit_logs, sessions, user_permissions, role_permissions,
      users, roles, branches, stores, subscriptions, tenants, plans
    RESTART IDENTITY CASCADE
  `);
}

/**
 * ينفّذ استعلامًا ضمن سياق مستأجر — كما يفعل الخادم بالضبط.
 *
 * ⚠️ `SET LOCAL ROLE oh_app` إلزامي: نتصل كـ`postgres` (مستخدم فائق يتجاوز
 *    RLS كليًا). بدون التحويل إلى دور التطبيق غير الفائق، لا تُطبَّق أي سياسة
 *    عزل، فتمرّ اختبارات العزل كذبًا. يجب أن تعمل الاختبارات بدور التطبيق نفسه.
 */
export async function asTenant<T>(
  tenantId: string,
  fn: (tx: Omit<PrismaClient, '$transaction' | '$connect' | '$disconnect' | '$on' | '$use' | '$extends'>) => Promise<T>,
): Promise<T> {
  const db = testDb();
  return db.$transaction(async (tx) => {
    await tx.$executeRawUnsafe('SET LOCAL ROLE oh_app');
    await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}::text, true)`;
    return fn(tx);
  });
}

/** ينفّذ استعلامًا بسياق المنصة. */
export async function asPlatform<T>(
  fn: (tx: Omit<PrismaClient, '$transaction' | '$connect' | '$disconnect' | '$on' | '$use' | '$extends'>) => Promise<T>,
): Promise<T> {
  const db = testDb();
  return db.$transaction(async (tx) => {
    await tx.$executeRawUnsafe('SET LOCAL ROLE oh_app');
    await tx.$executeRaw`SELECT set_config('app.is_platform', 'on', true)`;
    return fn(tx);
  });
}

/**
 * ينفّذ استعلامًا بدور التطبيق **بلا** سياق مستأجر — محاكاة «نسي المطوّر
 * ضبط المستأجر».
 *
 * `SET LOCAL ROLE oh_app` بلا `app.tenant_id`: RLS تُطبَّق، وبلا سياق تُرجع
 * صفرًا. هذا هو **الفشل الآمن** — خطأ برمجي يعطي «لا شيء» لا «كل شيء».
 */
export async function asNobody<T>(
  fn: (tx: Omit<PrismaClient, '$transaction' | '$connect' | '$disconnect' | '$on' | '$use' | '$extends'>) => Promise<T>,
): Promise<T> {
  const db = testDb();
  return db.$transaction(async (tx) => {
    await tx.$executeRawUnsafe('SET LOCAL ROLE oh_app');
    return fn(tx);
  });
}
