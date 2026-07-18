# Oh-Finance — خطة المعمارية (المرحلة 0)

> ### 🔄 تعديلات مُطبَّقة أثناء المرحلة 1
>
> | # | التغيير | السبب |
> |---|---|---|
> | **C1** | فصل `Tenant` (الحساب) عن `Store` (المحل) عن `Branch` (الفرع) — كانت مدموجة في كيان `tenants` واحد | طلب صريح في مواصفات المرحلة 1 |
> | **C2** | `User.email` **فريد عالميًا** — لا `UNIQUE(tenant_id, email)` | تسجيل الدخول يحدث **قبل** وجود سياق مستأجر؛ بريد مكرر عبر محلين يجعل الدخول غامضًا |
> | **C3** | بحث المصادقة عبر دالة `SECURITY DEFINER` (`app_auth_lookup`) بدل تجاوز RLS بدور مميّز | RLS تمنع قراءة المستخدم قبل معرفة محله. هذه الدالة هي **الثقب الوحيد** المسموح — ضيقة، بحقول محدودة، وموثّقة في ADR-0001 |
> | **C4** | `Permission` صار **جدولًا** لا نصًا حرًّا | يسمح بمفاتيح أجنبية حقيقية بدل نصوص غير مُتحقَّق منها |
> | **C5** | المرحلة 1 لا تُنشئ جداول `Customer`/`Order`/`Payment`/`LedgerEntry` | حصر النطاق — تُبنى في المرحلتين 4 و5 |
>
> القرارات الكبرى موثّقة في [`docs/adr/`](adr/).

> النظام: SaaS تجاري متعدد المحلات (Multi-Tenant) لإدارة الزبائن، الطلبات الآجلة، الدفعات، الديون، دفتر الحسابات، التقارير، الطباعة، الرسائل، الموظفين، والاشتراكات.
> المرجع البصري الإلزامي: `ui/other screens/*.jpeg` (ديسكتوب) و `ui/phone screen/*.jpeg` (موبايل).

---

## 1. ملخص حالة المشروع الحالية

| البند | الحالة |
|---|---|
| كود المصدر | **لا يوجد إطلاقًا** — المشروع greenfield |
| مستودع git | غير مُهيّأ (`git init` مطلوب) |
| محتوى المجلد | `ui/` فقط: 20 صورة JPEG (10 شاشات × ديسكتوب/موبايل) |
| Node / npm | v24.14.1 / 11.11.0 ✅ |
| Docker | **غير مثبّت** ❌ |
| PostgreSQL محلي | **غير مثبّت** ❌ |
| Redis محلي | **غير مثبّت** ❌ |

**القرار المتخذ:** قاعدة البيانات ستكون **Neon (Postgres سحابي)**، و Redis عبر **Upstash** (سحابي، متوافق مع BullMQ). لا حاجة لتثبيت أي شيء محليًا.

### الشاشات المتوفرة كمرجع بصري (10)
`الرئيسية` · `الزبائن` · `صفحة كل زبون` · `الطلبات` · `الدفعات` · `الحساب والحركات` · `التقارير` · `الموظفون` · `الاعدادت` · `كل الاعدادات`

### الشاشات **الناقصة** من المرجع (يجب تصميمها التزامًا بنفس النظام البصري)
- `المستندات والطباعة` (موجودة في الشريط الجانبي، بلا صورة)
- `الرسائل والواتساب` (موجودة في الشريط الجانبي، بلا صورة)
- `الاشتراك والفواتير` (موجودة في الشريط الجانبي؛ صورة جزئية داخل تبويب «إدارة الاشتراك»)
- `المنتجات (اختياري)` (موجودة في الشريط الجانبي، بلا صورة)
- **لوحة المدير العام (Super Admin) بكاملها** — لا توجد أي صورة مرجعية
- شاشة تسجيل الدخول / 2FA — لا توجد صورة
- نموذج «إضافة طلب جديد» و«تسجيل دفعة» (Modals) — لا توجد صور

> ⚠️ سأبني هذه الشاشات باشتقاق صارم من نظام التصميم المستخرج (القسم 9 + `docs/01-design-system.md`)، وأوثّق كل اجتهاد بصري.

### تناقضات في المرجع البصري (موثّقة + القرار)
| التناقض | القرار |
|---|---|
| `الرئيسية` تعرض شريطًا جانبيًا **فاتحًا**، بينما 8 شاشات تعرضه **داكنًا (navy)** | ✅ الشريط الداكن هو المعتمد (الأغلبية + شاشات الموبايل) |
| الديسكتوب يعرض `ر.س`، الموبايل يعرض `₪` | ✅ العملة **إعداد لكل محل**، الافتراضي `ILS ₪` (قرار المستخدم) |
| عنصر الشريط النشط أزرق في معظم الشاشات، وأخضر في الإعدادات | ✅ الأزرق `#1D4ED8` للتنقل النشط، الأخضر `#15803D` لون العلامة/الحفظ |
| `الموظفون` تعرض أعمدة خدمات/مواعيد/تقييم (نمط صالون) غير موجودة في المتطلبات | ✅ تُحذف — الوحدة = موظفون + أدوار + صلاحيات فقط (قرار المستخدم) |
| `الرئيسية` تعرض عنصري «لوحة التحكم» و«الرئيسية» معًا في الشريط | ✅ عنصر واحد: `لوحة التحكم` (تكرار في الموك‌أب) |

---

## 2. Architecture Plan

### 2.1 هيكل المستودع (npm workspaces monorepo)

