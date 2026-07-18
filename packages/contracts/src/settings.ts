import { z } from 'zod';
import { emailSchema } from './common.js';

/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  عقود الإعدادات — المرحلة 4 / Increment 4.2. مطابقة لـ`ui/other screens/كل الاعدادات.jpeg`.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  الأقسام السبعة: عام · المالية · الفواتير · الطباعة · الرسائل · سجل النشاط ·
 *  إدارة الاشتراك.
 *
 *  التخزين:
 *    • «عام» والعملة → أعمدة حقيقية (Store/Tenant).
 *    • المالية-الإضافية/الفواتير/الطباعة/الرسائل → JSONB في `Store.settings`،
 *      يُتحقَّق شكله هنا بـZod (القاعدة ليست مكان قواعد الأعمال — ADR-0001).
 *    • «سجل النشاط» و«إدارة الاشتراك» → عرض فقط، يعيدان استخدام موجز النشاط
 *      ووحدة الاشتراك القائمين (لا تخزين جديد).
 */

// ── عام (أعمدة حقيقية) ───────────────────────────────────────────────────────

export const generalSettingsSchema = z.object({
  name: z.string().trim().min(1, 'اسم المحل مطلوب.').max(120),
  email: emailSchema.nullable().or(z.literal('')),
  address: z.string().trim().max(240).nullable().or(z.literal('')),
  logoUrl: z.string().trim().max(512).nullable().or(z.literal('')),
  language: z.enum(['ar', 'he', 'en']),
  timezone: z.string().trim().min(1).max(48),
});
export type GeneralSettings = z.infer<typeof generalSettingsSchema>;

// ── المالية ──────────────────────────────────────────────────────────────────

export const numberFormatSchema = z.enum(['1,234.56', '1.234,56', '1234.56']);
export const dateFormatSchema = z.enum(['YYYY-MM-DD', 'DD/MM/YYYY', 'MM/DD/YYYY']);

export const financialSettingsSchema = z.object({
  currency: z.string().length(3),
  country: z.string().trim().max(80),
  numberFormat: numberFormatSchema,
  dateFormat: dateFormatSchema,
  tax: z.object({
    enabled: z.boolean(),
    /** نسبة مئوية 0–100. */
    rate: z.number().min(0).max(100),
    text: z.string().trim().max(500),
  }),
});
export type FinancialSettings = z.infer<typeof financialSettingsSchema>;

// ── الفواتير ─────────────────────────────────────────────────────────────────

export const invoiceSettingsSchema = z.object({
  startNumber: z.number().int().min(1),
  prefix: z.string().trim().max(16),
  suffix: z.string().trim().max(16),
  /** صيغة العرض، مثل `INV-{0001}`. */
  numberFormat: z.string().trim().max(40),
  priceIncludesTax: z.boolean(),
  showTaxColumn: z.boolean(),
  notes: z.string().trim().max(1000),
});
export type InvoiceSettings = z.infer<typeof invoiceSettingsSchema>;

// ── الطباعة ──────────────────────────────────────────────────────────────────

export const paperSizeSchema = z.enum(['A4', 'A5', '80mm', '58mm']);
export const printOrientationSchema = z.enum(['portrait', 'landscape']);

export const printingSettingsSchema = z.object({
  printer: z.string().trim().max(80),
  paperSize: paperSizeSchema,
  orientation: printOrientationSchema,
  printLogo: z.boolean(),
  printInvoiceNumber: z.boolean(),
  printDateTime: z.boolean(),
  printBarcode: z.boolean(),
});
export type PrintingSettings = z.infer<typeof printingSettingsSchema>;

// ── الرسائل ──────────────────────────────────────────────────────────────────

export const messageFrequencySchema = z.enum(['instant', 'hourly', 'daily', 'off']);

export const messagingSettingsSchema = z.object({
  whatsappEnabled: z.boolean(),
  whatsappNumber: z.string().trim().max(32),
  /** قالب رسالة الطلب الجديد بمتغيّرات: {order_id} {customer_name} {amount}. */
  newOrderTemplate: z.string().trim().max(1000),
  alertsEnabled: z.boolean(),
  newOrdersFrequency: messageFrequencySchema,
  sequence: messageFrequencySchema,
});
export type MessagingSettings = z.infer<typeof messagingSettingsSchema>;

// ── التجميع ──────────────────────────────────────────────────────────────────

/** الأقسام القابلة للتعديل (تحدّد مسار PATCH). */
export const settingsSectionSchema = z.enum([
  'general',
  'financial',
  'invoices',
  'printing',
  'messaging',
]);
export type SettingsSection = z.infer<typeof settingsSectionSchema>;

/** الاستجابة الكاملة لـGET /settings. */
export const storeSettingsSchema = z.object({
  general: generalSettingsSchema,
  financial: financialSettingsSchema,
  invoices: invoiceSettingsSchema,
  printing: printingSettingsSchema,
  messaging: messagingSettingsSchema,
});
export type StoreSettings = z.infer<typeof storeSettingsSchema>;

/** القيم الافتراضية — تُدمج مع المخزَّن فلا يظهر حقل فارغ. */
export const DEFAULT_STORE_SETTINGS: Omit<StoreSettings, 'general'> = {
  financial: {
    currency: 'ILS',
    country: 'فلسطين',
    numberFormat: '1,234.56',
    dateFormat: 'YYYY-MM-DD',
    tax: { enabled: false, rate: 0, text: '' },
  },
  invoices: {
    startNumber: 1,
    prefix: 'INV-',
    suffix: '',
    numberFormat: 'INV-{0001}',
    priceIncludesTax: false,
    showTaxColumn: true,
    notes: '',
  },
  printing: {
    printer: '',
    paperSize: '80mm',
    orientation: 'portrait',
    printLogo: true,
    printInvoiceNumber: true,
    printDateTime: true,
    printBarcode: false,
  },
  messaging: {
    whatsappEnabled: false,
    whatsappNumber: '',
    newOrderTemplate: 'طلب جديد رقم {order_id} من {customer_name} المبلغ: {amount}',
    alertsEnabled: false,
    newOrdersFrequency: 'instant',
    sequence: 'daily',
  },
};

export const SETTINGS_SECTION_LABELS: Record<string, string> = {
  general: 'عام',
  financial: 'المالية',
  invoices: 'الفواتير',
  printing: 'الطباعة',
  messaging: 'الرسائل',
  activity: 'سجل النشاط',
  subscription: 'إدارة الاشتراك',
};
