import { config } from 'node:process';

void config;

/**
 * تحميل .env.test إن وُجد — بلا اعتماد على dotenv (ليس ضمن اعتماديات الخادم).
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(__dirname, '../../..');

for (const file of ['.env.test', '.env']) {
  const path = resolve(ROOT, file);
  if (!existsSync(path)) continue;

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
    if (value && !process.env[key]) {
      process.env[key] = value;
    }
  }
}

process.env.NODE_ENV = 'test';
