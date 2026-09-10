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
        id: string;
        code: string;
        name: string;
        purchases: string;
    }[];
    topDebtors: {
        id: string;
        code: string;
        balance: string;
        name: string;
        creditLimit: string;
        paymentDueDay: number;
        overCreditLimit: boolean;
        dueReached: boolean;
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
        scope: string[];
    };
    salesVsPayments: {
        date: string;
        payments: string;
        sales: string;
    }[];
    ordersByWeekday: {
        count: number;
        label: string;
        weekday: number;
    }[];
    ordersByStatus: {
        status: "PAID" | "PARTIALLY_PAID" | "CANCELLED" | "DRAFT" | "QUOTE" | "CONFIRMED";
        amount: string;
        count: number;
    }[];
    paymentMethods: {
        amount: string;
        method: "CASH" | "BANK_TRANSFER" | "CARD" | "CHECK";
        count: number;
        pct: number;
    }[];
    urgentCustomers: {
        id: string;
        code: string;
        balance: string;
        name: string;
        creditLimit: string;
        paymentDueDay: number;
        overCreditLimit: boolean;
        dueReached: boolean;
    }[];
    topProducts: {
        name: string;
        quantity: string;
        sales: string;
    }[];
    employeePerformance: {
        orders: number;
        name: string;
        payments: string;
        sales: string;
        userId: string | null;
    }[];
    salesByCategory: {
        reason: string;
        available: boolean;
    };
    branchReports: {
        reason: string;
        available: boolean;
    };
}>, Error>;
//# sourceMappingURL=api.d.ts.map