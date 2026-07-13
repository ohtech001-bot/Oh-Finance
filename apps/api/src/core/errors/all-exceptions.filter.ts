import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import { ERROR_CODES, type ApiError } from '@oh/contracts';
import type { Request, Response } from 'express';
import { TenantContext } from '../tenancy/tenant-context.js';
import { EnvService } from '../config/env.service.js';
import { AppError } from './app-error.js';

/**
 * مرشّح الاستثناءات المركزي — نقطة الخروج الوحيدة للأخطاء.
 *
 * مسؤوليتان أمنيتان:
 *   1. **لا stack trace ولا تفاصيل داخلية تصل للعميل في الإنتاج.**
 *      رسالة قاعدة البيانات قد تكشف أسماء جداول وأعمدة وقيود — خريطة مجانية
 *      للمهاجم. تُسجَّل كاملة على الخادم، ويرى العميل رسالة عامة + requestId.
 *   2. كل خطأ يحمل `requestId` — يربط ما رآه المستخدم بسطر السجل بالضبط.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  constructor(private readonly env: EnvService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const requestId = TenantContext.requestId();

    const { status, body, logLevel } = this.normalize(exception, requestId);

    const logPayload = {
      requestId,
      method: request.method,
      path: request.url,
      status,
      code: body.code,
      tenantId: TenantContext.get()?.tenantId ?? null,
      userId: TenantContext.get()?.userId ?? null,
    };

    if (logLevel === 'error') {
      this.logger.error(
        { ...logPayload, err: exception },
        `${body.code}: ${this.extractMessage(exception)}`,
      );
    } else {
      this.logger.warn(logPayload, body.code);
    }

    response.status(status).json(body);
  }

  private normalize(
    exception: unknown,
    requestId: string,
  ): { status: number; body: ApiError; logLevel: 'warn' | 'error' } {
    // ── أخطاء التطبيق المقصودة ──────────────────────────────────────────
    if (exception instanceof AppError) {
      const res = exception.getResponse() as { code: string; message: string; fields?: never };
      return {
        status: exception.getStatus(),
        body: { code: res.code, message: res.message, fields: exception.fields, requestId },
        logLevel: exception.getStatus() >= 500 ? 'error' : 'warn',
      };
    }

    // ── أخطاء التحقق من المدخلات ────────────────────────────────────────
    if (exception instanceof ZodError) {
      const fields: Record<string, string[]> = {};
      for (const issue of exception.issues) {
        const key = issue.path.join('.') || '_root';
        (fields[key] ??= []).push(issue.message);
      }
      return {
        status: HttpStatus.BAD_REQUEST,
        body: {
          code: ERROR_CODES.VALIDATION_FAILED,
          message: 'تحقّق من البيانات المُدخلة.',
          fields,
          requestId,
        },
        logLevel: 'warn',
      };
    }

    // ── أخطاء Prisma المعروفة ───────────────────────────────────────────
    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      return this.normalizePrisma(exception, requestId);
    }

    // ── استثناءات Nest القياسية (404 من الراوتر، حدود المعدل...) ─────────
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const res = exception.getResponse();
      const message =
        typeof res === 'string'
          ? res
          : ((res as { message?: string | string[] }).message ?? exception.message);

      return {
        status,
        body: {
          code: status === 429 ? ERROR_CODES.RATE_LIMITED : this.codeForStatus(status),
          message: Array.isArray(message) ? message.join('، ') : message,
          requestId,
        },
        logLevel: status >= 500 ? 'error' : 'warn',
      };
    }

    // ── المجهول: لا نكشف شيئًا ──────────────────────────────────────────
    // في التطوير نُظهر الرسالة لتسريع التشخيص. في الإنتاج: رسالة عامة فقط.
    const message = this.env.isProduction
      ? 'حدث خطأ غير متوقع. إن تكرر، أبلغ الدعم بالرقم المرجعي.'
      : this.extractMessage(exception);

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      body: { code: ERROR_CODES.INTERNAL, message, requestId },
      logLevel: 'error',
    };
  }

  private normalizePrisma(
    exception: Prisma.PrismaClientKnownRequestError,
    requestId: string,
  ): { status: number; body: ApiError; logLevel: 'warn' | 'error' } {
    switch (exception.code) {
      // انتهاك قيد فريد
      case 'P2002': {
        const target = (exception.meta?.target as string[] | undefined)?.join('، ') ?? 'قيمة';
        return {
          status: HttpStatus.CONFLICT,
          body: {
            code: ERROR_CODES.CONFLICT,
            message: `القيمة مستخدمة مسبقًا (${this.humanizeField(target)}).`,
            requestId,
          },
          logLevel: 'warn',
        };
      }

      // مرجع أجنبي مفقود
      case 'P2003':
        return {
          status: HttpStatus.BAD_REQUEST,
          body: {
            code: ERROR_CODES.VALIDATION_FAILED,
            message: 'مرجع غير صالح في البيانات المُرسلة.',
            requestId,
          },
          logLevel: 'warn',
        };

      // صف غير موجود
      case 'P2025':
        return {
          status: HttpStatus.NOT_FOUND,
          body: { code: ERROR_CODES.NOT_FOUND, message: 'العنصر غير موجود.', requestId },
          logLevel: 'warn',
        };

      default:
        // ⚠️ لا نُمرّر رسالة Prisma للعميل — تكشف أسماء الجداول والأعمدة.
        return {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          body: {
            code: ERROR_CODES.INTERNAL,
            message: 'حدث خطأ في قاعدة البيانات.',
            requestId,
          },
          logLevel: 'error',
        };
    }
  }

  private codeForStatus(status: number): string {
    if (status === 401) return ERROR_CODES.UNAUTHENTICATED;
    if (status === 403) return ERROR_CODES.FORBIDDEN;
    if (status === 404) return ERROR_CODES.NOT_FOUND;
    if (status === 409) return ERROR_CODES.CONFLICT;
    if (status === 400) return ERROR_CODES.VALIDATION_FAILED;
    return ERROR_CODES.INTERNAL;
  }

  private humanizeField(target: string): string {
    const map: Record<string, string> = {
      email: 'البريد الإلكتروني',
      slug: 'المعرّف',
      code: 'الرمز',
    };
    return map[target] ?? target;
  }

  private extractMessage(exception: unknown): string {
    if (exception instanceof Error) return exception.message;
    return String(exception);
  }
}
