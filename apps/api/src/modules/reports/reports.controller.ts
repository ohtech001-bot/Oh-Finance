import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '@oh/config';
import { reportsQuerySchema, type ReportsQuery } from '@oh/contracts';
import { zodQuery } from '../../core/validation/zod.pipe.js';
import { RequirePermissions } from '../auth/decorators.js';
import { ReportsService } from './reports.service.js';

/**
 * التقارير — قراءة فقط، محمية بـ`reports.read`، معزولة بالمستأجر (RLS).
 *
 * التصدير (PDF/Excel) يتم في الواجهة من نفس البيانات — فلا نُكرّر التجميع ولا
 * نُحمّل الخادم توليد مستندات.
 */
@ApiTags('reports')
@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.REPORTS_READ)
  @ApiOperation({ summary: 'تقرير شامل — مشتق من قاعدة البيانات، بفترة ومنطقة المحل.' })
  async get(@Query(zodQuery(reportsQuerySchema)) query: ReportsQuery) {
    return this.reports.getReports(query);
  }
}
