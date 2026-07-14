#!/usr/bin/env node
/**
 * يلتقط لقطات للشاشات المنفَّذة — للمراجعة البصرية مقابل المرجع في /ui.
 *
 * يشغّل خادم Vite على منفذ معزول، يلتقط، ثم يُنهيه.
 * الاستخدام:  node tooling/screenshots.mjs [outDir]
 */
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const OUT = process.argv[2] ?? resolve(ROOT, '.screenshots');
const PORT = 5198;
const BASE = `http://localhost:${PORT}`;

mkdirSync(OUT, { recursive: true });

const SHOTS = [
  { name: '01-login-desktop-1440', path: '/login', width: 1440, height: 900 },
  { name: '02-login-mobile-390', path: '/login', width: 390, height: 844 },
  { name: '03-login-mobile-360', path: '/login', width: 360, height: 800 },
  { name: '04-forgot-password', path: '/forgot-password', width: 1440, height: 900 },
  { name: '05-404', path: '/no-such-route', width: 1440, height: 900 },
  { name: '06-403', path: '/403', width: 1440, height: 900 },
];

const server = spawn(
  'npx',
  ['vite', '--port', String(PORT), '--strictPort'],
  { cwd: resolve(ROOT, 'apps/web'), shell: true, stdio: 'ignore' },
);

const waitForServer = async () => {
  for (let i = 0; i < 40; i += 1) {
    try {
      const res = await fetch(BASE);
      if (res.ok) return true;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
};

try {
  if (!(await waitForServer())) {
    throw new Error(`تعذّر تشغيل خادم Vite على ${BASE}`);
  }

  const browser = await chromium.launch();

  for (const shot of SHOTS) {
    const page = await browser.newPage({
      viewport: { width: shot.width, height: shot.height },
      locale: 'ar',
    });

    await page.goto(`${BASE}${shot.path}`, { waitUntil: 'networkidle' }).catch(() => {});
    await page.waitForTimeout(600);
    await page.screenshot({ path: resolve(OUT, `${shot.name}.png`) });
    await page.close();

    console.log(`✓ ${shot.name}`);
  }

  await browser.close();
  console.log(`\nاللقطات في: ${OUT}`);
} finally {
  server.kill();
  // على ويندوز، kill لا يقتل شجرة العمليات دائمًا.
  spawn('npx', ['kill-port', String(PORT)], { shell: true, stdio: 'ignore' });
}
