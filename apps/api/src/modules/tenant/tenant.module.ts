import { Module } from '@nestjs/common';
import { PlatformModule } from '../platform/platform.module.js';
import { PlansService } from '../platform/plans.service.js';
import { TenantController } from './tenant.controller.js';

@Module({
  imports: [PlatformModule],
  controllers: [TenantController],
  providers: [PlansService],
})
export class TenantModule {}
