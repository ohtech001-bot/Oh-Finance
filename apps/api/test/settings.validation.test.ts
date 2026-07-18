import { describe, expect, it } from 'vitest';
import type { ZodSchema } from 'zod';
import { financialSettingsSchema, printingSettingsSchema, settingsSectionSchema } from '@oh/contracts';
import { ZodValidationPipe } from '../src/core/validation/zod.pipe.js';
import { AppError } from '../src/core/errors/app-error.js';

/** تحقّق مدخلات الإعدادات — على مستوى الأنبوب (بلا قاعدة بيانات). */
function validate(schema: ZodSchema, input: unknown): number | 'ok' {
  const pipe = new ZodValidationPipe(schema);
  try { pipe.transform(input, { type: 'body' } as never); return 'ok'; }
  catch (e) { if (e instanceof AppError) return e.getStatus(); throw e; }
}

describe('تحقّق مدخلات الإعدادات', () => {
  it('قسم غير معروف يُرفض بـ400', () => {
    expect(validate(settingsSectionSchema, 'hacking')).toBe(400);
    expect(validate(settingsSectionSchema, 'general')).toBe('ok');
  });
  it('نسبة ضريبة خارج 0–100 تُرفض', () => {
    const base = { currency: 'ILS', country: 'x', numberFormat: '1,234.56', dateFormat: 'YYYY-MM-DD' };
    expect(validate(financialSettingsSchema, { ...base, tax: { enabled: true, rate: 150, text: '' } })).toBe(400);
    expect(validate(financialSettingsSchema, { ...base, tax: { enabled: true, rate: 16, text: '' } })).toBe('ok');
  });
  it('عملة بطول خاطئ تُرفض', () => {
    expect(validate(financialSettingsSchema, { currency: 'ILSX', country: 'x', numberFormat: '1,234.56', dateFormat: 'YYYY-MM-DD', tax: { enabled: false, rate: 0, text: '' } })).toBe(400);
  });
  it('قياس ورق غير مدعوم يُرفض', () => {
    const base = { printer: '', orientation: 'portrait', printLogo: true, printInvoiceNumber: true, printDateTime: true, printBarcode: false };
    expect(validate(printingSettingsSchema, { ...base, paperSize: 'A3' })).toBe(400);
    expect(validate(printingSettingsSchema, { ...base, paperSize: '80mm' })).toBe('ok');
  });
});
