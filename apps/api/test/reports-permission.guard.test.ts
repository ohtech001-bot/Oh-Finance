import { describe, expect, it } from 'vitest';
import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionsGuard } from '../src/modules/auth/guards/permissions.guard.js';
import { ReportsController } from '../src/modules/reports/reports.controller.js';
import { AppError } from '../src/core/errors/app-error.js';
import { TenantContext, type RequestContext } from '../src/core/tenancy/tenant-context.js';

/** حماية GET /reports بصلاحية reports.read — على مستوى الحارس (بلا قاعدة بيانات). */
const guard = new PermissionsGuard(new Reflector());
function ctx(): ExecutionContext {
  return {
    getHandler: () => ReportsController.prototype.get,
    getClass: () => ReportsController,
    getType: () => 'http',
  } as unknown as ExecutionContext;
}
function reqCtx(permissions: string[]): RequestContext {
  return {
    requestId: 'guard-test', tenantId: '11111111-1111-1111-1111-111111111111',
    userId: '22222222-2222-2222-2222-222222222222', storeId: '33333333-3333-3333-3333-333333333333',
    isSuperAdmin: false, permissions: permissions as never, ip: null, userAgent: null,
  };
}
function run(permissions: string[]): number | true {
  return TenantContext.run(reqCtx(permissions), () => {
    try { return guard.canActivate(ctx()) as true; }
    catch (e) { if (e instanceof AppError) return e.getStatus(); throw e; }
  });
}

describe('حماية GET /reports', () => {
  it('يمنع من لا يملك reports.read بـ403', () => {
    expect(run(['dashboard.read', 'orders.read'])).toBe(403);
  });
  it('يسمح لمن يملك reports.read', () => {
    expect(run(['reports.read'])).toBe(true);
  });
});
