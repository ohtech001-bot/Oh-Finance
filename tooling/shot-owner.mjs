#!/usr/bin/env node
/**
 * لقطات شاشات المالك — يسجّل الدخول فعليًا ثم يلتقط الصفحات الأربع.
 * يتطلب الخادم (3001) والواجهة (5173) قيد التشغيل.
 *   node tooling/shot-owner.mjs <outDir> <email> <password>
 */
import { chromium } from '@playwright/test';
import { resolve } from 'node:path';
import { mkdirSync } from 'node:fs';

const OUT = process.argv[2] ?? resolve(import.meta.dirname, '../.screenshots');
const EMAIL = process.argv[3];
const PASSWORD = process.argv[4];
const BASE = 'http://localhost:5173';

mkdirSync(OUT, { recursive: true });

const PAGES = [
  { name: 'owner-01-customers', path: '/customers' },
  { name: 'owner-02-orders', path: '/orders' },
  { name: 'owner-03-payments', path: '/payments' },
  { name: 'owner-04-ledger', path: '/ledger' },
];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, locale: 'ar' });

try {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.getByRole('textbox', { name: 'البريد الإلكتروني', exact: true }).fill(EMAIL);
  await page.getByRole('textbox', { name: 'كلمة المرور', exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'دخول' }).click();

  // ننتظر مغادرة صفحة الدخول (نجاح المصادقة).
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 15000 });
  await page.waitForTimeout(1500);
  console.log('✓ logged in as', EMAIL);

  for (const p of PAGES) {
    await page.goto(`${BASE}${p.path}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1800); // ننتظر جلب البيانات
    await page.screenshot({ path: resolve(OUT, `${p.name}.png`) });
    console.log('✓', p.name);
  }
} catch (error) {
  console.error('✗', error.message);
  await page.screenshot({ path: resolve(OUT, 'owner-error.png') });
} finally {
  await browser.close();
}
