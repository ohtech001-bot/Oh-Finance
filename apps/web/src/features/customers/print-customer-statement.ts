import type {
  Customer,
  CustomerStatement,
  LedgerEntryType,
  OrderDetail,
  SessionUser,
} from '@oh/contracts';
import {
  abs,
  formatMoney,
  isNegative,
  isPositive,
  toMoneyString,
  type CurrencyCode,
} from '@oh/money';
import type { LocaleCode } from '@oh/config';

interface PrintCustomerStatementOptions {
  statement: CustomerStatement;
  customer: Customer;
  currency: CurrencyCode;
  locale: LocaleCode;
  store: SessionUser['store'];
  orders: OrderDetail[];
  targetWindow?: Window | null;
}

const labels = {
  ar: {
    title: 'كشف حساب',
    accountOwner: 'تفاصيل صاحب الحساب',
    accountDetails: 'تفاصيل الحساب',
    name: 'الاسم',
    company: 'الشركة',
    phone: 'الهاتف',
    email: 'البريد الإلكتروني',
    address: 'العنوان',
    storePhone: 'رقم المحل',
    generatedAt: 'تاريخ إصدار الكشف',
    currentDebt: 'الدين الحالي',
    availableCredit: 'الرصيد المتاح',
    settled: 'الحساب مسدّد',
    debtLimit: 'حد الدين',
    dueDate: 'تاريخ السداد',
    totalOrders: 'إجمالي الطلبات',
    orderDetails: 'تفاصيل الطلبات',
    orderNumber: 'رقم الطلب',
    products: 'المنتجات',
    product: 'المنتج',
    quantity: 'الكمية',
    unitPrice: 'سعر الوحدة',
    lineTotal: 'السعر الكلي',
    orderTotal: 'قيمة الطلب',
    financialMovements: 'الحركات المالية',
    date: 'التاريخ',
    time: 'الساعة',
    movement: 'نوع الحركة',
    debt: 'الدين',
    paid: 'المدفوع',
    balanceAfter: 'الرصيد بعد',
    reference: 'المرجع',
    noValue: '—',
  },
  he: {
    title: 'דף חשבון',
    accountOwner: 'פרטי בעל החשבון',
    accountDetails: 'פרטי החשבון',
    name: 'שם',
    company: 'חברה',
    phone: 'טלפון',
    email: 'דוא״ל',
    address: 'כתובת',
    storePhone: 'טלפון העסק',
    generatedAt: 'תאריך הפקת הדוח',
    currentDebt: 'חוב נוכחי',
    availableCredit: 'יתרת זכות',
    settled: 'החשבון מאוזן',
    debtLimit: 'מסגרת',
    dueDate: 'תאריך תשלום',
    totalOrders: 'סך ההזמנות',
    orderDetails: 'פרטי ההזמנות',
    orderNumber: 'מספר הזמנה',
    products: 'מוצרים',
    product: 'מוצר',
    quantity: 'כמות',
    unitPrice: 'מחיר ליחידה',
    lineTotal: 'מחיר כולל',
    orderTotal: 'סכום ההזמנה',
    financialMovements: 'תנועות כספיות',
    date: 'תאריך',
    time: 'שעה',
    movement: 'סוג תנועה',
    debt: 'חוב',
    paid: 'שולם',
    balanceAfter: 'יתרה לאחר',
    reference: 'אסמכתה',
    noValue: '—',
  },
  en: {
    title: 'Account Statement',
    accountOwner: 'Account Holder Details',
    accountDetails: 'Account Details',
    name: 'Name',
    company: 'Company',
    phone: 'Phone',
    email: 'Email',
    address: 'Address',
    storePhone: 'Store phone',
    generatedAt: 'Statement issued',
    currentDebt: 'Current debt',
    availableCredit: 'Available credit',
    settled: 'Account settled',
    debtLimit: 'Debt limit',
    dueDate: 'Payment due date',
    totalOrders: 'Total orders',
    orderDetails: 'Order Details',
    orderNumber: 'Order number',
    products: 'Products',
    product: 'Product',
    quantity: 'Quantity',
    unitPrice: 'Unit price',
    lineTotal: 'Line total',
    orderTotal: 'Order total',
    financialMovements: 'Financial movements',
    date: 'Date',
    time: 'Time',
    movement: 'Movement',
    debt: 'Debt',
    paid: 'Paid',
    balanceAfter: 'Balance after',
    reference: 'Reference',
    noValue: '—',
  },
} as const;

