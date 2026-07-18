import { useQuery } from '@tanstack/react-query';
import type {
  CustomerStatement,
  LedgerEntry,
  LedgerListQuery,
  LedgerTotals,
  PaginatedResult,
} from '@oh/contracts';
import { api, buildQuery } from '@/lib/api';

const KEY = 'ledger';

type LedgerList = PaginatedResult<LedgerEntry> & { totals: LedgerTotals };

export function useLedger(query: Partial<LedgerListQuery>) {
  return useQuery({
    queryKey: [KEY, 'list', query],
    queryFn: () => api.get<LedgerList>(`/ledger${buildQuery(query as Record<string, string>)}`),
  });
}

/**
 * يجمع **كل** حركات المرشّح الحالي عبر ترقيم الصفحات — للتصدير والطباعة.
 *
 * الجدول يعرض صفحة واحدة فقط، لكن التصدير يجب أن يشمل المجموعة المُرشَّحة
 * كاملة. نجمعها عند الطلب فقط (لا تُحمَّل مع كل عرض).
 */
export async function fetchAllLedger(query: Partial<LedgerListQuery>): Promise<LedgerEntry[]> {
  const rows: LedgerEntry[] = [];
  let page = 1;
  for (;;) {
    const pageQuery: Partial<LedgerListQuery> = { ...query, page, pageSize: 100 };
    const res = await api.get<LedgerList>(
      `/ledger${buildQuery(pageQuery as Record<string, string>)}`,
    );
    rows.push(...res.items);
    if (page >= res.totalPages || res.items.length === 0) break;
    page += 1;
    if (page > 500) break; // حد أمان ضد الحلقة اللانهائية
  }
  return rows;
}

export function useStatement(
  customerId: string | undefined,
  range: { from?: string; to?: string } = {},
) {
  return useQuery({
    queryKey: [KEY, 'statement', customerId, range],
    queryFn: () =>
      api.get<CustomerStatement>(`/ledger/statement/${customerId}${buildQuery(range)}`),
    enabled: Boolean(customerId),
  });
}
