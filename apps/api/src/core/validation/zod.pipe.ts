import { PipeTransform, Injectable, type ArgumentMetadata } from '@nestjs/common';
import { ZodError, type ZodSchema } from 'zod';
import { AppError } from '../errors/app-error.js';

/**
 * التحقق من المدخلات بـZod — على **كل** مسار، بلا استثناء.
 *
 * المخطط يأتي من `@oh/contracts` — نفس المخطط الذي تستخدمه الواجهة في
 * React Hook Form. فما يقبله المتصفح هو بالضبط ما يقبله الخادم، ولا يمكن
 * لأحدهما أن ينحرف عن الآخر دون كسر البناء.
 *
 * ⚠️ التحقق في الواجهة تجربةُ مستخدم. التحقق هنا **أمان**. المهاجم لا يستخدم
 *    نموذجنا أصلًا — يرسل الطلب مباشرة.
 *
 * ملاحظة: Zod يُرجع الكائن المُحوَّل (بعد trim/lowercase/coerce/defaults)،
 * وهو ما يصل للمتحكّم. أي حقل زائد يُسقَط — فلا يتسلل `tenantId` من العميل.
 */
@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema: ZodSchema) {}

  transform(value: unknown, _metadata: ArgumentMetadata): unknown {
    try {
      return this.schema.parse(value);
    } catch (error) {
      if (error instanceof ZodError) {
        const fields: Record<string, string[]> = {};
        for (const issue of error.issues) {
          const key = issue.path.join('.') || '_root';
          (fields[key] ??= []).push(issue.message);
        }
        throw AppError.validation('تحقّق من البيانات المُدخلة.', fields);
      }
      throw error;
    }
  }
}

/** مختصر: `@Body(zodBody(loginRequestSchema)) dto: LoginRequest` */
export function zodBody(schema: ZodSchema): ZodValidationPipe {
  return new ZodValidationPipe(schema);
}

export function zodQuery(schema: ZodSchema): ZodValidationPipe {
  return new ZodValidationPipe(schema);
}
