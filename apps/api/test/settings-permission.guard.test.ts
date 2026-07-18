import { describe, expect, it } from 'vitest';
import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionsGuard } from '../src/modules/auth/guards/permissions.guard.js';
import { SettingsController } from '../src/modules/settings/settings.controller.js';
import { AppError } from '../src/core/errors/app-error.js';
import { TenantContext, type RequestContext } from '../src/core/tenancy/tenant-context.js';

/**
 * حماية الإعدادات — القراءة بـsettings.read، التعديل بـsettings.manage.
 * على مستوى الحارس (بلا قاعدة بيانات).
 */
const guard = new PermissionsGuard(new Reflector());
function contextFor(handler: (...args: never[]) => unknown): ExecutionContext {
  return { getHandler: () => handler, getClass: () => SettingsController, getType: () => 'http' } as unknown as ExecutionContext;
}
function reqCtx(permissions: string[]): RequestContext {
  return {
    requestId: 'guard-test', tenantId: '11111111-1111-1111-1111-111111111111',
    userId: '22222222-2222-2222-2222-222222222222', storeId: '33333333-3333-3333-3333-333333333333',
    isSuperAdmin: false, permissions: permissions as never, ip: null, userAgent: null,
  };
}
function run(context: ExecutionContext, permissions: string[]): number | true {
  return TenantContext.run(reqCtx(permissions), () => {
    try { return guard.canActivate(context) as true; }
    catch (e) { if (e instanceof AppError) return e.getStatus(); throw e; }
  });
}
const getCtx = () => contextFor(SettingsController.prototype.get);
const patchCtx = () => contextFor(SettingsController.prototype.update);

describe('حماية الإعدادات', () => {
  it('القراءة تتطلب settings.read', () => {
    expect(run(getCtx(), ['orders.read'])).toBe(403);
    expect(run(getCtx(), ['settings.read'])).toBe(true);
  });
  it('التعديل يتطلب settings.manage — القراءة لا تكفي', () => {
    expect(run(patchCtx(), ['settings.read'])).toBe(403);
    expect(run(patchCtx(), ['settings.manage'])).toBe(true);
  });
});
