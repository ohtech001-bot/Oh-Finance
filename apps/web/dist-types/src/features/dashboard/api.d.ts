import type { DashboardQuery } from '@oh/contracts';
/**
 * بيانات لوحة التحكم — كلها من الخادم (مشتقة من قاعدة البيانات، بمنطقة المحل).
 *
 * مفتاح الاستعلام يشمل الفترة والدقّة، فلكل فترة نسختها المخزّنة. `staleTime`
 * قصير: الأرقام المالية تتغيّر مع كل دفعة/طلب، فلا نعرض دَينًا سُدِّد للتو.
 */
export declare function useDashboard(query: Partial<DashboardQuery>): import("@tanstack/react-query").UseQueryResult<NoInfer<{
    kpis: {
        id: "revenue" | "payments" | "orders" | "outstanding_balance" | "overdue_balance" | "overdue_customers" | "active_customers" | "average_order_value" | "collection_rate" | "unallocated_payments";
        value: string;
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
        id: string;
        code: string;
        name: string;
        amount: string;
    }[];
    topDebtors: {
        id: string;
        code: string;
        name: string;
        balance: string;
        oldestOverdueAt: string | null;
        openOrders: number;
    }[];
    recentPayments: {
        number: string;
        id: string;
        customerId: string;
        customerName: string;
        paidAt: string;
        method: "CASH" | "BANK_TRANSFER" | "CARD" | "CHECK";
        amount: string;
        createdByName: string | null;
    }[];
    recentOrders: {
        number: string;
        id: string;
        status: "DRAFT" | "QUOTE" | "CONFIRMED" | "PARTIALLY_PAID" | "PAID" | "CANCELLED";
        total: string;
        customerId: string;
        customerName: string;
        issuedAt: string;
    }[];
    meta: {
        storeName: string;
        currency: string;
        timezone: string;
        generatedAt: string;
        range: {
            from: string;
            to: string;
            preset: "custom" | "today" | "yesterday" | "last_7_days" | "last_30_days" | "this_month" | "previous_month" | "this_year";
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
        id: string;
        message: string;
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