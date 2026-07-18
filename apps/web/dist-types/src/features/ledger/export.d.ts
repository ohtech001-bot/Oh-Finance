import { type LedgerEntry } from '@oh/contracts';
/** ينزّل الحركات كملف CSV. BOM في المقدمة كي يعرض Excel العربية سليمة. */
export declare function exportLedgerCsv(rows: LedgerEntry[], filename: string): void;
/** يفتح نافذة طباعة بجدول RTL منسّق. لا يعتمد على أي CSS خارجي. */
export declare function printLedger(rows: LedgerEntry[], title: string): void;
//# sourceMappingURL=export.d.ts.map