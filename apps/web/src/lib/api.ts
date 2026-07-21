import type { ApiError } from '@oh/contracts';

/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  عميل الـAPI.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  ── لا رموز في JavaScript ─────────────────────────────────────────────────
 *  لا يوجد في هذا الملف `localStorage` ولا `sessionStorage` ولا متغيّر يحمل
 *  رمز وصول. الرموز في كوكيز HttpOnly لا يراها JS إطلاقًا، والمتصفح يرسلها
 *  تلقائيًا بفضل `credentials: 'include'`.
 *
 *  النتيجة: ثغرة XSS — في كودنا أو في أي حزمة npm نستوردها — لا تستطيع
 *  سرقة الجلسة. تستطيع إطلاق طلبات نيابة عن المستخدم أثناء وجوده على
 *  الصفحة (وهذا سيّئ)، لكنها لا تستطيع أخذ الرمز والعودة به لاحقًا.
 *
 *  ── الرمز الوحيد الذي نقرأه: CSRF ─────────────────────────────────────────
 *  وهو ليس سرًّا: قيمته أنه **غير قابل للقراءة من أصل آخر**. موقع خبيث يستطيع
 *  إجبار متصفحك على إرسال كوكياتك، لكنه لا يستطيع قراءتها — فلا يستطيع ملء
 *  ترويسة X-CSRF-Token.
 */

const API_BASE = '/api';
export const UNAUTHENTICATED_EVENT = 'oh:unauthenticated';

export class ApiRequestError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly fields?: Record<string, string[]>,
    public readonly requestId?: string,
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }

  get isUnauthenticated(): boolean {
    return this.status === 401;
  }

  get isForbidden(): boolean {
    return this.status === 403;
  }

  get isValidation(): boolean {
    return this.code === 'VALIDATION_FAILED';
  }
}

/** يقرأ رمز CSRF من الكوكي (وهو الكوكي الوحيد غير HttpOnly). */
function readCsrfToken(): string | null {
  const match = /(?:^|;\s*)oh_csrf=([^;]+)/.exec(document.cookie);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

const MUTATING_METHODS = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  /** مفتاح منع التكرار — إلزامي للدفعات (المرحلة 5). */
  idempotencyKey?: string;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const method = (options.method ?? 'GET').toUpperCase();

  const headers = new Headers(options.headers);
  headers.set('Accept', 'application/json');

  if (options.body !== undefined) {
    headers.set('Content-Type', 'application/json');
  }

  if (MUTATING_METHODS.has(method)) {
    const csrf = readCsrfToken();
    if (csrf) headers.set('X-CSRF-Token', csrf);
  }

  if (options.idempotencyKey) {
    headers.set('Idempotency-Key', options.idempotencyKey);
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    method,
    headers,
    // ⬅ يرسل كوكيز الجلسة. بدونه لا مصادقة إطلاقًا.
    credentials: 'include',
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const requestId = response.headers.get('X-Request-Id') ?? undefined;

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const error = (payload ?? {}) as Partial<ApiError>;
    if (response.status === 401 && path !== '/auth/me') {
      window.dispatchEvent(new Event(UNAUTHENTICATED_EVENT));
    }
    throw new ApiRequestError(
      response.status,
      error.code ?? 'INTERNAL',
      error.message ?? 'حدث خطأ غير متوقع.',
      error.fields,
      error.requestId ?? requestId,
    );
  }

  return payload as T;
}

export const api = {
  get: <T>(path: string, options?: RequestOptions) =>
    request<T>(path, { ...options, method: 'GET' }),

  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: 'POST', body }),

  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: 'PATCH', body }),

  delete: <T>(path: string, options?: RequestOptions) =>
    request<T>(path, { ...options, method: 'DELETE' }),
};

/** يبني query string — يتخطى القيم الفارغة كي لا تظهر `?status=` في المسار. */
export function buildQuery(params: Record<string, string | number | undefined | null>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `?${query}` : '';
}
