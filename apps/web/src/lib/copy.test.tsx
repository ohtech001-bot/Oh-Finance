import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { Breadcrumbs, Field, StatusBadge, UiLocalizationProvider, ConfirmDialog } from '@oh/ui';
import ar from '../locales/ar.json';
import he from '../locales/he.json';
import copyHe from '../locales/copy-he.json';
import i18n, { currentLocale } from './i18n';
import { copy, useCopy } from './copy';

function LocalizedExample() {
  useCopy();
  return (
    <UiLocalizationProvider locale={currentLocale()} translate={copy}>
      <Field label="الهاتف" error="رقم الهاتف يجب أن يبدأ بـ 05.">
        {(props) => <input {...props} defaultValue="0506446682" />}
      </Field>
      <StatusBadge>مدفوع جزئيًا</StatusBadge>
      <p>{copy('طلبات {{value0}}', { value0: 'محمد' })}</p>
      <Breadcrumbs
        items={[{ label: copy('الزبائن'), href: '/customers' }, { label: 'المنتجات' }]}
      />
      <ConfirmDialog
        open
        onOpenChange={() => {}}
        title="حذف العامل"
        description="إدارة حسابات العاملين في المحل."
        onConfirm={() => {}}
      />
    </UiLocalizationProvider>
  );
}

afterEach(async () => {
  cleanup();
  await i18n.changeLanguage('ar');
});

describe('Arabic and Hebrew localization', () => {
  it('keeps every structured translation key in both languages', () => {
    const keys = (value: object, prefix = ''): string[] =>
      Object.entries(value).flatMap(([key, item]) =>
        typeof item === 'string' ? [`${prefix}${key}`] : keys(item, `${prefix}${key}.`),
      );
    expect(keys(he).sort()).toEqual(keys(ar).sort());
  });

  it('preserves interpolation variables and contains no Arabic in Hebrew UI copy', () => {
    const variables = (value: string) =>
      [...value.matchAll(/\{\{([^}]+)\}\}/g)].map((match) => match[1]).sort();
    for (const [source, target] of Object.entries(copyHe)) {
      expect(variables(target), source).toEqual(variables(source));
      expect(target, source).not.toMatch(/[\u0600-\u06ff]/u);
      expect(target.trim(), source).not.toBe('');
    }
  });

  it('updates open dialogs, validation and status labels without changing customer data', async () => {
    await i18n.changeLanguage('ar');
    render(<LocalizedExample />);
    expect(screen.getByRole('button', { name: 'تأكيد' })).toBeTruthy();
    await act(async () => {
      await i18n.changeLanguage('he');
    });
    expect(screen.getByRole('button', { name: 'אישור' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'ביטול' })).toBeTruthy();
    expect(screen.getByRole('dialog').textContent).not.toMatch(/[\u0600-\u06ff]/u);
    expect(screen.getByText('שולם חלקית')).toBeTruthy();
    expect(screen.getByText('מספר הטלפון חייב להתחיל ב־05.')).toBeTruthy();
    expect(screen.getByDisplayValue('0506446682')).toBeTruthy();
    expect(screen.getByText('הזמנות של محمد')).toBeTruthy();
    expect(screen.getByText('المنتجات')).toBeTruthy();
    await act(async () => {
      await i18n.changeLanguage('ar');
    });
    expect(screen.getByRole('button', { name: 'تأكيد' })).toBeTruthy();
    expect(screen.getByText('مدفوع جزئيًا')).toBeTruthy();
  });

  it('uses the selected language only instead of bilingual payment labels', async () => {
    await i18n.changeLanguage('he');
    expect(copy('مدفوع / שולם')).toBe('שולם');
    expect(copy('مرحبا غير معروف')).toBe('مرحبا غير معروف');
    await i18n.changeLanguage('ar');
    expect(copy('مدفوع / שולם')).toBe('مدفوع');
  });

  it('localizes library validation and HTTP error messages without altering limits', async () => {
    await i18n.changeLanguage('he');
    expect(copy('Required')).toBe('זהו שדה חובה.');
    expect(copy('String must contain at most 80 character(s)')).toBe('ניתן להזין עד 80 תווים.');
    expect(copy('Number must be less than or equal to 31')).toBe('הערך אינו יכול להיות גבוה מ־31.');
    expect(copy('Too Many Requests')).toContain('המתינו');
    await i18n.changeLanguage('ar');
    expect(copy('Required')).toBe('هذا الحقل مطلوب.');
    expect(copy('String must contain at most 80 character(s)')).toBe(
      'يجب ألا يتجاوز النص 80 حرفًا.',
    );
  });

  it('translates server-generated messages while preserving names, IDs and amounts', async () => {
    await i18n.changeLanguage('he');
    expect(copy('إضافة زبون "محمد" (C-001)')).toBe('נוסף לקוח "محمد" (C-001)');
    expect(copy('محمد تجاوز حد الائتمان')).toBe('محمد חרג ממסגרת האשראי');
    expect(copy('المبلغ يتجاوز رصيد الزبون المتاح (100.00).')).toBe(
      'הסכום גבוה מיתרת הזכות הזמינה של הלקוח (100.00).',
    );
    expect(copy('محاولات دخول فاشلة كثيرة. حاول مجددًا بعد 15 دقيقة.')).toContain('15');
    expect(copy('من 2026-10-01 إلى 2026-10-03')).toBe('מ־2026-10-01 עד 2026-10-03');
  });
});
