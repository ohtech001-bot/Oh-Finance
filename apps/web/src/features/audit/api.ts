import { useQuery } from '@tanstack/react-query';
import type { AuditLog } from '@oh/contracts';
import { api } from '@/lib/api';

/**
 * نشاط كيان محدد — لتبويب «النشاط» في ملف الزبون وتفاصيل الطلب.
 *
 * قراءة فقط. السجل append-only على الخادم؛ لا مسار كتابة/تعديل.
 * يتطلب صلاحية `audit.read` — الخطاف يُعطَّل بلا صلاحية فلا يُطلق طلبًا يُرفض.
 */
export function useEntityActivity(
  entityType: string,
  entityId: string | undefined,
  enabled = true,
) {
  return useQuery({
    queryKey: ['audit', 'entity', entityType, entityId],
    queryFn: () => api.get<AuditLog[]>(`/audit/entity/${entityType}/${entityId}`),
    enabled: Boolean(entityId) && enabled,
  });
}
