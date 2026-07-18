import { Module } from '@nestjs/common';
import { ActivityController } from './activity.controller.js';
import { ActivityService } from './activity.service.js';

/**
 * موجز النشاط — سطح قراءة موحّد للوحة التحكم وصفحة الزبون.
 */
@Module({
  controllers: [ActivityController],
  providers: [ActivityService],
})
export class ActivityModule {}
