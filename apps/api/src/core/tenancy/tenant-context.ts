import { AsyncLocalStorage } from 'node:async_hooks';
import type { Permission } from '@oh/config';

/**
 * سياق الطلب — يُحمل عبر AsyncLocalStorage.
 *
 * لماذا ALS وليس تمرير المعامل يدويًا؟ لأن `tenantId` يجب أن يصل إلى **كل**
 * استعلام، بما فيها الاستعلامات العميقة داخل الخدمات. تمريره يدويًا يعني أن
 * نسيان معامل واحد = تسرّب بيانات. ALS يجعله جزءًا من الطلب نفسه لا من توقيع
 * الدالة، فيستحيل «نسيانه».
 *
 * ⚠️ ALS يعزل السياق بين الطلبات المتزامنة تلقائيًا — لا يتسرّب سياق مستأجر
 *    إلى طلب مستأجر آخر يعمل بالتوازي على نفس العملية.
 */
export interface RequestContext {
  readonly requestId: string;

  /** null للمدير العام حصرًا. */
  readonly tenantId: string | null;

  readonly userId: string | null;
  readonly storeId: string | null;
  readonly isSuperAdmin: boolean;
  readonly supportMode: boolean;
  readonly permissions: readonly Permission[];
  readonly mustChangePassword: boolean;

  readonly ip: string | null;
  readonly userAgent: string | null;
}

/** ما يحقنه حارس المصادقة بعد التحقق من الرمز. */
export interface AuthenticatedIdentity {
  readonly tenantId: string | null;
  readonly userId: string;
  readonly storeId: string | null;
  readonly isSuperAdmin: boolean;
  readonly supportMode: boolean;
  readonly permissions: readonly Permission[];
  readonly mustChangePassword: boolean;
}

const storage = new AsyncLocalStorage<RequestContext>();

export const TenantContext = {
  /** يشغّل دالة ضمن سياق محدد. */
  run<T>(context: RequestContext, fn: () => T): T {
    return storage.run(context, fn);
  },

  /**
   * يُثبّت الهوية في السياق الحالي — يستدعيه `JwtAuthGuard` وحده بعد التحقق
   * من توقيع الرمز.
   *
   * ── لماذا مرة واحدة فقط؟ ────────────────────────────────────────────────
   * لو سُمح باستدعائها مرتين، لأمكن لكود لاحق (خطأً أو عمدًا) أن **يبدّل**
   * المستأجر في منتصف الطلب — وهو بالضبط الهجوم الذي بُني كل هذا لمنعه.
   * الاستدعاء الثاني ينهار بدل أن يمرّ بصمت.
   */
  attachIdentity(identity: AuthenticatedIdentity): void {
    const ctx = storage.getStore();
    if (!ctx) {
      throw new Error('attachIdentity: لا يوجد سياق طلب. الـmiddleware لم يعمل؟');
    }
    if (ctx.userId !== null) {
      throw new Error(
        'attachIdentity استُدعيت مرتين على نفس الطلب. تبديل الهوية داخل الطلب ممنوع.',
      );
    }

    // الكتابة الوحيدة على السياق في دورة حياة الطلب كلها.
    const mutable = ctx as { -readonly [K in keyof RequestContext]: RequestContext[K] };
    mutable.tenantId = identity.tenantId;
    mutable.userId = identity.userId;
    mutable.storeId = identity.storeId;
    mutable.isSuperAdmin = identity.isSuperAdmin;
    mutable.supportMode = identity.supportMode;
    mutable.permissions = identity.permissions;
    mutable.mustChangePassword = identity.mustChangePassword;
  },

  /** السياق الحالي، أو undefined خارج دورة طلب (مهام خلفية، سكربتات). */
  get(): RequestContext | undefined {
    return storage.getStore();
  },

  /**
   * المستأجر الحالي — يرمي إن غاب.
   *
   * تعمّدنا الرمي بدل إعادة null: كود يستدعي هذا يفترض وجود مستأجر، وإرجاع
   * null كان سينتج استعلامًا بـ `tenantId: undefined` — أي **بلا فلترة**،
   * فيقرأ كل الصفوف. الانهيار الصريح أأمن من التسرّب الصامت.
   */
  requireTenantId(): string {
    const ctx = storage.getStore();
    if (!ctx?.tenantId) {
      throw new Error(
        'TenantContext: لا يوجد مستأجر في السياق الحالي. ' +
          'استعلام بيانات مستأجر خارج طلب موثّق — هذا خطأ برمجي، ليس حالة مستخدم.',
      );
    }
    return ctx.tenantId;
  },

  requireUserId(): string {
    const ctx = storage.getStore();
    if (!ctx?.userId) {
      throw new Error('TenantContext: لا يوجد مستخدم في السياق الحالي.');
    }
    return ctx.userId;
  },

  isSuperAdmin(): boolean {
    return storage.getStore()?.isSuperAdmin ?? false;
  },

  requestId(): string {
    return storage.getStore()?.requestId ?? 'no-request-context';
  },
};