```
oh-finance/
├─ package.json                 # workspaces root
├─ tsconfig.base.json
├─ .env.example                 # لا أسرار في الكود إطلاقًا
├─ docs/
│  ├─ 00-architecture-plan.md   (هذا الملف)
│  ├─ 01-design-system.md       (عقد التصميم البصري)
│  └─ adr/                      (Architecture Decision Records)
├─ ui/                          # الصور المرجعية — لا تُمس
├─ packages/
│  ├─ money/                    # @oh/money — Decimal + سياسة التقريب الموحّدة
│  └─ contracts/                # @oh/contracts — Zod schemas + TS types (عقد API واحد للطرفين)
└─ apps/
   ├─ api/                      # NestJS 11 + Prisma + Postgres + Redis + BullMQ
   └─ web/                      # React 19 + Vite + Tailwind + shadcn/ui + TanStack Query
```

**لماذا monorepo؟** `@oh/contracts` هو المصدر الوحيد لأشكال البيانات: الخادم يتحقق بها (Zod)، والواجهة تستنتج أنواعها منها (`z.infer`). هذا يحقق **Typed API Contracts** ويمنع انحراف العقد بين الطرفين — أي تغيير في الحقل يكسر البناء على الطرفين فورًا بدل أن يظهر كخطأ وقت التشغيل.

### 2.2 عزل المستأجرين — دفاع بأربع طبقات

> القاعدة الحديدية: **`tenantId` لا يُقرأ أبدًا من body أو query أو header. مصدره الوحيد هو الـ JWT المُوقّع.**

| # | الطبقة | الآلية | ماذا توقف؟ |
|---|---|---|---|
| 1 | **الهوية** | `tenantId` مضمّن في الـ access token المُوقّع فقط | تزوير المستأجر من العميل |
| 2 | **السياق** | `AsyncLocalStorage` يحمل `TenantContext` طوال دورة الطلب | تسرّب السياق بين الطلبات المتزامنة |
| 3 | **التطبيق** | Prisma Client Extension يحقن `tenantId` في كل `where` و `data` | خطأ برمجي في استعلام (نسيان الفلترة) |
| 4 | **قاعدة البيانات** | **PostgreSQL RLS** — سياسة على كل جدول: `USING (tenant_id = current_setting('app.tenant_id')::uuid)` | **كل ما سبق مجتمعًا** — الحارس النهائي |

**آلية RLS عمليًا:** كل طلب HTTP يُفتح داخل معاملة (transaction) تبدأ بـ:
```sql
SELECT set_config('app.tenant_id', $1, true);  -- true = transaction-scoped
```
التطبيق يتصل بدور Postgres **بلا `BYPASSRLS`** (`oh_app`)، بينما الهجرات تعمل بدور آخر (`oh_migrator`). حتى لو نجح مهاجم في حقن استعلام، لن يرى صف مستأجر آخر.

**المدير العام (Super Admin):** يعمل على **جداول المنصة فقط** (`tenants`, `plans`, `subscriptions`, `platform_invoices`) — وهي بلا RLS لأنها ليست بيانات مستأجر. **لا يستطيع قراءة بيانات أعمال أي محل** (زبائن/طلبات/حركات). هذا موقف أمني متعمّد يحقق «عزل كامل».

### 2.3 نموذج الأموال (Financial Correctness)

| القرار | التفصيل |
|---|---|
| التخزين | `NUMERIC(18,4)` في Postgres — لا `float`، لا `double`، لا `money` |
| في الكود | `Prisma.Decimal` (مبني على decimal.js) — **يُمنع `number` للمبالغ منعًا باتًا** (قاعدة ESLint مخصصة) |
| النقل عبر API | **نص** `"1250.00"` — لا أرقام JSON (JSON number = IEEE-754 double) |
| التقريب | `ROUND_HALF_UP` تجاري، مُطبّق مرة واحدة عند سطر الطلب ومرة عند إجمالي المستند — كله في `@oh/money` |
| الوحدات الصغرى | من إعدادات المحل (`ILS` = خانتان) |

**لماذا نص وليس رقم؟** `JSON.parse("1250.10")` في JavaScript يعطي `1250.1` بدقة عائمة، و `0.1 + 0.2 !== 0.3`. أي مبلغ يمرّ عبر `number` ولو مرة واحدة يفقد الدقة بلا رجعة. النص يعبر الشبكة بلا خسارة ويُحوَّل إلى `Decimal` مباشرة على الطرفين.

### 2.4 دفتر الأستاذ (Ledger) — قلب النظام

`ledger_entries` هو **append-only** ومصدر الحقيقة الوحيد للرصيد.

```
كل طلب مؤكد   → قيد مدين  (DEBIT)
كل دفعة        → قيد دائن  (CREDIT)
كل تصحيح       → ADJUSTMENT_DEBIT / ADJUSTMENT_CREDIT
كل إلغاء قيد   → REVERSAL (يشير إلى القيد الأصلي، ولا يحذفه)
```

**كيف نضمن أنه لا يُحذف ولا يُعدّل فعليًا (لا مجرد "اتفاق")؟**
1. `REVOKE UPDATE, DELETE ON ledger_entries FROM oh_app;` — دور التطبيق لا يملك الصلاحية أصلًا.
2. Trigger `BEFORE UPDATE OR DELETE` يرفع `RAISE EXCEPTION` — حاجز ثانٍ حتى لو أُعطيت الصلاحية خطأً.
3. نفس المعاملة مع `audit_logs`.

**سلامة سلسلة الرصيد (`balance_before` → `balance_after`):**
كل إضافة قيد تأخذ قفلًا على الزبون داخل المعاملة:
```sql
SELECT pg_advisory_xact_lock(hashtextextended(customer_id::text, 0));
```
هذا يُسلسِل الكتابات المتزامنة على نفس الزبون، فيستحيل أن تحصل دفعتان متزامنتان على نفس `balance_before` (شرط سباق كلاسيكي يُفسد الدفتر).

