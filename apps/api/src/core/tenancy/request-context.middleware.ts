import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { TenantContext, type RequestContext } from './tenant-context.js';

/**
 * يفتح سياق الطلب لكل طلب وارد.
 *
 * في هذه المرحلة السياق **مجهول** — لا مستأجر ولا مستخدم. `JwtAuthGuard`
 * هو من يملؤه بعد التحقق من الرمز. الترتيب مقصود:
 *
 *   middleware (سياق فارغ + requestId)
 *      → guard (يتحقق من الرمز ويحقن المستأجر)
 *          → controller/service (يستعلم ضمن السياق)
 *
 * هكذا يوجد `requestId` حتى للطلبات التي تفشل مصادقتها — فنستطيع تتبّعها.
 */
@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const headerId = req.headers['x-request-id'];
    const requestId =
      (Array.isArray(headerId) ? headerId[0] : headerId) ??
      (req as { id?: string }).id ??
      randomUUID();

    res.setHeader('X-Request-Id', requestId);

    const context: RequestContext = {
      requestId,
      tenantId: null,
      userId: null,
      storeId: null,
      isSuperAdmin: false,
      supportMode: false,
      permissions: [],
      mustChangePassword: false,
      ip: req.ip ?? null,
      userAgent: req.headers['user-agent'] ?? null,
    };

    TenantContext.run(context, () => next());
  }
}
