-- المرحلة 3 — أرشفة الطلبات
-- عمود إضافي nullable، مقاوم للانحراف (موجود في schema.prisma أيضًا).
-- لا يتعارض مع trigger قفل الطلب المؤكد: archived_at ليس من الأعمدة المحمية.
ALTER TABLE "orders" ADD COLUMN "archived_at" TIMESTAMPTZ(6);
CREATE INDEX "orders_tenant_id_archived_at_idx" ON "orders"("tenant_id", "archived_at");
