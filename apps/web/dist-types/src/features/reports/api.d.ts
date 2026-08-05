import type { ReportsQuery } from '@oh/contracts';
/**
 * بيانات التقارير — كلها من الخادم (مشتقة من قاعدة البيانات بمنطقة المحل).
 * المفتاح يشمل الفترة، فلكل فترة نسختها المخزّنة.
 */
export declare function useReports(query: Partial<ReportsQuery>): import("@tanstack/react-query").UseQueryResult<NoInfer<{
    kpis: {
        payments: {
            value: string;
            previous: string | null;
            deltaPct: number | null;
        };
        sales: {
            value: string;
            previous: string | null;
            deltaPct: number | null;
        };
        outstanding: {
            value: string;
            previous: string | null;
            deltaPct: number | null;
        };
        ordersCount: {
            value: string;
            previous: string | null;
            deltaPct: number | null;
        };
        activeCustomers: {
            value: string;
            previous: string | null;
            deltaPct: number | null;
        };
        totalCustomers: number;
        averageOrderValue: {
            value: string;
            previous: string | null;
            deltaPct: number | null;
        };
        taxes: {
            value: string;
            previous: string | null;
            deltaPct: number | null;
        };
        discounts: {
            value: string;
            previous: string | null;
            deltaPct: number | null;
        };
        avgPaymentDurationDays: number | null;
    };
    topCustomers: {
        code: string;
        id: string;
        name: string;
        purchases: string;
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
        scope: string[];
    };
    salesVsPayments: {
        payments: string;
        date: string;
        sales: string;
    }[];
    ordersByWeekday: {
        label: string;
        count: number;
        weekday: number;
    }[];
    ordersByStatus: {
        status: "DRAFT" | "QUOTE" | "CONFIRMED" | "PARTIALLY_PAID" | "PAID" | "CANCELLED";
        count: number;
        amount: string;
    }[];
    paymentMethods: {
        count: number;
        amount: string;
        method: "CASH" | "BANK_TRANSFER" | "CARD" | "CHECK";
        pct: number;
    }[];
    topProducts: {
        name: string;
        sales: string;
        quantity: string;
    }[];
    employeePerformance: {
        payments: string;
        orders: number;
        name: string;
        sales: string;
        userId: string | null;
    }[];
    salesByCategory: {
        available: boolean;
        reason: string;
    };
    branchReports: {
        available: boolean;
        reason: string;
    };
}>, Error>;
//# sourceMappingURL=api.d.ts.map