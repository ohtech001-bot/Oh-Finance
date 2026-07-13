#!/usr/bin/env node
/**
 * يولّد SQL الهجرة الأولية من schema.prisma — **بلا اتصال بأي قاعدة بيانات**.
 *
 * `prisma migrate diff --from-empty --to-schema-datamodel` يعمل بالكامل دون اتصال:
 * يقارن schema فارغًا بـ schema الملف ويُخرج SQL. المتغيّر النائب مطلوب فقط
 * لأن Prisma يرفض تحليل الملف بلا datasource url — ولا يُفتح به أي اتصال.
 *
 * هذا يسمح بمراجعة الـSQL وتثبيته في git قبل توفر قاعدة بيانات.
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const SCHEMA = resolve(ROOT, 'apps/api/prisma/schema.prisma');
const OUT_DIR = resolve(ROOT, 'apps/api/prisma/migrations/0001_init');
const PLACEHOLDER = 'postgresql://placeholder:placeholder@localhost:5432/placeholder';

const result = spawnSync(
  'npx',
  [
    'prisma',
    'migrate',
    'diff',
    '--from-empty',
    '--to-schema-datamodel',
    SCHEMA,
    '--script',
  ],
  {
    encoding: 'utf8',
    shell: true,
    env: {
      ...process.env,
      DATABASE_URL: process.env.DATABASE_URL || PLACEHOLDER,
      DIRECT_DATABASE_URL: process.env.DIRECT_DATABASE_URL || PLACEHOLDER,
    },
  },
);

if (result.status !== 0) {
  console.error('✗ فشل توليد SQL:\n', result.stderr || result.stdout);
  process.exit(1);
}

mkdirSync(OUT_DIR, { recursive: true });
const target = resolve(OUT_DIR, 'migration.sql');
writeFileSync(target, result.stdout, 'utf8');

console.log(`✓ تم توليد الهجرة الأولية: ${target}`);
console.log(`  (${result.stdout.split('\n').length} سطر SQL — راجعها قبل التثبيت)`);
