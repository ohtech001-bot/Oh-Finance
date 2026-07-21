import type { OrderDetail } from '@oh/contracts';
import { formatMoney, type CurrencyCode } from '@oh/money';

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function printOrder(
  order: OrderDetail,
  currency: CurrencyCode,
  targetWindow?: Window | null,
) {
  const win = targetWindow ?? window.open('', '_blank', 'width=900,height=720');
  if (!win) return;
  const money = (value: string) => escapeHtml(formatMoney(value, { currency }));
  const items = order.items
    .map(
      (item) => `
        <tr>
          <td>${escapeHtml(item.name)}</td>
          <td>${escapeHtml(item.quantity)}</td>
          <td>${money(item.unitPrice)}</td>
          <td>${escapeHtml(item.taxRate)}%</td>
          <td>${money(item.lineTotal)}</td>
        </tr>`,
    )
    .join('');
  const paymentState = order.remainingAmount === '0.00' ? 'مدفوع' : 'دين';

  win.document.write(`<!doctype html>
  <html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${escapeHtml(order.number)}</title>
  <style>
    body{font-family:Arial,sans-serif;color:#172033;margin:36px;line-height:1.6}
    header{display:flex;justify-content:space-between;border-bottom:2px solid #1f8a46;padding-bottom:18px;margin-bottom:24px}
    h1{font-size:24px;margin:0} .muted{color:#667085}.grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:24px}
    table{width:100%;border-collapse:collapse;margin:18px 0}th,td{border:1px solid #d9e0ea;padding:10px;text-align:right}th{background:#f5f7fa}
    .totals{margin-right:auto;width:320px}.row{display:flex;justify-content:space-between;padding:6px 0}.total{font-size:18px;font-weight:700;border-top:2px solid #172033}
    .state{display:inline-block;padding:4px 12px;border-radius:4px;background:${paymentState === 'مدفوع' ? '#e8f7ee' : '#fff0f0'};color:${paymentState === 'مدفوع' ? '#15713a' : '#b42318'};font-weight:700}
    @media print{body{margin:18px}}
  </style></head><body>
  <header><div><h1>OH Finance</h1><div class="muted">تفاصيل الطلب</div></div><div><strong>${escapeHtml(order.number)}</strong><br>${escapeHtml(order.issuedAt.slice(0, 10))}</div></header>
  <div class="grid"><div><strong>الزبون</strong><br>${escapeHtml(order.customerName)}</div><div><strong>حالة الدفع</strong><br><span class="state">${paymentState}</span></div></div>
  <table><thead><tr><th>البند</th><th>الكمية</th><th>السعر</th><th>الضريبة</th><th>الإجمالي</th></tr></thead><tbody>${items}</tbody></table>
  <div class="totals"><div class="row"><span>المجموع الفرعي</span><span>${money(order.subtotal)}</span></div><div class="row"><span>الضريبة</span><span>${money(order.taxAmount)}</span></div><div class="row total"><span>تكلفة الطلب</span><span>${money(order.total)}</span></div><div class="row"><span>المدفوع</span><span>${money(order.paidAmount)}</span></div><div class="row"><span>الدين</span><span>${money(order.remainingAmount)}</span></div></div>
  </body></html>`);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 300);
}
