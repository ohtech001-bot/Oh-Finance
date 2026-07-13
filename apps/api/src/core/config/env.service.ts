import { Injectable } from '@nestjs/common';
import { parseEnv, type Env } from '@oh/config';

/**
 * البيئة المُتحقَّق منها — تُقرأ مرة واحدة عند الإقلاع.
 *
 * لا يوجد `process.env` في أي مكان آخر من الخادم. كل قراءة تمر من هنا،
 * بنوع صريح. هذا يمنع الخطأ الكلاسيكي: `process.env.COOKIE_SECURE` يعيد
 * نصًا، و `"false"` نص صادق (truthy) — فتُرسل الكوكيز بلا Secure في الإنتاج.
 */
@Injectable()
export class EnvService {
  private readonly env: Env;

  constructor() {
    this.env = parseEnv(process.env);
  }

  get<K extends keyof Env>(key: K): Env[K] {
    return this.env[key];
  }

  get all(): Readonly<Env> {
    return this.env;
  }

  get isProduction(): boolean {
    return this.env.NODE_ENV === 'production';
  }

  get isTest(): boolean {
    return this.env.NODE_ENV === 'test';
  }

  get isDevelopment(): boolean {
    return this.env.NODE_ENV === 'development';
  }
}
