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
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '@oh/config';
import {
  createWorkerSchema,
  setWorkerStatusSchema,
  updateWorkerSchema,
  type CreateWorkerRequest,
  type SetWorkerStatusRequest,
  type UpdateWorkerRequest,
} from '@oh/contracts';
import { zodBody } from '../../core/validation/zod.pipe.js';
import { RequirePermissions } from '../auth/decorators.js';
import { EmployeesService } from './employees.service.js';

@ApiTags('employees')
@Controller('employees')
export class EmployeesController {
  constructor(private readonly employees: EmployeesService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.EMPLOYEES_READ)
  @ApiOperation({ summary: 'عرض عمال المحل.' })
  async list() {
    return this.employees.list();
  }

  @Post()
  @RequirePermissions(PERMISSIONS.EMPLOYEES_MANAGE)
  @ApiOperation({ summary: 'إضافة عامل جديد للمحل.' })
  async create(@Body(zodBody(createWorkerSchema)) dto: CreateWorkerRequest) {
    return this.employees.create(dto);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.EMPLOYEES_MANAGE)
  @ApiOperation({ summary: 'تعديل بيانات عامل.' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(zodBody(updateWorkerSchema)) dto: UpdateWorkerRequest,
  ) {
    return this.employees.update(id, dto);
  }

  @Patch(':id/status')
  @RequirePermissions(PERMISSIONS.EMPLOYEES_MANAGE)
  @ApiOperation({ summary: 'تعطيل أو تفعيل حساب عامل.' })
  async setStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(zodBody(setWorkerStatusSchema)) dto: SetWorkerStatusRequest,
  ) {
    return this.employees.setStatus(id, dto);
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.EMPLOYEES_MANAGE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'حذف حساب عامل.' })
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.employees.remove(id);
  }
}
