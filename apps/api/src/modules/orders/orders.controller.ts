import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '@oh/config';
import {
  cancelOrderSchema,
  confirmOrderSchema,
  createOrderSchema,
  orderListQuerySchema,
  orderPreviewSchema,
  updateOrderSchema,
  type CancelOrderRequest,
  type ConfirmOrderRequest,
  type CreateOrderRequest,
  type OrderListQuery,
  type OrderPreviewRequest,
  type UpdateOrderRequest,
} from '@oh/contracts';
import { AppError } from '../../core/errors/app-error.js';
import { zodBody, zodQuery } from '../../core/validation/zod.pipe.js';
import { RequirePermissions } from '../auth/decorators.js';
import { OrdersService } from './orders.service.js';

@ApiTags('orders')
@Controller('orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.ORDERS_READ)
  @ApiOperation({ summary: 'قائمة الطلبات — بحث برقم الطلب، فلترة بالتاريخ والحالة.' })
  async list(@Query(zodQuery(orderListQuerySchema)) query: OrderListQuery) {
    return this.orders.list(query);
  }

  @Get('stats')
  @RequirePermissions(PERMISSIONS.ORDERS_READ)
  @ApiOperation({ summary: 'إحصاءات الطلبات حسب الحالة + المبالغ المستحقة.' })
  async stats(@Query(zodQuery(orderListQuerySchema)) query: OrderListQuery) {
    return this.orders.stats(query);
  }

  /**
   * معاينة الحساب.
   *
   * الواجهة **لا تحسب** مبالغ الطلب. ترسل البنود، ويعيد الخادم الأرقام.
   * فما يراه المستخدم هو بالضبط ما سيُحفظ — لا فرق تقريب، ولا مبلغ مزوّر.
   */
  @Post('preview')
  @RequirePermissions(PERMISSIONS.ORDERS_READ)
  @ApiOperation({ summary: 'حساب مبالغ الطلب من البنود — بلا حفظ.' })
  preview(@Body(zodBody(orderPreviewSchema)) dto: OrderPreviewRequest) {
    return this.orders.preview(dto);
  }

  /** البحث برقم الطلب (المتطلب 13). */
  @Get('by-number/:number')
  @RequirePermissions(PERMISSIONS.ORDERS_READ)
  @ApiOperation({ summary: 'البحث بالرقم: ORD-00087' })
  async byNumber(@Param('number') number: string) {
    const order = await this.orders.findByNumber(number);
    if (!order) throw AppError.notFound('الطلب');
    return order;
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.ORDERS_READ)
  @ApiOperation({ summary: 'طلب واحد ببنوده ودفعاته.' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    const order = await this.orders.findOne(id);
    if (!order) throw AppError.notFound('الطلب');
    return order;
  }

  @Post()
  @RequirePermissions(PERMISSIONS.ORDERS_CREATE)
  @ApiOperation({
    summary: 'إنشاء طلب (مسودة / عرض سعر / مؤكد). التأكيد يولّد قيدًا مدينًا.',
  })
  async create(@Body(zodBody(createOrderSchema)) dto: CreateOrderRequest) {
    return this.orders.create(dto);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.ORDERS_UPDATE)
  @ApiOperation({
    summary: 'تعديل مسودة أو عرض سعر. الطلب المؤكد مقفل — يُرفض بـ409.',
  })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(zodBody(updateOrderSchema)) dto: UpdateOrderRequest,
  ) {
    return this.orders.update(id, dto);
  }

  /**
   * تأكيد الطلب — **يولّد قيدًا مدينًا لا رجعة فيه**.
   *
   * يفحص حد الائتمان قبل القيد. التجاوز يتطلب صلاحية صاحب المحل + سببًا،
   * ويُسجَّل في سجل التدقيق.
   */
  @Post(':id/confirm')
  @RequirePermissions(PERMISSIONS.ORDERS_CONFIRM)
  @ApiOperation({ summary: 'تأكيد الطلب — يولّد حركة مدينة ويقفل المبالغ.' })
  async confirm(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(zodBody(confirmOrderSchema)) dto: ConfirmOrderRequest,
  ) {
    return this.orders.confirm(id, dto);
  }

  @Post(':id/cancel')
  @RequirePermissions(PERMISSIONS.ORDERS_CANCEL)
  @ApiOperation({
    summary: 'إلغاء الطلب. المؤكد يولّد قيد عكس. المدفوع جزئيًا يتطلب عكس دفعاته أولًا.',
  })
  async cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(zodBody(cancelOrderSchema)) dto: CancelOrderRequest,
  ) {
    return this.orders.cancel(id, dto);
  }
}