**الرصيد:** `customer_balances` جدول **ذاكرة مؤقتة** يُحدَّث داخل نفس المعاملة، لكن **مصدر الحقيقة** هو `SUM(debit) - SUM(credit)`. مهمة مطابقة (reconciliation) دورية عبر BullMQ تتحقق من تطابقهما وتُنذر عند الانحراف.

**دورات الحساب (المتطلب 12):** `account_cycles` — عند سداد الرصيد بالكامل (`balance = 0`) يمكن إغلاق الدورة وفتح دورة جديدة برصيد افتتاحي `0`. **لا يُحذف شيء** — القيود القديمة تبقى مرتبطة بـ `cycle_id` السابق، والتاريخ الكامل متاح دائمًا.

### 2.5 Idempotency للدفعات (المتطلب: منع التسجيل المزدوج)

نقطة `POST /payments` تتطلب ترويسة `Idempotency-Key` (UUID من العميل).

```
1. يصل الطلب مع المفتاح K
2. INSERT INTO idempotency_keys (tenant_id, key, request_hash, status='IN_PROGRESS')
   → UNIQUE(tenant_id, key) يمنع التوازي
3. إن كان موجودًا و status='COMPLETED' → أعِد الرد المخزّن (200) بلا أي أثر جانبي
4. إن كان موجودًا و request_hash مختلف → 422 (نفس المفتاح، حمولة مختلفة = خطأ عميل)
5. عند النجاح: خزّن الرد، status='COMPLETED'
```
خط دفاع ثانٍ: `UNIQUE(tenant_id, idempotency_key)` على `ledger_entries` نفسه.

**الواجهة:** لا Optimistic UI للدفعات إطلاقًا — الرصيد الجديد يُعرض فقط بعد تأكيد الخادم (التزامًا بمتطلبك الصريح).

### 2.6 سجل التدقيق غير القابل للتلاعب

`audit_logs` سلسلة هاش (hash chain):
```
hash[n] = sha256( hash[n-1] || tenant_id || actor || action || payload || timestamp )
```
أي تعديل لصف قديم يكسر السلسلة لكل ما بعده، ويكشفه أمر `audit:verify`. + نفس حماية `REVOKE UPDATE/DELETE` + Trigger.

### 2.7 المكدس التقني

**Backend:** NestJS 11 (TypeScript strict) · Prisma 6 · PostgreSQL 16 (Neon) · Redis (Upstash) · BullMQ · Zod · Pino · Argon2id · Helmet · @nestjs/throttler

> **قرار: NestJS وليس Express.** المتطلبات تفرض DI، Guards للصلاحيات على كل مسار، Interceptors لسياق المستأجر، ومعمارية Modules صريحة. NestJS يوفرها بنيويًا؛ مع Express كنت سأعيد بناء نصفها يدويًا.

**Frontend:** React 19 · TypeScript strict · Vite 7 · Tailwind CSS 4 · shadcn/ui · TanStack Query v5 · React Hook Form + Zod · React Router 7 · i18next (ar/he/en) · Recharts

> **قرار: Recharts وليس ECharts.** الرسوم في التصميم بسيطة (donut، خطي مزدوج، أعمدة). Recharts متوافق مع React ذاتيًا وأخف بكثير (~100KB مقابل ~1MB)، ويدعم RTL عبر `reversed` على المحاور.

**Testing:** Vitest (وحدوي) · React Testing Library · Supertest (تكاملي) · Playwright (E2E) · axe-core (وصولية)

**PDF:** Playwright/Chromium يحوّل قالب HTML → PDF. **السبب:** تشكيل النص العربي والعبري (RTL shaping، ligatures، bidi) صحيح فقط في محرك تخطيط حقيقي. مكتبات PDF الخفيفة (pdfkit/react-pdf) تُنتج عربية مقطّعة أو معكوسة. Chromium موجود أصلًا لاختبارات E2E.

---

## 3. Database ERD (نصّي)

### 3.1 جداول المنصة (بلا RLS — للمدير العام فقط)

```
plans
  id PK · code UNIQUE · name_ar · name_he · price_monthly NUMERIC(18,4) · currency
  max_customers INT · max_orders INT · max_users INT · max_storage_mb INT
  features JSONB · is_active BOOL · created_at

tenants                                  ← "المحل"
  id PK (uuid) · code UNIQUE ("1001") · name · slug UNIQUE
  status ENUM(ACTIVE|SUSPENDED|TRIAL|CANCELLED)
  logo_url · phone · email · address · city
  locale ENUM(ar|he|en) DEFAULT ar · timezone DEFAULT 'Asia/Jerusalem'
  currency DEFAULT 'ILS' · date_format · number_format
  created_at · created_by (super admin)

subscriptions
  id PK · tenant_id FK→tenants · plan_id FK→plans
  status ENUM(ACTIVE|PAST_DUE|CANCELLED|TRIALING)
  started_at · current_period_start · current_period_end · cancelled_at
  UNIQUE(tenant_id) WHERE status='ACTIVE'          ← اشتراك نشط واحد لكل محل

platform_invoices                        ← فواتير المنصة على المحل
  id PK · tenant_id FK · subscription_id FK · number UNIQUE
  amount NUMERIC(18,4) · currency · status ENUM(DRAFT|OPEN|PAID|VOID)
  issued_at · due_at · paid_at

tenant_usage                             ← لعدّادات "استخدام الباقة" في شاشة الاشتراك
  tenant_id PK FK · customers_count · orders_count · storage_mb · computed_at
```

