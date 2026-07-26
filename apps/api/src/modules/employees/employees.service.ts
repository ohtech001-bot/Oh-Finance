import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ROLES } from '@oh/config';
import type {
  CreateWorkerRequest,
  SetWorkerStatusRequest,
  UpdateWorkerRequest,
  Worker,
} from '@oh/contracts';
import { AppError } from '../../core/errors/app-error.js';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import { TenantContext } from '../../core/tenancy/tenant-context.js';
import { PasswordService } from '../auth/password.service.js';

@Injectable()
export class EmployeesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
  ) {}

  async list(): Promise<Worker[]> {
    const { tenantId, storeId } = this.context();

    return this.prisma.runInTenant(tenantId, async (tx) => {
      const rows = await tx.user.findMany({
        where: {
          tenantId,
          storeId,
          role: { name: ROLES.CASHIER },
        },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          phone: true,
          email: true,
          status: true,
          createdAt: true,
        },
      });

      return rows.map((row) => ({
        id: row.id,
        name: row.name,
        phone: row.phone ?? '',
        email: row.email,
        status: row.status,
        createdAt: row.createdAt.toISOString(),
      }));
    });
  }

  async create(dto: CreateWorkerRequest): Promise<Worker> {
    const { tenantId, storeId } = this.context();
    const passwordHash = await this.passwords.hash(dto.password);

    try {
      return await this.prisma.runInTenant(tenantId, async (tx) => {
        const role = await tx.role.findFirst({
          where: { tenantId, name: ROLES.CASHIER },
          select: { id: true },
        });
        if (!role) throw AppError.internal('تعذّر العثور على صلاحية العامل.');

        const row = await tx.user.create({
          data: {
            tenantId,
            storeId,
            roleId: role.id,
            name: dto.name,
            phone: dto.phone,
            email: dto.email,
            passwordHash,
            jobTitle: 'عامل',
            status: 'ACTIVE',
            passwordChangedAt: new Date(),
          },
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
            status: true,
            createdAt: true,
          },
        });

        return {
          id: row.id,
          name: row.name,
          phone: row.phone ?? '',
          email: row.email,
          status: row.status,
          createdAt: row.createdAt.toISOString(),
        };
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw AppError.conflict('البريد الإلكتروني مستخدم لحساب آخر.');
      }
      throw error;
    }
  }

  async update(id: string, dto: UpdateWorkerRequest): Promise<Worker> {
    const { tenantId, storeId } = this.context();
    const passwordHash = dto.password ? await this.passwords.hash(dto.password) : undefined;

    try {
      return await this.prisma.runInTenant(tenantId, async (tx) => {
        const worker = await tx.user.findFirst({
          where: { id, tenantId, storeId, role: { name: ROLES.CASHIER } },
          select: { id: true },
        });
        if (!worker) throw AppError.notFound('العامل');

        const row = await tx.user.update({
          where: { id: worker.id },
          data: {
            name: dto.name,
            phone: dto.phone,
            email: dto.email,
            ...(passwordHash
              ? {
                  passwordHash,
                  passwordChangedAt: new Date(),
                  failedLoginCount: 0,
                  lockedUntil: null,
                }
              : {}),
          },
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
            status: true,
            createdAt: true,
          },
        });

        if (passwordHash) {
          await tx.session.deleteMany({ where: { userId: worker.id } });
        }

        return {
          id: row.id,
          name: row.name,
          phone: row.phone ?? '',
          email: row.email,
          status: row.status,
          createdAt: row.createdAt.toISOString(),
        };
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw AppError.conflict('البريد الإلكتروني مستخدم لحساب آخر.');
      }
      throw error;
    }
  }

  async setStatus(id: string, dto: SetWorkerStatusRequest): Promise<Worker> {
    const { tenantId, storeId } = this.context();

    return this.prisma.runInTenant(tenantId, async (tx) => {
      const worker = await tx.user.findFirst({
        where: { id, tenantId, storeId, role: { name: ROLES.CASHIER } },
        select: { id: true },
      });
      if (!worker) throw AppError.notFound('العامل');

      const row = await tx.user.update({
        where: { id: worker.id },
        data: {
          status: dto.status,
          failedLoginCount: 0,
          lockedUntil: null,
        },
        select: {
          id: true,
          name: true,
          phone: true,
          email: true,
          status: true,
          createdAt: true,
        },
      });

      if (dto.status === 'INACTIVE') {
        await tx.session.deleteMany({ where: { userId: worker.id } });
      }

      return {
        id: row.id,
        name: row.name,
        phone: row.phone ?? '',
        email: row.email,
        status: row.status,
        createdAt: row.createdAt.toISOString(),
      };
    });
  }

  async remove(id: string): Promise<void> {
    const { tenantId, storeId } = this.context();

    await this.prisma.runInTenant(tenantId, async (tx) => {
      const worker = await tx.user.findFirst({
        where: { id, tenantId, storeId, role: { name: ROLES.CASHIER } },
        select: { id: true },
      });
      if (!worker) throw AppError.notFound('العامل');
      await tx.user.delete({ where: { id: worker.id } });
    });
  }

  private context(): { tenantId: string; storeId: string } {
    const ctx = TenantContext.get();
    const tenantId = TenantContext.requireTenantId();
    if (!ctx?.storeId) throw AppError.forbidden('لا يوجد محل مرتبط بحسابك.');
    return { tenantId, storeId: ctx.storeId };
  }
}
