import { Module } from '@nestjs/common';
import { AuditController } from './audit.controller.js';
import { AuditQueryService } from './audit-query.service.js';

/**
 * قراءة سجل النشاط عبر الـAPI.
 *
 * منفصلة عن `core/audit` (التي تكتب السجل داخليًا وهي @Global): تلك بنية
 * تحتية للكتابة، وهذه سطح قراءة للواجهة. الفصل يوضّح أن الكتابة والقراءة
 * مسؤوليتان مختلفتان.
 */
@Module({
  controllers: [AuditController],
  providers: [AuditQueryService],
})
export class AuditReadModule {}