### 3.2 جداول المستأجر (كلها `tenant_id NOT NULL` + RLS مُفعّلة)

```
users                                    ← صاحب المحل + الموظفون
  id PK · tenant_id FK · email · phone · name · avatar_url
  password_hash (argon2id) · role ENUM(OWNER|MANAGER|CASHIER|VIEWER)
  job_title · department · status ENUM(ACTIVE|INACTIVE)
  totp_secret (مشفّر) · totp_enabled BOOL · recovery_codes JSONB (مُجزّأة)
  failed_login_count · locked_until · last_login_at
  UNIQUE(tenant_id, email)

user_permissions                         ← تجاوزات صلاحيات فردية فوق الدور
  user_id FK · permission TEXT · granted BOOL
  PK(user_id, permission)

sessions
  id PK · tenant_id · user_id FK · refresh_token_hash (sha256) UNIQUE
  family_id (لكشف إعادة الاستخدام) · user_agent · ip · expires_at
  revoked_at · replaced_by_id

customers                                ← الزبائن
  id PK · tenant_id FK · code UNIQUE per tenant ("CUST-0001")
  name · phone · phone_alt · email · address · city · notes
  credit_limit NUMERIC(18,4) DEFAULT 0 · payment_terms_days INT DEFAULT 30
  status ENUM(ACTIVE|INACTIVE)
  created_at · created_by · updated_at
  UNIQUE(tenant_id, code) · INDEX(tenant_id, phone) · INDEX(tenant_id, name)

customer_balances                         ← ذاكرة مؤقتة (مشتقة، تُحدَّث في نفس المعاملة)
  customer_id PK FK · tenant_id · balance NUMERIC(18,4)
  total_debit · total_credit · last_entry_id · updated_at

account_cycles                            ← دورات الحساب (المتطلب 12)
  id PK · tenant_id · customer_id FK · cycle_number INT
  status ENUM(OPEN|CLOSED) · opened_at · closed_at
  opening_balance NUMERIC(18,4) · closing_balance NUMERIC(18,4)
  UNIQUE(customer_id, cycle_number)
  UNIQUE(customer_id) WHERE status='OPEN'        ← دورة مفتوحة واحدة فقط

products                                  ← اختياري (كتالوج)
  id PK · tenant_id · sku · name · category · unit
  price NUMERIC(18,4) · tax_rate NUMERIC(5,2) · is_active

orders
  id PK · tenant_id FK · number UNIQUE per tenant ("ORD-00087")
  customer_id FK · cycle_id FK→account_cycles
  status ENUM(DRAFT|QUOTE|CONFIRMED|PARTIALLY_PAID|PAID|CANCELLED)
  issued_at · due_at                             ← "تاريخ الاستحقاق"
  subtotal · discount_amount · tax_amount · total NUMERIC(18,4)
  paid_amount NUMERIC(18,4)                      ← مشتق من payment_allocations
  notes · locked_at                              ← بعد التأكيد: لا تعديل مباشر
  confirmed_at · confirmed_by · cancelled_at · cancelled_by
  created_at · created_by · updated_at
  INDEX(tenant_id, number) · INDEX(tenant_id, customer_id, issued_at)
  INDEX(tenant_id, status) · INDEX(tenant_id, issued_at)   ← فلترة بالتاريخ

order_items                                ← إدخال يدوي (المتطلب 5)
  id PK · tenant_id · order_id FK
  product_id FK NULLABLE                          ← الكتالوج اختياري
  name TEXT NOT NULL                              ← نص حر
  quantity NUMERIC(12,3) · unit_price NUMERIC(18,4)
  discount NUMERIC(18,4) · tax_rate NUMERIC(5,2)
  line_total NUMERIC(18,4) · sort_order INT

payments
  id PK · tenant_id FK · number UNIQUE per tenant ("PAY-00045")
  customer_id FK · cycle_id FK
  amount NUMERIC(18,4) CHECK (amount > 0)
  method ENUM(CASH|BANK_TRANSFER|CARD|CHECK)
  paid_at TIMESTAMPTZ NOT NULL                    ← تاريخ ووقت الدفعة (المتطلب 10)
  reference · note
  idempotency_key · UNIQUE(tenant_id, idempotency_key)
  status ENUM(POSTED|REVERSED)
  created_at · created_by
  INDEX(tenant_id, customer_id, paid_at) · INDEX(tenant_id, paid_at)

payment_allocations                        ← ★ many-to-many (دفعة واحدة ← عدة طلبات)
  id PK · tenant_id · payment_id FK · order_id FK
  amount NUMERIC(18,4) CHECK (amount > 0)
  UNIQUE(payment_id, order_id)
  ── مستخرج من شاشة "الدفعات": PAY-00042 مربوطة بـ ORD-00084 + ORD-00083

ledger_entries                             ← ★★ APPEND-ONLY — قلب النظام
  id PK · tenant_id FK · customer_id FK · cycle_id FK
  seq BIGSERIAL                                   ← ترتيب مطلق
  entry_type ENUM(OPENING_BALANCE | ORDER_DEBIT | PAYMENT_CREDIT |
                  ADJUSTMENT_DEBIT | ADJUSTMENT_CREDIT | DISCOUNT_CREDIT |
                  REVERSAL | WRITE_OFF | CYCLE_CLOSE)
  direction ENUM(DEBIT|CREDIT)
  amount NUMERIC(18,4) CHECK (amount > 0)         ← دائمًا موجب؛ الاتجاه في direction
  balance_before NUMERIC(18,4) NOT NULL           ← المتطلب: كل حركة تحفظ السابق
  balance_after  NUMERIC(18,4) NOT NULL           ← ...والجديد
  ref_type ENUM(ORDER|PAYMENT|ADJUSTMENT|CYCLE) · ref_id UUID
  reversed_entry_id FK→ledger_entries NULLABLE    ← التصحيح لا الحذف
  reason TEXT                                      ← إلزامي للتعديلات/العكس
  occurred_at TIMESTAMPTZ · created_at · created_by
  idempotency_key · UNIQUE(tenant_id, idempotency_key)
  CHECK (balance_after = balance_before + CASE direction WHEN 'DEBIT' THEN amount ELSE -amount END)
  INDEX(tenant_id, customer_id, seq) · INDEX(tenant_id, occurred_at)
  ⛔ REVOKE UPDATE, DELETE  +  TRIGGER يمنع UPDATE/DELETE

message_templates
  id PK · tenant_id · key ENUM(NEW_ORDER|PAYMENT_RECEIPT|BALANCE_REMINDER|STATEMENT)
  channel ENUM(WHATSAPP|SMS|EMAIL) · locale · subject · body
  ── متغيرات: {{customer_name}} {{order_no}} {{amount}} {{balance}} {{shop_name}}

messages                                   ← صندوق صادر
  id PK · tenant_id · customer_id FK · channel · to_address
  template_key · body_rendered
  status ENUM(QUEUED|SENDING|SENT|DELIVERED|FAILED)
  provider · provider_message_id · attempts · last_error
  created_at · sent_at · created_by

documents                                  ← المستندات المطبوعة/المولّدة
  id PK · tenant_id · type ENUM(ORDER|QUOTE|DRAFT|STATEMENT|RECEIPT)
  ref_type · ref_id · locale ENUM(ar|he|ar_he)
  file_path · file_hash · size_bytes · created_at · created_by

tenant_settings                            ← تبويبات شاشة الإعدادات السبعة
  tenant_id PK FK
  general    JSONB   ── الاسم، الشعار، الهاتف، العنوان، المنطقة الزمنية، اللغة
  financial  JSONB   ── العملة، تنسيق التاريخ، تنسيق الأرقام، الضريبة (تفعيل + نسبة)
  invoicing  JSONB   ── بادئة/لاحقة رقم الفاتورة، رقم البداية، عرض الضريبة، ملاحظات
  printing   JSONB   ── الطابعة، القياس (80mm)، الاتجاه، خيارات (شعار/رقم/تاريخ/باركود)
  messaging  JSONB   ── تفعيل واتساب/SMS/بريد، الأرقام، القوالب، جدولة التنبيهات
  security   JSONB   ── قفل الجلسة التلقائي، المدة، إلزام 2FA
  updated_at · updated_by

audit_logs                                 ← ★ APPEND-ONLY + hash chain
  id PK · tenant_id · seq BIGSERIAL
  actor_user_id · actor_name · actor_ip · user_agent
  action TEXT ("order.confirm", "payment.create", "settings.update", "auth.login")
  entity_type · entity_id
  before JSONB · after JSONB                      ← منقّحة من البيانات الحساسة
  prev_hash CHAR(64) · hash CHAR(64)              ← sha256 chain
  created_at
  ⛔ REVOKE UPDATE, DELETE  +  TRIGGER

idempotency_keys
  id PK · tenant_id · key TEXT · endpoint TEXT
  request_hash CHAR(64) · response_status INT · response_body JSONB
  status ENUM(IN_PROGRESS|COMPLETED) · created_at · expires_at
  UNIQUE(tenant_id, key)

tenant_counters                            ← ترقيم متسلسل لكل محل
  tenant_id · name ('order'|'payment'|'customer'|'invoice')
  value BIGINT · PK(tenant_id, name)
  ── UPDATE ... RETURNING داخل المعاملة (آمن ضد التسابق)
```

