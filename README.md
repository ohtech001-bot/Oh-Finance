# Oh-Finance

نظام SaaS متعدد المحلات لإدارة الزبائن والطلبات الآجلة والدفعات والديون ودفتر الحركات المالية.

**الحالة:** المرحلة 1 مكتملة (الأساس). المراحل 2–10 قيد التخطيط.

---

## المبادئ الحاكمة

قبل أي كود، هذه القواعد غير قابلة للتفاوض:

| القاعدة | كيف تُفرض |
|---|---|
| **لا `number` للأموال** | نوع `MoneyString` + قواعد ESLint تمنع `.toFixed()` و`parseFloat` و`Math.round` |
| **المستأجر من الجلسة فقط** | `JwtAuthGuard` هو المكان الوحيد الذي يُضبط فيه — لا body، لا query، لا header |
| **العزل تفرضه قاعدة البيانات** | RLS + دور تطبيق بلا `BYPASSRLS`. خطأ برمجي ⇒ صفر صفوف، لا كل الصفوف |
| **لا حذف لحركة مالية** | `REVOKE UPDATE, DELETE` + trigger. التصحيح بقيد عكس |
| **لا Mock UI ولا زر ميت** | الشاشات غير الجاهزة تعرض حالة «قيد التطوير» صريحة — لا أرقام مخترعة |

التفصيل: [`docs/00-architecture-plan.md`](docs/00-architecture-plan.md) · [`docs/adr/`](docs/adr/)

---

## التشغيل السريع

### 1. المتطلبات

- **Node.js ≥ 20.11** (مطوَّر ومُختبَر على 24)
- **PostgreSQL 16** — سحابي (Neon/Supabase) أو محلي
- Redis — اختياري في التطوير، **إلزامي في الإنتاج**

### 2. التثبيت

```bash
npm install
```

> يولّد `postinstall` أنواع Prisma تلقائيًا. **لا يحتاج قاعدة بيانات** — لو غاب `DATABASE_URL` يُستخدم عنوان نائب للتوليد فقط، بلا أي اتصال.

### 3. البيئة

```bash
cp .env.development.example .env.development
```

ثم املأ في `.env.development`:

```bash
# ولّد كل سر بأمر:
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

| المتغيّر | إلزامي | الوصف |
|---|:--:|---|
| `DATABASE_URL` | ✅ | اتصال **pooled** — يستخدمه التطبيق |
| `DIRECT_DATABASE_URL` | ✅ | اتصال **مباشر** — للهجرات فقط (Prisma لا يهاجر عبر pooler) |
| `JWT_ACCESS_SECRET` | ✅ | ≥32 حرفًا. **مختلف** عن سر التجديد |
| `JWT_REFRESH_SECRET` | ✅ | ≥32 حرفًا |
| `COOKIE_SECRET` | ✅ | ≥32 حرفًا |
| `REDIS_URL` | إنتاج | حدود المعدل بالذاكرة لا تعمل عبر عدة نسخ |
| `WEB_ORIGIN` | — | افتراضي `http://localhost:5173` |
| `DEFAULT_CURRENCY` | — | افتراضي `ILS` |
| `DEFAULT_LOCALE` | — | افتراضي `ar` |
| `COOKIE_SECURE` | إنتاج | **`true` إلزامي** في الإنتاج |

> الخادم **يرفض الإقلاع** بإعداد ناقص أو ضعيف، ويطبع قائمة واضحة بما ينقص. هذا مقصود: خادم مالي بسر افتراضي ضعيف أسوأ من خادم لا يعمل.

### 4. قاعدة البيانات

```bash
npm run db:check        # يتحقق من المتغيّرات ويشرح ما ينقص
npm run db:migrate:dev  # يطبّق الهجرات (بما فيها RLS)
npm run db:seed         # المدير العام + محل النجاح + الباقات
```

> البذر يتطلب `SEED_SUPER_ADMIN_EMAIL/PASSWORD` و`SEED_OWNER_EMAIL/PASSWORD` في البيئة. **لا كلمات مرور افتراضية** — ولا حتى في التطوير.

### 5. التشغيل

```bash
npm run dev          # الخادم (3001) + الواجهة (5173) معًا
npm run dev:api      # الخادم فقط
npm run dev:web      # الواجهة فقط
```

- الواجهة: http://localhost:5173
- الـAPI: http://localhost:3001/api
- التوثيق: http://localhost:3001/api/docs (غير الإنتاج فقط)

---

## بلا قاعدة بيانات؟

**معظم المشروع يعمل.** هذا مقصود ومُختبَر:

