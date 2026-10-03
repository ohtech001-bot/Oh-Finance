import { expect, test } from '@playwright/test';

for (const width of [390, 1440]) {
  test(`floating contacts, accessibility and motion work at ${width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    await page.goto('/');
    const rail = page.locator('.oh-floating-tools');
    await expect(rail.locator('.oh-floating-tool').first().locator('svg')).toHaveCSS(
      'animation-name',
      'oh-tool-float',
    );
    await expect(rail.locator('.oh-floating-tool').first()).toHaveCSS(
      'backdrop-filter',
      'blur(12px) saturate(1.4)',
    );
    await expect(rail.getByRole('link', { name: 'تواصل عبر واتساب', exact: true })).toHaveAttribute(
      'href',
      /^https:\/\/wa.me\/972552616622/,
    );
    await expect(
      rail.getByRole('link', { name: 'إنستغرام O&H Tech', exact: true }),
    ).toHaveAttribute('href', 'https://www.instagram.com/oh_tech/');
    expect(await page.locator('a[href*="wa.me"]').count()).toBeGreaterThan(1);
    for (const anchor of await page.locator('a[href*="wa.me"]').all())
      await expect(anchor.locator('[data-brand="whatsapp"]')).toHaveCount(1);
    await expect(page.locator('.oh-hero__image')).toHaveAttribute(
      'src',
      '/landing/brand-transparent.webp',
    );
    await expect
      .poll(() =>
        page
          .locator('.oh-hero__image')
          .evaluate((image) => (image as HTMLImageElement).naturalWidth),
      )
      .toBe(960);
    const initial = await page
      .locator('.oh-flying-note')
      .first()
      .evaluate((note) => getComputedStyle(note).transform);
    await page.locator('#features').scrollIntoViewIfNeeded();
    await expect
      .poll(() =>
        page
          .locator('.oh-flying-note')
          .first()
          .evaluate((note) => getComputedStyle(note).transform),
      )
      .not.toBe(initial);
    await rail.getByRole('button', { name: 'أدوات إمكانية الوصول', exact: true }).click();
    const panel = page.getByRole('dialog', { name: 'أدوات إمكانية الوصول' });
    await expect(panel).toBeVisible();
    await panel.getByRole('button', { name: 'تكبير النص', exact: true }).click();
    await expect(panel.locator('output')).toHaveText('110%');
    await panel.getByRole('switch', { name: 'تباين عالٍ', exact: true }).click();
    await expect(page.locator('.oh-landing')).toHaveAttribute('data-high-contrast', 'true');
    await panel.getByRole('switch', { name: 'إيقاف الرسوم المتحركة', exact: true }).click();
    await expect(page.locator('.oh-money-flight')).toBeHidden();
    await expect(rail.locator('.oh-floating-tool').first().locator('svg')).toHaveCSS(
      'animation-name',
      'none',
    );
    await page.screenshot({
      path: testInfo.outputPath(`accessibility-${width}.png`),
      animations: 'disabled',
    });
    await page.keyboard.press('Escape');
    await expect(panel).toBeHidden();
    await expect(
      rail.getByRole('button', { name: 'أدوات إمكانية الوصول', exact: true }),
    ).toBeFocused();
    await page.reload();
    await expect(page.locator('.oh-landing')).toHaveAttribute('data-motion-paused', 'true');
    await rail.getByRole('button', { name: 'أدوات إمكانية الوصول', exact: true }).click();
    await page.getByRole('button', { name: 'إعادة تعيين إلى الافتراضي', exact: true }).click();
    await expect(page.locator('.oh-landing')).toHaveAttribute('data-motion-paused', 'false');
    await page.getByRole('slider', { name: 'حجم النص', exact: true }).fill('140');
    await page.getByRole('switch', { name: 'تسطير الروابط', exact: true }).click();
    await page.getByRole('switch', { name: 'إخفاء الصور', exact: true }).click();
    await page.keyboard.press('Escape');
    await expect(page.locator('.oh-hero__image')).toBeHidden();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await rail.getByRole('button', { name: 'أدوات إمكانية الوصول', exact: true }).click();
    await page.getByRole('button', { name: 'إعادة تعيين إلى الافتراضي', exact: true }).click();
    await page.keyboard.press('Escape');
    await page.locator('.oh-language-button').click();
    await rail.getByRole('button', { name: 'כלי נגישות', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'כלי נגישות' })).toBeVisible();
    await expect(page.getByRole('switch', { name: 'עצירת הנפשות', exact: true })).toBeVisible();
    await page.keyboard.press('Escape');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
}

test('reduced motion disables floating money and counters finish with accurate values', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.locator('.oh-money-flight')).toBeHidden();
  await expect(page.locator('.oh-floating-tool').first().locator('svg')).toHaveCSS(
    'animation-name',
    'none',
  );
  const counters = page.locator('[data-counter]');
  for (const counter of await counters.all())
    await expect(counter).toHaveText((await counter.getAttribute('data-counter'))!);
});
