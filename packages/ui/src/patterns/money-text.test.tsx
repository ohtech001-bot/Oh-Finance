import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MoneyText } from './money-text.js';
import { StatusBadge } from './status-badge.js';

describe('MoneyText', () => {
  it('يعرض المبلغ بعملة المحل', () => {
    render(<MoneyText value="1250.00" currency="ILS" />);
    expect(screen.getByText('1,250.00 ₪')).toBeInTheDocument();
  });

  it('يفرض dir=ltr على الرقم — يمنع انقلاب "1,250.00" داخل نص عربي', () => {
    const { container } = render(<MoneyText value="1250.00" />);
    const el = container.querySelector('span');
    expect(el).toHaveAttribute('dir', 'ltr');
  });

  it('يستخدم tabular-nums — يمنع اهتزاز الأعمدة بين صفوف الجدول', () => {
    const { container } = render(<MoneyText value="1250.00" />);
    expect(container.querySelector('span')).toHaveClass('tabular-nums');
  });

  it('tone="auto": سالب أحمر، موجب أخضر، صفر رمادي', () => {
    const { container: neg } = render(<MoneyText value="-200.00" tone="auto" />);
    expect(neg.querySelector('span')).toHaveClass('text-danger');

    const { container: pos } = render(<MoneyText value="1250.00" tone="auto" />);
    expect(pos.querySelector('span')).toHaveClass('text-success');

    const { container: zero } = render(<MoneyText value="0.00" tone="auto" />);
    expect(zero.querySelector('span')).toHaveClass('text-fg-muted');
  });

  it('tone صريح يتجاوز auto', () => {
    const { container } = render(<MoneyText value="1250.00" tone="debit" />);
    expect(container.querySelector('span')).toHaveClass('text-danger');
  });

  it('tone="balance": موجب أحمر (مدين لنا)، سالب أخضر (دائن) — عكس auto', () => {
    // رصيد الزبون الموجب يعني «مدين لنا» = أحمر (دَين نُحصّله)، كما في المرجع.
    const { container: debtor } = render(<MoneyText value="1250.00" tone="balance" />);
    expect(debtor.querySelector('span')).toHaveClass('text-danger');

    const { container: creditor } = render(<MoneyText value="-200.00" tone="balance" />);
    expect(creditor.querySelector('span')).toHaveClass('text-success');

    const { container: settled } = render(<MoneyText value="0.00" tone="balance" />);
    expect(settled.querySelector('span')).toHaveClass('text-fg-muted');

    // البرهان على أنها عكس auto: نفس القيمة الموجبة، لونان متعاكسان.
    const { container: auto } = render(<MoneyText value="1250.00" tone="auto" />);
    expect(auto.querySelector('span')).toHaveClass('text-success'); // auto: موجب أخضر
  });

  it('قيمة تالفة تعرض شرطة ولا تُسقط الشاشة', () => {
    // انهيار جدول مالي كامل بسبب صف واحد تالف أسوأ من عرض «—».
    render(<MoneyText value={'not-a-number' as never} />);
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('يحترم خانات العملة (JOD = 3)', () => {
    render(<MoneyText value="1250.567" currency="JOD" />);
    expect(screen.getByText('1,250.567 د.أ')).toBeInTheDocument();
  });
});

describe('StatusBadge', () => {
  it('اللون ليس الوسيلة الوحيدة — النص حاضر دائمًا', () => {
    // 8% من الذكور مصابون بعمى ألوان أحمر/أخضر — وهما لونا مدين/دائن عندنا.
    render(<StatusBadge tone="debit">مدين</StatusBadge>);
    expect(screen.getByText('مدين')).toBeInTheDocument();
  });

  it('يطبّق لون الدلالة', () => {
    const { container } = render(<StatusBadge tone="credit">مدفوع</StatusBadge>);
    expect(container.querySelector('span')).toHaveClass('bg-success-soft', 'text-success');
  });
});
