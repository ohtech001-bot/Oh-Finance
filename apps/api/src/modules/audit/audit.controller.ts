import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '@oh/config';
import { auditListQuerySchema, type AuditListQuery } from '@oh/contracts';
import { zodQuery } from '../../core/validation/zod.pipe.js';
import { RequirePermissions } from '../auth/decorators.js';
import { AuditQueryService } from './audit-query.service.js';

/**
 * سجل النشاط (قراءة فقط).
 *
 * ⚠️ لا مسار كتابة/تعديل/حذف — السجل append-only، والكتابة داخلية حصرًا.
 */
@ApiTags('audit')
@Controller('audit')
export class AuditController {
  constructor(private readonly audit: AuditQueryService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.AUDIT_READ)
  @ApiOperation({ summary: 'سجل النشاط — فلترة، ترقيم. قراءة فقط.' })
  async list(@Query(zodQuery(auditListQuerySchema)) query: AuditListQuery) {
    return this.audit.list(query);
  }

  @Get('entity/:type/:id')
  @RequirePermissions(PERMISSIONS.AUDIT_READ)
  @ApiOperation({ summary: 'نشاط كيان محدد (زبون/طلب/دفعة).' })
  async forEntity(@Param('type') type: string, @Param('id') id: string) {
    return this.audit.forEntity(type, id);
  }
}
