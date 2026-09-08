import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '../errors/app-error.js';
import { StoreLogoStorageService, parseStoreLogoDataUrl } from './store-logo-storage.service.js';

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
const DATA_URL = `data:image/png;base64,${PNG.toString('base64')}`;

const env = {
  get(key: string) {
    return {
      SUPABASE_URL: 'https://project.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'service-role-key-with-at-least-32-characters',
      SUPABASE_STORAGE_BUCKET: 'store-logos',
    }[key];
  },
} as never;

afterEach(() => vi.unstubAllGlobals());

describe('StoreLogoStorageService', () => {
  it('rejects unsupported MIME types and mismatched signatures', () => {
    expect(() => parseStoreLogoDataUrl('data:image/gif;base64,R0lGODlh')).toThrow(AppError);
    expect(() => parseStoreLogoDataUrl('data:image/png;base64,QUJDRA==')).toThrow(AppError);
  });

  it('rejects files larger than 5 MiB', () => {
    const oversized = Buffer.alloc(5 * 1024 * 1024 + 1).toString('base64');
    expect(() => parseStoreLogoDataUrl(`data:image/png;base64,${oversized}`)).toThrow(AppError);
  });

  it('uploads to the public store-logos bucket and returns a display URL', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ public: true }), { status: 200 }))
      .mockResolvedValueOnce(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const asset = await new StoreLogoStorageService(env).uploadDataUrl(DATA_URL);

    expect(asset.path).toMatch(/^stores\/[0-9a-f-]+\.png$/);
    expect(asset.publicUrl).toContain('/storage/v1/object/public/store-logos/stores/');
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({ method: 'POST' });
  });

  it('creates the bucket when Supabase reports its missing-bucket 400 response', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('{"message":"Bucket not found"}', { status: 400 }))
      .mockResolvedValueOnce(new Response('{}', { status: 200 }))
      .mockResolvedValueOnce(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await new StoreLogoStorageService(env).uploadDataUrl(DATA_URL);

    expect(fetchMock.mock.calls[1]?.[0]).toBe('https://project.supabase.co/storage/v1/bucket');
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({ method: 'POST' });
  });

  it('replaces a logo only after commit and then deletes the old object', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ public: true }), { status: 200 }))
      .mockResolvedValueOnce(new Response('{}', { status: 200 }))
      .mockResolvedValueOnce(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const service = new StoreLogoStorageService(env);
    const oldUrl =
      'https://project.supabase.co/storage/v1/object/public/store-logos/stores/old.png';

    const result = await service.replaceAfterCommit(DATA_URL, oldUrl, async () => 'saved');

    expect(result).toBe('saved');
    expect(fetchMock.mock.calls[2]?.[1]).toMatchObject({ method: 'DELETE' });
  });

  it('deletes the newly uploaded object when the database commit fails', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ public: true }), { status: 200 }))
      .mockResolvedValueOnce(new Response('{}', { status: 200 }))
      .mockResolvedValueOnce(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const service = new StoreLogoStorageService(env);

    await expect(
      service.replaceAfterCommit(DATA_URL, null, async () => {
        throw new Error('database failed');
      }),
    ).rejects.toThrow('database failed');
    expect(fetchMock.mock.calls[2]?.[1]).toMatchObject({ method: 'DELETE' });
  });
});
