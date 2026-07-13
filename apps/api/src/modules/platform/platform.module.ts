import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PlatformController } from './platform.controller.js';
import { PlansService } from './plans.service.js';
import { SubscriptionsService } from './subscriptions.service.js';
import { TenantsService } from './tenants.service.js';

@Module({
  imports: [AuthModule], // PasswordService — لتجزئة كلمة مرور صاحب المحل عند الإنشاء
  controllers: [PlatformController],
  providers: [TenantsService, PlansService, SubscriptionsService],
  exports: [SubscriptionsService],
})
export class PlatformModule {}
