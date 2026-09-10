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

type OrderPrintWindow = Window & {
  closePrintPreview?: () => void;
  printReceipt?: () => void;
  shareReceiptPdf?: () => Promise<void>;
};

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

function whatsappNumber(phone?: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (/^05\d{8}$/.test(digits)) return `972${digits.slice(1)}`;
  if (digits.startsWith('00')) return digits.slice(2);
  return digits.length >= 8 ? digits : null;
}

async function createReceiptPdf(win: Window, paperSize: PrintPaperSize): Promise<Blob> {
  const receipt = win.document.querySelector<HTMLElement>('.receipt');
  if (!receipt) throw new Error('Receipt element is missing');

  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import('html2canvas'),
    import('jspdf'),
  ]);
  const canvas = await html2canvas(receipt, {
    backgroundColor: '#ffffff',
    scale: 2,
    useCORS: true,
  });
  const image = canvas.toDataURL('image/jpeg', 0.96);

  if (paperSize === '80mm') {
    const pageWidth = 80;
    const imageHeight = (canvas.height * pageWidth) / canvas.width;
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: [pageWidth, Math.max(imageHeight, 40)],
    });
    pdf.addImage(image, 'JPEG', 0, 0, pageWidth, imageHeight);
    return pdf.output('blob');
  }

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const margin = 10;
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const imageWidth = pageWidth - margin * 2;
  const imageHeight = (canvas.height * imageWidth) / canvas.width;
  const printableHeight = pageHeight - margin * 2;

  let offset = 0;
  while (offset < imageHeight) {
    if (offset > 0) pdf.addPage();
    pdf.addImage(image, 'JPEG', margin, margin - offset, imageWidth, imageHeight);
    offset += printableHeight;
  }
  return pdf.output('blob');
}

export function printOrder(
  order: OrderDetail,
  currency: CurrencyCode,
  options: PrintOrderOptions = {},
) {
  const win = (options.targetWindow ??
    window.open('', '_blank', 'width=420,height=720')) as OrderPrintWindow | null;
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

  const filename = `order-${displayOrderNumber(order.number)}.pdf`;
  const customerWhatsapp = whatsappNumber(options.customer?.phone);

  win.closePrintPreview = () => {
    win.opener?.focus();
    win.close();
  };
  win.printReceipt = () => win.print();
  win.shareReceiptPdf = async () => {
    const shareButton = win.document.querySelector<HTMLButtonElement>('[data-share-pdf]');
    const originalText = shareButton?.textContent ?? '';
    if (shareButton) {
      shareButton.disabled = true;
      shareButton.textContent = 'جارٍ تجهيز PDF...';
    }

    try {
      const blob = await createReceiptPdf(win, paperSize);
      const file = new File([blob], filename, { type: 'application/pdf' });
      const shareData: ShareData = {
        files: [file],
        title: `طلب ${displayOrderNumber(order.number)}`,
        text: `طلب ${displayOrderNumber(order.number)} - ${order.customerName}`,
      };

      if (win.navigator.share && (!win.navigator.canShare || win.navigator.canShare(shareData))) {
        await win.navigator.share(shareData);
        return;
      }

      const downloadUrl = URL.createObjectURL(blob);
      const link = win.document.createElement('a');
      link.href = downloadUrl;
      link.download = filename;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 30_000);

      if (customerWhatsapp) {
        win.open(
          `https://wa.me/${customerWhatsapp}?text=${encodeURIComponent(`طلب ${displayOrderNumber(order.number)} جاهز بصيغة PDF. أرفق الملف الذي تم تنزيله.`)}`,
          '_blank',
          'noopener,noreferrer',
        );
      }
      win.alert('تم تنزيل ملف PDF. أرفقه في محادثة واتساب للزبون.');
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      win.alert('تعذر إنشاء ملف PDF. حاول مرة أخرى.');
    } finally {
      if (shareButton) {
        shareButton.disabled = false;
        shareButton.textContent = originalText;
      }
    }
  };

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
      .print-toolbar{position:sticky;top:0;z-index:10;display:flex;gap:8px;justify-content:center;width:100%;padding:10px;background:#f8fafc;border-bottom:1px solid #dbe3ed;direction:rtl}
      .print-toolbar button{min-height:38px;padding:7px 12px;border:1px solid #cbd5e1;border-radius:6px;background:#fff;color:#172033;font:700 13px Arial,Tahoma,sans-serif;cursor:pointer}
      .print-toolbar button.primary{border-color:#218a43;background:#218a43;color:#fff}
      .print-toolbar button:disabled{cursor:wait;opacity:.65}
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
      @media print{html,body{width:${a4 ? '100%' : '74mm'}}.print-toolbar{display:none!important}.receipt{break-inside:avoid}}
    </style>
  </head>
  <body>
    <nav class="print-toolbar" aria-label="إجراءات الطباعة">
      <button type="button" onclick="window.closePrintPreview()">رجوع ←</button>
      <button class="primary" type="button" onclick="window.printReceipt()">طباعة</button>
      <button type="button" data-share-pdf onclick="window.shareReceiptPdf()">مشاركة PDF</button>
    </nav>
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