### 3.3 العلاقات الأساسية

```
tenants 1───N users, customers, orders, payments, ledger_entries, ...
tenants 1───1 tenant_settings, tenant_usage
tenants 1───N subscriptions ───N platform_invoices
tenants 1───1 subscription (ACTIVE واحد فقط)

customers 1───N orders
customers 1───N payments
customers 1───N account_cycles ───N ledger_entries
customers 1───1 customer_balances (مشتق)

orders 1───N order_items
orders N───M payments  (عبر payment_allocations)   ★
orders 1───1 ledger_entries (عند التأكيد: ORDER_DEBIT)
payments 1───1 ledger_entries (PAYMENT_CREDIT)
ledger_entries 0..1───1 ledger_entries (reversed_entry_id)
```

---

## 4. قائمة الوحدات (Modules)

### Backend — `apps/api/src/modules/`

| # | الوحدة | المسؤولية |
|---|---|---|
| 1 | `core/config` | تحقق متغيّرات البيئة بـ Zod، فشل سريع عند الإقلاع |
| 2 | `core/prisma` | عميل Prisma + امتداد المستأجر + `runInTenantTx()` |
| 3 | `core/tenancy` | `AsyncLocalStorage`، `TenantContext`، `TenantGuard` |
| 4 | `core/logging` | Pino منظّم + تنقيح البيانات الحساسة |
| 5 | `core/errors` | مرشّح استثناءات مركزي + أكواد أخطاء موحّدة |
| 6 | `core/idempotency` | `@Idempotent()` decorator + interceptor |
| 7 | `core/audit` | `AuditService` + hash chain + `audit:verify` |
| 8 | `core/queue` | BullMQ (رسائل، تقارير، مطابقة الأرصدة، نسخ احتياطي) |
| 9 | `core/feature-flags` | أعلام مميزات لكل محل/باقة |
| 10 | `auth` | تسجيل دخول، refresh rotation، 2FA، أقفال، جلسات |
| 11 | `rbac` | `@RequirePermission()` guard + مصفوفة الصلاحيات |
| 12 | `customers` | CRUD، بحث، استيراد، ملف الزبون |
| 13 | `orders` | مسودة/عرض سعر/تأكيد/إلغاء، بنود، ترقيم |
| 14 | `payments` | دفع كامل/جزئي، توزيع على الطلبات، idempotency |
| 15 | `ledger` | القيود، الأرصدة، التصحيحات، العكس، **الدورات** |
| 16 | `reports` | تقارير مالية وتشغيلية + تصدير |
| 17 | `documents` | PDF (طلب/عرض سعر/مسودة/كشف حساب) + قوالب ar/he |
| 18 | `messaging` | واتساب/SMS/بريد + قوالب + صندوق صادر |
| 19 | `employees` | موظفون + أدوار + صلاحيات |
| 20 | `settings` | 7 تبويبات إعدادات المحل |
| 21 | `subscription` | باقة المحل + استخدام + فواتير (عرض للمحل) |
| 22 | `platform` | **Super Admin**: محلات، باقات، اشتراكات، فواتير |
| 23 | `dashboard` | تجميعات لوحة التحكم |
| 24 | `uploads` | رفع الشعار (فحص magic bytes + إعادة ترميز) |
| 25 | `health` | فحوص جاهزية/حياة |

