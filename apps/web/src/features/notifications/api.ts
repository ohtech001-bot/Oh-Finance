import { useQuery } from '@tanstack/react-query';
import type { NotificationFeed } from '@oh/contracts';
import { api } from '@/lib/api';

export function useNotifications(enabled: boolean) {
  return useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.get<NotificationFeed>('/notifications'),
    enabled,
    staleTime: 30_000,
    refetchInterval: enabled ? 60_000 : false,
    refetchOnWindowFocus: false,
  });
}
