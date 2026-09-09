import type { OrderDetail } from '@oh/contracts';
import {
  formatMoney,
  greaterThan,
  percentOf,
  roundMoney,
  subtract,
  toCurrencyString,
  type CurrencyCode,
} from '@oh/money';
import { displayOrderNumber } from './order-number';

interface PrintOrderOptions {
  store?: {
    name: string;
    logoUrl: string | null;
    phone?: string | null;
    email?: string | null;
    address?: string | null;
    taxEnabled: boolean;
    taxRate: number;
  } | null;
  customer?: {
    phone?: string | null;
    email?: string | null;
    city?: string | null;
    address?: string | null;
    balance?: string;
  } | null;
  payment?: {
    amount: string;
    balanceBefore: string;
    balanceAfter: string;
  } | null;
  paperSize?: PrintPaperSize;
  targetWindow?: Window | null;
}

export type PrintPaperSize = '80mm' | 'A4';

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function inclusiveTaxBreakdown(
  total: string,
  taxEnabled: boolean,
  taxRate: number,
  currency: CurrencyCode,
): { beforeTax: string; taxAmount: string } {
  if (!taxEnabled || taxRate <= 0) {
    return {
      beforeTax: toCurrencyString(total, currency),
      taxAmount: toCurrencyString('0', currency),
    };
  }

  const taxAmount = roundMoney(percentOf(total, String(taxRate)), currency);
  return {
    beforeTax: toCurrencyString(subtract(total, taxAmount), currency),
    taxAmount: toCurrencyString(taxAmount, currency),
  };
}

export function orderSettlementDate(
  order: Pick<OrderDetail, 'remainingAmount' | 'allocations' | 'confirmedAt'>,
): Date | null {
  if (greaterThan(order.remainingAmount, '0')) return null;

  const latestPayment = order.allocations.reduce<Date | null>((latest, allocation) => {
    const paidAt = new Date(allocation.paidAt);
    if (Number.isNaN(paidAt.getTime())) return latest;
    return !latest || paidAt > latest ? paidAt : latest;
  }, null);

  if (latestPayment) return latestPayment;
  return order.confirmedAt ? new Date(order.confirmedAt) : null;
}

