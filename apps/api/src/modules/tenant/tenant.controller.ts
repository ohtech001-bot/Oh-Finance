import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '@oh/config';
import { TenantContext } from '../../core/tenancy/tenant-context.js';
import { RequirePermissions } from '../auth/decorators.js';
import { PlansService } from '../platform/plans.service.js';
import { SubscriptionsService } from '../platform/subscriptions.service.js';

/**
 * مسارات المحل (لصاحب المحل والموظفين).
 *
 * لا `tenantId` في أي توقيع — يُقرأ من `TenantContext` الذي ملأه `JwtAuthGuard`
 * من الرمز الموقّع. حتى لو أرسل العميل `?tenantId=...` فسيُتجاهل تمامًا.
 */
@ApiTags('tenant')
@Controller()
export class TenantController {
  constructor(
    private readonly subscriptions: SubscriptionsService,
    private readonly plans: PlansService,
  ) {}

  @Get('subscription')
  @RequirePermissions(PERMISSIONS.SUBSCRIPTION_READ)
  @ApiOperation({ summary: 'اشتراك المحل الحالي مع عدّادات استخدام الباقة.' })
  async mySubscription() {
    const tenantId = TenantContext.requireTenantId();
    return this.subscriptions.findForCurrentTenant(tenantId);
  }

  @Get('plans')
  @RequirePermissions(PERMISSIONS.SUBSCRIPTION_READ)
  @ApiOperation({ summary: 'الباقات النشطة — لشاشة الترقية.' })
  async availablePlans() {
    return this.plans.list(false);
  }
}
