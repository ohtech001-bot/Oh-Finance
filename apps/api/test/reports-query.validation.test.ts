import { describe, expect, it } from 'vitest';
import { reportsQuerySchema } from '@oh/contracts';
import { ZodValidationPipe } from '../src/core/validation/zod.pipe.js';
import { AppError } from '../src/core/errors/app-error.js';

/** تحقّق استعلام التقارير — على مستوى الأنبوب (بلا قاعدة بيانات). */
const pipe = new ZodValidationPipe(reportsQuerySchema);
function validate(input: unknown): number | 'ok' {
  try { pipe.transform(input, { type: 'query' } as never); return 'ok'; }
  catch (e) { if (e instanceof AppError) return e.getStatus(); throw e; }
}

describe('تحقّق استعلام التقارير', () => {
  it('الفترة المخصّصة بلا تاريخين تُرفض بـ400', () => {
    expect(validate({ preset: 'custom' })).toBe(400);
  });
  it('بداية بعد النهاية تُرفض بـ400', () => {
    expect(validate({ preset: 'custom', from: '2026-07-31', to: '2026-07-01' })).toBe(400);
  });
  it('دقّة غير معروفة تُرفض بـ400', () => {
    expect(validate({ granularity: 'century' })).toBe(400);
  });
  it('استعلام صالح يُقبل (افتراضي آخر ٣٠ يومًا)', () => {
    expect(validate({})).toBe('ok');
  });
});
