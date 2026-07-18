import type { SettingsSection } from '@oh/contracts';
export declare function useSettings(): import("@tanstack/react-query").UseQueryResult<NoInfer<{
    general: {
        email: string | null;
        name: string;
        logoUrl: string | null;
        address: string | null;
        timezone: string;
        language: "ar" | "he" | "en";
    };
    financial: {
        currency: string;
        country: string;
        numberFormat: "1,234.56" | "1.234,56" | "1234.56";
        dateFormat: "YYYY-MM-DD" | "DD/MM/YYYY" | "MM/DD/YYYY";
        tax: {
            enabled: boolean;
            rate: number;
            text: string;
        };
    };
    invoices: {
        notes: string;
        numberFormat: string;
        startNumber: number;
        prefix: string;
        suffix: string;
        priceIncludesTax: boolean;
        showTaxColumn: boolean;
    };
    printing: {
        printer: string;
        paperSize: "A4" | "A5" | "80mm" | "58mm";
        orientation: "portrait" | "landscape";
        printLogo: boolean;
        printInvoiceNumber: boolean;
        printDateTime: boolean;
        printBarcode: boolean;
    };
    messaging: {
        whatsappEnabled: boolean;
        whatsappNumber: string;
        newOrderTemplate: string;
        alertsEnabled: boolean;
        newOrdersFrequency: "instant" | "hourly" | "daily" | "off";
        sequence: "instant" | "hourly" | "daily" | "off";
    };
}>, Error>;
export declare function useUpdateSettingsSection(): import("@tanstack/react-query").UseMutationResult<{
    general: {
        email: string | null;
        name: string;
        logoUrl: string | null;
        address: string | null;
        timezone: string;
        language: "ar" | "he" | "en";
    };
    financial: {
        currency: string;
        country: string;
        numberFormat: "1,234.56" | "1.234,56" | "1234.56";
        dateFormat: "YYYY-MM-DD" | "DD/MM/YYYY" | "MM/DD/YYYY";
        tax: {
            enabled: boolean;
            rate: number;
            text: string;
        };
    };
    invoices: {
        notes: string;
        numberFormat: string;
        startNumber: number;
        prefix: string;
        suffix: string;
        priceIncludesTax: boolean;
        showTaxColumn: boolean;
    };
    printing: {
        printer: string;
        paperSize: "A4" | "A5" | "80mm" | "58mm";
        orientation: "portrait" | "landscape";
        printLogo: boolean;
        printInvoiceNumber: boolean;
        printDateTime: boolean;
        printBarcode: boolean;
    };
    messaging: {
        whatsappEnabled: boolean;
        whatsappNumber: string;
        newOrderTemplate: string;
        alertsEnabled: boolean;
        newOrdersFrequency: "instant" | "hourly" | "daily" | "off";
        sequence: "instant" | "hourly" | "daily" | "off";
    };
}, Error, {
    section: SettingsSection;
    data: unknown;
}, unknown>;
//# sourceMappingURL=api.d.ts.map