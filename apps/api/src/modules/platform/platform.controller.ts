import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  changeSubscriptionPlanSchema,
  createPlatformStaffInviteSchema,
  createPlanSchema,
  createTenantSchema,
  setTenantStatusSchema,
  setPlatformStaffStatusSchema,
  tenantListQuerySchema,
  subscriptionListQuerySchema,
  updateSubscriptionBillingSchema,
  updatePlatformStaffSchema,
  verifyPlatformStaffInviteSchema,
  updatePlanSchema,
  updateTenantSchema,
  type ChangeSubscriptionPlanRequest,
  type CreatePlatformStaffInviteRequest,
  type CreatePlanRequest,
  type CreateTenantRequest,
  type SetTenantStatusRequest,
  type SetPlatformStaffStatusRequest,
  type TenantListQuery,
  type SubscriptionListQuery,
  type UpdateSubscriptionBillingRequest,
  type UpdatePlatformStaffRequest,
  type VerifyPlatformStaffInviteRequest,
  type UpdatePlanRequest,
  type UpdateTenantRequest,
} from '@oh/contracts';
import { PERMISSIONS } from '@oh/config';
import { zodBody, zodQuery } from '../../core/validation/zod.pipe.js';
import { AppError } from '../../core/errors/app-error.js';
import { CurrentUser, RequirePermissions, SuperAdminOnly } from '../auth/decorators.js';
import type { AccessTokenPayload } from '../auth/token.service.js';
import { AuthService } from '../auth/auth.service.js';
import type { Request, Response } from 'express';
import { PlansService } from './plans.service.js';
import { SubscriptionsService } from './subscriptions.service.js';
import { TenantsService } from './tenants.service.js';
import { StaffService } from './staff.service.js';

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
    private readonly staff: StaffService,
    private readonly auth: AuthService,
  ) {}

  // ── مدراء وموظفو المنصة ─────────────────────────────────────────────────
  @Get('staff')
  @RequirePermissions(PERMISSIONS.PLATFORM_STAFF_READ)
  async listStaff() {
    return this.staff.list();
  }

  @Post('staff/invitations')
  @RequirePermissions(PERMISSIONS.PLATFORM_STAFF_MANAGE)
  async inviteStaff(
    @Body(zodBody(createPlatformStaffInviteSchema)) dto: CreatePlatformStaffInviteRequest,
    @CurrentUser() actor: AccessTokenPayload,
  ) {
    return this.staff.invite(dto, actor.sub);
  }

  @Post('staff/invitations/verify')
  @RequirePermissions(PERMISSIONS.PLATFORM_STAFF_MANAGE)
  async verifyStaff(
    @Body(zodBody(verifyPlatformStaffInviteSchema)) dto: VerifyPlatformStaffInviteRequest,
    @CurrentUser() actor: AccessTokenPayload,
  ) {
    return this.staff.verify(dto, actor.sub);
  }

  @Delete('staff/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions(PERMISSIONS.PLATFORM_STAFF_MANAGE)
  async deleteStaff(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AccessTokenPayload,
  ): Promise<void> {
    await this.staff.remove(id, actor.sub);
  }

  @Patch('staff/:id')
  @RequirePermissions(PERMISSIONS.PLATFORM_STAFF_MANAGE)
  async updateStaff(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(zodBody(updatePlatformStaffSchema)) dto: UpdatePlatformStaffRequest,
    @CurrentUser() actor: AccessTokenPayload,
  ) {
    return this.staff.update(id, dto, actor.sub);
  }

  @Post('staff/:id/status')
  @RequirePermissions(PERMISSIONS.PLATFORM_STAFF_MANAGE)
  async setStaffStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(zodBody(setPlatformStaffStatusSchema)) dto: SetPlatformStaffStatusRequest,
    @CurrentUser() actor: AccessTokenPayload,
  ) {
    return this.staff.setStatus(id, dto, actor.sub);
  }

  @Post('staff/:id/update-invitations')
  @RequirePermissions(PERMISSIONS.PLATFORM_STAFF_MANAGE)
  async inviteStaffUpdate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(zodBody(updatePlatformStaffSchema)) dto: UpdatePlatformStaffRequest,
    @CurrentUser() actor: AccessTokenPayload,
  ) {
    return this.staff.inviteUpdate(id, dto, actor.sub);
  }

  @Post('staff/:id/update-invitations/verify')
  @RequirePermissions(PERMISSIONS.PLATFORM_STAFF_MANAGE)
  async verifyStaffUpdate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(zodBody(verifyPlatformStaffInviteSchema)) dto: VerifyPlatformStaffInviteRequest,
    @CurrentUser() actor: AccessTokenPayload,
  ) {
    return this.staff.verifyUpdate(id, dto, actor.sub);
  }

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
    summary:
      'إنشاء محل جديد — المستأجر والمحل والفرع والأدوار وصاحب المحل والاشتراك في معاملة واحدة.',
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

  @Post('tenants/:id/support-session')
  @RequirePermissions(PERMISSIONS.PLATFORM_TENANTS_MANAGE)
  @ApiOperation({ summary: 'بدء جلسة دعم مؤقتة ومُدققة داخل محل.' })
  async startSupportSession(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AccessTokenPayload,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.auth.startSupportSession(id, actor, res, {
      ip: req.ip ?? null,
      userAgent: req.headers['user-agent'] ?? null,
    });
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
  @Get('subscriptions')
  @RequirePermissions(PERMISSIONS.PLATFORM_SUBSCRIPTIONS_READ)
  async listSubscriptions(
    @Query(zodQuery(subscriptionListQuerySchema)) query: SubscriptionListQuery,
  ) {
    return this.subscriptions.list(query);
  }

  @Patch('subscriptions/:id/billing')
  @RequirePermissions(PERMISSIONS.PLATFORM_SUBSCRIPTIONS_MANAGE)
  async updateSubscriptionBilling(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(zodBody(updateSubscriptionBillingSchema)) dto: UpdateSubscriptionBillingRequest,
    @CurrentUser() actor: AccessTokenPayload,
  ) {
    return this.subscriptions.updateBilling(id, dto, actor.sub);
  }

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