const movementLabels: Record<LocaleCode, Record<LedgerEntryType, string>> = {
  ar: {
    OPENING_BALANCE: 'رصيد افتتاحي',
    ORDER_DEBIT: 'طلب',
    PAYMENT_CREDIT: 'دفعة',
    ADJUSTMENT_DEBIT: 'تسوية مدينة',
    ADJUSTMENT_CREDIT: 'تسوية دائنة',
    REVERSAL: 'عكس قيد',
    WRITE_OFF: 'إعدام دين',
  },
  he: {
    OPENING_BALANCE: 'יתרת פתיחה',
    ORDER_DEBIT: 'הזמנה',
    PAYMENT_CREDIT: 'תשלום',
    ADJUSTMENT_DEBIT: 'התאמת חובה',
    ADJUSTMENT_CREDIT: 'התאמת זכות',
    REVERSAL: 'ביטול תנועה',
    WRITE_OFF: 'מחיקת חוב',
  },
  en: {
    OPENING_BALANCE: 'Opening balance',
    ORDER_DEBIT: 'Order',
    PAYMENT_CREDIT: 'Payment',
    ADJUSTMENT_DEBIT: 'Debit adjustment',
    ADJUSTMENT_CREDIT: 'Credit adjustment',
    REVERSAL: 'Reversal',
    WRITE_OFF: 'Debt write-off',
  },
};

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function printCustomerStatement({
  statement,
  customer,
  currency,
  locale,
  store,
  orders,
  targetWindow,
}: PrintCustomerStatementOptions): void {
  const win = targetWindow ?? window.open('', '_blank', 'width=980,height=760');
  if (!win) return;

  const text = labels[locale];
  const dir = locale === 'en' ? 'ltr' : 'rtl';
  const money = (value: string) => escapeHtml(formatMoney(value, { currency }));
  const optional = (value: string | null | undefined) => (value ? escapeHtml(value) : text.noValue);
  const formatDate = (value: string) =>
    escapeHtml(
      new Intl.DateTimeFormat(locale, {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date(value)),
    );
  const formatTime = (value: string) =>
    escapeHtml(
      new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(
        new Date(value),
      ),
    );
  const balance = statement.totals.currentBalance;
  const balanceLabel = isPositive(balance)
    ? text.currentDebt
    : isNegative(balance)
      ? text.availableCredit
      : text.settled;
  const balanceClass = isPositive(balance) ? 'debt' : isNegative(balance) ? 'credit' : '';
  const address = [customer.address, customer.city].filter(Boolean).join('، ');
  const logo = store?.logoUrl ? `<img class="logo" src="${escapeHtml(store.logoUrl)}" alt="">` : '';
  const detail = (label: string, value: string | null | undefined, ltr = false) =>
    value
      ? `<div class="detail"><span class="label">${escapeHtml(label)}:</span><span class="value${ltr ? ' ltr' : ''}">${escapeHtml(value)}</span></div>`
      : '';
  const accountOwnerDetails = [
    detail(text.name, customer.name),
    detail(text.company, customer.company),
    detail(text.phone, customer.phone, true),
    detail(text.email, customer.email, true),
    detail(text.address, address),
  ].join('');
  const accountDetails = [
    detail(
      text.generatedAt,
      `${formatDate(statement.generatedAt)} ${formatTime(statement.generatedAt)}`,
    ),
    detail(text.debtLimit, money(customer.creditLimit)),
    customer.paymentDueDate ? detail(text.dueDate, formatDate(customer.paymentDueDate)) : '',
  ].join('');
  const orderDetails = [...orders]
    .sort((a, b) => a.issuedAt.localeCompare(b.issuedAt))
    .map((order) => {
      const products = order.items
        .map(
          (item) => `<tr>
            <td>${escapeHtml(item.name)}</td>
            <td>${escapeHtml(item.quantity)}</td>
            <td>${money(item.unitPrice)}</td>
            <td>${money(item.lineTotal)}</td>
          </tr>`,
        )
        .join('');
      return `<article class="order-card">
        <div class="order-head">
          <strong>${escapeHtml(text.orderNumber)}: <span dir="ltr">${escapeHtml(order.number.replace(/^ORD-/, ''))}</span></strong>
          <span>${formatDate(order.issuedAt)} · ${formatTime(order.issuedAt)}</span>
          <strong>${escapeHtml(text.orderTotal)}: ${money(order.total)}</strong>
        </div>
        <h3>${escapeHtml(text.products)}</h3>
        <table class="products-table">
          <thead><tr>
            <th>${escapeHtml(text.product)}</th>
            <th>${escapeHtml(text.quantity)}</th>
            <th>${escapeHtml(text.unitPrice)}</th>
            <th>${escapeHtml(text.lineTotal)}</th>
          </tr></thead>
          <tbody>${products}</tbody>
        </table>
      </article>`;
    })
    .join('');
  const rows = statement.entries
    .map(
      (entry) => `<tr>
        <td>${formatDate(entry.occurredAt)}</td>
        <td>${formatTime(entry.occurredAt)}</td>
        <td>${escapeHtml(movementLabels[locale][entry.entryType])}</td>
        <td>${entry.debit !== '0.00' ? money(entry.debit) : text.noValue}</td>
        <td>${entry.credit !== '0.00' ? money(entry.credit) : text.noValue}</td>
        <td>${money(entry.runningBalance)}</td>
        <td>${optional(entry.refNumber)}</td>
      </tr>`,
    )
    .join('');

  win.document.write(`<!doctype html>
<html lang="${locale}" dir="${dir}">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(text.title)} - ${escapeHtml(customer.name)}</title>
  <style>
    *{box-sizing:border-box}
    body{font-family:"Segoe UI",Tahoma,Arial,sans-serif;margin:24px;color:#101828;font-size:13px}
    .store-header{display:flex;align-items:center;justify-content:center;gap:14px;border-bottom:2px solid #c69a21;padding-bottom:16px;text-align:center}
    .logo{width:68px;height:68px;object-fit:contain}
    .store-name{font-size:24px;font-weight:800;margin:0}
    .store-phone{font-size:13px;color:#475467;margin-top:4px}
    .ltr{direction:ltr;text-align:left;unicode-bidi:embed}
    h1{text-align:center;font-size:20px;margin:18px 0}
    h2{font-size:15px;margin:0 0 12px;padding-bottom:8px;border-bottom:1px solid #d0d5dd}
    .section{border:1px solid #d0d5dd;border-radius:6px;padding:14px;margin-bottom:14px}
    .details{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px 22px}
    .detail{display:flex;gap:8px;min-width:0}
    .label{color:#667085;white-space:nowrap}
    .value{font-weight:600;overflow-wrap:anywhere}
    .summary{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-bottom:14px}
    .summary-item{border:1px solid #d0d5dd;border-radius:6px;padding:10px}
    .summary-value{font-size:15px;font-weight:800;margin-top:5px}
    .debt{color:#d92d20}.credit{color:#16803c}
    .order-card{border:1px solid #98a2b3;border-radius:6px;padding:12px;margin-bottom:12px;break-inside:avoid}
    .order-head{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:12px;margin-bottom:10px}
    .order-head strong:last-child{text-align:${dir === 'rtl' ? 'left' : 'right'}}
    h3{font-size:12px;margin:8px 0}
    table{width:100%;border-collapse:collapse;font-size:11px}
    th,td{border:1px solid #d0d5dd;padding:7px;text-align:${dir === 'rtl' ? 'right' : 'left'};vertical-align:top}
    th{background:#f2f4f7;font-weight:700}
    tbody tr:nth-child(even){background:#f9fafb}
    @page{size:A4;margin:12mm}
    @media print{body{margin:0}.section,.summary-item,.order-card,tr{break-inside:avoid}}
  </style>
</head>
<body>
  <header class="store-header">
    ${logo}
    <div>
      <p class="store-name">${escapeHtml(store?.name ?? 'OH Finance')}</p>
      ${store?.phone ? `<p class="store-phone">${escapeHtml(text.storePhone)}: <span class="ltr">${escapeHtml(store.phone)}</span></p>` : ''}
    </div>
  </header>

  <h1>${escapeHtml(text.title)}</h1>

  <section class="section">
    <h2>${escapeHtml(text.accountOwner)}</h2>
    <div class="details">
      ${accountOwnerDetails}
    </div>
  </section>

  <section class="section">
    <h2>${escapeHtml(text.accountDetails)}</h2>
    <div class="details">
      ${accountDetails}
    </div>
  </section>

  <div class="summary">
    <div class="summary-item"><span class="label">${escapeHtml(balanceLabel)}</span><div class="summary-value ${balanceClass}">${money(toMoneyString(abs(balance), 2))}</div></div>
    <div class="summary-item"><span class="label">${escapeHtml(text.totalOrders)}</span><div class="summary-value">${orders.length}</div></div>
  </div>

  ${orders.length ? `<h2>${escapeHtml(text.orderDetails)}</h2>${orderDetails}` : ''}

  <h2>${escapeHtml(text.financialMovements)}</h2>
  <table>
    <thead><tr>
      <th>${escapeHtml(text.date)}</th>
      <th>${escapeHtml(text.time)}</th>
      <th>${escapeHtml(text.movement)}</th>
      <th>${escapeHtml(text.debt)}</th>
      <th>${escapeHtml(text.paid)}</th>
      <th>${escapeHtml(text.balanceAfter)}</th>
      <th>${escapeHtml(text.reference)}</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>
</body>
</html>`);
  win.document.close();
  win.focus();
  win.addEventListener('load', () => win.print(), { once: true });
  window.setTimeout(() => win.print(), 500);
}
