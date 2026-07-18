import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { parseEnv } from '@oh/config';

import { AppConfigModule } from './core/config/config.module.js';
import { EnvService } from './core/config/env.service.js';
import { PrismaModule } from './core/prisma/prisma.module.js';
import { AuditModule } from './core/audit/audit.module.js';
import { AllExceptionsFilter } from './core/errors/all-exceptions.filter.js';
import { buildLoggerConfig } from './core/logging/logger.config.js';
import { RequestContextMiddleware } from './core/tenancy/request-context.middleware.js';
import { NumberingModule } from './core/numbering/numbering.module.js';
import { IdempotencyModule } from './core/idempotency/idempotency.module.js';

import { AuthModule } from './modules/auth/auth.module.js';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard.js';
import { PermissionsGuard } from './modules/auth/guards/permissions.guard.js';
import { CsrfGuard } from './modules/auth/guards/csrf.guard.js';
import { PlatformModule } from './modules/platform/platform.module.js';
import { TenantModule } from './modules/tenant/tenant.module.js';
import { HealthModule } from './modules/health/health.module.js';

// ── المرحلة 2: النواة المالية ──
import { LedgerModule } from './modules/ledger/ledger.module.js';
import { CustomersModule } from './modules/customers/customers.module.js';
import { OrdersModule } from './modules/orders/orders.module.js';
import { PaymentsModule } from './modules/payments/payments.module.js';

// ── المرحلة 3: لوحة التحكم وسجل النشاط ──
import { DashboardModule } from './modules/dashboard/dashboard.module.js';
import { AuditReadModule } from './modules/audit/audit-read.module.js';
import { ActivityModule } from './modules/activity/activity.module.js';

// ── المرحلة 4: التقارير والإعدادات ──
import { ReportsModule } from './modules/reports/reports.module.js';
import { SettingsModule } from './modules/settings/settings.module.js';

@Module({
  imports: [
    AppConfigModule,
    PrismaModule,
    AuditModule,

    LoggerModule.forRoot(buildLoggerConfig(parseEnv(process.env))),

    /**
     * حدود المعدل.
     *
     * مسميّان: `default` للطلبات العامة، و`auth` لمسارات المصادقة (أشد بكثير).
     * التخزين بالذاكرة في التطوير مقبول؛ الإنتاج يفرض Redis عبر `envSchema`
     * لأن العدّاد بالذاكرة لا يعمل عبر عدة نسخ من الخادم — يصير كل نسخة تعدّ
     * وحدها، فيتضاعف الحد الفعلي بعدد النسخ.
     */
    ThrottlerModule.forRootAsync({
      inject: [EnvService],
      useFactory: (env: EnvService) => [
        {
          name: 'default',
          ttl: env.get('RATE_LIMIT_TTL_SECONDS') * 1000,
          limit: env.get('RATE_LIMIT_MAX'),
        },
        {
          name: 'auth',
          ttl: 900_000,
          limit: env.get('AUTH_RATE_LIMIT_MAX'),
        },
      ],
    }),

    AuthModule,
    PlatformModule,
    TenantModule,
    HealthModule,

    /**
     * ── المرحلة 2: النواة المالية ──
     *
     * `LedgerModule` قبل الوحدات التي تعتمد عليه — وهو `@Global` فتُحقن
     * `LedgerService` في الزبائن والطلبات والدفعات بلا استيراد صريح.
     * كونه عامًا يجعل من الواضح أنه بنية تحتية: **الطريق الوحيد** لكتابة
     * قيد محاسبي، لا وحدة أعمال عادية.
     */
    NumberingModule,
    IdempotencyModule,
    LedgerModule,
    CustomersModule,
    OrdersModule,
    PaymentsModule,

    // ── المرحلة 3 ──
    DashboardModule,
    AuditReadModule,
    ActivityModule,
    ReportsModule,
    SettingsModule,
  ],
  providers: [
    /**
     * ترتيب الحراس **مهم** — Nest ينفّذها بترتيب التسجيل:
     *
     *   1. Throttler  — يوقف الفيضان قبل أي عمل (لا نصرف Argon2 على هجوم).
     *   2. JwtAuth    — يتحقق من الرمز ويحقن المستأجر في السياق.
     *   3. Csrf       — يحتاج sid من الرمز، فيأتي بعد JwtAuth.
     *   4. Permissions— يحتاج الصلاحيات من السياق، فيأتي أخيرًا.
     */
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: CsrfGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },

    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    // يفتح سياق الطلب (requestId) لكل طلب — قبل الحراس.
    consumer.apply(RequestContextMiddleware).forRoutes('*');
  }
}