export function formatOrderDate(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

export function formatOrderTime(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

export function printOrder(
  order: OrderDetail,
  currency: CurrencyCode,
  options: PrintOrderOptions = {},
) {
  const win = options.targetWindow ?? window.open('', '_blank', 'width=420,height=720');
  if (!win) return;

  const money = (value: string) => escapeHtml(formatMoney(value, { currency }));
  const orderNumber = escapeHtml(displayOrderNumber(order.number));
  const receivedAt = new Date(order.issuedAt);
  const orderDate = escapeHtml(formatOrderDate(receivedAt));
  const orderTime = escapeHtml(formatOrderTime(receivedAt));
  const settledAt = orderSettlementDate(order);
  const settlementDate = settledAt ? escapeHtml(formatOrderDate(settledAt)) : null;
  const settlementTime = settledAt ? escapeHtml(formatOrderTime(settledAt)) : null;
  const paid = order.remainingAmount === '0.00';
  const partiallyPaid = order.status === 'PARTIALLY_PAID';
  const paymentState = paid
    ? 'مدفوع / שולם'
    : partiallyPaid
      ? 'مدفوع جزئيًا / שולם חלקית'
      : 'غير مدفوع / לא שולם';
  const paymentColor = paid ? '#16733a' : partiallyPaid ? '#b65d00' : '#c42323';
  const cashPaid = subtract(order.paidAmount, order.creditAppliedAmount);
  const documentState = order.status === 'DRAFT' ? 'مسودة / טיוטה' : 'طلب مؤكد / הזמנה מאושרת';
  const storeName = escapeHtml(options.store?.name ?? 'OH Finance');
  const paperSize = options.paperSize ?? '80mm';
  const a4 = paperSize === 'A4';
  const taxRate = options.store?.taxEnabled ? options.store.taxRate : 0;
  const tax = inclusiveTaxBreakdown(
    order.total,
    options.store?.taxEnabled ?? false,
    taxRate,
    currency,
  );
  const logo = options.store?.logoUrl
    ? `<img class="logo" src="${escapeHtml(options.store.logoUrl)}" alt="">`
    : '';

  const items = order.items
    .map((item) => {
      const itemDiscount =
        Number(item.discount) > 0
          ? `<span class="product-discount">خصم المنتج: - ${money(item.discount)}</span>`
          : '';

      return `
        <tr>
          <td class="product">
            <span class="product-name">${escapeHtml(item.name)}</span>
            ${itemDiscount}
          </td>
          <td>${escapeHtml(item.quantity)}</td>
          <td>${money(item.unitPrice)}</td>
          <td>${money(item.lineTotal)}</td>
        </tr>`;
    })
    .join('');

  const discount =
    Number(order.discountAmount) > 0
      ? `<div class="total-row"><span>الخصم</span><strong>- ${money(order.discountAmount)}</strong></div>`
      : '';

  win.document.write(`<!doctype html>
  <html lang="ar" dir="rtl">
  <head>
    <meta charset="utf-8">
    <title>${orderNumber}</title>
    <style>
      *{box-sizing:border-box}
      @page{size:${a4 ? 'A4' : '80mm auto'};margin:${a4 ? '14mm' : '3mm'}}
      html,body{width:${a4 ? '100%' : '74mm'};margin:0;padding:0;background:#fff;color:#111}
      body{font-family:Arial,Tahoma,sans-serif;font-size:${a4 ? '13px' : '11px'};line-height:1.45}
      .receipt{width:100%;max-width:${a4 ? '182mm' : 'none'};margin:0 auto;padding:1mm 0}
      .store{text-align:center;padding-bottom:3mm;border-bottom:1px dashed #555}
      .logo{display:block;max-width:24mm;max-height:18mm;object-fit:contain;margin:0 auto 1.5mm}
      .store-name{font-size:17px;font-weight:800}
      .document-state{margin:2.5mm auto 0;width:max-content;border:1px solid #111;padding:1mm 4mm;font-size:13px;font-weight:800}
      .section{padding:2.5mm 0;border-bottom:1px dashed #777}
      .section-title{font-size:12px;font-weight:800;margin-bottom:1.5mm}
      .info-row,.total-row{display:flex;align-items:flex-start;justify-content:space-between;gap:3mm;padding:.7mm 0}
      .info-row strong,.total-row strong{text-align:left;direction:ltr}
      .payment{display:inline-block;border:1px solid currentColor;padding:.8mm 2mm;font-weight:800;color:${paymentColor}}
      table{width:100%;border-collapse:collapse;table-layout:fixed;margin-top:1mm;font-size:${a4 ? '12px' : '9px'}}
      th,td{padding:1.4mm .7mm;border-bottom:1px solid #ccc;text-align:center;vertical-align:top}
      th{font-weight:800}
      .product{width:32%;text-align:right;overflow-wrap:anywhere}
      .product-name{display:block;font-weight:700}
      .product-discount{display:block;margin-top:.7mm;color:#c42323;font-size:8px;font-weight:700;white-space:nowrap}
      .tax-note{font-size:9px;color:#444;margin-top:1mm}
      .grand-total{font-size:14px;border-top:1.5px solid #111;margin-top:1.5mm;padding-top:1.5mm}
      .footer{text-align:center;padding-top:3mm;font-size:9px}
      @media print{html,body{width:${a4 ? '100%' : '74mm'}}.receipt{break-inside:avoid}}
    </style>
  </head>
  <body>
    <main class="receipt">
      <header class="store">
        ${logo}
        <div class="store-name">${storeName}</div>
        ${options.store?.phone ? `<div dir="ltr">${escapeHtml(options.store.phone)}</div>` : ''}
        ${options.store?.email ? `<div dir="ltr">${escapeHtml(options.store.email)}</div>` : ''}
        ${options.store?.address ? `<div>${escapeHtml(options.store.address)}</div>` : ''}
        <div class="document-state">${documentState}</div>
      </header>

      <section class="section">
        <div class="section-title">تفاصيل صاحب الطلب</div>
        <div class="info-row"><span>الاسم</span><strong>${escapeHtml(order.customerName)}</strong></div>
        ${options.customer?.phone ? `<div class="info-row"><span>الهاتف</span><strong>${escapeHtml(options.customer.phone)}</strong></div>` : ''}
        ${options.customer?.email ? `<div class="info-row"><span>البريد الإلكتروني</span><strong>${escapeHtml(options.customer.email)}</strong></div>` : ''}
        ${options.customer?.city ? `<div class="info-row"><span>المدينة</span><strong>${escapeHtml(options.customer.city)}</strong></div>` : ''}
        ${options.customer?.address ? `<div class="info-row"><span>العنوان</span><strong>${escapeHtml(options.customer.address)}</strong></div>` : ''}
      </section>

      <section class="section">
        <div class="section-title">تفاصيل الطلب</div>
        <div class="info-row"><span>رقم الطلب</span><strong>${orderNumber}</strong></div>
        <div class="info-row"><span>تاريخ استلام الطلب</span><strong>${orderDate}</strong></div>
        <div class="info-row"><span>ساعة الاستلام</span><strong>${orderTime}</strong></div>
        ${settlementDate ? `<div class="info-row"><span>تاريخ السداد</span><strong>${settlementDate}</strong></div>` : ''}
        ${settlementTime ? `<div class="info-row"><span>ساعة السداد</span><strong>${settlementTime}</strong></div>` : ''}
        <div class="info-row"><span>حالة الدفع</span><span class="payment">${paymentState}</span></div>
        <div class="info-row"><span>قيمة الطلب</span><strong>${money(order.total)}</strong></div>
        <div class="info-row"><span>المسحوب من رصيد الزبون</span><strong>${money(order.creditAppliedAmount)}</strong></div>
        ${greaterThan(cashPaid, '0') ? `<div class="info-row"><span>المدفوع نقدًا</span><strong>${money(cashPaid.toString())}</strong></div>` : ''}
        <div class="info-row"><span>إجمالي المسدد</span><strong>${money(order.paidAmount)}</strong></div>
        <div class="info-row"><span>المتبقي للسداد</span><strong>${money(order.remainingAmount)}</strong></div>
        ${options.customer?.balance !== undefined ? `<div class="info-row"><span>رصيد الحساب الحالي</span><strong>${money(options.customer.balance)}</strong></div>` : ''}
        ${
          options.payment
            ? `<div class="info-row"><span>قيمة الدفعة</span><strong>${money(options.payment.amount)}</strong></div>
        <div class="info-row"><span>الرصيد قبل الدفع</span><strong>${money(options.payment.balanceBefore)}</strong></div>
        <div class="info-row"><span>الرصيد بعد الدفع</span><strong>${money(options.payment.balanceAfter)}</strong></div>`
            : ''
        }
      </section>

      <section class="section">
        <div class="section-title">المنتجات</div>
        <table>
          <thead>
            <tr><th class="product">المنتج</th><th>الكمية</th><th>سعر الوحدة</th><th>الإجمالي</th></tr>
          </thead>
          <tbody>${items}</tbody>
        </table>
        <div class="tax-note">الأسعار المعروضة تشمل الضريبة.</div>
      </section>

      <section class="section">
        <div class="total-row"><span>السعر قبل الضريبة</span><strong>${money(tax.beforeTax)}</strong></div>
        <div class="total-row"><span>قيمة الضريبة (${escapeHtml(String(taxRate))}% ضمن السعر)</span><strong>${money(tax.taxAmount)}</strong></div>
        ${discount}
        <div class="total-row grand-total"><span>السعر النهائي شامل الضريبة</span><strong>${money(order.total)}</strong></div>
      </section>

      <footer class="footer">${storeName}</footer>
    </main>
    <script>
      window.addEventListener('load', function () {
        window.setTimeout(function () { window.print(); }, 250);
      });
    </script>
  </body>
  </html>`);
  win.document.close();
  win.focus();
}
