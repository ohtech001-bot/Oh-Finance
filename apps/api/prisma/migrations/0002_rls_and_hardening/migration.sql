-- ═══════════════════════════════════════════════════════════════════════════
--  0002 — عزل المستأجرين (RLS) + تحصين سجل التدقيق
--
--  هذه الهجرة هي **الحارس النهائي**. طبقات التطبيق (JWT → TenantGuard →
--  TenantContext → Prisma extension) تمنع الخطأ البرمجي؛ هذه الطبقة تمنع
--  عواقبه. حتى لو مرّ استعلام بلا فلترة، أو نجح حقن SQL، لن يعبر صف واحد
--  من مستأجر إلى آخر.
--
--  ⚠️ قواعد الأعمال ليست هنا. لا يوجد trigger يحسب رصيدًا أو يؤكد طلبًا.
--     المنطق المالي في طبقة الدومين (ADR-0001). القاعدة تفرض ثوابت فقط:
--     العزل، ومنع الحذف/التعديل على السجلات غير القابلة للتغيير.
-- ═══════════════════════════════════════════════════════════════════════════

-- بريد إلكتروني غير حسّاس لحالة الأحرف (Owner@x.com == owner@x.com)
CREATE EXTENSION IF NOT EXISTS citext;
-- pgcrypto: digest() لسلسلة هاش التدقيق، gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE "users" ALTER COLUMN "email" TYPE citext;


-- ═══════════════════════════════════════════════════════════════════════════
--  1. أدوار قاعدة البيانات
--
--  oh_app       : دور التطبيق. **بلا BYPASSRLS**. هذا جوهر الأمان كله —
--                 لو كان لدور التطبيق حق التجاوز، لصارت كل سياسات RLS زينة.
--  oh_migrator  : دور الهجرات. يملك الجداول ويطبّق التغييرات البنيوية.
--
--  في Neon يكون المستخدم الافتراضي هو المالك؛ ننشئ oh_app كدور محدود
--  ونمنحه ما يلزم فقط.
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'oh_app') THEN
    CREATE ROLE oh_app NOLOGIN NOBYPASSRLS;
  END IF;
END
$$;

-- التطبيق يقرأ ويكتب البيانات، ولا يغيّر البنية.
GRANT USAGE ON SCHEMA public TO oh_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO oh_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO oh_app;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO oh_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO oh_app;


-- ═══════════════════════════════════════════════════════════════════════════
--  2. دوال سياق الطلب
--
--  السياق يُضبط بـ set_config(..., is_local => true) أي **على نطاق المعاملة**.
--  هذا حرج مع connection pooling (PgBouncer/Neon): إعداد على نطاق الجلسة
--  كان سيبقى عالقًا على الاتصال ويتسرّب إلى طلب مستأجر آخر يعيد استخدامه.
--  نطاق المعاملة يُمحى تلقائيًا عند COMMIT/ROLLBACK.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION app_current_tenant()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('app.tenant_id', true), '')::uuid;
$$;

CREATE OR REPLACE FUNCTION app_is_platform()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(current_setting('app.is_platform', true), 'off') = 'on';
$$;


