import { Injectable } from '@nestjs/common';
import type { TxClient } from '../prisma/prisma.service.js';

export type CounterName = 'customer' | 'order' | 'payment';

const PREFIX: Record<CounterName, string> = {
  customer: 'CUST',
  order: 'ORD',
  payment: 'PAY',
};

/** عدد الخانات في الرقم: CUST-0001 · ORD-00087 · PAY-00045 (من المرجع البصري). */
const PAD: Record<CounterName, number> = {
  customer: 4,
  order: 5,
  payment: 5,
};

/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  الترقيم المتسلسل لكل محل.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  ── لماذا لا SEQUENCE من Postgres؟ ────────────────────────────────────────
 *  التسلسل عالمي لا لكل مستأجر. مع محلّين نشطين يرى الأول أرقامًا
 *  1، 5، 9 والثاني 2، 6، 10 — مربك للتاجر، **ويسرّب حجم نشاط منافسه**:
 *  قفزة من ORD-100 إلى ORD-140 تخبرك أن غيرك أصدر 39 طلبًا بينهما.
 *
 *  ── لماذا لا MAX(number) + 1؟ ────────────────────────────────────────────
 *  سباق كلاسيكي: طلبان متزامنان يقرآن نفس MAX فيحصلان على نفس الرقم.
 *  ينجو أحدهما بقيد UNIQUE ويفشل الآخر بخطأ غامض.
 *
 *  ── الحل: UPDATE ... RETURNING ────────────────────────────────────────────
 *  عملية **ذرّية واحدة**: تقرأ وتزيد وتُعيد في خطوة واحدة. Postgres يقفل
 *  الصف طوال العملية، فالطلب الثاني ينتظر ويحصل على الرقم التالي.
 *  لا سباق، ولا فشل، ولا فجوات (ما لم تتراجع المعاملة — وهذا مقبول).
 */
@Injectable()
export class NumberingService {
  async next(
    tx: TxClient,
    tenantId: string,
    storeId: string,
    name: CounterName,
  ): Promise<string> {
    /**
     * ON CONFLICT DO UPDATE يغطي الحالتين في جملة واحدة:
     *   • أول رقم للمحل   → INSERT بقيمة 1
     *   • الأرقام التالية → UPDATE بـ value + 1
     *
     * لا حاجة لفحص «هل العدّاد موجود؟» أولًا — وهو فحص كان سيفتح نافذة سباق
     * بينه وبين الإدراج.
     */
    const rows = await tx.$queryRaw<{ value: number }[]>`
      INSERT INTO tenant_counters (tenant_id, store_id, name, value)
      VALUES (${tenantId}::uuid, ${storeId}::uuid, ${name}, 1)
      ON CONFLICT (tenant_id, store_id, name)
      DO UPDATE SET value = tenant_counters.value + 1
      RETURNING value
    `;

    const value = rows[0]?.value;
    if (value === undefined) {
      throw new Error(`فشل توليد رقم ${name} — لم يُعِد العدّاد قيمة.`);
    }

    return `${PREFIX[name]}-${String(value).padStart(PAD[name], '0')}`;
  }
}
