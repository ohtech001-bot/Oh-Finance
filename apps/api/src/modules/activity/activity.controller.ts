import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '@oh/config';
import {
  customerActivityQuerySchema,
  storeActivityQuerySchema,
  type CustomerActivityQuery,
  type StoreActivityQuery,
} from '@oh/contracts';
import { zodQuery } from '../../core/validation/zod.pipe.js';
import { RequirePermissions } from '../auth/decorators.js';
import { ActivityService } from './activity.service.js';

/**
 * موجز النشاط (قراءة فقط) — مساران بصلاحيتين مختلفتين قصدًا.
 *
 *  • `GET /activity` — نشاط المحل كله (أداة إشراف). محمي بـ`activity.read`
 *    المستقلة، لا بقراءة الزبائن: من يقرأ ملفات الزبائن لا يرى بالضرورة كل
 *    ما يجري في المحل.
 *
 *  • `GET /customers/:id/activity` — الخط الزمني لزبون واحد. يتطلب
 *    `customers.read` للوصول، ثم تُرشَّح أنواع الأحداث داخليًا بصلاحيات القراءة
 *    التفصيلية (طلبات/دفعات/حركات) داخل `ActivityService`.
 *
 *  كلاهما معزول بالمستأجر عبر RLS، ويشتركان في منطق تجميع واحد.
 */
@ApiTags('activity')
@Controller()
export class ActivityController {
  constructor(private readonly activity: ActivityService) {}

  @Get('activity')
  @RequirePermissions(PERMISSIONS.ACTIVITY_READ)
  @ApiOperation({ summary: 'موجز نشاط المحل — بفلترة وترقيم (يتطلب activity.read).' })
  async storeFeed(@Query(zodQuery(storeActivityQuerySchema)) query: StoreActivityQuery) {
    // نطاق المحل حصرًا — بلا customerId مهما جاء في الاستعلام (المخطط يُسقطه).
    return this.activity.feed(query);
  }

  @Get('customers/:id/activity')
  @RequirePermissions(PERMISSIONS.CUSTOMERS_READ)
  @ApiOperation({ summary: 'الخط الزمني لزبون — أحداثه وطلباته ودفعاته.' })
  async customerTimeline(
    @Param('id', ParseUUIDPipe) id: string,
    @Query(zodQuery(customerActivityQuerySchema)) query: CustomerActivityQuery,
  ) {
    return this.activity.feed({ ...query, customerId: id });
  }
}
