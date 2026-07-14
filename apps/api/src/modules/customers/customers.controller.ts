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
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '@oh/config';
import {
  createCustomerSchema,
  customerListQuerySchema,
  updateCustomerSchema,
  type CreateCustomerRequest,
  type CustomerListQuery,
  type UpdateCustomerRequest,
} from '@oh/contracts';
import { AppError } from '../../core/errors/app-error.js';
import { zodBody, zodQuery } from '../../core/validation/zod.pipe.js';
import { RequirePermissions } from '../auth/decorators.js';
import { CustomersService } from './customers.service.js';

/**
 * مسارات الزبائن.
 *
 * ⚠️ لا يوجد هنا `tenantId` في أي توقيع — يُقرأ من الجلسة الموقّعة.
 *    ولا يوجد endpoint لكتابة الرصيد — الرصيد مشتق من الدفتر.
 */
@ApiTags('customers')
@Controller('customers')
export class CustomersController {
  constructor(private readonly customers: CustomersService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.CUSTOMERS_READ)
  @ApiOperation({ summary: 'قائمة الزبائن — بحث، فلترة، فرز (بالرصيد أيضًا)، ترقيم.' })
  async list(@Query(zodQuery(customerListQuerySchema)) query: CustomerListQuery) {
    return this.customers.list(query);
  }

  @Get('stats')
  @RequirePermissions(PERMISSIONS.CUSTOMERS_READ)
  @ApiOperation({ summary: 'إحصاءات: العدد، الديون الإجمالية، المتجاوزون لحد الائتمان.' })
  async stats() {
    return this.customers.stats();
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.CUSTOMERS_READ)
  @ApiOperation({ summary: 'زبون واحد — مع رصيده المشتق من دفتر الحركات.' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    const customer = await this.customers.findOne(id);
    if (!customer) throw AppError.notFound('الزبون');
    return customer;
  }

  @Get(':id/summary')
  @RequirePermissions(PERMISSIONS.CUSTOMERS_READ)
  @ApiOperation({ summary: 'ملف الزبون: الطلبات، الدفعات، المتأخرات.' })
  async summary(@Param('id', ParseUUIDPipe) id: string) {
    return this.customers.summary(id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.CUSTOMERS_WRITE)
  @ApiOperation({
    summary: 'إضافة زبون. الرصيد الافتتاحي (إن وُجد) يولّد قيدًا في دفتر الحركات.',
  })
  async create(@Body(zodBody(createCustomerSchema)) dto: CreateCustomerRequest) {
    return this.customers.create(dto);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.CUSTOMERS_WRITE)
  @ApiOperation({
    summary: 'تعديل زبون. لا يشمل الرصيد — تصحيحه يتم بقيد تسوية.',
  })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(zodBody(updateCustomerSchema)) dto: UpdateCustomerRequest,
  ) {
    return this.customers.update(id, dto);
  }

  /**
   * أرشفة — لا حذف.
   *
   * الحذف الحقيقي مستحيل بنيويًا: قيود الدفتر تشير إلى الزبون بـRestrict.
   * حذفه سيُلغي جزءًا من التاريخ المحاسبي.
   */
  @Delete(':id')
  @RequirePermissions(PERMISSIONS.CUSTOMERS_DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'أرشفة زبون. يُرفض إن كان له رصيد قائم أو طلبات مفتوحة.',
  })
  async archive(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.customers.archive(id);
  }
}
