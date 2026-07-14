import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '@oh/config';
import {
  createAdjustmentSchema,
  ledgerListQuerySchema,
  reverseEntrySchema,
  type CreateAdjustmentRequest,
  type LedgerListQuery,
  type ReverseEntryRequest,
} from '@oh/contracts';
import { AppError } from '../../core/errors/app-error.js';
import { zodBody, zodQuery } from '../../core/validation/zod.pipe.js';
import { RequirePermissions } from '../auth/decorators.js';
import { LedgerQueryService } from './ledger-query.service.js';

/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  دفتر الحركات.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  ⚠️ لاحظ ما **لا** يوجد هنا:
 *      ✗ PATCH /ledger/:id     — لا تعديل قيد
 *      ✗ DELETE /ledger/:id    — لا حذف قيد
 *      ✗ PUT /customers/:id/balance — لا كتابة رصيد
 *
 *  غيابها ليس نسيانًا: الدفتر append-only، والرصيد مشتق. لو أضاف أحدهم
 *  مسار تعديل يومًا، لرفضته قاعدة البيانات نفسها (REVOKE + trigger).
 *
 *  الطريقان الوحيدان لتغيير رصيد بلا طلب أو دفعة:
 *    POST /ledger/adjustments   — قيد تسوية (سبب إلزامي)
 *    POST /ledger/:id/reverse   — عكس قيد تسوية
 *  كلاهما يتطلب `ledger.adjust` — صاحب المحل وحده.
 */
@ApiTags('ledger')
@Controller('ledger')
export class LedgerController {
  constructor(private readonly ledger: LedgerQueryService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.LEDGER_READ)
  @ApiOperation({
    summary: 'الحركات المالية — الرصيد قبل، المدين، الدائن، الرصيد بعد.',
  })
  async list(@Query(zodQuery(ledgerListQuerySchema)) query: LedgerListQuery) {
    return this.ledger.list(query);
  }

  @Get('statement/:customerId')
  @RequirePermissions(PERMISSIONS.LEDGER_READ)
  @ApiOperation({
    summary: 'كشف حساب زبون — برصيد افتتاحي للفترة، لا من صفر.',
  })
  async statement(
    @Param('customerId', ParseUUIDPipe) customerId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.ledger.statement(customerId, from, to);
  }

  /**
   * فحص سلامة دفتر زبون.
   *
   * يتحقق من: التسلسل متصل · كل قيد يبني على سابقه · المعادلة محفوظة ·
   * الرصيد النهائي = SUM(debit) − SUM(credit).
   *
   * أداة تدقيق: لو أعادت `valid: false` يومًا، فهناك خلل بنيوي يجب أن يوقف
   * كل شيء — لا أن يُتجاهل.
   */
  @Get('verify/:customerId')
  @RequirePermissions(PERMISSIONS.LEDGER_READ)
  @ApiOperation({ summary: 'فحص سلامة دفتر زبون (تسلسل، ربط، معادلة، مجموع).' })
  async verify(@Param('customerId', ParseUUIDPipe) customerId: string) {
    return this.ledger.verify(customerId);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.LEDGER_READ)
  @ApiOperation({ summary: 'قيد واحد.' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    const entry = await this.ledger.findOne(id);
    if (!entry) throw AppError.notFound('القيد');
    return entry;
  }

  /**
   * قيد تسوية يدوي.
   *
   * البوابة **الوحيدة** لتغيير رصيد زبون بلا طلب أو دفعة.
   * صاحب المحل وحده. السبب إلزامي. يظهر في الدفتر وفي سجل التدقيق.
   */
  @Post('adjustments')
  @RequirePermissions(PERMISSIONS.LEDGER_ADJUST)
  @ApiOperation({
    summary: 'قيد تسوية يدوي — البوابة الوحيدة لتعديل رصيد. السبب إلزامي.',
  })
  async createAdjustment(
    @Body(zodBody(createAdjustmentSchema)) dto: CreateAdjustmentRequest,
  ) {
    return this.ledger.createAdjustment(dto);
  }

  /**
   * عكس قيد تسوية.
   *
   * قيود الطلبات والدفعات لا تُعكس من هنا — تُعكس من وحداتها، كي تُنظَّف
   * آثارها (حالة الطلب، `paidAmount`). الخدمة ترفضها صراحةً.
   */
  @Post(':id/reverse')
  @RequirePermissions(PERMISSIONS.LEDGER_ADJUST)
  @ApiOperation({ summary: 'عكس قيد تسوية بقيد مضاد. لا حذف.' })
  async reverse(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(zodBody(reverseEntrySchema)) dto: ReverseEntryRequest,
  ) {
    return this.ledger.reverseEntry(id, dto);
  }
}
