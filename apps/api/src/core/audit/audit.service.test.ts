import { describe, expect, it, vi } from 'vitest';
import { AuditService } from './audit.service.js';
import type { TxClient } from '../prisma/prisma.service.js';

/**
 * اختبارات سلسلة الهاش — بلا قاعدة بيانات.
 *
 * نُزيّف `TxClient` بمصفوفة في الذاكرة تحاكي ما يفعله Postgres، فنختبر
 * **منطق السلسلة** نفسه: الربط، الكشف عن التعديل، والتنقيح.
 */

interface FakeEntry {
  seq: bigint;
  tenantId: string | null;
  action: string;
  entityType: string | null;
  entityId: string | null;
  actorId: string | null;
  before: unknown;
  after: unknown;
  createdAt: Date;
  prevHash: string | null;
  hash: string;
}

function fakeTx(store: FakeEntry[]): TxClient {
  let nextSeq = 1n;

  return {
    $executeRaw: vi.fn().mockResolvedValue(1),
    auditLog: {
      findFirst: vi.fn(async ({ where }: { where: { tenantId: string | null } }) => {
        const matches = store.filter((e) => e.tenantId === where.tenantId);
        return matches.length ? matches[matches.length - 1] : null;
      }),
      findMany: vi.fn(async ({ where }: { where: { tenantId: string | null } }) =>
        store.filter((e) => e.tenantId === where.tenantId),
      ),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const entry: FakeEntry = {
          seq: nextSeq++,
          tenantId: (data.tenantId as string | null) ?? null,
          action: data.action as string,
          entityType: (data.entityType as string | null) ?? null,
          entityId: (data.entityId as string | null) ?? null,
          actorId: (data.actorId as string | null) ?? null,
          before: data.before ?? null,
          after: data.after ?? null,
          createdAt: data.createdAt as Date,
          prevHash: (data.prevHash as string | null) ?? null,
          hash: data.hash as string,
        };
        store.push(entry);
        return entry;
      }),
    },
  } as unknown as TxClient;
}

