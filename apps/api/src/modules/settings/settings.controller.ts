import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '@oh/config';
import {
  financialSettingsSchema,
  generalSettingsSchema,
  invoiceSettingsSchema,
  messagingSettingsSchema,
  printingSettingsSchema,
  settingsSectionSchema,
  type SettingsSection,
} from '@oh/contracts';
import type { ZodSchema } from 'zod';
import { ZodValidationPipe, zodBody } from '../../core/validation/zod.pipe.js';
import { RequirePermissions } from '../auth/decorators.js';
import { SettingsService } from './settings.service.js';

/** مخطط جسم الطلب لكل قسم — التحقق يطابق العرض. */
const SECTION_SCHEMA: Record<SettingsSection, ZodSchema> = {
  general: generalSettingsSchema,
  financial: financialSettingsSchema,
  invoices: invoiceSettingsSchema,
  printing: printingSettingsSchema,
  messaging: messagingSettingsSchema,
};

/**
 * إعدادات المحل — الأقسام السبعة.
 *
 * القراءة بـ`settings.read`، والتعديل بـ`settings.manage`. «سجل النشاط»
 * و«إدارة الاشتراك» عرضٌ فقط يخدمهما موجز النشاط ووحدة الاشتراك، فلا مسار لهما هنا.
 */
@ApiTags('settings')
@Controller('settings')
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.SETTINGS_READ)
  @ApiOperation({ summary: 'قراءة إعدادات المحل (الأقسام القابلة للتعديل).' })
  async get() {
    return this.settings.getSettings();
  }

  @Patch(':section')
  @RequirePermissions(PERMISSIONS.SETTINGS_MANAGE)
  @ApiOperation({ summary: 'تعديل قسم إعدادات واحد بالتحقق المطابق لعرضه.' })
  async update(
    @Param('section', new ZodValidationPipe(settingsSectionSchema)) section: SettingsSection,
    @Body() body: unknown,
  ) {
    // نتحقق من الجسم بمخطط القسم المحدَّد (بعد التأكد أن القسم صالح).
    const validated = zodBody(SECTION_SCHEMA[section]).transform(body, {
      type: 'body',
    } as never);
    return this.settings.updateSection(section, validated);
  }
}
