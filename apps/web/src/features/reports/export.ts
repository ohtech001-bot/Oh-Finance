import type { ReportsData } from '@oh/contracts';

/**
 * تصدير التقرير — بلا اعتماديات خارجية.
 *
 *  • CSV (يفتحه Excel مباشرة) — للأرقام والجداول.
 *  • الطباعة/PDF — عبر متصفح المستخدم (`window.print`)، فتُحترم RTL والخطوط
 *    العربية أصلًا، وتصدير PDF من حوار الطباعة.
 *
 *  ملاحظة صريحة: توليد XLSX/PDF على الخادم مؤجَّل (يتطلب مكتبات)؛ CSV+الطباعة
 *  يغطّيان الحاجة الآن بلا تضخيم الاعتماديات.
 */

/** يقتبس حقل CSV بأمان (فواصل/علامات اقتباس/أسطر). */
function csvCell(value: string | number): string {
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function rowsToCsv(rows: (string | number)[][]): string {
  return rows.map((r) => r.map(csvCell).join(',')).join('\n');
}

export function downloadReportCsv(data: ReportsData): void {
  const k = data.kpis;
  const sections: (string | number)[][] = [
    ['تقرير المحل', data.meta.storeName],
    ['الفترة', data.meta.range.label],
    ['العملة', data.meta.currency],
    [],
    ['المؤشر', 'القيمة', 'الفترة السابقة', 'التغيّر %'],
    ['الإيراد', k.sales.value, k.sales.previous ?? '', k.sales.deltaPct ?? ''],
    ['المقبوضات', k.payments.value, k.payments.previous ?? '', k.payments.deltaPct ?? ''],
    ['الديون', k.outstanding.value, k.outstanding.previous ?? '', k.outstanding.deltaPct ?? ''],
    ['عدد الطلبات', k.ordersCount.value, k.ordersCount.previous ?? '', k.ordersCount.deltaPct ?? ''],
    ['متوسط قيمة الطلب', k.averageOrderValue.value, k.averageOrderValue.previous ?? '', ''],
    ['الزبائن النشطون', k.activeCustomers.value, k.activeCustomers.previous ?? '', ''],
    ['الضرائب', k.taxes.value, k.taxes.previous ?? '', ''],
    ['الخصومات', k.discounts.value, k.discounts.previous ?? '', ''],
    ['متوسط مدة السداد (يوم)', k.avgPaymentDurationDays ?? ''],
    [],
    ['أعلى الزبائن مبيعًا', 'إجمالي المشتريات'],
    ...data.topCustomers.map((c) => [c.name, c.purchases]),
    [],
    ['أكثر المنتجات مبيعًا', 'الكمية', 'إجمالي المبيعات'],
    ...data.topProducts.map((p) => [p.name, p.quantity, p.sales]),
    [],
    ['طريقة الدفع', 'المبلغ', 'العدد', 'النسبة %'],
    ...data.paymentMethods.map((m) => [m.method, m.amount, m.count, m.pct]),
  ];

  // BOM لضمان قراءة Excel للعربية بترميز UTF-8.
  const blob = new Blob(['﻿' + rowsToCsv(sections)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `تقرير-${data.meta.range.label}-${data.meta.generatedAt.slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function printReport(): void {
  window.print();
}