| الأمر | يحتاج قاعدة بيانات؟ |
|---|:--:|
| `npm run lint` | ❌ |
| `npm run typecheck` | ❌ |
| `npm run test` | ❌ (اختبارات التكامل تتخطى نفسها برسالة واضحة) |
| `npm run build` | ❌ |
| `npm run test:e2e` | ❌ (تختبر الواجهة بلا خادم) |
| `npm run dev:web` | ❌ (الواجهة تُعرض؛ الطلبات تفشل بأناقة) |
| `npm run db:*` | ✅ |
| `npm run dev:api` | ✅ |

أوامر قاعدة البيانات **لا تنهار برسالة غامضة** — تشرح ما ينقص وكيف يُضاف.

---

## الأوامر

### الجودة

```bash
npm run lint          # ESLint — 0 تحذيرات مسموحة
npm run typecheck     # TypeScript strict عبر كل الحزم
npm run test          # كل اختبارات الوحدة والتكامل
npm run test:e2e      # Playwright (منفذ 5199 — معزول عن التطوير)
npm run build         # بناء إنتاجي كامل
npm run verify        # الأربعة معًا
```

### قاعدة البيانات

```bash
npm run db:check         # تحقق من المتغيّرات
npm run db:generate      # توليد أنواع Prisma
npm run db:migrate:dev   # هجرة (تطوير)
npm run db:migrate       # هجرة (إنتاج — deploy)
npm run db:seed          # بذور (آمنة لإعادة التشغيل)
npm run db:studio        # واجهة Prisma
npm run db:gen-init-sql  # توليد SQL بلا اتصال بقاعدة بيانات
```

---

## البنية

```
oh-finance/
├─ apps/
│  ├─ api/          NestJS · Prisma · PostgreSQL · RLS
│  └─ web/          React 19 · Vite · Tailwind · TanStack Query
├─ packages/
│  ├─ money/        Decimal + تقريب موحّد + توزيع بلا فقدان فلس
│  ├─ contracts/    عقود Zod مشتركة — مصدر أنواع الطرفين
│  ├─ config/       صلاحيات · أدوار · لغات · تحقق البيئة
│  ├─ ui/           نظام التصميم (مستخرج من /ui)
│  ├─ eslint-config/
│  └─ typescript-config/
├─ docs/            الخطة المعمارية · نظام التصميم · ADRs
├─ tooling/         سكربتات الأدوات
└─ ui/              📷 المرجع البصري الإلزامي — لا يُمس
```

---

## الأمان — ما هو مُنفَّذ فعلًا

| البند | التنفيذ |
|---|---|
| تجزئة كلمات المرور | Argon2id (m=64MiB, t=3, p=4) |
| تخزين الرموز | كوكيز HttpOnly — **لا localStorage** |
| CSRF | Double-submit + `SameSite` |
| تدوير رمز التجديد | مع كشف إعادة الاستخدام ⇒ إبطال عائلة الجلسة |
| منع تعداد المستخدمين | رسالة موحّدة **+ زمن موحّد** (هاش وهمي) |
| حماية من التخمين | حد معدل (IP) + قفل حساب |
| عزل المستأجرين | RLS + دور بلا `BYPASSRLS` |
| سجل التدقيق | append-only + سلسلة هاش sha256 |
| التحقق من المدخلات | Zod على **كل** مسار |
| ترويسات الأمان | Helmet + CSP + HSTS |
| تنقيح السجلات | كلمات المرور والرموز والأسرار |
| Stack traces | **لا تُكشف** في الإنتاج |

التفصيل: [`docs/adr/0007`](docs/adr/0007-authentication-strategy.md) · [`docs/adr/0001`](docs/adr/0001-multi-tenancy-and-rls.md)

---

## اللغات

العربية (افتراضية) · العبرية · الإنجليزية.

RTL للعربية والعبرية، LTR للإنجليزية — يُضبط على `<html>` فتنعكس كل الخصائص المنطقية في Tailwind تلقائيًا.

> **ممنوع** استخدام أصناف اتجاهية فيزيائية (`ml-`, `pr-`, `text-left`, `border-l`) — قاعدة ESLint تمنع البناء. البدائل المنطقية: `ms-`, `pe-`, `text-start`, `border-s`.

---

## نقاط التوقف المدعومة

`1536` · `1440` · `1280` · `1024` · `768` · `430` · `390` · `360`

كلها مُختبَرة في Playwright — الفحص الحاسم: **لا تمرير أفقي للصفحة** عند أي عرض.
