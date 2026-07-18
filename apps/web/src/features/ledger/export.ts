import { LEDGER_TYPE_LABELS, type LedgerEntry } from '@oh/contracts';

/**
 * تصدير وطباعة دفتر الحركات.
 *
 * ⚠️ لا تحويل أرقام هنا: المبالغ سلاسل عشرية من الخادم (`@oh/money`) وتُكتب
 *    كما هي. تحويلها إلى `number` يفقد الدقة — وهذا دفتر محاسبي.
 */

const HEADERS = [
  'التاريخ',
  'الوقت',
  'نوع الحركة',
  'الزبون',
  'رقم الزبون',
  'المرجع',
  'المدين',
  'الدائن',
  'الرصيد بعد الحركة',
  'ملاحظات',
] as const;

function timeOf(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function rowCells(e: LedgerEntry): string[] {
  return [
    e.occurredAt.slice(0, 10),
    timeOf(e.occurredAt),
    LEDGER_TYPE_LABELS[e.entryType],
    e.customerName,
    e.customerCode,
    e.refNumber ?? '',
    e.debit !== '0.00' ? e.debit : '',
    e.credit !== '0.00' ? e.credit : '',
    e.runningBalance,
    e.notes ?? '',
  ];
}

/** يهرّب خلية CSV وفق RFC 4180. */
function csvCell(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

/** ينزّل الحركات كملف CSV. BOM في المقدمة كي يعرض Excel العربية سليمة. */
export function exportLedgerCsv(rows: LedgerEntry[], filename: string): void {
  const lines = [HEADERS, ...rows.map(rowCells)].map((cells) => cells.map(csvCell).join(','));
  const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** يفتح نافذة طباعة بجدول RTL منسّق. لا يعتمد على أي CSS خارجي. */
export function printLedger(rows: LedgerEntry[], title: string): void {
  const win = window.open('', '_blank', 'width=980,height=720');
  if (!win) return;

  const head = HEADERS.map((h) => `<th>${escapeHtml(h)}</th>`).join('');
  const body = rows
    .map((e) => `<tr>${rowCells(e).map((c) => `<td>${escapeHtml(c)}</td>`).join('')}</tr>`)
    .join('');

  win.document.write(`<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8" />
<title>${escapeHtml(title)}</title>
<style>
  body { font-family: 'Segoe UI', Tahoma, sans-serif; margin: 24px; color: #111; }
  h1 { font-size: 18px; margin: 0 0 4px; }
  .meta { color: #666; font-size: 12px; margin-bottom: 16px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th, td { border: 1px solid #d0d0d0; padding: 6px 8px; text-align: right; }
  th { background: #f3f4f6; }
  tbody tr:nth-child(even) { background: #fafafa; }
  @media print { body { margin: 0; } }
</style></head><body>
<h1>${escapeHtml(title)}</h1>
<div class="meta">${rows.length} حركة — ${new Date().toLocaleDateString('en-GB')}</div>
<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>
</body></html>`);
  win.document.close();
  win.focus();
  win.addEventListener('load', () => {
    win.print();
  });
  // احتياط لو أُطلق حدث load قبل ربط المستمع.
  setTimeout(() => win.print(), 400);
}
