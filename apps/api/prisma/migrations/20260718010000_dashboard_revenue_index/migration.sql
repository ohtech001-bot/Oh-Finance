-- المرحلة 3.5 / Increment 3 — لوحة التحكم.
-- الإيراد يُجمَّع بتاريخ التأكيد (confirmed_at) لكل دلو زمني في المنحنيات،
-- واستعلام كل دلو يرشِّح مدى confirmed_at. بلا هذا الفهرس كان الترشيح Filter
-- على مسح كل طلبات المستأجر (مرة لكل دلو). الفهرس يحوّله إلى Index Cond مدى.
-- يوازي فهرسي (tenant_id, issued_at) و(tenant_id, due_at) القائمين.
CREATE INDEX IF NOT EXISTS "orders_tenant_id_confirmed_at_idx"
  ON "orders" ("tenant_id", "confirmed_at");
