import { describe, expect, it } from 'vitest';
import {
  FEATURES,
  SCREENS,
  SECTIONS,
  SUBSCRIPTION_MESSAGE,
  SUBSCRIPTION_URL,
} from './landing-content';

describe('landing content', () => {
  it('uses the approved WhatsApp recipient and complete encoded message', () => {
    const link = new URL(SUBSCRIPTION_URL);
    expect(link.origin).toBe('https://wa.me');
    expect(link.pathname).toBe('/972552616622');
    expect(link.searchParams.get('text')).toBe(SUBSCRIPTION_MESSAGE);
    expect(SUBSCRIPTION_MESSAGE).toBe(
      'مرحبًا O&H Tech، اطلعت على منظومة OH Finance وأرغب بالاشتراك. أرجو تزويدي بتفاصيل الاشتراك.',
    );
  });
  it('describes prepared backup tooling rather than claiming it is activated', () => {
    const backup = FEATURES.find((item) => item.title.includes('النسخ الاحتياطي'));
    expect(backup?.title).toContain('تجهيز');
    expect(backup?.text).toContain('تُفعّل حسب إعدادات الاستضافة');
  });
  it('has six distinct existing project screen categories and no administration link', () => {
    expect(SCREENS).toHaveLength(6);
    expect(new Set(SCREENS.map((item) => item.id)).size).toBe(6);
    expect(SECTIONS.some((item) => /admin|platform/.test(item.id))).toBe(false);
  });
});
