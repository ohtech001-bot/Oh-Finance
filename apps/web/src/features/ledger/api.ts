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
