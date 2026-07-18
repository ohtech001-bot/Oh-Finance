import { z } from 'zod';
import { isoDateSchema, paginationQuerySchema, uuidSchema } from './common.js';

/**
 * عقود موجز النشاط (Timeline / Activity Feed).
 *
 * مصدر واحد: سجل التدقيق (append-only). كل عنصر حدث حقيقي جرى فعلًا، بفاعله
 * ووقته. يُعاد استخدام نفس الشكل في لوحة التحكم (نشاط المحل) وصفحة الزبون
 * (الخط الزمني للزبون) — لا تكرار لمنطق التجميع.
 */

export const activityCategorySchema = z.enum(['ORDER', 'PAYMENT', 'CUSTOMER', 'LEDGER', 'SYSTEM']);
export type ActivityCategory = z.infer<typeof activityCategorySchema>;

export const ACTIVITY_CATEGORY_LABELS: Record<ActivityCategory, string> = {
  ORDER: 'الطلبات',
  PAYMENT: 'الدفعات',
  CUSTOMER: 'الزبائن',
  LEDGER: 'الحركات',
  SYSTEM: 'النظام',
};

export const activityItemSchema = z.object({
  id: uuidSchema,
  /** رقم تسلسلي من سلسلة التدقيق — يُنقل كنص (BigInt). */
  seq: z.string(),
  category: activityCategorySchema,
  /** فعل التدقيق الخام، مثل `order.confirmed`. */
  action: z.string(),
  /** عنوان بشري جاهز للعرض (ملخّص القيد). */
  title: z.string(),

  actorId: uuidSchema.nullable(),
  actorName: z.string().nullable(),

  /** الكيان المرجعي — للربط: Order / Payment / Customer. */
  entityType: z.string().nullable(),
  entityId: z.string().nullable(),

  occurredAt: z.string(),
});
export type ActivityItem = z.infer<typeof activityItemSchema>;

/**
 * فلاتر الموجز المشتركة: الفئة والمدى الزمني والترقيم. لا `customerId` هنا —
 * تحديد النطاق بالزبون يأتي من مسار الرابط (`/customers/:id/activity`)، لا من
 * الاستعلام، حتى لا يحوّل أحدٌ موجزَ المحل إلى خطّ زبون متجاوزًا فرق الصلاحية.
 */
export const activityFiltersSchema = paginationQuerySchema.extend({
  category: activityCategorySchema.optional(),
  from: isoDateSchema.optional(),
  to: isoDateSchema.optional(),
});
export type ActivityFilters = z.infer<typeof activityFiltersSchema>;

/** استعلام موجز نشاط المحل (store-wide) — يتطلب صلاحية `activity.read`. */
export const storeActivityQuerySchema = activityFiltersSchema;
export type StoreActivityQuery = ActivityFilters;

/** استعلام الخط الزمني لزبون — نفس الفلاتر؛ معرّف الزبون من المسار. */
export const customerActivityQuerySchema = activityFiltersSchema;
export type CustomerActivityQuery = ActivityFilters;

/**
 * مُدخل خدمة الموجز. `customerId` اختياري: يُملأ من مسار الرابط لخط الزبون،
 * ويُترك فارغًا لموجز المحل. ليس مخطط تحقّق للواجهة الخارجية — للاستعمال الداخلي.
 */
export interface ActivityQuery extends ActivityFilters {
  customerId?: string;
}
