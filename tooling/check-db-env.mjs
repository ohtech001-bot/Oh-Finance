#!/usr/bin/env node
/**
 * حارس متغيّرات قاعدة البيانات.
 *
 * الغرض: بدل أن ينهار `prisma migrate` برسالة غامضة (أو أسوأ: يحاول الاتصال
 * بـ localhost ويعلّق)، نتحقق أولًا ونطبع رسالة عربية واضحة تشرح ما ينقص وكيف يُضاف.
 *
 * الاستخدام:  node tooling/check-db-env.mjs [migrate|seed|studio]
 * الخروج:     0 = كل شيء جاهز | 1 = متغيّرات ناقصة (مع شرح)
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const command = process.argv[2] ?? 'check';

/** يحمّل .env يدويًا (بلا اعتماد على dotenv في مرحلة ما قبل التثبيت). */
function loadEnvFile(name) {
  const path = resolve(ROOT, name);
  if (!existsSync(path)) return {};
  const out = {};
  for (const rawLine of readFileSync(path, 'utf8').split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (value) out[key] = value;
  }
  return out;
}

const fileEnv = {
  ...loadEnvFile('.env'),
  ...loadEnvFile('.env.development'),
};
const env = { ...fileEnv, ...process.env };

const REQUIRED = {
  migrate: ['DATABASE_URL', 'DIRECT_DATABASE_URL'],
  seed: ['DATABASE_URL'],
  studio: ['DATABASE_URL'],
  check: ['DATABASE_URL', 'DIRECT_DATABASE_URL'],
};

const needed = REQUIRED[command] ?? REQUIRED.check;
const missing = needed.filter((key) => !env[key] || env[key].trim() === '');

const RESET = '\x1b[0m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const GREEN = '\x1b[32m';
const DIM = '\x1b[2m';

if (missing.length === 0) {
  const invalid = needed.filter((key) => !/^postgres(ql)?:\/\//.test(env[key]));
  if (invalid.length > 0) {
    console.error(
      `${RED}✗ متغيّرات موجودة لكن بصيغة غير صالحة:${RESET} ${invalid.join(', ')}\n` +
        `  يجب أن تبدأ بـ postgresql://  — المزوّد PostgreSQL ولا يُستبدل.`,
    );
    process.exit(1);
  }
  console.log(`${GREEN}✓${RESET} متغيّرات قاعدة البيانات جاهزة (${needed.join(', ')})`);
  process.exit(0);
}

const hasEnvFile = existsSync(resolve(ROOT, '.env')) || existsSync(resolve(ROOT, '.env.development'));

console.error(`
${YELLOW}────────────────────────────────────────────────────────────────${RESET}
${RED}✗ قاعدة البيانات غير مُهيّأة — الأمر «${command}» يحتاجها.${RESET}
${YELLOW}────────────────────────────────────────────────────────────────${RESET}

  متغيّرات ناقصة:  ${RED}${missing.join(', ')}${RESET}
  ملف البيئة:      ${hasEnvFile ? `${GREEN}موجود${RESET} لكن القيم فارغة` : `${RED}غير موجود${RESET}`}

  ${DIM}هذا ليس خطأً في الكود.${RESET} بقية المشروع (البناء، الفحص، اختبارات
  الوحدة، الواجهة) يعمل بالكامل بدون قاعدة بيانات.

  ${GREEN}للتهيئة:${RESET}

    1) أنشئ قاعدة PostgreSQL (Neon / Supabase / خادم خاص).

    2) انسخ القالب:
       ${DIM}cp .env.development.example .env.development${RESET}

    3) املأ في .env.development:
       ${DIM}DATABASE_URL${RESET}         ← رابط pooled (للتطبيق)
       ${DIM}DIRECT_DATABASE_URL${RESET}  ← رابط مباشر (للهجرات فقط)

    4) شغّل:
       ${DIM}npm run db:migrate:dev && npm run db:seed${RESET}

  ${YELLOW}⚠${RESET}  المزوّد PostgreSQL حصرًا. لا SQLite ولا بدائل — النظام يعتمد على
     RLS و NUMERIC و advisory locks، وكلها غير متوفرة في SQLite.
`);

process.exit(1);
