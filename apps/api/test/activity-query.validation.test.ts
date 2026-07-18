import { describe, expect, it } from 'vitest';
import { storeActivityQuerySchema } from '@oh/contracts';
import { ZodValidationPipe } from '../src/core/validation/zod.pipe.js';
import { AppError } from '../src/core/errors/app-error.js';

/**
 * تحقّق مُدخلات موجز النشاط — على مستوى الأنبوب (بلا قاعدة بيانات).
 *
 * نُشغّل `ZodValidationPipe` الحقيقي على مخطط `@oh/contracts` نفسه الذي يستخدمه
 * المتحكّم، فنثبت أن المدخل الفاسد يُرفض بـ400 قبل أن يمسّ الخدمة أو القاعدة.
 */

const pipe = new ZodValidationPipe(storeActivityQuerySchema);

/** يشغّل الأنبوب ويعيد رمز الحالة إن رُفض، أو `'ok'` إن قُبل. */
function validate(input: unknown): number | 'ok' {
  try {
    pipe.transform(input, { type: 'query' } as never);
    return 'ok';
  } catch (e) {
    if (e instanceof AppError) return e.getStatus();
    throw e;
  }
}

describe('تحقّق استعلام موجز النشاط', () => {
  it('حجم صفحة غير مسموح يُرفض بـ400', () => {
    expect(validate({ pageSize: '7' })).toBe(400);
    expect(validate({ pageSize: 'abc' })).toBe(400);
  });

  it('تاريخ بصيغة خاطئة يُرفض بـ400', () => {
    expect(validate({ from: '2026/07/18' })).toBe(400);
    expect(validate({ to: 'ليس تاريخًا' })).toBe(400);
  });

  it('فئة غير معروفة تُرفض بـ400', () => {
    expect(validate({ category: 'HACK' })).toBe(400);
  });

  it('استعلام صالح يُقبل (مع قيم افتراضية للترقيم)', () => {
    expect(validate({})).toBe('ok');
    expect(validate({ pageSize: '25', page: '2', category: 'ORDER', from: '2026-07-01', to: '2026-07-18' })).toBe('ok');
  });

  it('يُسقط أي customerId مُهرَّب في الاستعلام — نطاق المحل لا يُخترق', () => {
    const result = pipe.transform(
      { customerId: '11111111-1111-1111-1111-111111111111', pageSize: '10' },
      { type: 'query' } as never,
    ) as Record<string, unknown>;
    // المخطط لا يعرّف customerId، وZod يُسقط المفاتيح الزائدة افتراضيًا.
    expect(result.customerId).toBeUndefined();
  });
});
