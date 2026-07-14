export declare class ApiRequestError extends Error {
    readonly status: number;
    readonly code: string;
    readonly fields?: Record<string, string[]> | undefined;
    readonly requestId?: string | undefined;
    constructor(status: number, code: string, message: string, fields?: Record<string, string[]> | undefined, requestId?: string | undefined);
    get isUnauthenticated(): boolean;
    get isForbidden(): boolean;
    get isValidation(): boolean;
}
interface RequestOptions extends Omit<RequestInit, 'body'> {
    body?: unknown;
    /** مفتاح منع التكرار — إلزامي للدفعات (المرحلة 5). */
    idempotencyKey?: string;
}
export declare const api: {
    get: <T>(path: string, options?: RequestOptions) => Promise<T>;
    post: <T>(path: string, body?: unknown, options?: RequestOptions) => Promise<T>;
    patch: <T>(path: string, body?: unknown, options?: RequestOptions) => Promise<T>;
    delete: <T>(path: string, options?: RequestOptions) => Promise<T>;
};
/** يبني query string — يتخطى القيم الفارغة كي لا تظهر `?status=` في المسار. */
export declare function buildQuery(params: Record<string, string | number | undefined | null>): string;
export {};
//# sourceMappingURL=api.d.ts.map