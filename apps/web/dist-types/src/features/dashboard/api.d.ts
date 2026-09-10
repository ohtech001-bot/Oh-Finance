import type { DashboardQuery } from '@oh/contracts';
/**
 * بيانات لوحة التحكم — كلها من الخادم (مشتقة من قاعدة البيانات، بمنطقة المحل).
 *
 * مفتاح الاستعلام يشمل الفترة والدقّة، فلكل فترة نسختها المخزّنة. `staleTime`
 * قصير: الأرقام المالية تتغيّر مع كل دفعة/طلب، فلا نعرض دَينًا سُدِّد للتو.
 */
export declare function useDashboard(query: Partial<DashboardQuery>): import("@tanstack/react-query").UseQueryResult<NoInfer<{
    kpis: {
        id: "orders" | "revenue" | "payments" | "outstanding_balance" | "overdue_balance" | "overdue_customers" | "active_customers" | "average_order_value" | "collection_rate" | "unallocated_payments";
        value: string;
        unit: "count" | "money" | "percent";
        previous: string | null;
        deltaPct: number | null;
        trend: "flat" | "up" | "down";
    }[];
    trends: {
        id: "orders" | "revenue" | "payments" | "outstanding_balance" | "new_customers";
        unit: "count" | "money" | "percent";
        points: {
            value: string;
            bucket: string;
        }[];
    }[];
    topCustomers: {
        id: string;
        code: string;
        amount: string;
        name: string;
    }[];
    topDebtors: {
        id: string;
        code: string;
        balance: string;
        name: string;
        oldestOverdueAt: string | null;
        openOrders: number;
    }[];
    recentPayments: {
        number: string;
        id: string;
        customerId: string;
        customerName: string;
        createdByName: string | null;
        amount: string;
        paidAt: string;
        method: "CASH" | "BANK_TRANSFER" | "CARD" | "CHECK";
    }[];
    recentOrders: {
        number: string;
        id: string;
        customerId: string;
        customerName: string;
        status: "PAID" | "PARTIALLY_PAID" | "CANCELLED" | "DRAFT" | "QUOTE" | "CONFIRMED";
        total: string;
        issuedAt: string;
    }[];
    meta: {
        generatedAt: string;
        currency: string;
        timezone: string;
        storeName: string;
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
            kpis: ("orders" | "revenue" | "payments" | "outstanding_balance" | "overdue_balance" | "overdue_customers" | "active_customers" | "average_order_value" | "collection_rate" | "unallocated_payments")[];
            trends: ("orders" | "revenue" | "payments" | "outstanding_balance" | "new_customers")[];
            lists: ("topCustomers" | "topDebtors" | "recentPayments" | "recentOrders")[];
        };
    };
    alerts: {
        id: string;
        message: string;
        date: string | null;
        amount: string | null;
        entityType: string | null;
        entityId: string | null;
        kind: "unallocated_payments" | "approaching_credit_limit" | "over_credit_limit" | "long_overdue" | "stale_draft_orders" | "inactive_no_activity" | "subscription_ending";
        severity: "info" | "warning" | "critical";
        actionHref: string | null;
    }[];
}>, Error>;
//# sourceMappingURL=api.d.ts.map