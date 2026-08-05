export declare function useNotifications(enabled: boolean): import("@tanstack/react-query").UseQueryResult<NoInfer<{
    items: {
        id: string;
        title: string;
        occurredAt: string;
        kind: "ORDER_CREATED" | "PAYMENT_RECEIVED" | "PAYMENT_DUE_SOON" | "PAYMENT_DUE_TODAY" | "PAYMENT_DUE_OVERDUE";
        severity: "info" | "success" | "warning" | "danger";
        description: string;
        href: string;
        customerName?: string | undefined;
        amount?: string | undefined;
        orderNumber?: string | undefined;
        balance?: string | undefined;
    }[];
    total: number;
}>, Error>;
//# sourceMappingURL=api.d.ts.map