### Frontend — `apps/web/src/`

```
app/            ← Router، providers، حراس المسارات
features/       ← شرائح رأسية: dashboard, customers, orders, payments,
                  ledger, reports, documents, messaging, employees,
                  settings, subscription, platform, auth
components/ui/  ← shadcn/ui معدّلة على نظام التصميم
components/     ← AppShell, Sidebar, Topbar, MobileTabBar, DataTable,
                  KpiCard, StatusPill, MoneyText, FilterBar, EmptyState,
                  Skeletons, ConfirmDialog, Pagination
lib/            ← apiClient، money، i18n، formatters، permissions
```

---

## 5. Routes & Permissions Matrix

### 5.1 الصلاحيات (Permission Strings)

`customers.read` · `customers.write` · `customers.delete`
`orders.read` · `orders.create` · `orders.update` · `orders.confirm` · `orders.cancel`
`payments.read` · `payments.create` · `payments.reverse`
`ledger.read` · `ledger.adjust`
`reports.read` · `reports.export`
`documents.print`
`messages.send` · `messages.read`
`employees.read` · `employees.manage`
`settings.read` · `settings.manage`
`subscription.read` · `subscription.manage`
`audit.read`
`platform.*` (المدير العام فقط)

### 5.2 الأدوار الافتراضية

| الصلاحية | OWNER | MANAGER | CASHIER | VIEWER |
|---|:--:|:--:|:--:|:--:|
| customers.read | ✅ | ✅ | ✅ | ✅ |
| customers.write | ✅ | ✅ | ✅ | ❌ |
| customers.delete | ✅ | ❌ | ❌ | ❌ |
| orders.read | ✅ | ✅ | ✅ | ✅ |
| orders.create | ✅ | ✅ | ✅ | ❌ |
| orders.update *(مسودة/عرض سعر فقط)* | ✅ | ✅ | ✅ | ❌ |
| orders.confirm | ✅ | ✅ | ✅ | ❌ |
| orders.cancel | ✅ | ✅ | ❌ | ❌ |
| payments.read | ✅ | ✅ | ✅ | ✅ |
| payments.create | ✅ | ✅ | ✅ | ❌ |
| **payments.reverse** | ✅ | ❌ | ❌ | ❌ |
| ledger.read | ✅ | ✅ | ✅ | ✅ |
| **ledger.adjust** | ✅ | ❌ | ❌ | ❌ |
| reports.read / export | ✅ | ✅ | ❌ | ✅ / ❌ |
| documents.print | ✅ | ✅ | ✅ | ✅ |
| messages.send | ✅ | ✅ | ✅ | ❌ |
| employees.manage | ✅ | ❌ | ❌ | ❌ |
| settings.manage | ✅ | ❌ | ❌ | ❌ |
| subscription.manage | ✅ | ❌ | ❌ | ❌ |
| audit.read | ✅ | ✅ | ❌ | ❌ |

> العمليات المالية العكسية (`payments.reverse`, `ledger.adjust`) محصورة بـ OWNER — لأنها الأبواب الوحيدة لتغيير رصيد مُثبت.

### 5.3 مسارات API (مختصر)

