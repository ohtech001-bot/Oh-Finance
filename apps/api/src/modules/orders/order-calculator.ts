import { Injectable } from '@nestjs/common';
import {
  Decimal,
  add,
  max,
  multiply,
  percentOf,
  roundMoney,
  subtract,
  sum,
  toMoney,
  toMoneyString,
  zero,
  type CurrencyCode,
  type MoneyString,
} from '@oh/money';
import type { OrderItemInput, OrderTotals } from '@oh/contracts';

export interface CalculatedLine {
  lineTotal: Decimal;
  lineSubtotal: Decimal;
  lineTax: Decimal;
}

export interface CalculatedOrder {
  lines: CalculatedLine[];
  subtotal: Decimal;
  discountAmount: Decimal;
  taxAmount: Decimal;
  total: Decimal;
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  حساب الطلب — المكان الوحيد الذي تُجمع فيه أرقام الفاتورة.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  ⚠️ الواجهة **لا تحسب**. ترسل البنود، ويعيد الخادم الأرقام.
 *
 *  لو حسبت الواجهة وأرسلت `total`، لأمكن لمهاجم إرسال بنود بقيمة 5000
 *  و`total: 5` — فيُقيَّد على الزبون 5 فقط. ولو حسبت الواجهة للعرض فقط،
 *  لظهر فرق تقريب بين ما يراه المستخدم وما يُحفظ.
 *
 *  نقطة `POST /orders/preview` تعيد نفس الحساب — فتعرض الواجهة رقمًا يطابق
 *  المحفوظ حتمًا.
 *
 *  ── ترتيب العمليات (يُغيّر النتيجة!) ──────────────────────────────────────
 *    1. لكل بند:  base = qty × price
 *    2.           afterDiscount = base − discount        (لا ينزل تحت صفر)
 *    3.           tax = afterDiscount × rate%            ← الضريبة **بعد** الخصم
 *    4.           lineTotal = afterDiscount + tax
 *    5. subtotal = Σ afterDiscount   (بلا ضريبة)
 *    6. taxAmount = Σ tax
 *    7. total = subtotal + tax − orderDiscount
 *
 *  الخطوة 3 حاسمة: الضريبة تُحسب على المبلغ **بعد** الخصم، لا قبله. حسابها
 *  قبل الخصم يجعل الزبون يدفع ضريبة على مبلغ لم يدفعه — خطأ محاسبي وقانوني.
 *
 *  ── التقريب مرة واحدة ────────────────────────────────────────────────────
 *  نقرّب عند حدود السطر وعند الإجمالي فقط. التقريب في كل خطوة وسيطة يراكم
 *  الخطأ: عشرة بنود × تقريب في ثلاث خطوات = انحراف يصل إلى فلوس.
 */
@Injectable()
export class OrderCalculator {
  calculate(
    items: readonly OrderItemInput[],
    orderDiscount: MoneyString = '0',
    currency: CurrencyCode = 'ILS',
  ): CalculatedOrder {
    const lines: CalculatedLine[] = [];

    for (const item of items) {
      // 1. الأساس
      const base = multiply(item.unitPrice, item.quantity);

      // 2. الخصم — لا يتجاوز قيمة السطر (سطر بقيمة سالبة بلا معنى)
      const discount = toMoney(item.discount);
      const afterDiscount = max(subtract(base, discount), zero());

      // 3. الضريبة على المبلغ بعد الخصم
      const tax = percentOf(afterDiscount, item.taxRate);

      // 4. إجمالي السطر — نقرّب هنا (حد المستند الأول)
      const lineSubtotal = roundMoney(afterDiscount, currency);
      const lineTax = roundMoney(tax, currency);
      const lineTotal = add(lineSubtotal, lineTax);

      lines.push({ lineTotal, lineSubtotal, lineTax });
    }

    // 5–6. التجميع
    const subtotal = sum(lines.map((l) => l.lineSubtotal));
    const taxAmount = sum(lines.map((l) => l.lineTax));

    // 7. خصم الطلب — لا ينزل بالإجمالي تحت صفر
    const grossTotal = add(subtotal, taxAmount);
    const discountAmount = roundMoney(orderDiscount, currency);
    const cappedDiscount = discountAmount.greaterThan(grossTotal) ? grossTotal : discountAmount;
    const total = subtract(grossTotal, cappedDiscount);

    return {
      lines,
      subtotal: roundMoney(subtotal, currency),
      discountAmount: cappedDiscount,
      taxAmount: roundMoney(taxAmount, currency),
      total: roundMoney(total, currency),
    };
  }

  /** الصيغة التي تعيدها نقطة المعاينة. */
  toTotals(calculated: CalculatedOrder, currency: CurrencyCode = 'ILS'): OrderTotals {
    const scale = currency === 'JOD' ? 3 : 2;

    return {
      lineTotals: calculated.lines.map((l) => toMoneyString(l.lineTotal, scale)),
      subtotal: toMoneyString(calculated.subtotal, scale),
      discountAmount: toMoneyString(calculated.discountAmount, scale),
      taxAmount: toMoneyString(calculated.taxAmount, scale),
      total: toMoneyString(calculated.total, scale),
    } as OrderTotals;
  }
}
