import { randomUUID } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { AppError } from '../errors/app-error.js';
import { EnvService } from '../config/env.service.js';

const MAX_LOGO_BYTES = 5 * 1024 * 1024;
const MIME_TO_EXTENSION = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
} as const;

type LogoMime = keyof typeof MIME_TO_EXTENSION;

export interface StoreLogoAsset {
  path: string;
  publicUrl: string;
}

interface ParsedLogo {
  bytes: Buffer;
  mime: LogoMime;
  extension: (typeof MIME_TO_EXTENSION)[LogoMime];
}

export function parseStoreLogoDataUrl(dataUrl: string): ParsedLogo {
  const match = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(dataUrl);
  if (!match?.[1] || !match[2] || match[2].length % 4 !== 0) {
    throw AppError.validation('صيغة الشعار غير مدعومة.');
  }

  const mime = match[1] as LogoMime;
  if (match[2].length > Math.ceil(MAX_LOGO_BYTES / 3) * 4) {
    throw AppError.validation('حجم الشعار يجب ألا يتجاوز 5 ميجابايت.');
  }

  const bytes = Buffer.from(match[2], 'base64');
  if (bytes.length === 0 || bytes.length > MAX_LOGO_BYTES) {
    throw AppError.validation('حجم الشعار يجب ألا يتجاوز 5 ميجابايت.');
  }

  const validSignature =
    (mime === 'image/png' &&
      bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) ||
    (mime === 'image/jpeg' && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) ||
    (mime === 'image/webp' &&
      bytes.subarray(0, 4).toString('ascii') === 'RIFF' &&
      bytes.subarray(8, 12).toString('ascii') === 'WEBP');

  if (!validSignature) {
    throw AppError.validation('محتوى ملف الشعار لا يطابق صيغة الصورة المحددة.');
  }

  return { bytes, mime, extension: MIME_TO_EXTENSION[mime] };
}

@Injectable()
export class StoreLogoStorageService {
  private readonly logger = new Logger(StoreLogoStorageService.name);
  private bucketReady: Promise<void> | undefined;

  constructor(private readonly env: EnvService) {}

  async uploadDataUrl(dataUrl: string): Promise<StoreLogoAsset> {
    const logo = parseStoreLogoDataUrl(dataUrl);
    await this.ensureBucket();

    const path = `stores/${randomUUID()}.${logo.extension}`;
    const response = await fetch(this.objectUrl(path), {
      method: 'POST',
      headers: {
        ...this.authHeaders(),
        'Content-Type': logo.mime,
        'Cache-Control': 'public, max-age=31536000, immutable',
        'x-upsert': 'false',
      },
      body: logo.bytes,
    });

    if (!response.ok) {
      this.logger.error(`Store logo upload failed with Storage status ${response.status}.`);
      throw AppError.internal('تعذّر حفظ شعار المحل. حاول مرة أخرى.');
    }

    return { path, publicUrl: this.publicUrl(path) };
  }

  async replaceAfterCommit<T>(
    dataUrl: string,
    previousUrl: string | null,
    commit: (publicUrl: string) => Promise<T>,
  ): Promise<T> {
    const asset = await this.uploadDataUrl(dataUrl);
    let result: T;
    try {
      result = await commit(asset.publicUrl);
    } catch (error) {
      await this.deletePathBestEffort(asset.path);
      throw error;
    }

    if (previousUrl && previousUrl !== asset.publicUrl) {
      await this.deleteUrlBestEffort(previousUrl);
    }
    return result;
  }

  async deleteUrlBestEffort(url: string): Promise<void> {
    const path = this.pathFromPublicUrl(url);
    if (!path) return;
    await this.deletePathBestEffort(path);
  }

  private async deletePathBestEffort(path: string): Promise<void> {
    try {
      const response = await fetch(this.objectUrl(path), {
        method: 'DELETE',
        headers: this.authHeaders(),
      });
      if (!response.ok && response.status !== 404) {
        this.logger.error(`Store logo deletion failed with Storage status ${response.status}.`);
      }
    } catch (error) {
      this.logger.error('Store logo deletion failed after database commit.', error);
    }
  }

  private ensureBucket(): Promise<void> {
    if (!this.bucketReady) {
      this.bucketReady = this.createOrVerifyBucket().catch((error: unknown) => {
        this.bucketReady = undefined;
        throw error;
      });
    }
    return this.bucketReady;
  }

  private async createOrVerifyBucket(): Promise<void> {
    const config = this.config();
    const bucketUrl = `${config.url}/storage/v1/bucket/${encodeURIComponent(config.bucket)}`;
    const existing = await fetch(bucketUrl, { headers: this.authHeaders() });
    if (existing.ok) {
      const bucket = (await existing.json()) as { public?: boolean };
      if (!bucket.public) {
        throw AppError.internal('يجب أن يكون bucket شعارات المحلات عامًا لعرض الشعارات.');
      }
      return;
    }
    const missingBucket =
      existing.status === 404 ||
      (existing.status === 400 && (await existing.text()).includes('Bucket not found'));
    if (!missingBucket) {
      this.logger.error(`Storage bucket lookup failed with status ${existing.status}.`);
      throw AppError.internal('تعذّر التحقق من مخزن شعارات المحلات.');
    }

    const created = await fetch(`${config.url}/storage/v1/bucket`, {
      method: 'POST',
      headers: { ...this.authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: config.bucket,
        name: config.bucket,
        public: true,
        file_size_limit: MAX_LOGO_BYTES,
        allowed_mime_types: Object.keys(MIME_TO_EXTENSION),
      }),
    });
    if (!created.ok && created.status !== 409) {
      this.logger.error(`Storage bucket creation failed with status ${created.status}.`);
      throw AppError.internal('تعذّر إنشاء مخزن شعارات المحلات.');
    }
  }

  private config(): { url: string; key: string; bucket: string } {
    const url = this.env.get('SUPABASE_URL');
    const key = this.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !key) {
      throw AppError.internal('إعداد Supabase Storage غير مكتمل.');
    }
    return {
      url: url.replace(/\/$/, ''),
      key,
      bucket: this.env.get('SUPABASE_STORAGE_BUCKET'),
    };
  }

  private authHeaders(): Record<string, string> {
    const { key } = this.config();
    return { apikey: key, Authorization: `Bearer ${key}` };
  }

  private objectUrl(path: string): string {
    const config = this.config();
    return `${config.url}/storage/v1/object/${encodeURIComponent(config.bucket)}/${this.encodePath(path)}`;
  }

  private publicUrl(path: string): string {
    const config = this.config();
    return `${config.url}/storage/v1/object/public/${encodeURIComponent(config.bucket)}/${this.encodePath(path)}`;
  }

  private pathFromPublicUrl(value: string): string | null {
    const config = this.config();
    try {
      const url = new URL(value);
      const expected = new URL(config.url);
      const prefix = `/storage/v1/object/public/${encodeURIComponent(config.bucket)}/`;
      if (url.origin !== expected.origin || !url.pathname.startsWith(prefix)) return null;
      return decodeURIComponent(url.pathname.slice(prefix.length));
    } catch {
      return null;
    }
  }

  private encodePath(path: string): string {
    return path.split('/').map(encodeURIComponent).join('/');
  }
}
