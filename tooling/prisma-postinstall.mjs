#!/usr/bin/env node
/**
 * postinstall — توليد Prisma Client بنسخة المشروع المثبّتة محليًا فقط.
 *
 * ── قاعدتان صارمتان ────────────────────────────────────────────────────────
 * 1. **نشر الويب لا يشغّل Prisma إطلاقًا.** إن ضُبط `SKIP_PRISMA_GENERATE=1`
 *    (كما في `apps/web/vercel.json`) نخرج فورًا دون لمس Prisma.
 * 2. **لا نثبّت أبدًا نسخة Prisma أخرى.** نستعمل الثنائي المثبّت محليًا حصرًا
 *    (`node_modules/.bin/prisma` = نسخة المشروع). لا `npx` تنزيل — فلا ينزلق
 *    إصدار أحدث (مثل 7.x) بديلًا عن المثبّت (6.x). إن لم يكن مثبّتًا، نتخطّى
 *    بهدوء بلا أي تثبيت.
 *
 * `prisma generate` يقرأ DATABASE_URL لتحليل الـschema (بلا اتصال). إن غاب،
 * نمرّر عنوانًا نائبًا — تُولَّد الأنواع بنجاح دون أي شبكة.
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

if (process.env.SKIP_PRISMA_GENERATE === '1') {
  console.log('↷ postinstall: تخطّي prisma generate (SKIP_PRISMA_GENERATE=1) — نشر الويب لا يحتاج Prisma.');
  process.exit(0);
}

const bin = process.platform === 'win32' ? 'prisma.cmd' : 'prisma';
const localPrisma = resolve(ROOT, 'node_modules', '.bin', bin);

if (!existsSync(localPrisma)) {
  console.log('↷ postinstall: Prisma غير مثبّت في هذه المجموعة — تخطّي التوليد (بلا تثبيت أي نسخة).');
  process.exit(0);
}

const schema = resolve(ROOT, 'apps/api/prisma/schema.prisma');
const PLACEHOLDER = 'postgresql://placeholder:placeholder@localhost:5432/placeholder';

const result = spawnSync(localPrisma, ['generate', '--schema', schema], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: {
    ...process.env,
    DATABASE_URL: process.env.DATABASE_URL || PLACEHOLDER,
    DIRECT_DATABASE_URL: process.env.DIRECT_DATABASE_URL || PLACEHOLDER,
  },
});

process.exit(result.status ?? 1);