describe('AuditService — سلسلة الهاش', () => {
  it('أول قيد بلا prevHash (GENESIS)', async () => {
    const store: FakeEntry[] = [];
    const service = new AuditService();

    await service.record(fakeTx(store), {
      action: 'test.first',
      summary: 'أول حدث',
      tenantId: 't1',
    });

    expect(store).toHaveLength(1);
    expect(store[0]?.prevHash).toBeNull();
    expect(store[0]?.hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('كل قيد يرتبط بهاش سابقه', async () => {
    const store: FakeEntry[] = [];
    const service = new AuditService();
    const tx = fakeTx(store);

    await service.record(tx, { action: 'a', summary: 'أ', tenantId: 't1' });
    await service.record(tx, { action: 'b', summary: 'ب', tenantId: 't1' });
    await service.record(tx, { action: 'c', summary: 'ج', tenantId: 't1' });

    expect(store).toHaveLength(3);
    expect(store[1]?.prevHash).toBe(store[0]?.hash);
    expect(store[2]?.prevHash).toBe(store[1]?.hash);
  });

  it('سلاسل المستأجرين مستقلة — لا تتشابك', async () => {
    const store: FakeEntry[] = [];
    const service = new AuditService();
    const tx = fakeTx(store);

    await service.record(tx, { action: 'a1', summary: 'x', tenantId: 't1' });
    await service.record(tx, { action: 'b1', summary: 'x', tenantId: 't2' });
    await service.record(tx, { action: 'a2', summary: 'x', tenantId: 't1' });

    // قيد t2 الأول يبدأ سلسلته بنفسه، لا يبني على سلسلة t1.
    expect(store[1]?.prevHash).toBeNull();
    // قيد t1 الثاني يبني على قيد t1 الأول — لا على قيد t2.
    expect(store[2]?.prevHash).toBe(store[0]?.hash);
  });

  it('verifyChain يقبل سلسلة سليمة', async () => {
    const store: FakeEntry[] = [];
    const service = new AuditService();
    const tx = fakeTx(store);

    await service.record(tx, { action: 'a', summary: 'أ', tenantId: 't1' });
    await service.record(tx, { action: 'b', summary: 'ب', tenantId: 't1' });

    const result = await service.verifyChain(tx, 't1');
    expect(result.valid).toBe(true);
    expect(result.entriesChecked).toBe(2);
    expect(result.firstBrokenSeq).toBeNull();
  });

  it('⚠️ verifyChain يكشف تعديل محتوى قيد قديم', async () => {
    const store: FakeEntry[] = [];
    const service = new AuditService();
    const tx = fakeTx(store);

    await service.record(tx, { action: 'payment.create', summary: 'دفعة 1000', tenantId: 't1' });
    await service.record(tx, { action: 'payment.create', summary: 'دفعة 2000', tenantId: 't1' });
    await service.record(tx, { action: 'payment.create', summary: 'دفعة 3000', tenantId: 't1' });

    // مهاجم يملك وصولًا لقاعدة البيانات يغيّر قيدًا قديمًا مباشرة.
    // (في القاعدة الحقيقية يمنعه الـtrigger — هذا يحاكي تجاوزه.)
    const target = store[1];
    if (!target) throw new Error('setup');
    target.action = 'payment.reverse';

    const result = await service.verifyChain(tx, 't1');

    expect(result.valid).toBe(false);
    expect(result.firstBrokenSeq).toBe(2n); // أول موضع انكسار = الصف المُعدَّل
  });

  it('⚠️ verifyChain يكشف كسر الربط (حذف قيد من المنتصف)', async () => {
    const store: FakeEntry[] = [];
    const service = new AuditService();
    const tx = fakeTx(store);

    await service.record(tx, { action: 'a', summary: 'أ', tenantId: 't1' });
    await service.record(tx, { action: 'b', summary: 'ب', tenantId: 't1' });
    await service.record(tx, { action: 'c', summary: 'ج', tenantId: 't1' });

    // حذف القيد الأوسط — القيد الثالث يشير الآن إلى هاش غير موجود.
    store.splice(1, 1);

    const result = await service.verifyChain(tx, 't1');
    expect(result.valid).toBe(false);
  });

  it('سلسلة فارغة صالحة', async () => {
    const service = new AuditService();
    const result = await service.verifyChain(fakeTx([]), 't1');
    expect(result.valid).toBe(true);
    expect(result.entriesChecked).toBe(0);
  });
});

describe('AuditService — تنقيح البيانات الحسّاسة', () => {
  it('ينقّح كلمات المرور والرموز قبل الكتابة', async () => {
    const store: FakeEntry[] = [];
    const service = new AuditService();

    await service.record(fakeTx(store), {
      action: 'user.updated',
      summary: 'تعديل مستخدم',
      tenantId: 't1',
      after: {
        email: 'user@test.com',
        passwordHash: '$argon2id$v=19$m=65536...',
        totpSecret: 'JBSWY3DPEHPK3PXP',
        refreshToken: 'secret-token-value',
        name: 'أحمد',
      },
    });

    const written = store[0]?.after as Record<string, unknown>;

    // ⚠️ لولا هذا، لكان صاحب المحل يقرأ هاشات كلمات مرور موظفيه من شاشة
    //    سجل النشاط — وهي شاشة مصمَّمة ليقرأها.
    expect(written.passwordHash).toBe('[منقّح]');
    expect(written.totpSecret).toBe('[منقّح]');
    expect(written.refreshToken).toBe('[منقّح]');

    // البيانات غير الحسّاسة تبقى — وإلا فقد السجل قيمته.
    expect(written.email).toBe('user@test.com');
    expect(written.name).toBe('أحمد');
  });

  it('ينقّح داخل الكائنات المتداخلة', async () => {
    const store: FakeEntry[] = [];
    const service = new AuditService();

    await service.record(fakeTx(store), {
      action: 'test',
      summary: 'x',
      tenantId: 't1',
      after: { user: { profile: { name: 'أحمد', password: 'plaintext!' } } },
    });

    const written = store[0]?.after as { user: { profile: Record<string, unknown> } };
    expect(written.user.profile.password).toBe('[منقّح]');
    expect(written.user.profile.name).toBe('أحمد');
  });
});
