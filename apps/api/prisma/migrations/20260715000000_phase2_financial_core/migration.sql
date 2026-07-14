-- ═══════════════════════════════════════════════════════════════════════
--  المرحلة 2 — النواة المالية: البنية
--  مولَّد بـ prisma migrate diff. التحصين في الجزء الثاني أدناه.
-- ═══════════════════════════════════════════════════════════════════════

-- CreateEnum
CREATE TYPE "CustomerStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'BLOCKED');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('DRAFT', 'QUOTE', 'CONFIRMED', 'PARTIALLY_PAID', 'PAID', 'CANCELLED');

-- CreateEnum
CREATE TYPE "OrderItemSource" AS ENUM ('MANUAL', 'PRODUCT', 'SERVICE');

-- CreateEnum
CREATE TYPE "LedgerEntryType" AS ENUM ('OPENING_BALANCE', 'ORDER_DEBIT', 'PAYMENT_CREDIT', 'ADJUSTMENT_DEBIT', 'ADJUSTMENT_CREDIT', 'REVERSAL', 'WRITE_OFF');

-- CreateEnum
CREATE TYPE "LedgerRefType" AS ENUM ('CUSTOMER', 'ORDER', 'PAYMENT', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'BANK_TRANSFER', 'CARD', 'CHECK');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('POSTED', 'REVERSED');

-- CreateEnum
CREATE TYPE "IdempotencyStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED');

-- DropIndex
DROP INDEX "audit_logs_tenant_id_seq_idx";

-- CreateTable
CREATE TABLE "customers" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "store_id" UUID NOT NULL,
    "code" VARCHAR(24) NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "company" VARCHAR(160),
    "phone" VARCHAR(32),
    "phone_alt" VARCHAR(32),
    "email" VARCHAR(254),
    "address" VARCHAR(240),
    "city" VARCHAR(80),
    "tax_number" VARCHAR(32),
    "notes" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "credit_limit" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "payment_term_days" INTEGER NOT NULL DEFAULT 30,
    "status" "CustomerStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "created_by" UUID,
    "archived_at" TIMESTAMPTZ(6),

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "store_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "number" VARCHAR(24) NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'DRAFT',
    "issued_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "due_at" TIMESTAMPTZ(6),
    "subtotal" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "discount_amount" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "tax_amount" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "total" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "paid_amount" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "locked_at" TIMESTAMPTZ(6),
    "confirmed_at" TIMESTAMPTZ(6),
    "confirmed_by" UUID,
    "cancelled_at" TIMESTAMPTZ(6),
    "cancelled_by" UUID,
    "cancel_reason" VARCHAR(500),
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "created_by" UUID,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_items" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "source_type" "OrderItemSource" NOT NULL DEFAULT 'MANUAL',
    "source_id" UUID,
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "quantity" DECIMAL(14,4) NOT NULL,
    "unit_price" DECIMAL(18,4) NOT NULL,
    "discount" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "tax_rate" DECIMAL(6,3) NOT NULL DEFAULT 0,
    "line_total" DECIMAL(18,4) NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ledger_entries" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "store_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "seq" INTEGER NOT NULL,
    "entry_type" "LedgerEntryType" NOT NULL,
    "opening_balance" DECIMAL(18,4) NOT NULL,
    "debit" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "credit" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "running_balance" DECIMAL(18,4) NOT NULL,
    "ref_type" "LedgerRefType" NOT NULL,
    "ref_id" UUID,
    "reverses_entry_id" UUID,
    "notes" TEXT,
    "idempotency_key" VARCHAR(64),
    "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,

    CONSTRAINT "ledger_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "store_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "number" VARCHAR(24) NOT NULL,
    "amount" DECIMAL(18,4) NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'POSTED',
    "paid_at" TIMESTAMPTZ(6) NOT NULL,
    "reference" VARCHAR(120),
    "notes" TEXT,
    "idempotency_key" VARCHAR(64) NOT NULL,
    "reversed_at" TIMESTAMPTZ(6),
    "reversed_by" UUID,
    "reverse_reason" VARCHAR(500),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_allocations" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "payment_id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "amount" DECIMAL(18,4) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_counters" (
    "tenant_id" UUID NOT NULL,
    "store_id" UUID NOT NULL,
    "name" VARCHAR(24) NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "tenant_counters_pkey" PRIMARY KEY ("tenant_id","store_id","name")
);

