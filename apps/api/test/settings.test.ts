import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FinancialSettings, GeneralSettings, PrintingSettings } from '@oh/contracts';
import { HAS_TEST_DB, SKIP_REASON, closeTestDb, testDb } from './db.js';
import { createTestTenant, resetAll, type TestTenant } from './helpers.js';
import { SettingsService } from '../src/modules/settings/settings.service.js';
import type { PrismaService } from '../src/core/prisma/prisma.service.js';
import { TenantContext } from '../src/core/tenancy/tenant-context.js';

/**
 * الإعدادات — المرحلة 4 / Increment 4.2. تخزين مختلط: أعمدة Store + JSONB،
 * مع الافتراضيات؛ والعزل بين المستأجرين.
 */

if (!HAS_TEST_DB) console.warn(`\n⚠  ${SKIP_REASON}\n`);

const TX_OPTS = { maxWait: 30_000, timeout: 30_000 } as const;
function fakePrisma(): PrismaService {
  return {
    runInTenant<T>(tenantId: string, fn: (tx: never) => Promise<T>): Promise<T> {
      return testDb().$transaction(async (tx) => {
        await tx.$executeRawUnsafe('SET LOCAL ROLE oh_app');
        await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}::text, true)`;
        return fn(tx as never);
      }, TX_OPTS);
    },
  } as unknown as PrismaService;
}
const PERMS = ['settings.read', 'settings.manage'] as const;
function asUser<T>(t: TestTenant, fn: () => Promise<T>): Promise<T> {
  return TenantContext.run(
    { requestId: 'test-settings', tenantId: t.tenantId, userId: t.userId, storeId: t.storeId,
      isSuperAdmin: false, permissions: PERMS as never, ip: null, userAgent: null },
    fn,
  );
}

describe.skipIf(!HAS_TEST_DB)('الإعدادات — Increment 4.2', () => {
  let t: TestTenant, b: TestTenant, settings: SettingsService;

  beforeAll(async () => {
    await resetAll();
    t = await createTestTenant('set-a');
    b = await createTestTenant('set-b');
    settings = new SettingsService(fakePrisma());
  });
  afterAll(async () => { await closeTestDb(); });
  beforeEach(async () => {
    // نعيد ضبط JSONB الإعدادات بين الاختبارات دون حذف المحل.
    await testDb().$executeRawUnsafe(`UPDATE stores SET settings = '{}'::jsonb`);
  });

  it('القراءة الافتراضية: اسم المحل من العمود + قيم افتراضية للأقسام', async () => {
    const s = await asUser(t, () => settings.getSettings());
    expect(s.general.name).toContain('محل');
    expect(s.financial.numberFormat).toBe('1,234.56');
    expect(s.invoices.prefix).toBe('INV-');
    expect(s.printing.paperSize).toBe('80mm');
    expect(s.messaging.newOrderTemplate).toContain('{order_id}');
  });

  it('تعديل «عام»: الاسم إلى عمود، واللغة/المنطقة إلى JSONB', async () => {
    const g: GeneralSettings = {
      name: 'محل النجاح', email: 'x@y.com', address: 'شارع النجاح', logoUrl: '',
      language: 'he', timezone: 'Asia/Hebron',
    };
    await asUser(t, () => settings.updateSection('general', g));
    const s = await asUser(t, () => settings.getSettings());
    expect(s.general.name).toBe('محل النجاح');
    expect(s.general.language).toBe('he');
    expect(s.general.timezone).toBe('Asia/Hebron');
    // اسم المحل يُخزَّن في العمود (يظهر في استعلام مباشر).
    const [row] = await testDb().$queryRawUnsafe<{ name: string }[]>(
      `SELECT name FROM stores WHERE id = $1::uuid`, t.storeId,
    );
    expect(row?.name).toBe('محل النجاح');
  });

  it('تعديل «المالية»: العملة إلى العمود، والضريبة إلى JSONB', async () => {
    const f: FinancialSettings = {
      currency: 'USD', country: 'فلسطين', numberFormat: '1,234.56', dateFormat: 'DD/MM/YYYY',
      tax: { enabled: true, rate: 16, text: 'ضريبة القيمة المضافة' },
    };
    await asUser(t, () => settings.updateSection('financial', f));
    const s = await asUser(t, () => settings.getSettings());
    expect(s.financial.currency).toBe('USD');
    expect(s.financial.tax.enabled).toBe(true);
    expect(s.financial.tax.rate).toBe(16);
    expect(s.financial.dateFormat).toBe('DD/MM/YYYY');
  });

  it('تعديل «الطباعة»: round-trip كامل عبر JSONB', async () => {
    const p: PrintingSettings = {
      printer: 'Xprinter XP-58', paperSize: '58mm', orientation: 'portrait',
      printLogo: false, printInvoiceNumber: true, printDateTime: false, printBarcode: true,
    };
    await asUser(t, () => settings.updateSection('printing', p));
    const s = await asUser(t, () => settings.getSettings());
    expect(s.printing.paperSize).toBe('58mm');
    expect(s.printing.printLogo).toBe(false);
    expect(s.printing.printBarcode).toBe(true);
  });

  it('عزل المستأجرين: تعديل أ لا يؤثّر على إعدادات ب', async () => {
    await asUser(t, () => settings.updateSection('financial', {
      currency: 'USD', country: 'x', numberFormat: '1,234.56', dateFormat: 'YYYY-MM-DD',
      tax: { enabled: false, rate: 0, text: '' },
    } as FinancialSettings));
    const sb = await asUser(b, () => settings.getSettings());
    expect(sb.financial.currency).not.toBe('USD'); // ب يبقى على افتراضه
  });
});
