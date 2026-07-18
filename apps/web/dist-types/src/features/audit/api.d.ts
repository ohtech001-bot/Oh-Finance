/**
 * نشاط كيان محدد — لتبويب «النشاط» في ملف الزبون وتفاصيل الطلب.
 *
 * قراءة فقط. السجل append-only على الخادم؛ لا مسار كتابة/تعديل.
 * يتطلب صلاحية `audit.read` — الخطاف يُعطَّل بلا صلاحية فلا يُطلق طلبًا يُرفض.
 */
export declare function useEntityActivity(entityType: string, entityId: string | undefined, enabled?: boolean): import("@tanstack/react-query").UseQueryResult<NoInfer<{
    id: string;
    seq: string;
    action: string;
    actorId: string | null;
    actorName: string | null;
    entityType: string | null;
    entityId: string | null;
    actorIp: string | null;
    summary: string;
    createdAt: string;
}[]>, Error>;
//# sourceMappingURL=api.d.ts.map