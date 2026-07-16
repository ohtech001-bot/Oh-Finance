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
   * لا يحوّل الدور إلى `oh_app`، فيبقى الاتصال كـ`postgres` (مستخدم فائق
   * **يتجاوز RLS**). أي استعلام هنا يرى بيانات كل المستأجرين — لا عزل.
   *
   * لذلك الاستخدام المشروع محصور بعمليات ما-قبل-المستأجر التي تبحث بمفتاح
   * فريد: `app_auth_lookup` (بالبريد)، والتحقق من الجلسة (بهاش الرمز الفريد).
   * **يُمنع** استخدامه لأي استعلام أعمال — تلك تمر عبر `runInTenant` حصرًا.
   */
  get raw(): PrismaClient {
    return this.client;
  }

  /**
   * ينفّذ العمل داخل معاملة مقيّدة بمستأجر واحد.
   *
   * سطران يفعّلان العزل، والترتيب بينهما لا يهم لكن كلاهما إلزامي:
   *
   *   1. `SET LOCAL ROLE oh_app`
   *      ⚠️ **هذا السطر هو ما يجعل RLS تعمل أصلًا.**
   *      نتصل بقاعدة البيانات كـ`postgres` (مستخدم فائق)، والمستخدمون
   *      الفائقون **يتجاوزون RLS كليًا** — فبدون هذا السطر تكون كل سياسات
   *      العزل زينةً بلا أثر، ويرى كل استعلام بيانات كل المستأجرين.
   *      `oh_app` دور غير فائق (NOBYPASSRLS)، فتُطبَّق عليه السياسات.
   *      `SET LOCAL` مقيّد بالمعاملة، فلا يتسرّب الدور عبر الاتصالات المجمّعة.
   *
   *   2. `set_config('app.tenant_id', $1, true)`
   *      يحدّد أي مستأجر. المعامل الثالث `true` = نطاق المعاملة، فيُمحى
   *      تلقائيًا عند COMMIT ولا يتسرّب هو الآخر.
   */
  async runInTenant<T>(
    tenantId: string,
    fn: (tx: TxClient) => Promise<T>,
    options?: { timeoutMs?: number },
  ): Promise<T> {
    return this.client.$transaction(
      async (tx) => {
        await tx.$executeRawUnsafe('SET LOCAL ROLE oh_app');
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
        // نفس المنطق: SET LOCAL ROLE oh_app كي تُطبَّق RLS، ثم فتح سياق المنصة.
        // سياسة `platform_access` على كل جدول تسمح لـoh_app بالمرور عندما
        // يكون app.is_platform='on' — فيرى المدير العام كل المستأجرين.
        await tx.$executeRawUnsafe('SET LOCAL ROLE oh_app');
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
   * معاملة بلا تحويل دور وبلا سياق — تبقى كـ`postgres` (تتجاوز RLS).
   *
   * ⚠️ ليست «بلا عزل بالصدفة» — بل **تتجاوز العزل عمدًا**. الاستخدام المشروع
   *    الوحيد: عمليات ما-قبل-المستأجر التي تبحث بمفتاح فريد ولا يمكنها معرفة
   *    المستأجر بعد:
   *      • `app_auth_lookup()` — البحث بالبريد عند تسجيل الدخول
   *      • التحقق من الجلسة / تدوير الرمز — البحث بهاش الرمز الفريد
   *
   *    كل هذه تبحث عن **صف واحد بمفتاح فريد**، فلا تسرّب — تجد ما تبحث عنه أو
   *    لا شيء. **يُمنع** تمرير استعلام أعمال (زبائن/طلبات/دفعات) عبرها.
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
