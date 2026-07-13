import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';
import { timingSafeEqual, randomBytes, createHash } from 'node:crypto';

/**
 * تجزئة كلمات المرور — Argon2id.
 *
 * ── لماذا Argon2id وليس bcrypt؟ ─────────────────────────────────────────────
 * bcrypt مقيّد بـ 72 بايت (يقطع ما بعدها بصمت) ويستهلك ذاكرة ثابتة صغيرة،
 * فتكسره كروت الرسوميات (GPU) بكفاءة عالية.
 *
 * Argon2id فائز مسابقة تجزئة كلمات المرور (2015) ويقاوم الـGPU/ASIC لأنه
 * **صعب الذاكرة**: كل محاولة تخمين تحتاج 64 ميجابايت. مهاجم بـGPU فيه آلاف
 * الأنوية لن يشغّل إلا عشرات المحاولات المتوازية بدل الملايين.
 *
 * المعاملات تتبع توصية OWASP (m=64MiB, t=3, p=4).
 */
const ARGON2_OPTIONS: argon2.Options = {
  type: argon2.argon2id,
  memoryCost: 65_536, // 64 MiB
  timeCost: 3,
  parallelism: 4,
};

/**
 * هاش وهمي — لتسوية زمن الرد عند عدم وجود المستخدم.
 * يُولَّد مرة عند الإقلاع بكلمة عشوائية لا يعرفها أحد.
 */
const DUMMY_PASSWORD = randomBytes(32).toString('hex');

@Injectable()
export class PasswordService {
  private dummyHash: string | null = null;

  async hash(password: string): Promise<string> {
    return argon2.hash(password, ARGON2_OPTIONS);
  }

  async verify(hash: string, password: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, password);
    } catch {
      // هاش تالف أو بصيغة غير معروفة — نعامله كفشل تحقق، لا كخطأ خادم.
      return false;
    }
  }

  /**
   * ═══════════════════════════════════════════════════════════════════════
   *  الحماية من هجوم التوقيت (timing attack)
   * ═══════════════════════════════════════════════════════════════════════
   *
   *  لو أعدنا "بيانات خاطئة" فورًا عند عدم وجود البريد، بينما نصرف ~100ms
   *  في Argon2 عند وجوده، لصار زمن الرد وحده يكشف أي البُرد مسجّلة:
   *
   *      بريد غير موجود  →  رد خلال   2ms
   *      بريد موجود      →  رد خلال 100ms
   *
   *  المهاجم يقيس الفارق ويعدّ المستخدمين بلا أي رسالة خطأ مختلفة.
   *
   *  الحل: عند عدم وجود المستخدم، نتحقق من **هاش وهمي** — فنصرف نفس الوقت
   *  تقريبًا. الرسالة موحّدة والزمن موحّد.
   */
  async verifyWithTimingEqualization(
    hash: string | null,
    password: string,
  ): Promise<boolean> {
    if (hash) {
      return this.verify(hash, password);
    }

    this.dummyHash ??= await argon2.hash(DUMMY_PASSWORD, ARGON2_OPTIONS);
    await this.verify(this.dummyHash, password).catch(() => false);
    return false;
  }

  /** رمز عشوائي آمن (رموز التجديد، CSRF، استعادة كلمة المرور). */
  generateToken(bytes = 32): string {
    return randomBytes(bytes).toString('base64url');
  }

  /**
   * هاش رمز — لتخزينه في قاعدة البيانات.
   *
   * SHA-256 كافٍ هنا وليس Argon2: الرمز عشوائي بـ256 بت، فلا معنى لمقاومة
   * القاموس (لا يوجد قاموس لأرقام عشوائية). السرعة مطلوبة لأن كل تجديد
   * يتحقق منه، والبطء هنا يعني بطء كل طلب.
   */
  hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  /** مقارنة ثابتة الزمن — تمنع استنتاج الرمز بايتًا بايت من فروق التوقيت. */
  compareTokens(a: string, b: string): boolean {
    const bufA = Buffer.from(a, 'utf8');
    const bufB = Buffer.from(b, 'utf8');
    if (bufA.length !== bufB.length) return false;
    return timingSafeEqual(bufA, bufB);
  }
}