```
POST   /auth/login                    عام (rate-limited 5/15د/IP+حساب)
POST   /auth/2fa/verify               عام (مقيّد)
POST   /auth/refresh                  cookie + CSRF token
POST   /auth/logout                   authed
GET    /auth/me                       authed

GET    /customers                     customers.read      (بحث/فلترة/صفحات/فرز)
POST   /customers                     customers.write
GET    /customers/:id                 customers.read
PATCH  /customers/:id                 customers.write
GET    /customers/:id/summary         customers.read      ← بطاقات "صفحة كل زبون"
GET    /customers/:id/statement       ledger.read         ← كشف الحساب
POST   /customers/:id/cycles/close    ledger.adjust       ← بدء دورة جديدة (المتطلب 12)

GET    /orders                        orders.read         (فلترة: تاريخ/حالة/زبون/رقم)
POST   /orders                        orders.create       (DRAFT|QUOTE|CONFIRMED)
GET    /orders/:id                    orders.read
GET    /orders/by-number/:number      orders.read         ← المتطلب 13
PATCH  /orders/:id                    orders.update       (DRAFT/QUOTE فقط)
POST   /orders/:id/confirm            orders.confirm      → قيد مدين
POST   /orders/:id/cancel             orders.cancel       → REVERSAL إن كان مؤكدًا
POST   /orders/:id/amend              ledger.adjust       ← تعديل طلب مدفوع = قيد تصحيح

GET    /payments                      payments.read
POST   /payments                      payments.create     ⚠️ Idempotency-Key إلزامي
GET    /payments/:id                  payments.read
POST   /payments/:id/reverse          payments.reverse    → REVERSAL

GET    /ledger                        ledger.read         ← "الحساب والحركات"
GET    /ledger/customer/:id           ledger.read
POST   /ledger/adjustments            ledger.adjust       (سبب إلزامي)

GET    /reports/financial             reports.read
GET    /reports/operational           reports.read
POST   /reports/export                reports.export

POST   /documents/order/:id           documents.print     (locale=ar|he|ar_he)
POST   /documents/statement/:id       documents.print
GET    /documents/:id/download        documents.print

POST   /messages/send                 messages.send
GET    /messages                      messages.read
GET/PUT /messages/templates           settings.manage

GET/POST/PATCH /employees             employees.read/manage
GET/PUT /settings/:section            settings.read/manage
GET    /subscription                  subscription.read
GET    /audit                         audit.read
GET    /dashboard                     authed

── Super Admin (بادئة /platform، حارس منفصل، بلا وصول لبيانات المحلات)
GET/POST/PATCH /platform/tenants
POST   /platform/tenants/:id/suspend
GET/POST/PATCH /platform/plans
GET/POST       /platform/subscriptions
GET/POST       /platform/invoices
```

---

## 6. المخاطر والقرارات التقنية

### 6.1 مخاطر عالية

| # | الخطر | الأثر | التخفيف |
|---|---|---|---|
| R1 | **تسرّب بيانات بين المحلات** | كارثي — انتهاك ثقة | 4 طبقات (§2.2)؛ **اختبارات تكاملية صريحة** تحاول قراءة بيانات محل آخر وتتوقع 0 صفوف |
| R2 | **فقدان دقة مالية** | فساد أرصدة صامت | `NUMERIC` + `Decimal` + **نقل نصي** + قاعدة ESLint تمنع `number` للمبالغ |
| R3 | **دفعة مزدوجة** | خسارة مالية مباشرة | Idempotency-Key + `UNIQUE` على الدفعة والقيد + قفل استشاري |
| R4 | **سباق على `balance_before/after`** | دفتر مكسور بصمت | `pg_advisory_xact_lock` لكل زبون + `CHECK` على المعادلة داخل الجدول |
| R5 | **RLS + connection pooling** | GUC يتسرب بين الطلبات | `set_config(..., true)` = **transaction-scoped**؛ كل طلب داخل معاملة؛ اختبار تسرّب صريح |
| R6 | **تشكيل عربي/عبري في PDF** | مستندات غير مقروءة → غير قابلة للاستخدام | Chromium (تخطيط حقيقي) + خطوط مُضمّنة؛ اختبار لقطة بصرية للـPDF |
| R7 | **معاملة لكل طلب HTTP** | استهلاك اتصالات تحت الحمل | مهلات قصيرة (`timeout: 5s`)، Neon pooler، مراقبة؛ قابل للتحسين لاحقًا بمسار قراءة منفصل |

### 6.2 مخاطر متوسطة

| # | الخطر | التخفيف |
|---|---|---|
| R8 | Neon سحابي = زمن استجابة أعلى من محلي | مقبول للتطوير؛ توثيق تشغيل الإنتاج بـ Postgres مُدار قريب |
| R9 | واتساب Business API يتطلب حسابًا معتمدًا | واجهة `MessageProvider` + `LogProvider` للتطوير؛ لا يحجب التسليم |
| R10 | 5 شاشات بلا مرجع بصري | اشتقاق صارم من `docs/01-design-system.md` + عرضها عليك للمراجعة |
| R11 | RTL في Recharts | محاور `reversed` + اختبار بصري |
| R12 | لا Docker → لا اختبارات مع حاويات معزولة | قاعدة بيانات اختبار منفصلة على Neon + `TRUNCATE` بين الاختبارات |

### 6.3 قرارات تقنية مُتخذة (ADR مختصرة)

| # | القرار | البديل المرفوض | السبب |
|---|---|---|---|
| D1 | NestJS | Express | DI + Guards + Modules مطلوبة بنيويًا |
| D2 | RLS في Postgres | فلترة بالتطبيق فقط | خطأ برمجي واحد = تسرّب؛ RLS حارس مستقل |
| D3 | Ledger مصدر الحقيقة، الرصيد ذاكرة مؤقتة | حقل `balance` قابل للتعديل | متطلبك الصريح + قابلية التدقيق |
| D4 | نقل المبالغ كنصوص | أرقام JSON | IEEE-754 يفسد الأموال بلا رجعة |
| D5 | `payment_allocations` (N:M) | `payment.order_id` (1:N) | **مستخرج من الصورة**: PAY-00042 → طلبان |
| D6 | Chromium لتوليد PDF | pdfkit / react-pdf | تشكيل العربية/العبرية |
| D7 | Recharts | ECharts | حجم أصغر بـ10× ورسوم التصميم بسيطة |
| D8 | الشريط الجانبي الداكن | الفاتح (شاشة الرئيسية) | 8 من 10 شاشات + كل شاشات الموبايل |
| D9 | Super Admin بلا وصول لبيانات المحلات | وصول كامل | «عزل كامل» — تقليل السطح |
| D10 | حذف أعمدة الخدمات/المواعيد من شاشة الموظفين | تنفيذها | خارج المتطلبات (قرار المستخدم) — يخالف «لا أزرار لا تعمل» |

