import { afterEach, describe, expect, it, vi } from 'vitest';
import { api, resetApiSessionStateForTests, UNAUTHENTICATED_EVENT } from './api';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('API session refresh', () => {
  afterEach(() => {
    resetApiSessionStateForTests();
    vi.unstubAllGlobals();
  });

  it('renews an expired session and retries the original request once', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ code: 'TOKEN_EXPIRED' }, 401))
      .mockResolvedValueOnce(jsonResponse({ user: {} }))
      .mockResolvedValueOnce(jsonResponse({ items: ['payment'] }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(api.get<{ items: string[] }>('/payments')).resolves.toEqual({
      items: ['payment'],
    });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[1]?.[0]).toBe('/api/auth/refresh');
    expect(fetchMock.mock.calls[2]?.[0]).toBe('/api/payments');
  });

  it('shares one refresh between concurrent unauthorized requests', async () => {
    const attempts = new Map<string, number>();
    const fetchMock = vi.fn<typeof fetch>(async (input) => {
      const url = String(input);
      if (url === '/api/auth/refresh') {
        await Promise.resolve();
        return jsonResponse({ user: {} });
      }

      const attempt = (attempts.get(url) ?? 0) + 1;
      attempts.set(url, attempt);
      return attempt === 1
        ? jsonResponse({ code: 'TOKEN_EXPIRED' }, 401)
        : jsonResponse({ ok: true });
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(Promise.all([api.get('/payments'), api.get('/payments/stats')])).resolves.toEqual([
      { ok: true },
      { ok: true },
    ]);

    expect(fetchMock.mock.calls.filter(([input]) => input === '/api/auth/refresh')).toHaveLength(1);
  });

  it('stops protected requests after the session can no longer be refreshed', async () => {
    const unauthenticated = vi.fn();
    window.addEventListener(UNAUTHENTICATED_EVENT, unauthenticated);
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ code: 'UNAUTHENTICATED' }, 401))
      .mockResolvedValueOnce(jsonResponse({ code: 'UNAUTHENTICATED' }, 401));
    vi.stubGlobal('fetch', fetchMock);

    await expect(api.get('/customers')).rejects.toMatchObject({ status: 401 });
    await expect(api.get('/customers/stats')).rejects.toMatchObject({ status: 401 });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(unauthenticated).toHaveBeenCalledTimes(1);
    window.removeEventListener(UNAUTHENTICATED_EVENT, unauthenticated);
  });

  it('does not request a refresh for an anonymous session check without a CSRF cookie', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ code: 'UNAUTHENTICATED' }, 401));
    vi.stubGlobal('fetch', fetchMock);

    await expect(api.get('/auth/me')).rejects.toMatchObject({ status: 401 });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/auth/me');
  });

  it('opens the protected request gate again after a successful login', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ code: 'UNAUTHENTICATED' }, 401))
      .mockResolvedValueOnce(jsonResponse({ code: 'UNAUTHENTICATED' }, 401))
      .mockResolvedValueOnce(jsonResponse({ user: { id: 'user-1' } }))
      .mockResolvedValueOnce(jsonResponse({ items: [] }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(api.get('/customers')).rejects.toMatchObject({ status: 401 });
    await expect(api.post('/auth/login', { email: 'owner@example.com' })).resolves.toEqual({
      user: { id: 'user-1' },
    });
    await expect(api.get('/customers')).resolves.toEqual({ items: [] });

    expect(fetchMock).toHaveBeenCalledTimes(4);
  });
});
