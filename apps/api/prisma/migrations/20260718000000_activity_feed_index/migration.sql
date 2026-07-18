-- موجز النشاط (Timeline / Activity Feed):
-- فهرس يخدم بحث أحداث كيان محدد (Order/Payment/Customer) مرتّبة زمنيًا،
-- وهو استعلام الخط الزمني للزبون: entity_type + entity_id ثم seq تنازليًا.
CREATE INDEX IF NOT EXISTS "audit_logs_tenant_id_entity_type_entity_id_seq_idx"
  ON "audit_logs" ("tenant_id", "entity_type", "entity_id", "seq");
