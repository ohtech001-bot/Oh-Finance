import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseInterceptors,
} from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '@oh/config';
import {
  allocationPreviewRequestSchema,
  createPaymentSchema,
  paymentListQuerySchema,
  reversePaymentSchema,
  type AllocationPreviewRequest,
  type CreatePaymentRequest,
  type PaymentListQuery,
  type ReversePaymentRequest,
} from '@oh/contracts';
import { AppError } from '../../core/errors/app-error.js';
import {
  Idempotent,
  IdempotencyInterceptor,
} from '../../core/idempotency/idempotency.interceptor.js';
import { zodBody, zodQuery } from '../../core/validation/zod.pipe.js';
import { RequirePermissions } from '../auth/decorators.js';
import { PaymentsService } from './payments.service.js';

@ApiTags('payments')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.PAYMENTS_READ)
  @ApiOperation({ summary: 'قائمة الدفعات مع توزيعاتها على الطلبات.' })
  async list(@Query(zodQuery(paymentListQuerySchema)) query: PaymentListQuery) {
    return this.payments.list(query);
  }

  @Get('stats')
  @RequirePermissions(PERMISSIONS.PAYMENTS_READ)
  @ApiOperation({ summary: 'إحصاءات الدفعات حسب طريقة الدفع + المتوسط اليومي.' })
  async stats(@Query(zodQuery(paymentListQuerySchema)) query: PaymentListQuery) {
    return this.payments.stats(query);
  }

  /** الطلبات المفتوحة لزبون — لشاشة التوزيع اليدوي. */
  @Get('open-orders/:customerId')
  @RequirePermissions(PERMISSIONS.PAYMENTS_READ)
  @ApiOperation({ summary: 'الطلبات غير المسدَّدة لزبون — الأقدم أولًا.' })
  async openOrders(@Param('customerId', ParseUUIDPipe) customerId: string) {
    return this.payments.openOrders(customerId);
  }

  /**
   * معاينة التوزيع.
   *
   * يرى الكاشير **بالضبط** أين ستذهب الدفعة قبل أن يضغط «تسجيل».
   * بلا هذه المعاينة، يسجّل ثم يكتشف أنها ذهبت لطلب آخر — وعكسها يتطلب
   * صلاحية صاحب المحل.
   */
  @Post('preview-allocation')
  @RequirePermissions(PERMISSIONS.PAYMENTS_READ)
  @ApiOperation({ summary: 'معاينة توزيع الدفعة على الطلبات — بلا حفظ.' })
  async previewAllocation(
    @Body(zodBody(allocationPreviewRequestSchema)) dto: AllocationPreviewRequest,
  ) {
    return this.payments.previewAllocation(dto);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.PAYMENTS_READ)
  @ApiOperation({ summary: 'دفعة واحدة — مع لقطة الرصيد قبلها وبعدها.' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    const payment = await this.payments.findOne(id);
    if (!payment) throw AppError.notFound('الدفعة');
    return payment;
  }

  /**
   * ═══════════════════════════════════════════════════════════════════════
   *  تسجيل دفعة.
   * ═══════════════════════════════════════════════════════════════════════
   *
   *  ⚠️ ترويسة `Idempotency-Key` **إلزامية**.
   *
   *  بلا مفتاح: 400. لا تنازل، ولا افتراضي.
   *  نقرتان متسرّعتان، أو إعادة إرسال من المتصفح، أو إعادة محاولة تلقائية
   *  من الشبكة — كلها ترسل نفس المفتاح، فتُسجَّل **دفعة واحدة**، ويُعاد
   *  الرد نفسه بلا أثر جانبي.
   */
  @Post()
  @RequirePermissions(PERMISSIONS.PAYMENTS_CREATE)
  @Idempotent()
  @UseInterceptors(IdempotencyInterceptor)
  @ApiHeader({
    name: 'Idempotency-Key',
    description: 'UUID فريد لكل عملية دفع. إلزامي — يمنع التسجيل المزدوج.',
    required: true,
  })
  @ApiOperation({
    summary: 'تسجيل دفعة وتوزيعها على الطلبات. يولّد حركة دائنة.',
  })
  async create(
    @Body(zodBody(createPaymentSchema)) dto: CreatePaymentRequest,
    @Headers('idempotency-key') idempotencyKey: string,
  ) {
    return this.payments.create(dto, idempotencyKey);
  }

  /**
   * عكس دفعة.
   *
   * محصورة بـ`payments.reverse` — صاحب المحل وحده. وهي إحدى بوابتين فقط
   * في النظام لتقليل رصيد مُثبَّت (الأخرى: قيد تسوية).
   */
  @Post(':id/reverse')
  @RequirePermissions(PERMISSIONS.PAYMENTS_REVERSE)
  @ApiOperation({
    summary: 'عكس دفعة — يُنشئ قيدًا مضادًا ويُعيد الطلبات لحالتها. لا حذف.',
  })
  async reverse(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(zodBody(reversePaymentSchema)) dto: ReversePaymentRequest,
  ) {
    return this.payments.reverse(id, dto);
  }
}
