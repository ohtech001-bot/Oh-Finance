import { copy } from '@/lib/copy';
import { PAYMENT_METHOD_LABELS, type ReportsData } from '@oh/contracts';
import { csvCell } from '@/lib/csv';

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

function rowsToCsv(rows: (string | number)[][]): string {
  return rows.map((r) => r.map(csvCell).join(',')).join('\n');
}

export function downloadReportCsv(data: ReportsData): void {
  const k = data.kpis;
  const sections: (string | number)[][] = [
    [copy('تقرير المحل'), data.meta.storeName],
    [copy('الفترة'), copy(data.meta.range.label)],
    [copy('العملة'), data.meta.currency],
    [],
    [copy('المؤشر'), copy('القيمة'), copy('الفترة السابقة'), copy('التغيّر %')],
    [copy('الإيراد'), k.sales.value, k.sales.previous ?? '', k.sales.deltaPct ?? ''],
    [copy('المقبوضات'), k.payments.value, k.payments.previous ?? '', k.payments.deltaPct ?? ''],
    [
      copy('الديون'),
      k.outstanding.value,
      k.outstanding.previous ?? '',
      k.outstanding.deltaPct ?? '',
    ],
    [
      copy('عدد الطلبات'),
      k.ordersCount.value,
      k.ordersCount.previous ?? '',
      k.ordersCount.deltaPct ?? '',
    ],
    [copy('متوسط قيمة الطلب'), k.averageOrderValue.value, k.averageOrderValue.previous ?? '', ''],
    [copy('الزبائن النشطون'), k.activeCustomers.value, k.activeCustomers.previous ?? '', ''],
    [copy('الضرائب'), k.taxes.value, k.taxes.previous ?? '', ''],
    [copy('الخصومات'), k.discounts.value, k.discounts.previous ?? '', ''],
    [copy('متوسط مدة السداد (يوم)'), k.avgPaymentDurationDays ?? ''],
    [],
    [copy('أعلى الزبائن مبيعًا'), copy('إجمالي المشتريات')],
    ...data.topCustomers.map((c) => [c.name, c.purchases]),
    [],
    [copy('أكثر المنتجات مبيعًا'), copy('الكمية'), copy('إجمالي المبيعات')],
    ...data.topProducts.map((p) => [p.name, p.quantity, p.sales]),
    [],
    [copy('طريقة الدفع'), copy('المبلغ'), copy('العدد'), copy('النسبة %')],
    ...data.paymentMethods.map((m) => [
      copy(PAYMENT_METHOD_LABELS[m.method]),
      m.amount,
      m.count,
      m.pct,
    ]),
  ];

  // BOM لضمان قراءة Excel للعربية بترميز UTF-8.
  const blob = new Blob(['﻿' + rowsToCsv(sections)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = copy('تقرير-{{value0}}-{{value1}}.csv', {
    value0: copy(data.meta.range.label),
    value1: data.meta.generatedAt.slice(0, 10),
  });
  a.click();
  URL.revokeObjectURL(url);
}

export function printReport(): void {
  window.print();
}
