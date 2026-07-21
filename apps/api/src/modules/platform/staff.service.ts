import { createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import {
  AUDIT_ACTIONS,
  type CreatePlatformStaffInviteRequest,
  type PlatformStaff,
  type SetPlatformStaffStatusRequest,
  type UpdatePlatformStaffRequest,
  type VerifyPlatformStaffInviteRequest,
} from '@oh/contracts';
import { AppError } from '../../core/errors/app-error.js';
import { AuditService } from '../../core/audit/audit.service.js';
import { EnvService } from '../../core/config/env.service.js';
import { MailService } from '../../core/mail/mail.service.js';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import { PasswordService } from '../auth/password.service.js';

@Injectable()
export class StaffService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly mail: MailService,
    private readonly env: EnvService,
    private readonly audit: AuditService,
  ) {}

  async list(): Promise<PlatformStaff[]> {
    const rows = await this.prisma.runAsPlatform((tx) =>
      tx.user.findMany({
        where: { isSuperAdmin: true },
        orderBy: { createdAt: 'desc' },
      }),
    );
    return rows.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone ?? '',
      dateOfBirth: user.dateOfBirth?.toISOString().slice(0, 10) ?? '',
      identityNumber: user.identityNumber ?? '',
      jobTitle: user.jobTitle ?? '',
      locale: user.locale,
      platformRole: user.platformRole ?? 'GENERAL_MANAGER',
      status: user.status,
      emailVerifiedAt: user.emailVerifiedAt?.toISOString() ?? null,
      mustChangePassword: user.mustChangePassword,
      createdAt: user.createdAt.toISOString(),
    }));
  }

  async invite(dto: CreatePlatformStaffInviteRequest, actorId: string) {
    const existing = await this.prisma.runAsPlatform((tx) =>
      tx.user.findUnique({ where: { email: dto.email } }),
    );
    if (existing) throw AppError.conflict('البريد الإلكتروني مستخدم لحساب آخر.');

    const code = String(randomInt(100000, 1000000));
    const expiresAt = new Date(Date.now() + 10 * 60_000);
    const invite = await this.prisma.runAsPlatform(async (tx) => {
      const row = await tx.platformStaffInvite.upsert({
        where: { email: dto.email },
        create: {
          ...dto,
          dateOfBirth: new Date(`${dto.dateOfBirth}T00:00:00.000Z`),
          verificationCodeHash: this.hashCode(code),
          expiresAt,
          createdBy: actorId,
        },
        update: {
          ...dto,
          dateOfBirth: new Date(`${dto.dateOfBirth}T00:00:00.000Z`),
          verificationCodeHash: this.hashCode(code),
          expiresAt,
          attempts: 0,
          createdBy: actorId,
        },
      });
      await this.audit.record(tx, {
        action: AUDIT_ACTIONS.PLATFORM_STAFF_INVITED,
        summary: `إرسال رمز تحقق لموظف المنصة: ${dto.email}`,
        entityType: 'PlatformStaffInvite',
        entityId: row.id,
        tenantId: null,
        actor: { id: actorId, name: null },
      });
      return row;
    });

    await this.mail.sendVerificationCode(dto.email, code);
    return { inviteId: invite.id, expiresAt: expiresAt.toISOString() };
  }

  async verify(dto: VerifyPlatformStaffInviteRequest, actorId: string): Promise<PlatformStaff> {
    const invite = await this.prisma.runAsPlatform((tx) =>
      tx.platformStaffInvite.findUnique({ where: { id: dto.inviteId } }),
    );
    if (!invite || invite.expiresAt.getTime() < Date.now())
      throw AppError.validation('انتهت صلاحية رمز التحقق. أرسل رمزاً جديداً.');
    if (invite.attempts >= 5)
      throw AppError.validation('تم تجاوز عدد محاولات التحقق. أرسل رمزاً جديداً.');

    const expected = Buffer.from(invite.verificationCodeHash, 'hex');
    const actual = Buffer.from(this.hashCode(dto.code), 'hex');
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
      await this.prisma.runAsPlatform((tx) =>
        tx.platformStaffInvite.update({
          where: { id: invite.id },
          data: { attempts: { increment: 1 } },
        }),
      );
      throw AppError.validation('رمز التحقق غير صحيح.');
    }

    const temporaryPassword = randomBytes(15).toString('base64url');
    const passwordHash = await this.passwords.hash(temporaryPassword);
    const user = await this.prisma.runAsPlatform(async (tx) => {
      const created = await tx.user.create({
        data: {
          email: invite.email,
          name: invite.name,
          phone: invite.phone,
          dateOfBirth: invite.dateOfBirth,
          identityNumber: invite.identityNumber,
          jobTitle: invite.jobTitle,
          locale: invite.locale,
          platformRole: invite.platformRole,
          isSuperAdmin: true,
          status: 'INACTIVE',
          passwordHash,
          emailVerifiedAt: new Date(),
          mustChangePassword: true,
        },
      });
      return created;
    });

    try {
      await this.mail.sendTemporaryPassword(user.email, user.name, temporaryPassword);
    } catch (error) {
      await this.prisma.runAsPlatform((tx) => tx.user.delete({ where: { id: user.id } }));
      throw error;
    }

    const activated = await this.prisma.runAsPlatform(async (tx) => {
      const row = await tx.user.update({ where: { id: user.id }, data: { status: 'ACTIVE' } });
      await tx.platformStaffInvite.delete({ where: { id: invite.id } });
      await this.audit.record(tx, {
        action: AUDIT_ACTIONS.PLATFORM_STAFF_CREATED,
        summary: `إنشاء حساب موظف منصة: ${row.email}`,
        entityType: 'User',
        entityId: row.id,
        tenantId: null,
        actor: { id: actorId, name: null },
      });
      return row;
    });
    return (await this.list()).find((item) => item.id === activated.id)!;
  }

  async remove(id: string, actorId: string): Promise<void> {
    if (id === actorId) throw AppError.forbidden('لا يمكنك حذف حسابك الحالي.');

    await this.prisma.runAsPlatform(async (tx) => {
      const target = await tx.user.findUnique({
        where: { id },
        select: { id: true, email: true, name: true, isSuperAdmin: true, platformRole: true },
      });
      if (!target?.isSuperAdmin) throw AppError.notFound('المدير أو الموظف');
      if (target.platformRole === 'GENERAL_MANAGER') {
        const generalManagers = await tx.user.count({
          where: { isSuperAdmin: true, platformRole: 'GENERAL_MANAGER' },
        });
        if (generalManagers <= 1) throw AppError.forbidden('لا يمكن حذف آخر مدير عام في المنظومة.');
      }

      await tx.session.updateMany({
        where: { userId: target.id, revokedAt: null },
        data: { revokedAt: new Date(), revokedReason: 'PLATFORM_STAFF_DELETED' },
      });
      await this.audit.record(tx, {
        action: AUDIT_ACTIONS.PLATFORM_STAFF_DELETED,
        summary: `حذف حساب منصة: ${target.email}`,
        entityType: 'User',
        entityId: target.id,
        tenantId: null,
        actor: { id: actorId, name: null },
      });
      await tx.user.delete({ where: { id: target.id } });
    });
  }

  async update(
    id: string,
    dto: UpdatePlatformStaffRequest,
    actorId: string,
  ): Promise<PlatformStaff> {
    await this.prisma.runAsPlatform(async (tx) => {
      const target = await tx.user.findUnique({
        where: { id },
        select: { id: true, email: true, isSuperAdmin: true, platformRole: true },
      });
      if (!target?.isSuperAdmin) throw AppError.notFound('المدير أو الموظف');
      if (target.platformRole === 'GENERAL_MANAGER' && dto.platformRole !== 'GENERAL_MANAGER') {
        const generalManagers = await tx.user.count({
          where: { isSuperAdmin: true, platformRole: 'GENERAL_MANAGER' },
        });
        if (generalManagers <= 1) throw AppError.forbidden('لا يمكن تغيير وظيفة آخر مدير عام.');
      }
      if (dto.email !== target.email) {
        throw AppError.validation('تغيير البريد يتطلب إرسال رمز تحقق جديد.');
      }

      await tx.user.update({
        where: { id },
        data: {
          name: dto.name,
          phone: dto.phone,
          dateOfBirth: new Date(`${dto.dateOfBirth}T00:00:00.000Z`),
          identityNumber: dto.identityNumber,
          jobTitle: dto.jobTitle,
          platformRole: dto.platformRole,
          locale: dto.locale,
        },
      });
      await this.audit.record(tx, {
        action: AUDIT_ACTIONS.PLATFORM_STAFF_UPDATED,
        summary: `تعديل حساب منصة: ${target.email}`,
        entityType: 'User',
        entityId: target.id,
        tenantId: null,
        actor: { id: actorId, name: null },
      });
    });

    const updated = (await this.list()).find((item) => item.id === id);
    if (!updated) throw AppError.notFound('المدير أو الموظف');
    return updated;
  }

  async inviteUpdate(id: string, dto: UpdatePlatformStaffRequest, actorId: string) {
    const target = await this.prisma.runAsPlatform((tx) =>
      tx.user.findUnique({
        where: { id },
        select: { id: true, email: true, isSuperAdmin: true, platformRole: true },
      }),
    );
    if (!target?.isSuperAdmin) throw AppError.notFound('المدير أو الموظف');
    const duplicate = await this.prisma.runAsPlatform((tx) =>
      tx.user.findFirst({ where: { email: dto.email, id: { not: id } }, select: { id: true } }),
    );
    if (duplicate) throw AppError.conflict('البريد الإلكتروني مستخدم لحساب آخر.');

    const code = String(randomInt(100000, 1000000));
    const expiresAt = new Date(Date.now() + 10 * 60_000);
    const invite = await this.prisma.runAsPlatform(async (tx) => {
      const row = await tx.platformStaffInvite.upsert({
        where: { email: dto.email },
        create: {
          ...dto,
          dateOfBirth: new Date(`${dto.dateOfBirth}T00:00:00.000Z`),
          verificationCodeHash: this.hashCode(code),
          expiresAt,
          createdBy: actorId,
        },
        update: {
          ...dto,
          dateOfBirth: new Date(`${dto.dateOfBirth}T00:00:00.000Z`),
          verificationCodeHash: this.hashCode(code),
          expiresAt,
          attempts: 0,
          createdBy: actorId,
        },
      });
      await this.audit.record(tx, {
        action: AUDIT_ACTIONS.PLATFORM_STAFF_INVITED,
        summary: `إرسال رمز تحقق لتعديل حساب منصة: ${dto.email}`,
        entityType: 'PlatformStaffInvite',
        entityId: row.id,
        tenantId: null,
        actor: { id: actorId, name: null },
      });
      return row;
    });

    await this.mail.sendVerificationCode(dto.email, code);
    return { inviteId: invite.id, expiresAt: expiresAt.toISOString() };
  }

  async verifyUpdate(
    id: string,
    dto: VerifyPlatformStaffInviteRequest,
    actorId: string,
  ): Promise<PlatformStaff> {
    const invite = await this.prisma.runAsPlatform((tx) =>
      tx.platformStaffInvite.findUnique({ where: { id: dto.inviteId } }),
    );
    if (!invite || invite.expiresAt.getTime() < Date.now()) {
      throw AppError.validation('انتهت صلاحية رمز التحقق. أرسل رمزاً جديداً.');
    }
    if (invite.attempts >= 5) {
      throw AppError.validation('تم تجاوز عدد محاولات التحقق. أرسل رمزاً جديداً.');
    }

    const expected = Buffer.from(invite.verificationCodeHash, 'hex');
    const actual = Buffer.from(this.hashCode(dto.code), 'hex');
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
      await this.prisma.runAsPlatform((tx) =>
        tx.platformStaffInvite.update({
          where: { id: invite.id },
          data: { attempts: { increment: 1 } },
        }),
      );
      throw AppError.validation('رمز التحقق غير صحيح.');
    }

    await this.prisma.runAsPlatform(async (tx) => {
      const target = await tx.user.findUnique({
        where: { id },
        select: { id: true, email: true, isSuperAdmin: true, platformRole: true },
      });
      if (!target?.isSuperAdmin) throw AppError.notFound('المدير أو الموظف');
      if (target.platformRole === 'GENERAL_MANAGER' && invite.platformRole !== 'GENERAL_MANAGER') {
        const generalManagers = await tx.user.count({
          where: { isSuperAdmin: true, platformRole: 'GENERAL_MANAGER' },
        });
        if (generalManagers <= 1) throw AppError.forbidden('لا يمكن تغيير وظيفة آخر مدير عام.');
      }
      const duplicate = await tx.user.findFirst({
        where: { email: invite.email, id: { not: id } },
        select: { id: true },
      });
      if (duplicate) throw AppError.conflict('البريد الإلكتروني مستخدم لحساب آخر.');

      await tx.user.update({
        where: { id },
        data: {
          email: invite.email,
          name: invite.name,
          phone: invite.phone,
          dateOfBirth: invite.dateOfBirth,
          identityNumber: invite.identityNumber,
          jobTitle: invite.jobTitle,
          platformRole: invite.platformRole,
          locale: invite.locale,
          emailVerifiedAt: new Date(),
        },
      });
      await tx.platformStaffInvite.delete({ where: { id: invite.id } });
      await this.audit.record(tx, {
        action: AUDIT_ACTIONS.PLATFORM_STAFF_UPDATED,
        summary: `تعديل حساب منصة بعد التحقق من البريد: ${invite.email}`,
        entityType: 'User',
        entityId: id,
        tenantId: null,
        actor: { id: actorId, name: null },
      });
    });

    const updated = (await this.list()).find((item) => item.id === id);
    if (!updated) throw AppError.notFound('المدير أو الموظف');
    return updated;
  }

  async setStatus(
    id: string,
    dto: SetPlatformStaffStatusRequest,
    actorId: string,
  ): Promise<PlatformStaff> {
    if (id === actorId) throw AppError.forbidden('لا يمكنك تعطيل حسابك الحالي.');
    await this.prisma.runAsPlatform(async (tx) => {
      const target = await tx.user.findUnique({
        where: { id },
        select: { id: true, email: true, isSuperAdmin: true, platformRole: true },
      });
      if (!target?.isSuperAdmin) throw AppError.notFound('المدير أو الموظف');
      if (target.platformRole === 'GENERAL_MANAGER' && dto.status === 'INACTIVE') {
        const activeGeneralManagers = await tx.user.count({
          where: { isSuperAdmin: true, platformRole: 'GENERAL_MANAGER', status: 'ACTIVE' },
        });
        if (activeGeneralManagers <= 1) throw AppError.forbidden('لا يمكن تعطيل آخر مدير عام نشط.');
      }
      await tx.user.update({ where: { id }, data: { status: dto.status } });
      if (dto.status === 'INACTIVE') {
        await tx.session.updateMany({
          where: { userId: id, revokedAt: null },
          data: { revokedAt: new Date(), revokedReason: 'PLATFORM_STAFF_DISABLED' },
        });
      }
      await this.audit.record(tx, {
        action: AUDIT_ACTIONS.PLATFORM_STAFF_UPDATED,
        summary: `${dto.status === 'ACTIVE' ? 'تفعيل' : 'تعطيل'} حساب منصة: ${target.email}`,
        entityType: 'User',
        entityId: id,
        tenantId: null,
        actor: { id: actorId, name: null },
      });
    });
    const updated = (await this.list()).find((item) => item.id === id);
    if (!updated) throw AppError.notFound('المدير أو الموظف');
    return updated;
  }

  private hashCode(code: string): string {
    return createHmac('sha256', this.env.get('COOKIE_SECRET')).update(code).digest('hex');
  }
}
