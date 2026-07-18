import { Injectable } from '@nestjs/common';
import type {
  FinancialSettings,
  GeneralSettings,
  InvoiceSettings,
  MessagingSettings,
  PrintingSettings,
  SettingsSection,
  StoreSettings,
} from '@oh/contracts';
import { DEFAULT_STORE_SETTINGS } from '@oh/contracts';
import { AppError } from '../../core/errors/app-error.js';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import { TenantContext } from '../../core/tenancy/tenant-context.js';

/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  خدمة الإعدادات — المرحلة 4 / Increment 4.2.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  التخزين:
 *    • name/email/address/logoUrl/currency → أعمدة `Store` (التطبيق يعدّلها).
 *    • language/timezone + المالية-الإضافية/الفواتير/الطباعة/الرسائل → JSONB في
 *      `Store.settings`.
 *
 *  ⚠️ حدّ RLS: جدول `tenants` للقراءة فقط من التطبيق (لا سياسة UPDATE). لذا
 *     منطقة المحل الزمنية ولغته المُحرَّرتان هنا تُخزَّنان في JSONB لا في Tenant.
 *     ربطهما ليتجاوزا منطقة المستأجر في التقارير/اللوحة مؤجَّل (لا نمسّ وحدات
 *     مُختبَرة في هذه الزيادة).
 *
 *  كله تحت `runInTenant` فيحترم RLS.
 */
@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getSettings(): Promise<StoreSettings> {
    const tenantId = TenantContext.requireTenantId();
    const ctx = TenantContext.get();
    if (!ctx?.storeId) throw AppError.forbidden('لا يوجد محل مرتبط بحسابك.');
    const storeId = ctx.storeId;

    return this.prisma.runInTenant(tenantId, async (tx) => {
      const store = await tx.store.findFirst({
        where: { id: storeId },
        select: {
          name: true, email: true, address: true, logoUrl: true, currency: true, settings: true,
          tenant: { select: { timezone: true, locale: true } },
        },
      });
      if (!store) throw AppError.notFound('المحل');
      return this.merge(store);
    });
  }

  async updateSection(section: SettingsSection, data: unknown): Promise<StoreSettings> {
    const tenantId = TenantContext.requireTenantId();
    const ctx = TenantContext.get();
    if (!ctx?.storeId) throw AppError.forbidden('لا يوجد محل مرتبط بحسابك.');
    const storeId = ctx.storeId;

    return this.prisma.runInTenant(tenantId, async (tx) => {
      const store = await tx.store.findFirst({
        where: { id: storeId },
        select: {
          name: true, email: true, address: true, logoUrl: true, currency: true, settings: true,
          tenant: { select: { timezone: true, locale: true } },
        },
      });
      if (!store) throw AppError.notFound('المحل');

      const json = (store.settings ?? {}) as Record<string, unknown>;
      const storeUpdate: Record<string, unknown> = {};

      switch (section) {
        case 'general': {
          const g = data as GeneralSettings;
          storeUpdate.name = g.name;
          storeUpdate.email = g.email || null;
          storeUpdate.address = g.address || null;
          storeUpdate.logoUrl = g.logoUrl || null;
          json.general = { language: g.language, timezone: g.timezone };
          break;
        }
        case 'financial': {
          const f = data as FinancialSettings;
          storeUpdate.currency = f.currency;
          json.financial = { country: f.country, numberFormat: f.numberFormat, dateFormat: f.dateFormat, tax: f.tax };
          break;
        }
        case 'invoices':
          json.invoices = data as InvoiceSettings;
          break;
        case 'printing':
          json.printing = data as PrintingSettings;
          break;
        case 'messaging':
          json.messaging = data as MessagingSettings;
          break;
      }

      const result = await tx.store.updateMany({
        where: { id: storeId },
        data: { ...storeUpdate, settings: json as never },
      });
      if (result.count === 0) throw AppError.notFound('المحل');

      const fresh = await tx.store.findFirst({
        where: { id: storeId },
        select: {
          name: true, email: true, address: true, logoUrl: true, currency: true, settings: true,
          tenant: { select: { timezone: true, locale: true } },
        },
      });
      return this.merge(fresh!);
    });
  }

  /** يدمج الأعمدة + JSONB + الافتراضيات في شكل الإعدادات الكامل. */
  private merge(store: {
    name: string;
    email: string | null;
    address: string | null;
    logoUrl: string | null;
    currency: string;
    settings: unknown;
    tenant: { timezone: string; locale: string } | null;
  }): StoreSettings {
    const json = (store.settings ?? {}) as Partial<Record<string, Record<string, unknown>>>;
    const d = DEFAULT_STORE_SETTINGS;
    const g = json.general ?? {};
    const fin = json.financial ?? {};

    return {
      general: {
        name: store.name,
        email: store.email ?? '',
        address: store.address ?? '',
        logoUrl: store.logoUrl ?? '',
        language: (g.language as GeneralSettings['language']) ?? (store.tenant?.locale as GeneralSettings['language']) ?? 'ar',
        timezone: (g.timezone as string) ?? store.tenant?.timezone ?? 'Asia/Jerusalem',
      },
      financial: {
        currency: store.currency,
        country: (fin.country as string) ?? d.financial.country,
        numberFormat: (fin.numberFormat as FinancialSettings['numberFormat']) ?? d.financial.numberFormat,
        dateFormat: (fin.dateFormat as FinancialSettings['dateFormat']) ?? d.financial.dateFormat,
        tax: { ...d.financial.tax, ...((fin.tax as object) ?? {}) },
      },
      invoices: { ...d.invoices, ...(json.invoices ?? {}) } as InvoiceSettings,
      printing: { ...d.printing, ...(json.printing ?? {}) } as PrintingSettings,
      messaging: { ...d.messaging, ...(json.messaging ?? {}) } as MessagingSettings,
    };
  }
}