---

## 7. المراحل والبوابات

كل مرحلة لا تُغلق إلا بعد: **Lint ✅ · Typecheck ✅ · Unit ✅ · Integration ✅ · Build ✅ · A11y ✅ · Security review ✅**

| المرحلة | المحتوى | البوابة الحرجة |
|---|---|---|
| **P1** | Monorepo، أدوات، تحقق البيئة، `@oh/money`، `@oh/contracts`، نظام التصميم (tokens + AppShell + Sidebar + Topbar) | اختبارات `@oh/money` (تقريب، جمع، قسمة) |
| **P2** | مخطط Prisma، هجرات، **RLS + triggers**، أدوار DB، seed | **اختبارات تسرّب بين المحلات** |
| **P3** | Auth: دخول، refresh rotation، 2FA، rate limit، جلسات، audit | اختبارات brute-force و reuse-detection |
| **P4** | الزبائن (قائمة + ملف) + الطلبات (مسودة/عرض سعر/تأكيد) + قيد مدين | اختبار: تأكيد الطلب يولّد قيدًا واحدًا بالضبط |
| **P5** | الدفعات + التوزيع + **Idempotency** + دورات الحساب | اختبار: طلبان متزامنان بنفس المفتاح → دفعة واحدة |
| **P6** | الحساب والحركات + التقارير + المستندات/الطباعة (ar/he) | اختبار بصري لـPDF العربي/العبري |
| **P7** | الرسائل (واتساب/SMS/بريد) + BullMQ | اختبار إعادة المحاولة والفشل |
| **P8** | الموظفون + الصلاحيات + الإعدادات (7 تبويبات) + سجل النشاط | اختبار: كل مسار محمي يرفض بلا صلاحية |
| **P9** | لوحة المدير العام: محلات، باقات، اشتراكات، فواتير | اختبار: super admin لا يصل لبيانات محل |
| **P10** | صقل الواجهة، وصولية، E2E، مراجعة أمنية، نسخ احتياطي/استعادة | Playwright E2E + axe + OWASP checklist |

---

## 8. الملفات التي ستُنشأ في المرحلة 1

```
جديد:
  package.json · tsconfig.base.json · .gitignore · .env.example
  .editorconfig · eslint.config.js · .prettierrc
  packages/money/{package.json,tsconfig.json,src/index.ts,src/money.ts,src/rounding.ts,src/money.test.ts}
  packages/contracts/{package.json,tsconfig.json,src/index.ts,src/common.ts,src/money.schema.ts}
  apps/api/{package.json,tsconfig.json,nest-cli.json,src/main.ts,src/app.module.ts,src/core/config/env.ts}
  apps/web/{package.json,tsconfig.json,vite.config.ts,index.html,tailwind.config.ts,
            src/main.tsx,src/app/App.tsx,src/styles/tokens.css,src/styles/globals.css,
            src/components/layout/{AppShell,Sidebar,Topbar,MobileTabBar}.tsx,
            src/components/ui/*, src/lib/{i18n,money,cn}.ts,
            src/locales/{ar,he,en}.json}
  docs/01-design-system.md · docs/adr/*.md

معدّل: لا شيء (المشروع فارغ)
محذوف: لا شيء
```

---

## 9. عقد التصميم البصري (ملخص — التفصيل في `docs/01-design-system.md`)

| الرمز | القيمة | الاستخدام |
|---|---|---|
| `--sidebar-bg` | `#0B1220` navy داكن | الشريط الجانبي الأيمن |
| `--sidebar-active` | `#1D4ED8` | العنصر النشط (كتلة كاملة) |
| `--brand` | `#15803D` / `#16A34A` | الشعار، أزرار الحفظ، «إضافة طلب جديد» |
| `--accent` | `#1D4ED8` | الروابط، «تسجيل دفعة»، «إضافة زبون» |
| `--danger` | `#DC2626` | الديون، المبالغ المدينة، «ملغي» |
| `--success` | `#16A34A` | المقبوضات، «مدفوع» |
| `--warning` | `#F59E0B` | «مدفوع جزئيًا» |
| `--bg` | `#F8FAFC` | خلفية الصفحة |
| `--card` | `#FFFFFF` | البطاقات |
| `--border` | `#E2E8F0` | الحدود |
| نصف القطر | بطاقات `12px` · أزرار/حقول `10px` · شارات `6px` | |
| الظل | `0 1px 3px rgba(16,24,40,.10), 0 1px 2px rgba(16,24,40,.06)` | |
| الخط | `IBM Plex Sans Arabic` (ar) · `Noto Sans Hebrew` (he) — **مُستضاف ذاتيًا** | |
| الأرقام | `font-variant-numeric: tabular-nums` | كل المبالغ |
| الاتجاه | `dir="rtl"` + خصائص منطقية (`ps-*`, `me-*`) — **لا `left/right` مباشرة** | |

**التخطيط:** شريط جانبي أيمن ثابت `260px` (داكن) · شريط علوي `72px` (أبيض، بحث مركزي) · محتوى `#F8FAFC`.
**الموبايل:** شريط تبويب سفلي (5 عناصر) + زر عائم أخضر مركزي «طلب جديد» + قائمة جانبية منزلقة + بطاقات بدل الجداول.

---

*نهاية المرحلة 0 — بانتظار الموافقة لبدء المرحلة 1.*
