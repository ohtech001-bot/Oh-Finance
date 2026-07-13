#!/usr/bin/env node
/**
 * احتياطي postinstall.
 *
 * `prisma generate` يحتاج DATABASE_URL موجودًا في البيئة (حتى لو لم يتصل بها).
 * إن غاب المتغيّر عند التثبيت الأول، نعيد المحاولة بعنوان نائب — لا يُستخدم
 * للاتصال إطلاقًا، فقط ليجتاز Prisma تحليل الـ schema ويولّد الأنواع.
 * بدون هذه الخطوة يفشل `typecheck` لأن @prisma/client غير مولَّد.
 */
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const SCHEMA = resolve(ROOT, 'apps/api/prisma/schema.prisma');

// عنوان نائب صريح — لا يُفتح أي اتصال أثناء `generate`.
const PLACEHOLDER = 'postgresql://placeholder:placeholder@localhost:5432/placeholder';

console.warn(
  '\n⚠  DATABASE_URL غير مضبوط — يتم توليد Prisma Client بعنوان نائب (بلا اتصال).\n' +
    '   الأنواع ستُولَّد بنجاح. لاستخدام قاعدة حقيقية: انظر .env.development.example\n',
);

const result = spawnSync('npx', ['prisma', 'generate', '--schema', SCHEMA], {
  stdio: 'inherit',
  shell: true,
  env: {
    ...process.env,
    DATABASE_URL: process.env.DATABASE_URL || PLACEHOLDER,
    DIRECT_DATABASE_URL: process.env.DIRECT_DATABASE_URL || PLACEHOLDER,
  },
});

process.exit(result.status ?? 1);