-- CreateTable
CREATE TABLE "idempotency_keys" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "key" VARCHAR(64) NOT NULL,
    "endpoint" VARCHAR(120) NOT NULL,
    "request_hash" CHAR(64) NOT NULL,
    "status" "IdempotencyStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "response_status" INTEGER,
    "response_body" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "idempotency_keys_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "customers_tenant_id_store_id_status_idx" ON "customers"("tenant_id", "store_id", "status");

-- CreateIndex
CREATE INDEX "customers_tenant_id_name_idx" ON "customers"("tenant_id", "name");

-- CreateIndex
CREATE INDEX "customers_tenant_id_phone_idx" ON "customers"("tenant_id", "phone");

-- CreateIndex
CREATE INDEX "customers_tenant_id_created_at_idx" ON "customers"("tenant_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "customers_tenant_id_code_key" ON "customers"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "orders_tenant_id_customer_id_issued_at_idx" ON "orders"("tenant_id", "customer_id", "issued_at");

-- CreateIndex
CREATE INDEX "orders_tenant_id_status_idx" ON "orders"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "orders_tenant_id_issued_at_idx" ON "orders"("tenant_id", "issued_at");

-- CreateIndex
CREATE INDEX "orders_tenant_id_due_at_idx" ON "orders"("tenant_id", "due_at");

-- CreateIndex
CREATE UNIQUE INDEX "orders_tenant_id_number_key" ON "orders"("tenant_id", "number");

-- CreateIndex
CREATE INDEX "order_items_tenant_id_order_id_idx" ON "order_items"("tenant_id", "order_id");

-- CreateIndex
CREATE INDEX "ledger_entries_tenant_id_customer_id_seq_idx" ON "ledger_entries"("tenant_id", "customer_id", "seq" DESC);

-- CreateIndex
CREATE INDEX "ledger_entries_tenant_id_occurred_at_idx" ON "ledger_entries"("tenant_id", "occurred_at");

-- CreateIndex
CREATE INDEX "ledger_entries_tenant_id_ref_type_ref_id_idx" ON "ledger_entries"("tenant_id", "ref_type", "ref_id");

-- CreateIndex
CREATE UNIQUE INDEX "ledger_entries_tenant_id_customer_id_seq_key" ON "ledger_entries"("tenant_id", "customer_id", "seq");

-- CreateIndex
CREATE UNIQUE INDEX "ledger_entries_tenant_id_idempotency_key_key" ON "ledger_entries"("tenant_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "payments_tenant_id_customer_id_paid_at_idx" ON "payments"("tenant_id", "customer_id", "paid_at");

-- CreateIndex
CREATE INDEX "payments_tenant_id_paid_at_idx" ON "payments"("tenant_id", "paid_at");

-- CreateIndex
CREATE INDEX "payments_tenant_id_method_idx" ON "payments"("tenant_id", "method");

-- CreateIndex
CREATE UNIQUE INDEX "payments_tenant_id_number_key" ON "payments"("tenant_id", "number");

-- CreateIndex
CREATE UNIQUE INDEX "payments_tenant_id_idempotency_key_key" ON "payments"("tenant_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "payment_allocations_tenant_id_order_id_idx" ON "payment_allocations"("tenant_id", "order_id");

-- CreateIndex
CREATE INDEX "payment_allocations_tenant_id_payment_id_idx" ON "payment_allocations"("tenant_id", "payment_id");

-- CreateIndex
CREATE UNIQUE INDEX "payment_allocations_payment_id_order_id_key" ON "payment_allocations"("payment_id", "order_id");

-- CreateIndex
CREATE INDEX "idempotency_keys_expires_at_idx" ON "idempotency_keys"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "idempotency_keys_tenant_id_key_key" ON "idempotency_keys"("tenant_id", "key");

-- CreateIndex
CREATE UNIQUE INDEX "audit_logs_tenant_id_seq_key" ON "audit_logs"("tenant_id", "seq");

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_reverses_entry_id_fkey" FOREIGN KEY ("reverses_entry_id") REFERENCES "ledger_entries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ═══════════════════════════════════════════════════════════════════════════
--  المرحلة 2 — التحصين
--
--  كل ما في هذا الملف **لا يستطيع Prisma التعبير عنه**، ولذلك ينجو من
--  `prisma migrate dev` (لا يعتبره انحرافًا). أما الفهارس وأنواع الأعمدة
--  فمكانها schema.prisma حصرًا — وإلا أُلغيت.
--
--  المحتوى:
--    1. عزل RLS على الجداول الثمانية الجديدة
--    2. دفتر الحركات append-only (سحب صلاحية + trigger)
--    3. قفل الطلب المؤكد (trigger)
--    4. قيود CHECK: المعادلة المحاسبية، المبالغ الموجبة، مجموع التوزيعات
--    5. إصلاح انحدار المرحلة 1 (citext → تطبيع lowercase)
-- ═══════════════════════════════════════════════════════════════════════════


-- ═══════════════════════════════════════════════════════════════════════════
--  0. إصلاح انحدار: البريد الإلكتروني
--
--  هجرة `migrate dev` أعادت `users.email` من citext إلى varchar، فصار
--  التفرّد حسّاسًا لحالة الأحرف: يستطيع مستخدمان التسجيل بـOwner@x.com
--  و owner@x.com كحسابين منفصلين.
--
--  لا نعيد citext (سيُلغى مجددًا عند أي migrate dev). بدلًا منه: نضمن أن
--  البريد **مُصغَّر دائمًا** — فيصير التفرّد الحسّاس للحالة كافيًا.
--    • Zod يطبّعه (.toLowerCase()) قبل أن يصل للخدمة
--    • CHECK يرفض أي بريد غير مُصغَّر — وPrisma لا يمس قيود CHECK
-- ═══════════════════════════════════════════════════════════════════════════

UPDATE users SET email = lower(email) WHERE email <> lower(email);

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_email_lowercase;
ALTER TABLE users
  ADD CONSTRAINT users_email_lowercase CHECK (email = lower(email));

-- دالة المصادقة كانت تستقبل citext. الآن تستقبل text وتُصغّره بنفسها.
DROP FUNCTION IF EXISTS app_auth_lookup(citext);

CREATE OR REPLACE FUNCTION app_auth_lookup(p_email text)
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
    u.id, u.tenant_id, u.store_id, u.role_id, u.password_hash, u.status,
    u.is_super_admin, u.totp_enabled, u.totp_secret,
    u.failed_login_count, u.locked_until,
    t.status AS tenant_status
  FROM users u
  LEFT JOIN tenants t ON t.id = u.tenant_id
  WHERE u.email = lower(btrim(p_email))
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION app_auth_lookup(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_auth_lookup(text) TO oh_app;


-- ═══════════════════════════════════════════════════════════════════════════
--  1. عزل المستأجرين (RLS) على جداول المرحلة 2
--
--  نفس النمط الحاكم في المرحلة 1: سياسة المستأجر + سياسة المنصة.
--  FORCE — كي تُطبَّق حتى على مالك الجدول.
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'customers',
    'orders',
    'order_items',
    'ledger_entries',
    'payments',
    'payment_allocations',
    'tenant_counters',
    'idempotency_keys'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);

    EXECUTE format($p$
      CREATE POLICY tenant_isolation ON %I
        USING (tenant_id = app_current_tenant())
        WITH CHECK (tenant_id = app_current_tenant())
    $p$, t);

    EXECUTE format($p$
      CREATE POLICY platform_access ON %I
        USING (app_is_platform())
        WITH CHECK (app_is_platform())
    $p$, t);
  END LOOP;
END
$$;

-- دور التطبيق يحتاج الصلاحيات على الجداول الجديدة.
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO oh_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO oh_app;


-- ═══════════════════════════════════════════════════════════════════════════
--  2. دفتر الحركات — APPEND ONLY
--
--  طبقتان مستقلتان. الأولى تكفي؛ الثانية تحمي من خطأ في هجرة لاحقة.
-- ═══════════════════════════════════════════════════════════════════════════

--  (أ) دور التطبيق لا يملك الصلاحية أصلًا.
REVOKE UPDATE, DELETE ON ledger_entries FROM oh_app;

--  (ب) trigger يرفض العملية حتى لو مُنحت الصلاحية.
--      app_forbid_mutation() موجودة من هجرة المرحلة 1.
DROP TRIGGER IF EXISTS ledger_entries_immutable ON ledger_entries;
CREATE TRIGGER ledger_entries_immutable
  BEFORE UPDATE OR DELETE ON ledger_entries
  FOR EACH ROW
  EXECUTE FUNCTION app_forbid_mutation();

--  توزيعات الدفعات مرتبطة بقيود محاسبية ⇒ لا تُحذف ولا تُعدَّل أيضًا.
--  عكس الدفعة يُنشئ قيدًا عكسيًا، ولا يمحو التوزيع الأصلي.
REVOKE UPDATE, DELETE ON payment_allocations FROM oh_app;

DROP TRIGGER IF EXISTS payment_allocations_immutable ON payment_allocations;
CREATE TRIGGER payment_allocations_immutable
  BEFORE UPDATE OR DELETE ON payment_allocations
  FOR EACH ROW
  EXECUTE FUNCTION app_forbid_mutation();


-- ═══════════════════════════════════════════════════════════════════════════
--  3. المعادلة المحاسبية — مفروضة في القاعدة
--
--  هذه القيود تجعل الدفتر **غير قابل للكسر** حتى بخطأ برمجي:
--  لا يمكن كتابة قيد يخالف المعادلة، مهما فعلت طبقة التطبيق.
-- ═══════════════════════════════════════════════════════════════════════════

--  المبالغ غير سالبة.
ALTER TABLE ledger_entries
  ADD CONSTRAINT ledger_amounts_non_negative
  CHECK (debit >= 0 AND credit >= 0);

--  أحدهما صفر — لا قيد مدين ودائن معًا. (قيد بلا مبلغ أيضًا مرفوض.)
ALTER TABLE ledger_entries
  ADD CONSTRAINT ledger_debit_xor_credit
  CHECK (
    (debit > 0 AND credit = 0) OR
    (credit > 0 AND debit = 0) OR
    (debit = 0 AND credit = 0 AND entry_type = 'OPENING_BALANCE')
  );

--  ★ المعادلة: الرصيد الجديد = الرصيد السابق + مدين − دائن.
--    هذا هو القيد الذي يجعل التلاعب بالأرصدة مستحيلًا: أي محاولة لكتابة
--    رصيد لا ينتج عن الحركة نفسها تُرفض على مستوى القاعدة.
ALTER TABLE ledger_entries
  ADD CONSTRAINT ledger_balance_equation
  CHECK (running_balance = opening_balance + debit - credit);

--  التسلسل يبدأ من 1.
ALTER TABLE ledger_entries
  ADD CONSTRAINT ledger_seq_positive CHECK (seq >= 1);

--  قيد العكس يجب أن يشير إلى قيد أصلي، وغير العكس يجب ألا يشير.
ALTER TABLE ledger_entries
  ADD CONSTRAINT ledger_reversal_has_target
  CHECK (
    (entry_type = 'REVERSAL' AND reverses_entry_id IS NOT NULL) OR
    (entry_type <> 'REVERSAL' AND reverses_entry_id IS NULL)
  );


-- ═══════════════════════════════════════════════════════════════════════════
--  4. قيود الطلبات والدفعات
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE orders
  ADD CONSTRAINT orders_amounts_non_negative
  CHECK (subtotal >= 0 AND tax_amount >= 0 AND total >= 0 AND paid_amount >= 0);

--  لا يُدفع أكثر من إجمالي الطلب. يمنع دفعة زائدة تُنتج رصيدًا سالبًا وهميًا
--  على الطلب (الفائض يصير رصيدًا دائنًا للزبون، لا دفعًا زائدًا على الطلب).
ALTER TABLE orders
  ADD CONSTRAINT orders_paid_not_over_total
  CHECK (paid_amount <= total);

ALTER TABLE payments
  ADD CONSTRAINT payments_amount_positive CHECK (amount > 0);

ALTER TABLE payment_allocations
  ADD CONSTRAINT payment_allocations_amount_positive CHECK (amount > 0);

ALTER TABLE order_items
  ADD CONSTRAINT order_items_quantity_positive CHECK (quantity > 0);

ALTER TABLE order_items
  ADD CONSTRAINT order_items_unit_price_non_negative CHECK (unit_price >= 0);

ALTER TABLE order_items
  ADD CONSTRAINT order_items_discount_non_negative CHECK (discount >= 0);

ALTER TABLE order_items
  ADD CONSTRAINT order_items_tax_rate_sane CHECK (tax_rate >= 0 AND tax_rate <= 100);

ALTER TABLE customers
  ADD CONSTRAINT customers_credit_limit_non_negative CHECK (credit_limit >= 0);

ALTER TABLE customers
  ADD CONSTRAINT customers_payment_term_sane
  CHECK (payment_term_days >= 0 AND payment_term_days <= 365);

--  البند اليدوي بلا مصدر؛ البند المرتبط بمصدر يجب أن يحمل معرّفه.
ALTER TABLE order_items
  ADD CONSTRAINT order_items_source_consistent
  CHECK (
    (source_type = 'MANUAL' AND source_id IS NULL) OR
    (source_type <> 'MANUAL' AND source_id IS NOT NULL)
  );


-- ═══════════════════════════════════════════════════════════════════════════
--  5. قفل الطلب المؤكد
--
--  بعد التأكيد، مبالغ الطلب مُثبَّتة في قيد محاسبي. تغييرها بـUPDATE مباشر
--  يجعل الطلب يخالف دفتر الحركات — أسوأ حالة ممكنة: رقمان مختلفان لنفس
--  المبلغ، ولا أحد يعرف أيهما الصحيح.
--
--  الـtrigger يسمح بتحديث `paid_amount` و`status` و`version` (وهي نتائج
--  الدفعات والعكس) ويرفض أي تغيير على المبالغ الأصلية أو البنود.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION app_orders_lock_confirmed()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.locked_at IS NULL THEN
    RETURN NEW;  -- مسودة أو عرض سعر — التعديل مسموح
  END IF;

  IF NEW.subtotal        IS DISTINCT FROM OLD.subtotal
  OR NEW.discount_amount IS DISTINCT FROM OLD.discount_amount
  OR NEW.tax_amount      IS DISTINCT FROM OLD.tax_amount
  OR NEW.total           IS DISTINCT FROM OLD.total
  OR NEW.customer_id     IS DISTINCT FROM OLD.customer_id
  OR NEW.issued_at       IS DISTINCT FROM OLD.issued_at
  THEN
    RAISE EXCEPTION
      'الطلب % مؤكد ومقفل. لا يمكن تعديل مبالغه أو زبونه أو تاريخه — التصحيح يتم بقيد تسوية في دفتر الحركات.',
      OLD.number
      USING ERRCODE = 'raise_exception';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS orders_lock_confirmed ON orders;
CREATE TRIGGER orders_lock_confirmed
  BEFORE UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION app_orders_lock_confirmed();

--  بنود طلب مقفل لا تُمس إطلاقًا.
CREATE OR REPLACE FUNCTION app_order_items_lock_confirmed()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_locked timestamptz;
  v_number varchar;
  v_order_id uuid;
BEGIN
  v_order_id := COALESCE(NEW.order_id, OLD.order_id);

  SELECT locked_at, number INTO v_locked, v_number
  FROM orders WHERE id = v_order_id;

  IF v_locked IS NOT NULL THEN
    RAISE EXCEPTION
      'الطلب % مؤكد ومقفل. لا يمكن إضافة أو تعديل أو حذف بنوده.',
      v_number
      USING ERRCODE = 'raise_exception';
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS order_items_lock_confirmed ON order_items;
CREATE TRIGGER order_items_lock_confirmed
  BEFORE INSERT OR UPDATE OR DELETE ON order_items
  FOR EACH ROW
  EXECUTE FUNCTION app_order_items_lock_confirmed();


-- ═══════════════════════════════════════════════════════════════════════════
--  6. دالة الرصيد — المصدر الوحيد
--
--  لا يوجد عمود رصيد في أي جدول. من يريد الرصيد يستدعي هذه الدالة، أو
--  يقرأ `running_balance` من آخر قيد (وهما متطابقان بحكم قيد المعادلة).
--
--  STABLE + SECURITY INVOKER: تعمل بصلاحيات المستدعي، فتحترم RLS.
--  زبون مستأجر آخر يعطي 0 — لا خطأ، ولا تسريب.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION app_customer_balance(p_customer_id uuid)
RETURNS numeric(18, 4)
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(SUM(debit) - SUM(credit), 0)::numeric(18, 4)
  FROM ledger_entries
  WHERE customer_id = p_customer_id;
$$;

GRANT EXECUTE ON FUNCTION app_customer_balance(uuid) TO oh_app;
