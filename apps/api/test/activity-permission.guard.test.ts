import { describe, expect, it } from 'vitest';
import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionsGuard } from '../src/modules/auth/guards/permissions.guard.js';
import { ActivityController } from '../src/modules/activity/activity.controller.js';
import { AppError } from '../src/core/errors/app-error.js';
import { TenantContext, type RequestContext } from '../src/core/tenancy/tenant-context.js';

/**
 * حماية مساري موجز النشاط بالصلاحيات — على مستوى الحارس (بلا قاعدة بيانات).
 *
 * نختبر الحارس الحقيقي على بيانات وسم `@RequirePermissions` الفعلية للمتحكم،
 * فنثبت أن كل مسار محمي فعلًا لا بالنيّة فقط:
 *
 *   • `storeFeed`        (GET /activity)                → activity.read
 *   • `customerTimeline` (GET /customers/:id/activity)  → customers.read
 *
 * الفصل مقصود: من يقرأ الزبائن لا يرى بالضرورة نشاط المحل العام.
 */

const guard = new PermissionsGuard(new Reflector());

function contextFor(handler: (...args: never[]) => unknown): ExecutionContext {
  return {
    getHandler: () => handler,
    getClass: () => ActivityController,
    getType: () => 'http',
  } as unknown as ExecutionContext;
}

const storeFeedCtx = () => contextFor(ActivityController.prototype.storeFeed);
const timelineCtx = () => contextFor(ActivityController.prototype.customerTimeline);

function reqCtx(permissions: string[]): RequestContext {
  return {
    requestId: 'guard-test',
    tenantId: '11111111-1111-1111-1111-111111111111',
    userId: '22222222-2222-2222-2222-222222222222',
    storeId: '33333333-3333-3333-3333-333333333333',
    isSuperAdmin: false,
    permissions: permissions as never,
    ip: null,
    userAgent: null,
  };
}

/** يشغّل الحارس ويعيد رمز الحالة إن رُفض، أو `true` إن سُمح. */
function run(context: ExecutionContext, permissions: string[]): number | true {
  return TenantContext.run(reqCtx(permissions), () => {
    try {
      return guard.canActivate(context) as true;
    } catch (e) {
      if (e instanceof AppError) return e.getStatus();
      throw e;
    }
  });
}

describe('حماية موجز نشاط المحل GET /activity', () => {
  it('يمنع من لا يملك activity.read بـ403', () => {
    expect(run(storeFeedCtx(), [])).toBe(403);
  });

  it('لا تكفي customers.read وحدها لموجز المحل — 403', () => {
    // جوهر التصميم: قراءة الزبائن لا تمنح رؤية نشاط المحل العام.
    expect(run(storeFeedCtx(), ['customers.read', 'orders.read', 'payments.read'])).toBe(403);
  });

  it('يسمح لمن يملك activity.read', () => {
    expect(run(storeFeedCtx(), ['activity.read'])).toBe(true);
  });
});

describe('حماية الخط الزمني للزبون GET /customers/:id/activity', () => {
  it('يمنع من لا يملك customers.read بـ403', () => {
    expect(run(timelineCtx(), ['activity.read', 'orders.read'])).toBe(403);
  });

  it('يسمح لمن يملك customers.read', () => {
    expect(run(timelineCtx(), ['customers.read'])).toBe(true);
  });
});
