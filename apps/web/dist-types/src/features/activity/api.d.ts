import type { ActivityFilters, PaginatedResult } from '@oh/contracts';
/**
 * موجز نشاط المحل (store-wide). يتطلب صلاحية `activity.read` على الخادم —
 * فمرّر `enabled = can('activity.read')` حتى لا نطلق طلبًا يعود بـ403 لمن لا
 * يملكها.
 *
 * `keepPreviousData` يمنع وميض القائمة أثناء تنقّل الصفحات أو تغيير الفلتر.
 * `staleTime` قصير: النشاط يجب أن يبدو حيًّا.
 */
export declare function useStoreActivityFeed(filters: Partial<ActivityFilters>, enabled?: boolean): import("@tanstack/react-query").UseQueryResult<NoInfer<PaginatedResult<{
    id: string;
    seq: string;
    category: "ORDER" | "PAYMENT" | "CUSTOMER" | "LEDGER" | "SYSTEM";
    action: string;
    title: string;
    actorId: string | null;
    actorName: string | null;
    entityType: string | null;
    entityId: string | null;
    occurredAt: string;
}>>, Error>;
/**
 * الخط الزمني لزبون. يتطلب `customers.read` للوصول؛ وتُرشَّح أنواع الأحداث
 * (طلبات/دفعات/حركات) على الخادم بحسب صلاحيات القراءة التفصيلية.
 */
export declare function useCustomerActivityFeed(customerId: string, filters: Partial<ActivityFilters>, enabled?: boolean): import("@tanstack/react-query").UseQueryResult<NoInfer<PaginatedResult<{
    id: string;
    seq: string;
    category: "ORDER" | "PAYMENT" | "CUSTOMER" | "LEDGER" | "SYSTEM";
    action: string;
    title: string;
    actorId: string | null;
    actorName: string | null;
    entityType: string | null;
    entityId: string | null;
    occurredAt: string;
}>>, Error>;
//# sourceMappingURL=api.d.ts.map