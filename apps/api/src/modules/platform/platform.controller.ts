import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  changeSubscriptionPlanSchema,
  createPlanSchema,
  createTenantSchema,
  setTenantStatusSchema,
  tenantListQuerySchema,
  updatePlanSchema,
  updateTenantSchema,
  type ChangeSubscriptionPlanRequest,
  type CreatePlanRequest,
  type CreateTenantRequest,
  type SetTenantStatusRequest,
  type TenantListQuery,
  type UpdatePlanRequest,
  type UpdateTenantRequest,
} from '@oh/contracts';
import { PERMISSIONS } from '@oh/config';
import { zodBody, zodQuery } from '../../core/validation/zod.pipe.js';
import { AppError } from '../../core/errors/app-error.js';
import { CurrentUser, RequirePermissions, SuperAdminOnly } from '../auth/decorators.js';
import type { AccessTokenPayload } from '../auth/token.service.js';
import { PlansService } from './plans.service.js';
import { SubscriptionsService } from './subscriptions.service.js';
import { TenantsService } from './tenants.service.js';

/**
 * لوحة المدير العام.
 *
 * `@SuperAdminOnly()` على مستوى المتحكّم: يفرضه `PermissionsGuard` على **كل**
 * مسار هنا. لا يمكن لمسار جديد أن يُنسى بلا حماية.
 *
 * ⚠️ لا يوجد هنا أي مسار يقرأ بيانات أعمال (زبائن/طلبات/دفعات/حركات).
 *    وهذا ليس سهوًا: المدير العام لا يملك صلاحيات المحل أصلًا
 *    (`ROLE_PERMISSIONS.SUPER_ADMIN` صلاحيات منصة فقط)، ولا سياسة RLS تسمح له
 *    بقراءتها إلا عبر `runAsPlatform` التي لا تُستدعى من أي خدمة أعمال.
 */
@ApiTags('platform')
@SuperAdminOnly()
@Controller('platform')
export class PlatformController {
  constructor(
    private readonly tenants: TenantsService,
    private readonly plans: PlansService,
    private readonly subscriptions: SubscriptionsService,
  ) {}

  // ── لوحة المعلومات ────────────────────────────────────────────────────────
  @Get('stats')
  @RequirePermissions(PERMISSIONS.PLATFORM_TENANTS_READ)
  @ApiOperation({ summary: 'إحصاءات المنصة: المحلات، المستخدمون، الإيراد الشهري.' })
  async stats() {
    return this.tenants.stats();
  }

  // ── المحلات ───────────────────────────────────────────────────────────────
  @Get('tenants')
  @RequirePermissions(PERMISSIONS.PLATFORM_TENANTS_READ)
  @ApiOperation({ summary: 'قائمة المحلات — بحث، فلترة، ترقيم، فرز.' })
  async listTenants(@Query(zodQuery(tenantListQuerySchema)) query: TenantListQuery) {
    return this.tenants.list(query);
  }

  @Get('tenants/:id')
  @RequirePermissions(PERMISSIONS.PLATFORM_TENANTS_READ)
  @ApiOperation({ summary: 'تفاصيل محل ومحلاته وفروعه.' })
  async getTenant(@Param('id', ParseUUIDPipe) id: string) {
    const tenant = await this.tenants.findOne(id);
    if (!tenant) throw AppError.notFound('المحل');
    return tenant;
  }

  @Post('tenants')
  @RequirePermissions(PERMISSIONS.PLATFORM_TENANTS_MANAGE)
  @ApiOperation({
    summary: 'إنشاء محل جديد — المستأجر والمحل والفرع والأدوار وصاحب المحل والاشتراك في معاملة واحدة.',
  })
  async createTenant(
    @Body(zodBody(createTenantSchema)) dto: CreateTenantRequest,
    @CurrentUser() actor: AccessTokenPayload,
  ) {
    return this.tenants.create(dto, actor.sub);
  }

  @Patch('tenants/:id')
  @RequirePermissions(PERMISSIONS.PLATFORM_TENANTS_MANAGE)
  @ApiOperation({ summary: 'تعديل بيانات محل.' })
  async updateTenant(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(zodBody(updateTenantSchema)) dto: UpdateTenantRequest,
    @CurrentUser() actor: AccessTokenPayload,
  ) {
    return this.tenants.update(id, dto, actor.sub);
  }

  @Post('tenants/:id/status')
  @RequirePermissions(PERMISSIONS.PLATFORM_TENANTS_MANAGE)
  @ApiOperation({ summary: 'إيقاف أو تفعيل محل — يُبطل جلساته فورًا. السبب إلزامي.' })
  async setTenantStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(zodBody(setTenantStatusSchema)) dto: SetTenantStatusRequest,
    @CurrentUser() actor: AccessTokenPayload,
  ) {
    return this.tenants.setStatus(id, dto, actor.sub);
  }

  // ── الباقات ───────────────────────────────────────────────────────────────
  @Get('plans')
  @RequirePermissions(PERMISSIONS.PLATFORM_PLANS_READ)
  @ApiOperation({ summary: 'كل الباقات (بما فيها غير النشطة).' })
  async listPlans() {
    return this.plans.list(true);
  }

  @Post('plans')
  @RequirePermissions(PERMISSIONS.PLATFORM_PLANS_MANAGE)
  async createPlan(
    @Body(zodBody(createPlanSchema)) dto: CreatePlanRequest,
    @CurrentUser() actor: AccessTokenPayload,
  ) {
    return this.plans.create(dto, actor.sub);
  }

  @Patch('plans/:id')
  @RequirePermissions(PERMISSIONS.PLATFORM_PLANS_MANAGE)
  async updatePlan(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(zodBody(updatePlanSchema)) dto: UpdatePlanRequest,
    @CurrentUser() actor: AccessTokenPayload,
  ) {
    return this.plans.update(id, dto, actor.sub);
  }

  // ── الاشتراكات ────────────────────────────────────────────────────────────
  @Get('tenants/:id/subscription')
  @RequirePermissions(PERMISSIONS.PLATFORM_SUBSCRIPTIONS_READ)
  @ApiOperation({ summary: 'تفاصيل اشتراك محل مع عدّادات الاستخدام.' })
  async getSubscription(@Param('id', ParseUUIDPipe) id: string) {
    return this.subscriptions.findByTenant(id);
  }

  @Post('tenants/:id/subscription/plan')
  @RequirePermissions(PERMISSIONS.PLATFORM_SUBSCRIPTIONS_MANAGE)
  @ApiOperation({ summary: 'تغيير باقة محل.' })
  async changePlan(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(zodBody(changeSubscriptionPlanSchema)) dto: ChangeSubscriptionPlanRequest,
    @CurrentUser() actor: AccessTokenPayload,
  ) {
    return this.subscriptions.changePlan(id, dto.planId, actor.sub);
  }
}
