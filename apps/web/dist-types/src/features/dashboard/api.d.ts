import type { DashboardQuery } from '@oh/contracts';
/**
 * بيانات لوحة التحكم — كلها من الخادم (مشتقة من قاعدة البيانات، بمنطقة المحل).
 *
 * مفتاح الاستعلام يشمل الفترة والدقّة، فلكل فترة نسختها المخزّنة. `staleTime`
 * قصير: الأرقام المالية تتغيّر مع كل دفعة/طلب، فلا نعرض دَينًا سُدِّد للتو.
 */
export declare function useDashboard(query: Partial<DashboardQuery>): import("@tanstack/react-query").UseQueryResult<NoInfer<{
    kpis: {
        value: string;
        id: "revenue" | "payments" | "orders" | "outstanding_balance" | "overdue_balance" | "overdue_customers" | "active_customers" | "average_order_value" | "collection_rate" | "unallocated_payments";
        unit: "money" | "count" | "percent";
        previous: string | null;
        deltaPct: number | null;
        trend: "flat" | "up" | "down";
    }[];
    trends: {
        id: "revenue" | "payments" | "orders" | "outstanding_balance" | "new_customers";
        unit: "money" | "count" | "percent";
        points: {
            value: string;
            bucket: string;
        }[];
    }[];
    topCustomers: {
        code: string;
        id: string;
        name: string;
        amount: string;
    }[];
    topDebtors: {
        code: string;
        id: string;
        name: string;
        balance: string;
        oldestOverdueAt: string | null;
        openOrders: number;
    }[];
    recentPayments: {
        number: string;
        id: string;
        amount: string;
        customerId: string;
        customerName: string;
        method: "CASH" | "BANK_TRANSFER" | "CARD" | "CHECK";
        paidAt: string;
        createdByName: string | null;
    }[];
    recentOrders: {
        number: string;
        status: "DRAFT" | "QUOTE" | "CONFIRMED" | "PARTIALLY_PAID" | "PAID" | "CANCELLED";
        id: string;
        customerId: string;
        customerName: string;
        total: string;
        issuedAt: string;
    }[];
    meta: {
        storeName: string;
        currency: string;
        timezone: string;
        generatedAt: string;
        range: {
            preset: "today" | "yesterday" | "last_7_days" | "last_30_days" | "this_month" | "previous_month" | "this_year" | "custom";
            from: string;
            to: string;
            granularity: "day" | "week" | "month";
            previousFrom: string;
            previousTo: string;
            label: string;
        };
        topCustomersBasis: "sales" | "collection";
        scope: {
            kpis: ("revenue" | "payments" | "orders" | "outstanding_balance" | "overdue_balance" | "overdue_customers" | "active_customers" | "average_order_value" | "collection_rate" | "unallocated_payments")[];
            trends: ("revenue" | "payments" | "orders" | "outstanding_balance" | "new_customers")[];
            lists: ("topCustomers" | "topDebtors" | "recentPayments" | "recentOrders")[];
        };
    };
    alerts: {
        message: string;
        id: string;
        date: string | null;
        amount: string | null;
        kind: "unallocated_payments" | "approaching_credit_limit" | "over_credit_limit" | "long_overdue" | "stale_draft_orders" | "inactive_no_activity" | "subscription_ending";
        severity: "info" | "warning" | "critical";
        entityType: string | null;
        entityId: string | null;
        actionHref: string | null;
    }[];
}>, Error>;
//# sourceMappingURL=api.d.ts.map