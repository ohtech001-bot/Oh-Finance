import { describe, expect, it } from 'vitest';
import { dashboardQuerySchema } from '@oh/contracts';
import { ZodValidationPipe } from '../src/core/validation/zod.pipe.js';
import { AppError } from '../src/core/errors/app-error.js';

/**
 * تحقّق مُدخلات لوحة التحكم — على مستوى الأنبوب (بلا قاعدة بيانات).
 *
 * نُشغّل `ZodValidationPipe` الحقيقي على مخطط `@oh/contracts` نفسه الذي يستخدمه
 * المتحكّم، فنثبت رفض الفترة/الدقّة الفاسدة بـ400 قبل لمس القاعدة.
 */

const pipe = new ZodValidationPipe(dashboardQuerySchema);

function validate(input: unknown): number | { ok: true; data: Record<string, unknown> } {
  try {
    return { ok: true, data: pipe.transform(input, { type: 'query' } as never) as Record<string, unknown> };
  } catch (e) {
    if (e instanceof AppError) return e.getStatus();
    throw e;
  }
}

describe('تحقّق استعلام لوحة التحكم', () => {
  it('الفترة المخصّصة بلا تاريخين تُرفض بـ400', () => {
    expect(validate({ preset: 'custom' })).toBe(400);
    expect(validate({ preset: 'custom', from: '2026-07-01' })).toBe(400);
  });

  it('تاريخ بداية بعد النهاية يُرفض بـ400', () => {
    expect(validate({ preset: 'custom', from: '2026-07-31', to: '2026-07-01' })).toBe(400);
  });

  it('دقّة تجميع غير معروفة تُرفض بـ400', () => {
    expect(validate({ granularity: 'hour' })).toBe(400);
  });

  it('فترة غير معروفة تُرفض بـ400', () => {
    expect(validate({ preset: 'last_millennium' })).toBe(400);
  });

  it('تاريخ بصيغة خاطئة يُرفض بـ400', () => {
    expect(validate({ preset: 'custom', from: '2026/07/01', to: '2026-07-31' })).toBe(400);
  });

  it('استعلام صالح يُقبل بقيم افتراضية', () => {
    const r = validate({});
    expect(typeof r === 'object' && r.ok).toBe(true);
    if (typeof r === 'object') {
      expect(r.data.preset).toBe('this_month');
      expect(r.data.granularity).toBe('auto');
    }
  });

  it('فترة مخصّصة صالحة تُقبل', () => {
    expect(typeof validate({ preset: 'custom', from: '2026-07-01', to: '2026-07-31' }) === 'object').toBe(true);
  });
});
