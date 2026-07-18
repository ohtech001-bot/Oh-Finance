import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { SettingsSection, StoreSettings } from '@oh/contracts';
import { api } from '@/lib/api';

const KEY = ['settings'];

export function useSettings() {
  return useQuery({
    queryKey: KEY,
    queryFn: () => api.get<StoreSettings>('/settings'),
    staleTime: 60_000,
  });
}

export function useUpdateSettingsSection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ section, data }: { section: SettingsSection; data: unknown }) =>
      api.patch<StoreSettings>(`/settings/${section}`, data),
    onSuccess: (fresh) => {
      qc.setQueryData(KEY, fresh);
    },
  });
}
