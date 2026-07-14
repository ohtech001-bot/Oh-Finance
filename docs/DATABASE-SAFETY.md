# سلامة قاعدة البيانات — أخطاء وقعت فعلًا

> ملف تشغيلي. كل بند هنا حدث في هذا المشروع، وكلّفنا وقتًا أو بيانات.

---

## 1. ⛔ لا تمرّر قاعدة حقيقية كـ `--shadow-database-url`

**ما حدث:** مرّرنا قاعدة التطوير الحقيقية كقاعدة ظل لأمر `prisma migrate diff`.
Prisma **يُفرِّغ قاعدة الظل** (drop schema) ثم يعيد تشغيل الهجرات عليها ليتأكد
أنها قابلة للتطبيق من الصفر.

**النتيجة:** كل بيانات قاعدة التطوير مُحيت. (نجونا: كانت بيانات بذور فقط.)

**القاعدة:** قاعدة الظل **تُدمَّر بالتصميم**. لا تشير إليها إلا بقاعدة فارغة
مخصّصة لهذا الغرض، أو اتركها لـPrisma لينشئها بنفسه.

```bash
# ⛔ خطر — يمحو القاعدة
prisma migrate diff --shadow-database-url "$DIRECT_DATABASE_URL" ...

# ✅ آمن — يقارن بلا كتابة
prisma migrate diff --from-url "$DIRECT_DATABASE_URL" --to-schema-datamodel schema.prisma --script
```

---

## 2. ⛔ `prisma migrate dev` يلغي أي SQL خام لا يعرفه (drift)

**ما حدث:** كتبنا في هجرة يدوية:
- `ALTER TABLE users ALTER COLUMN email TYPE citext`
- `CREATE UNIQUE INDEX audit_logs_tenant_seq_key`

ثم شغّل أحدهم `prisma migrate dev`. فقارن Prisma القاعدة بـ`schema.prisma`،
لم يجد فيه citext ولا الفهرس الفريد، فاعتبرهما **انحرافًا** وألغاهما:

```sql
DROP INDEX "audit_logs_tenant_seq_key";
ALTER TABLE "users" ALTER COLUMN "email" SET DATA TYPE VARCHAR(254);
```

**الأثر:** البريد الإلكتروني صار حسّاسًا لحالة الأحرف — `Owner@x.com` و
`owner@x.com` حسابان منفصلان. ثغرة صامتة، لم يلحظها أحد.

### القاعدة الحاكمة

| النوع | المكان الصحيح | ينجو من `migrate dev`؟ |
|---|---|:--:|
| أعمدة، أنواع، فهارس، تفرّد، مفاتيح أجنبية | **`schema.prisma`** | — |
| سياسات RLS | SQL خام | ✅ |
| Triggers ودوال | SQL خام | ✅ |
| `GRANT` / `REVOKE` | SQL خام | ✅ |
| قيود `CHECK` | SQL خام | ✅ |
| فهارس جزئية (`WHERE ...`) | SQL خام | ✅ |
| امتدادات (`CREATE EXTENSION`) | SQL خام | ✅ |
| **أنواع مخصّصة (citext)** | ⚠️ **تجنّبها** | ❌ **يُلغى** |

**إن احتجت سلوكًا لا يعبّر عنه Prisma:** حقّقه بطريقة **مقاومة للانحراف**.
مثالنا: بدل `citext`، نطبّع البريد إلى أحرف صغيرة في Zod، ونضيف قيد
`CHECK (email = lower(email))` — وPrisma لا يمس قيود CHECK.

---

## 3. ✅ `prisma migrate reset` محظور على الوكلاء

Prisma يرفض تنفيذه إن اكتشف أن المُنفِّذ وكيل AI، ويطلب موافقة صريحة من
الإنسان. **حاجز صحيح.** لا تلتفّ عليه.

**البديل غير المدمِّر** عند فقدان `_prisma_migrations` مع بقاء الجداول:

```bash
prisma migrate resolve --applied <اسم كل هجرة مطبَّقة>
prisma migrate deploy
```

---

## 4. ⛔ لا أسرار في ملفات `.env.*.example`

هذه الملفات **متتبَّعة في git**. أي قيمة حقيقية توضع فيها تدخل التاريخ
للأبد — ولا يمحوها حذفها لاحقًا.

القيم الحقيقية في `.env` و `.env.development` و `.env.test` (كلها مُستبعَدة
بـ`.gitignore`). القوالب تحمل **أشكالًا** فقط.

---

## 5. RLS تُخفي البيانات عن أدوات الفحص أيضًا

استعلام مباشر بلا سياق مستأجر يعيد **صفر صفوف** — حتى لمالك القاعدة
(`FORCE ROW LEVEL SECURITY`). هذا ليس فقدان بيانات.

للفحص اليدوي:

```sql
BEGIN;
SELECT set_config('app.is_platform', 'on', true);   -- سياق المنصة
-- أو: SELECT set_config('app.tenant_id', '<uuid>', true);
SELECT * FROM customers;
COMMIT;
```
