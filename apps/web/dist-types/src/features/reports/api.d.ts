import type { ReportsQuery } from '@oh/contracts';
/**
 * بيانات التقارير — كلها من الخادم (مشتقة من قاعدة البيانات بمنطقة المحل).
 * المفتاح يشمل الفترة، فلكل فترة نسختها المخزّنة.
 */
export declare function useReports(query: Partial<ReportsQuery>): import("@tanstack/react-query").UseQueryResult<NoInfer<{
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
            label: string;
            previousFrom: string;
            previousTo: string;
        };
        scope: string[];
    };
    kpis: {
        sales: {
            value: string;
            previous: string | null;
            deltaPct: number | null;
        };
        payments: {
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
    salesVsPayments: {
        date: string;
        sales: string;
        payments: string;
    }[];
    ordersByWeekday: {
        weekday: number;
        label: string;
        count: number;
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
    topCustomers: {
        code: string;
        id: string;
        name: string;
        purchases: string;
    }[];
    topProducts: {
        sales: string;
        name: string;
        quantity: string;
    }[];
    employeePerformance: {
        sales: string;
        payments: string;
        name: string;
        userId: string | null;
        orders: number;
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