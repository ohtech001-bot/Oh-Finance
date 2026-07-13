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
  client ??= new PrismaClient({
    datasources: { db: { url: TEST_DATABASE_URL } },
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

/** ينفّذ استعلامًا ضمن سياق مستأجر — كما يفعل الخادم بالضبط. */
export async function asTenant<T>(
  tenantId: string,
  fn: (tx: Omit<PrismaClient, '$transaction' | '$connect' | '$disconnect' | '$on' | '$use' | '$extends'>) => Promise<T>,
): Promise<T> {
  const db = testDb();
  return db.$transaction(async (tx) => {
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
    await tx.$executeRaw`SELECT set_config('app.is_platform', 'on', true)`;
    return fn(tx);
  });
}

/** ينفّذ استعلامًا بلا أي سياق — كما لو نسي المطوّر ضبط المستأجر. */
export async function asNobody<T>(
  fn: (tx: Omit<PrismaClient, '$transaction' | '$connect' | '$disconnect' | '$on' | '$use' | '$extends'>) => Promise<T>,
): Promise<T> {
  const db = testDb();
  return db.$transaction(async (tx) => fn(tx));
}
