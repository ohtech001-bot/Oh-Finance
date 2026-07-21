import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PlatformController } from './platform.controller.js';
import { PlansService } from './plans.service.js';
import { SubscriptionsService } from './subscriptions.service.js';
import { TenantsService } from './tenants.service.js';
import { StaffService } from './staff.service.js';

@Module({
  imports: [AuthModule], // PasswordService — لتجزئة كلمة مرور صاحب المحل عند الإنشاء
  controllers: [PlatformController],
  providers: [TenantsService, PlansService, SubscriptionsService, StaffService],
  exports: [SubscriptionsService],
})
export class PlatformModule {}
