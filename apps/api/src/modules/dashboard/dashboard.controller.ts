import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '@oh/config';
import { dashboardQuerySchema, type DashboardQuery } from '@oh/contracts';
import { zodQuery } from '../../core/validation/zod.pipe.js';
import { RequirePermissions } from '../auth/decorators.js';
import { DashboardService } from './dashboard.service.js';

/**
 * لوحة تحكم المحل.
 *
 * البوابة `dashboard.read` تفتح اللوحة (يملكها كل دور داخل المحل — إنها الصفحة
 * الرئيسية). لكن **كل قسم يُرشَّح بصلاحيته التفصيلية** على الخادم داخل الخدمة،
 * فلا تُرسَل بطاقة/قائمة لا يملك المستخدم قراءتها. المستأجر من الجلسة (RLS).
 */
@ApiTags('dashboard')
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.DASHBOARD_READ)
  @ApiOperation({ summary: 'مؤشرات لوحة التحكم — مشتقة من قاعدة البيانات، بفترة ومنطقة المحل.' })
  async get(@Query(zodQuery(dashboardQuerySchema)) query: DashboardQuery) {
    return this.dashboard.getDashboard(query);
  }
}
