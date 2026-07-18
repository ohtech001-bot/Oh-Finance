#!/usr/bin/env node
/**
 * تشغيل أوامر Prisma على قاعدة الاختبار (Test DB) دون خطوات يدوية ولا تعديل
 * متغيّرات الصدفة الهشّ.
 *
 * ── لماذا هذا السكربت؟ ─────────────────────────────────────────────────────
 * datasource يستخدم `url = env("DATABASE_URL")` و`directUrl =
 * env("DIRECT_DATABASE_URL")`، وأوامر `migrate` تستعمل **directUrl**. ملف
 * الجذر `.env` يضبط الاثنين لقاعدة التطوير، فلا يكفي تصدير `DATABASE_URL` وحده
 * لتحويل `migrate` إلى قاعدة الاختبار (كان يظل على directUrl التطوير).
 *
 * هنا نقرأ `TEST_DATABASE_URL` و`TEST_DIRECT_DATABASE_URL` من `.env.test` ونمرّرهما
 * كـ`DATABASE_URL`/`DIRECT_DATABASE_URL` للعملية الفرعية. Prisma لا يتجاوز متغيّرات
 * البيئة المضبوطة مسبقًا، فتُستعمل قيم الاختبار.
 *
 * الاستخدام:
 *   node tooling/prisma-test-db.mjs migrate status
 *   node tooling/prisma-test-db.mjs migrate deploy
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const envTest = resolve(ROOT, '.env.test');

if (!existsSync(envTest)) {
  console.error('✖ .env.test غير موجود — لا يمكن استهداف قاعدة الاختبار.');
  process.exit(1);
}

const vars = {};
for (const raw of readFileSync(envTest, 'utf8').split('\n')) {
  const line = raw.trim();
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
  vars[key] = value;
}

const url = vars.TEST_DATABASE_URL;
const directUrl = vars.TEST_DIRECT_DATABASE_URL ?? url;

if (!url) {
  console.error('✖ TEST_DATABASE_URL غير مضبوط في .env.test.');
  process.exit(1);
}

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('الاستخدام: node tooling/prisma-test-db.mjs <prisma args…>');
  console.error('مثال:    node tooling/prisma-test-db.mjs migrate status');
  process.exit(1);
}

const host = (() => {
  try {
    return new URL(url).host;
  } catch {
    return '(غير قابل للتحليل)';
  }
})();
console.error(`▶ Prisma على قاعدة الاختبار: ${host}\n`);

const schema = resolve(ROOT, 'apps/api/prisma/schema.prisma');
const result = spawnSync('npx', ['prisma', ...args, '--schema', schema], {
  stdio: 'inherit',
  env: { ...process.env, DATABASE_URL: url, DIRECT_DATABASE_URL: directUrl },
  shell: process.platform === 'win32',
});

process.exit(result.status ?? 1);
