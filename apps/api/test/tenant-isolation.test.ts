import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { HAS_TEST_DB, SKIP_REASON, asNobody, asPlatform, asTenant, closeTestDb, resetDb, testDb } from './db.js';

/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  اختبارات عزل المستأجرين — أهم اختبارات النظام.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  الفكرة المركزية: **نحن لا نختبر أن الكود يفلتر بشكل صحيح.**
 *  نختبر أن التسرّب مستحيل **حتى لو لم يفلتر الكود إطلاقًا.**
 *
 *  لذلك كل اختبار هنا يستدعي `findMany()` **بلا أي شرط `where`** — أي بأسوأ
 *  خطأ برمجي ممكن — ويتوقع أن ترى قاعدة البيانات صفوف المستأجر الحالي فقط.
 *
 *  لو مرّرنا `where: { tenantId }` في هذه الاختبارات، لكنّا نختبر Prisma،
 *  لا نختبر RLS. الاختبار الحقيقي هو أن نُسيء التصرّف عمدًا ونرى الجدار يصمد.
 */

if (!HAS_TEST_DB) {
  // eslint-disable-next-line no-console
  console.warn(`\n⚠  ${SKIP_REASON}\n`);
}

describe.skipIf(!HAS_TEST_DB)('عزل المستأجرين (RLS)', () => {
  let tenantA: string;
  let tenantB: string;
  let storeA: string;
  let storeB: string;
  let userA: string;
  let userB: string;

  beforeAll(async () => {
    await resetDb();
  });

  afterAll(async () => {
    await closeTestDb();
  });

  beforeEach(async () => {
    await resetDb();

    // نبني مستأجرين بسياق المنصة (الطريق الشرعي الوحيد لإنشائهما).
    const seeded = await asPlatform(async (tx) => {
      const plan = await tx.plan.create({
        data: {
          code: 'test-basic',
          nameAr: 'أساسية',
          nameHe: 'בסיסית',
          nameEn: 'Basic',
          priceMonthly: '99.00',
          currency: 'ILS',
        },
      });

      const build = async (slug: string, name: string, email: string) => {
        const tenant = await tx.tenant.create({
          data: { slug, name, status: 'ACTIVE', currency: 'ILS' },
        });
        const store = await tx.store.create({
          data: { tenantId: tenant.id, code: slug, name, currency: 'ILS' },
        });
        const role = await tx.role.create({
          data: { tenantId: tenant.id, name: 'OWNER', isSystem: true },
        });
        const user = await tx.user.create({
          data: {
            tenantId: tenant.id,
            storeId: store.id,
            roleId: role.id,
            email,
            name,
            passwordHash: 'argon2-placeholder-hash',
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
        return { tenantId: tenant.id, storeId: store.id, userId: user.id };
      };

      const a = await build('tenant-a', 'محل ألف', 'owner-a@test.com');
      const b = await build('tenant-b', 'محل باء', 'owner-b@test.com');
      return { a, b };
    });

    tenantA = seeded.a.tenantId;
    tenantB = seeded.b.tenantId;
    storeA = seeded.a.storeId;
    storeB = seeded.b.storeId;
    userA = seeded.a.userId;
    userB = seeded.b.userId;
  });

  // ═════════════════════════════════════════════════════════════════════════
  //  1. القراءة — استعلام بلا فلترة يجب أن يرى مستأجره فقط
  // ═════════════════════════════════════════════════════════════════════════

  describe('القراءة بلا فلترة (محاكاة خطأ برمجي)', () => {
    it('المحلات: المستأجر أ يرى محله فقط', async () => {
      // ⚠️ لاحظ: لا يوجد `where` إطلاقًا. هذا خطأ برمجي متعمَّد.
      const stores = await asTenant(tenantA, (tx) => tx.store.findMany());

      expect(stores).toHaveLength(1);
      expect(stores[0]?.id).toBe(storeA);
      expect(stores.map((s) => s.id)).not.toContain(storeB);
    });

    it('المستخدمون: المستأجر أ يرى مستخدميه فقط', async () => {
      const users = await asTenant(tenantA, (tx) => tx.user.findMany());

      expect(users).toHaveLength(1);
      expect(users[0]?.id).toBe(userA);
      expect(users.map((u) => u.email)).not.toContain('owner-b@test.com');
    });

    it('الأدوار والفروع والجلسات: معزولة كلها', async () => {
      const [rolesA, rolesB] = await Promise.all([
        asTenant(tenantA, (tx) => tx.role.findMany()),
        asTenant(tenantB, (tx) => tx.role.findMany()),
      ]);

      expect(rolesA).toHaveLength(1);
      expect(rolesB).toHaveLength(1);
      expect(rolesA[0]?.tenantId).toBe(tenantA);
      expect(rolesB[0]?.tenantId).toBe(tenantB);
    });

    it('العدّ (count) معزول أيضًا — لا يسرّب حجم بيانات الآخرين', async () => {
      // تسريب العدد وحده معلومة تنافسية: كم زبونًا لدى منافسي؟
      const count = await asTenant(tenantA, (tx) => tx.user.count());
      expect(count).toBe(1);
    });

    it('التجميع (aggregate) معزول', async () => {
      const result = await asTenant(tenantA, (tx) => tx.store.aggregate({ _count: true }));
      expect(result._count).toBe(1);
    });
  });

  // ═════════════════════════════════════════════════════════════════════════
  //  2. الوصول المباشر بمعرّف — الهجوم الأوضح
  // ═════════════════════════════════════════════════════════════════════════

  describe('الوصول بمعرّف مستأجر آخر (IDOR)', () => {
    it('المستأجر أ لا يستطيع قراءة محل المستأجر ب بمعرّفه المباشر', async () => {
      // حتى لو سرّب المهاجم معرّف محل آخر ووضعه في المسار.
      const store = await asTenant(tenantA, (tx) =>
        tx.store.findUnique({ where: { id: storeB } }),
      );
      expect(store).toBeNull();
    });

    it('المستأجر أ لا يستطيع قراءة مستخدم المستأجر ب', async () => {
      const user = await asTenant(tenantA, (tx) =>
        tx.user.findUnique({ where: { id: userB } }),
      );
      expect(user).toBeNull();
    });

    it('البحث بالبريد لا يكشف مستخدمي مستأجر آخر', async () => {
      const user = await asTenant(tenantA, (tx) =>
        tx.user.findUnique({ where: { email: 'owner-b@test.com' } }),
      );
      expect(user).toBeNull();
    });
  });

  // ═════════════════════════════════════════════════════════════════════════
  //  3. الكتابة — الأخطر: تعديل بيانات مستأجر آخر
  // ═════════════════════════════════════════════════════════════════════════

  describe('الكتابة عبر المستأجرين', () => {
    it('المستأجر أ لا يستطيع تعديل محل المستأجر ب', async () => {
      const result = await asTenant(tenantA, (tx) =>
        tx.store.updateMany({
          where: { id: storeB },
          data: { name: 'اختُرق' },
        }),
      );

      // 0 صفوف متأثرة — RLS أخفت الصف عن جملة UPDATE.
      expect(result.count).toBe(0);

      const unchanged = await asTenant(tenantB, (tx) =>
        tx.store.findUnique({ where: { id: storeB } }),
      );
      expect(unchanged?.name).toBe('محل باء');
    });

    it('المستأجر أ لا يستطيع حذف بيانات المستأجر ب', async () => {
      const result = await asTenant(tenantA, (tx) =>
        tx.user.deleteMany({ where: { id: userB } }),
      );
      expect(result.count).toBe(0);

      const stillThere = await asTenant(tenantB, (tx) =>
        tx.user.findUnique({ where: { id: userB } }),
      );
      expect(stillThere).not.toBeNull();
    });

    it('⚠️ المستأجر أ لا يستطيع إنشاء صف بـtenantId المستأجر ب', async () => {
      // هذا هجوم الحقن: أرسل tenantId مزوّرًا في الحمولة.
      // WITH CHECK في سياسة RLS يرفضه على مستوى القاعدة.
      await expect(
        asTenant(tenantA, (tx) =>
          tx.role.create({
            data: { tenantId: tenantB, name: 'MALICIOUS', isSystem: false },
          }),
        ),
      ).rejects.toThrow();

      const rolesB = await asTenant(tenantB, (tx) => tx.role.findMany());
      expect(rolesB.map((r) => r.name)).not.toContain('MALICIOUS');
    });

    it('المستأجر أ لا يستطيع نقل صفّه إلى المستأجر ب', async () => {
      // محاولة "تهريب" صف بتغيير tenantId — WITH CHECK يمنعها.
      await expect(
        asTenant(tenantA, (tx) =>
          tx.store.update({
            where: { id: storeA },
            data: { tenantId: tenantB },
          }),
        ),
      ).rejects.toThrow();
    });
  });

  // ═════════════════════════════════════════════════════════════════════════
  //  4. غياب السياق — ماذا لو نسي المطوّر runInTenant تمامًا؟
  // ═════════════════════════════════════════════════════════════════════════

  describe('بلا سياق مستأجر (نسيان runInTenant)', () => {
    it('استعلام بلا سياق يعيد صفرًا — لا كل الصفوف', async () => {
      // هذا هو الفشل الآمن: خطأ برمجي يعطي "لا شيء"، لا "كل شيء".
      const stores = await asNobody((tx) => tx.store.findMany());
      expect(stores).toHaveLength(0);

      const users = await asNobody((tx) => tx.user.findMany());
      expect(users).toHaveLength(0);
    });

    it('حتى العدّ يعيد صفرًا', async () => {
      const count = await asNobody((tx) => tx.store.count());
      expect(count).toBe(0);
    });
  });

  // ═════════════════════════════════════════════════════════════════════════
  //  5. المدير العام — لا يرى بيانات الأعمال، ويرى المستأجرين
  // ═════════════════════════════════════════════════════════════════════════

  describe('سياق المنصة (المدير العام)', () => {
    it('يرى كل المستأجرين', async () => {
      const tenants = await asPlatform((tx) => tx.tenant.findMany());
      expect(tenants).toHaveLength(2);
    });

    it('المستأجر أ لا يرى المستأجر ب في جدول tenants', async () => {
      const tenants = await asTenant(tenantA, (tx) => tx.tenant.findMany());
      expect(tenants).toHaveLength(1);
      expect(tenants[0]?.id).toBe(tenantA);
    });

    it('المستأجر لا يستطيع تعديل صف مستأجره (الحالة/الباقة) — للمنصة وحدها', async () => {
      // self_read سياسة SELECT فقط. لا سياسة UPDATE للمستأجر على نفسه.
      const result = await asTenant(tenantA, (tx) =>
        tx.tenant.updateMany({
          where: { id: tenantA },
          data: { status: 'ACTIVE' },
        }),
      );
      expect(result.count).toBe(0);
    });

    it('المستأجر يقرأ اشتراكه هو فقط', async () => {
      const subs = await asTenant(tenantA, (tx) => tx.subscription.findMany());
      expect(subs).toHaveLength(1);
      expect(subs[0]?.tenantId).toBe(tenantA);
    });
  });

  // ═════════════════════════════════════════════════════════════════════════
  //  6. المدير العام غير مرئي داخل أي مستأجر
  // ═════════════════════════════════════════════════════════════════════════

  describe('عزل المدير العام', () => {
    it('مستخدم بـtenantId = NULL غير مرئي لأي مستأجر', async () => {
      await asPlatform((tx) =>
        tx.user.create({
          data: {
            email: 'super@platform.com',
            name: 'المدير العام',
            passwordHash: 'hash',
            isSuperAdmin: true,
            tenantId: null,
          },
        }),
      );

      // NULL = uuid ينتج NULL (لا TRUE) ⇒ الصف مستبعَد من سياسة المستأجر.
      const usersA = await asTenant(tenantA, (tx) => tx.user.findMany());
      expect(usersA.map((u) => u.email)).not.toContain('super@platform.com');
      expect(usersA).toHaveLength(1);
    });

    it('قيد CHECK يمنع مستخدمًا عاديًا بلا مستأجر (يتنكّر كمستخدم منصة)', async () => {
      await expect(
        asPlatform((tx) =>
          tx.user.create({
            data: {
              email: 'orphan@test.com',
              name: 'يتيم',
              passwordHash: 'hash',
              isSuperAdmin: false,
              tenantId: null, // ← غير مسموح
            },
          }),
        ),
      ).rejects.toThrow();
    });

    it('قيد CHECK يمنع مديرًا عامًا مرتبطًا بمستأجر (امتيازات الطرفين)', async () => {
      await expect(
        asPlatform((tx) =>
          tx.user.create({
            data: {
              email: 'hybrid@test.com',
              name: 'هجين',
              passwordHash: 'hash',
              isSuperAdmin: true,
              tenantId: tenantA, // ← غير مسموح
            },
          }),
        ),
      ).rejects.toThrow();
    });
  });

  // ═════════════════════════════════════════════════════════════════════════
  //  7. ثوابت الأعمال المفروضة في القاعدة
  // ═════════════════════════════════════════════════════════════════════════

  describe('الثوابت في قاعدة البيانات', () => {
    it('اشتراك نشط واحد لكل مستأجر (فهرس جزئي فريد)', async () => {
      await expect(
        asPlatform(async (tx) => {
          const plan = await tx.plan.findFirstOrThrow();
          const now = new Date();
          const end = new Date(now);
          end.setFullYear(end.getFullYear() + 1);

          // اشتراك نشط ثانٍ لنفس المستأجر — يجب أن يُرفض.
          await tx.subscription.create({
            data: {
              tenantId: tenantA,
              planId: plan.id,
              status: 'ACTIVE',
              currentPeriodStart: now,
              currentPeriodEnd: end,
            },
          });
        }),
      ).rejects.toThrow();
    });

    it('فترة اشتراك مقلوبة مرفوضة', async () => {
      await expect(
        asPlatform(async (tx) => {
          const plan = await tx.plan.findFirstOrThrow();
          const tenant = await tx.tenant.create({
            data: { slug: 'tenant-c', name: 'محل جيم', currency: 'ILS' },
          });
          await tx.subscription.create({
            data: {
              tenantId: tenant.id,
              planId: plan.id,
              status: 'ACTIVE',
              currentPeriodStart: new Date('2025-12-01'),
              currentPeriodEnd: new Date('2025-01-01'), // ← قبل البداية
            },
          });
        }),
      ).rejects.toThrow();
    });

    it('سعر باقة سالب مرفوض', async () => {
      await expect(
        asPlatform((tx) =>
          tx.plan.create({
            data: {
              code: 'negative',
              nameAr: 'سالبة',
              nameHe: 'x',
              nameEn: 'x',
              priceMonthly: '-10.00',
              currency: 'ILS',
            },
          }),
        ),
      ).rejects.toThrow();
    });
  });

  // ═════════════════════════════════════════════════════════════════════════
  //  8. سجل التدقيق غير قابل للتلاعب
  // ═════════════════════════════════════════════════════════════════════════

  describe('حصانة سجل التدقيق', () => {
    it('لا يمكن تعديل قيد تدقيق — trigger يرفض UPDATE', async () => {
      const entry = await asPlatform((tx) =>
        tx.auditLog.create({
          data: {
            tenantId: null,
            action: 'test.action',
            summary: 'قيد اختبار',
            hash: 'a'.repeat(64),
          },
        }),
      );

      await expect(
        asPlatform((tx) =>
          tx.auditLog.update({
            where: { id: entry.id },
            data: { summary: 'مُتلاعَب به' },
          }),
        ),
      ).rejects.toThrow(/append-only|غير قابل للتغيير/i);
    });

    it('لا يمكن حذف قيد تدقيق — trigger يرفض DELETE', async () => {
      const entry = await asPlatform((tx) =>
        tx.auditLog.create({
          data: {
            tenantId: null,
            action: 'test.action',
            summary: 'قيد اختبار',
            hash: 'b'.repeat(64),
          },
        }),
      );

      await expect(
        asPlatform((tx) => tx.auditLog.delete({ where: { id: entry.id } })),
      ).rejects.toThrow(/append-only|غير قابل للتغيير/i);
    });

    it('سجل التدقيق معزول بين المستأجرين', async () => {
      await asTenant(tenantA, (tx) =>
        tx.auditLog.create({
          data: {
            tenantId: tenantA,
            action: 'test.a',
            summary: 'حدث خاص بالمستأجر أ',
            hash: 'c'.repeat(64),
          },
        }),
      );

      const logsB = await asTenant(tenantB, (tx) => tx.auditLog.findMany());
      expect(logsB).toHaveLength(0);
    });
  });

  // ═════════════════════════════════════════════════════════════════════════
  //  9. دالة المصادقة (SECURITY DEFINER) — الثقب الوحيد، وحدوده
  // ═════════════════════════════════════════════════════════════════════════

  describe('app_auth_lookup', () => {
    it('تجد المستخدم بلا سياق مستأجر (وهذا هدفها)', async () => {
      const db = testDb();
      const rows = await db.$queryRaw<{ id: string; tenant_id: string }[]>`
        SELECT * FROM app_auth_lookup('owner-a@test.com'::citext)
      `;
      expect(rows).toHaveLength(1);
      expect(rows[0]?.id).toBe(userA);
      expect(rows[0]?.tenant_id).toBe(tenantA);
    });

    it('غير حسّاسة لحالة الأحرف (citext)', async () => {
      const db = testDb();
      const rows = await db.$queryRaw<{ id: string }[]>`
        SELECT * FROM app_auth_lookup('OWNER-A@TEST.COM'::citext)
      `;
      expect(rows).toHaveLength(1);
    });

    it('لا تُرجع شيئًا لبريد غير موجود', async () => {
      const db = testDb();
      const rows = await db.$queryRaw<unknown[]>`
        SELECT * FROM app_auth_lookup('nobody@nowhere.com'::citext)
      `;
      expect(rows).toHaveLength(0);
    });
  });
});