-- ═══════════════════════════════════════════════════════════════════════════
--  3. بحث المصادقة  (SECURITY DEFINER)
--
--  مشكلة الدجاجة والبيضة: RLS تحتاج app.tenant_id، لكن عند تسجيل الدخول
--  لا نعرف المستأجر بعد — نعرف البريد فقط.
--
--  الحل: دالة SECURITY DEFINER واحدة، ضيقة ومُدقَّقة، تعمل بصلاحيات مالكها
--  فتتجاوز RLS. لا تُرجع إلا الحقول اللازمة للمصادقة، ولا تقبل إلا بريدًا.
--  هذا هو **الثقب الوحيد** المسموح في جدار RLS، ومقصود وموثّق.
--
--  ما لا تُرجعه مقصود أيضًا: لا اسم، لا هاتف، لا بيانات أعمال.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION app_auth_lookup(p_email citext)
RETURNS TABLE (
  id                 uuid,
  tenant_id          uuid,
  store_id           uuid,
  role_id            uuid,
  password_hash      varchar,
  status             "UserStatus",
  is_super_admin     boolean,
  totp_enabled       boolean,
  totp_secret        varchar,
  failed_login_count integer,
  locked_until       timestamptz,
  tenant_status      "TenantStatus"
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
  SELECT
    u.id,
    u.tenant_id,
    u.store_id,
    u.role_id,
    u.password_hash,
    u.status,
    u.is_super_admin,
    u.totp_enabled,
    u.totp_secret,
    u.failed_login_count,
    u.locked_until,
    t.status AS tenant_status
  FROM users u
  LEFT JOIN tenants t ON t.id = u.tenant_id
  WHERE u.email = p_email
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION app_auth_lookup(citext) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_auth_lookup(citext) TO oh_app;

-- تحديث عدّاد المحاولات الفاشلة والقفل — يحتاج تجاوز RLS لنفس السبب.
CREATE OR REPLACE FUNCTION app_auth_record_attempt(
  p_user_id uuid,
  p_success boolean,
  p_threshold integer,
  p_lock_minutes integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_success THEN
    UPDATE users
       SET failed_login_count = 0,
           locked_until       = NULL,
           last_login_at      = now()
     WHERE id = p_user_id;
  ELSE
    UPDATE users
       SET failed_login_count = failed_login_count + 1,
           locked_until = CASE
             WHEN failed_login_count + 1 >= p_threshold
               THEN now() + (p_lock_minutes || ' minutes')::interval
             ELSE locked_until
           END
     WHERE id = p_user_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION app_auth_record_attempt(uuid, boolean, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_auth_record_attempt(uuid, boolean, integer, integer) TO oh_app;


-- ═══════════════════════════════════════════════════════════════════════════
--  4. سياسات RLS على جداول المستأجر
--
--  النمط:  المستأجر يرى صفوفه فقط  OR  سياق المنصة مفعّل.
--  FORCE ROW LEVEL SECURITY يطبّقها حتى على مالك الجدول — بلا هذا السطر
--  كان المالك يتجاوزها بصمت.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── stores ────────────────────────────────────────────────────────────────
ALTER TABLE "stores" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "stores" FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON "stores"
  USING (tenant_id = app_current_tenant())
  WITH CHECK (tenant_id = app_current_tenant());

CREATE POLICY platform_access ON "stores"
  USING (app_is_platform())
  WITH CHECK (app_is_platform());

-- ── branches ──────────────────────────────────────────────────────────────
ALTER TABLE "branches" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "branches" FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON "branches"
  USING (tenant_id = app_current_tenant())
  WITH CHECK (tenant_id = app_current_tenant());

CREATE POLICY platform_access ON "branches"
  USING (app_is_platform())
  WITH CHECK (app_is_platform());

-- ── roles ─────────────────────────────────────────────────────────────────
ALTER TABLE "roles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "roles" FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON "roles"
  USING (tenant_id = app_current_tenant())
  WITH CHECK (tenant_id = app_current_tenant());

CREATE POLICY platform_access ON "roles"
  USING (app_is_platform())
  WITH CHECK (app_is_platform());

-- ── role_permissions ──────────────────────────────────────────────────────
ALTER TABLE "role_permissions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "role_permissions" FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON "role_permissions"
  USING (tenant_id = app_current_tenant())
  WITH CHECK (tenant_id = app_current_tenant());

CREATE POLICY platform_access ON "role_permissions"
  USING (app_is_platform())
  WITH CHECK (app_is_platform());

-- ── user_permissions ──────────────────────────────────────────────────────
ALTER TABLE "user_permissions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "user_permissions" FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON "user_permissions"
  USING (tenant_id = app_current_tenant())
  WITH CHECK (tenant_id = app_current_tenant());

CREATE POLICY platform_access ON "user_permissions"
  USING (app_is_platform())
  WITH CHECK (app_is_platform());

-- ── users ─────────────────────────────────────────────────────────────────
--  المدير العام (tenant_id IS NULL) غير مرئي داخل أي سياق مستأجر:
--  NULL = uuid ينتج NULL وليس TRUE، فالصف يُستبعد. هذا مقصود.
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "users" FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON "users"
  USING (tenant_id = app_current_tenant())
  WITH CHECK (tenant_id = app_current_tenant());

CREATE POLICY platform_access ON "users"
  USING (app_is_platform())
  WITH CHECK (app_is_platform());

-- ── sessions ──────────────────────────────────────────────────────────────
--  جلسات المدير العام لها tenant_id = NULL، فتحتاج سياق المنصة.
ALTER TABLE "sessions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sessions" FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON "sessions"
  USING (tenant_id = app_current_tenant())
  WITH CHECK (tenant_id = app_current_tenant());

CREATE POLICY platform_access ON "sessions"
  USING (app_is_platform())
  WITH CHECK (app_is_platform());

-- ── audit_logs ────────────────────────────────────────────────────────────
ALTER TABLE "audit_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "audit_logs" FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON "audit_logs"
  USING (tenant_id = app_current_tenant())
  WITH CHECK (tenant_id = app_current_tenant());

CREATE POLICY platform_access ON "audit_logs"
  USING (app_is_platform())
  WITH CHECK (app_is_platform());


-- ═══════════════════════════════════════════════════════════════════════════
--  5. جداول المنصة — سياق المنصة إلزامي
--
--  المستأجر يقرأ باقته واشتراكه (شاشة «إدارة الاشتراك»)، ولا يعدّلهما.
--  الباقات مقروءة للجميع (قائمة الترقية)، والتعديل للمنصة وحدها.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE "tenants" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tenants" FORCE ROW LEVEL SECURITY;

CREATE POLICY self_read ON "tenants"
  FOR SELECT
  USING (id = app_current_tenant());

CREATE POLICY platform_access ON "tenants"
  USING (app_is_platform())
  WITH CHECK (app_is_platform());

ALTER TABLE "subscriptions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "subscriptions" FORCE ROW LEVEL SECURITY;

CREATE POLICY self_read ON "subscriptions"
  FOR SELECT
  USING (tenant_id = app_current_tenant());

CREATE POLICY platform_access ON "subscriptions"
  USING (app_is_platform())
  WITH CHECK (app_is_platform());

ALTER TABLE "plans" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "plans" FORCE ROW LEVEL SECURITY;

-- الباقات النشطة مقروءة للجميع (شاشة الترقية).
CREATE POLICY read_active ON "plans"
  FOR SELECT
  USING (is_active = true OR app_is_platform());

CREATE POLICY platform_manage ON "plans"
  USING (app_is_platform())
  WITH CHECK (app_is_platform());

-- كتالوج الصلاحيات: ثابت وعالمي، للقراءة فقط.
ALTER TABLE "permissions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "permissions" FORCE ROW LEVEL SECURITY;

CREATE POLICY read_all ON "permissions"
  FOR SELECT
  USING (true);

CREATE POLICY platform_manage ON "permissions"
  USING (app_is_platform())
  WITH CHECK (app_is_platform());


-- ═══════════════════════════════════════════════════════════════════════════
--  6. تحصين سجل التدقيق — لا تعديل ولا حذف. أبدًا.
--
--  طبقتان:
--    (أ) سحب الصلاحية: دور التطبيق لا يملك UPDATE/DELETE أصلًا.
--    (ب) Trigger: يرفض العملية حتى لو مُنحت الصلاحية خطأً لاحقًا.
--
--  هذا ما يجعل «سجل نشاط لا يمكن التلاعب به» تقنيًا لا شعارًا.
-- ═══════════════════════════════════════════════════════════════════════════

REVOKE UPDATE, DELETE ON "audit_logs" FROM oh_app;

CREATE OR REPLACE FUNCTION app_forbid_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION
    'الجدول % سجلّ غير قابل للتغيير (append-only). العملية % مرفوضة. التصحيح يتم بقيد جديد لا بتعديل قيد قائم.',
    TG_TABLE_NAME, TG_OP
    USING ERRCODE = 'raise_exception';
END;
$$;

CREATE TRIGGER audit_logs_immutable
  BEFORE UPDATE OR DELETE ON "audit_logs"
  FOR EACH ROW
  EXECUTE FUNCTION app_forbid_mutation();

-- سلسلة الهاش: seq تصاعدي فريد لكل مستأجر.
CREATE UNIQUE INDEX audit_logs_tenant_seq_key ON "audit_logs" ("tenant_id", "seq");


-- ═══════════════════════════════════════════════════════════════════════════
--  7. ثوابت الأعمال المفروضة في القاعدة  (ثوابت فقط — لا منطق)
-- ═══════════════════════════════════════════════════════════════════════════

-- اشتراك نشط واحد لكل مستأجر. فهرس جزئي فريد — يمنع الازدواج ذرّيًا
-- حتى تحت طلبين متزامنين، وهو ما لا يضمنه فحص في طبقة التطبيق.
CREATE UNIQUE INDEX subscriptions_one_active_per_tenant
  ON "subscriptions" ("tenant_id")
  WHERE status IN ('ACTIVE', 'TRIALING');

-- فرع رئيسي واحد لكل محل.
CREATE UNIQUE INDEX branches_one_main_per_store
  ON "branches" ("store_id")
  WHERE is_main = true;

-- المدير العام بلا مستأجر، ومستخدم المحل يجب أن يكون له مستأجر.
-- هذا يمنع حالة خطيرة: مستخدم عادي بـ tenant_id = NULL يصبح غير مرئي لـRLS
-- وقد يتصرف كمستخدم منصة.
ALTER TABLE "users"
  ADD CONSTRAINT users_super_admin_has_no_tenant
  CHECK (
    (is_super_admin = true  AND tenant_id IS NULL) OR
    (is_super_admin = false AND tenant_id IS NOT NULL)
  );

-- سعر الباقة غير سالب.
ALTER TABLE "plans"
  ADD CONSTRAINT plans_price_non_negative CHECK (price_monthly >= 0);

-- فترة الاشتراك منطقية.
ALTER TABLE "subscriptions"
  ADD CONSTRAINT subscriptions_period_valid
  CHECK (current_period_end > current_period_start);
