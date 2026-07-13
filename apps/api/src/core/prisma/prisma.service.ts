import { Injectable, OnModuleDestroy, OnModuleInit, Logger } from '@nestjs/common';
import { PrismaClient, type Prisma } from '@prisma/client';
import { TenantContext } from '../tenancy/tenant-context.js';

/**
 * معاملة Prisma — الواجهة التي تراها الخدمات.
 * لا تملك `$transaction` ولا `$connect`: كل عمل يجري داخل معاملة مفتوحة أصلًا.
 */
export type TxClient = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  PrismaService — بوابة قاعدة البيانات الوحيدة.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  لا تُستخدم `PrismaClient` مباشرة في أي خدمة. كل وصول يمر عبر:
 *    • runInTenant()   — استعلامات داخل محل
 *    • runAsPlatform() — استعلامات المدير العام
 *    • runUnscoped()   — المصادقة فقط (دوال SECURITY DEFINER)
 *
 *  ── لماذا معاملة لكل طلب؟ ───────────────────────────────────────────────
 *  سياسات RLS تقرأ `current_setting('app.tenant_id')`. مع connection pooling
 *  (Neon/PgBouncer) لا يوجد ضمان بأن الطلب التالي يحصل على نفس الاتصال، لذا
 *  `SET` على نطاق الجلسة خطر: يبقى عالقًا على الاتصال ويتسرّب لطلب مستأجر آخر.
 *
 *  `set_config(..., is_local => true)` يجعل الإعداد **على نطاق المعاملة**،
 *  فيُمحى تلقائيًا عند COMMIT/ROLLBACK. الثمن: كل طلب يفتح معاملة.
 *  الفائدة: يستحيل تسرّب السياق بنيويًا.  (المخاطرة R5/R7 في خطة المرحلة 0)
 */
@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  private readonly client: PrismaClient;

  constructor() {
    this.client = new PrismaClient({
      log: [
        { emit: 'event', level: 'warn' },
        { emit: 'event', level: 'error' },
      ],
    });
  }

  async onModuleInit(): Promise<void> {
    await this.client.$connect();
    this.logger.log('اتصال قاعدة البيانات جاهز.');
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.$disconnect();
  }

  /**
   * ⚠️ للمصادقة والفحوص الصحية فقط.
   *
   * لا يضبط سياق مستأجر — أي استعلام على جدول محمي بـRLS سيعيد **صفر صفوف**
   * (لا خطأ، بل لا شيء). هذا مقصود: الفشل يكون صامتًا وآمنًا لا خطيرًا.
   * الاستخدام الشرعي الوحيد: استدعاء `app_auth_lookup` (دالة SECURITY DEFINER).
   */
  get raw(): PrismaClient {
    return this.client;
  }

  /**
   * ينفّذ العمل داخل معاملة مقيّدة بمستأجر واحد.
   *
   * `set_config('app.tenant_id', $1, true)` — المعامل الثالث `true` يعني
   * نطاق المعاملة. هذا السطر هو ما يفعّل كل سياسات RLS.
   */
  async runInTenant<T>(
    tenantId: string,
    fn: (tx: TxClient) => Promise<T>,
    options?: { timeoutMs?: number },
  ): Promise<T> {
    return this.client.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}::text, true)`;
        return fn(tx);
      },
      {
        maxWait: 5_000,
        timeout: options?.timeoutMs ?? 10_000,
      },
    );
  }

  /**
   * ينفّذ العمل بسياق المنصة (المدير العام).
   *
   * يفتح سياسات `platform_access` على جداول المستأجرين — يستخدمه المدير العام
   * لإنشاء محل جديد وكتابة صفوفه الأولى. لا يُستدعى إلا من خلف `SuperAdminGuard`.
   */
  async runAsPlatform<T>(
    fn: (tx: TxClient) => Promise<T>,
    options?: { timeoutMs?: number },
  ): Promise<T> {
    if (!TenantContext.isSuperAdmin()) {
      // حزام أمان: لو استُدعيت من مسار غير محمي، ننهار بدل أن نفتح الباب.
      throw new Error(
        'runAsPlatform استُدعيت من سياق ليس للمدير العام. هذا خطأ برمجي خطير — ' +
          'المسار يجب أن يكون خلف SuperAdminGuard.',
      );
    }

    return this.client.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT set_config('app.is_platform', 'on', true)`;
        return fn(tx);
      },
      {
        maxWait: 5_000,
        timeout: options?.timeoutMs ?? 15_000,
      },
    );
  }

  /**
   * معاملة بلا أي سياق — للمصادقة حصرًا.
   *
   * الجداول المحمية بـRLS تعيد صفرًا هنا. الاستخدام الوحيد المشروع:
   * استدعاء `app_auth_lookup()` التي تتجاوز RLS بصلاحيات مالكها.
   */
  async runUnscoped<T>(fn: (tx: TxClient) => Promise<T>): Promise<T> {
    return this.client.$transaction(async (tx) => fn(tx), {
      maxWait: 5_000,
      timeout: 10_000,
    });
  }

  /** فحص صحة الاتصال. */
  async ping(): Promise<boolean> {
    try {
      await this.client.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }
}

export type { Prisma };
