import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger as PinoLogger } from 'nestjs-pino';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { EnvValidationError } from '@oh/config';
import { AppModule } from './app.module.js';
import { EnvService } from './core/config/env.service.js';

async function bootstrap(): Promise<void> {
  // نوع Express صريح — `app.set('trust proxy')` غير موجود على الواجهة العامة.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });

  app.useLogger(app.get(PinoLogger));
  const env = app.get(EnvService);

  app.setGlobalPrefix('api');

  /**
   * ترويسات الأمان.
   *
   * CSP هنا تحمي ردود الـAPI نفسها (صفحة Swagger مثلًا). الواجهة تُقدَّم من
   * خادم منفصل وتحمل CSP خاصة بها.
   *
   * `crossOriginResourcePolicy` مضبوطة على same-site كي تستطيع الواجهة على
   * منفذ مختلف قراءة الردود في التطوير.
   */
  app.use(
    helmet({
      contentSecurityPolicy: env.isProduction
        ? {
            directives: {
              defaultSrc: ["'self'"],
              scriptSrc: ["'self'"],
              styleSrc: ["'self'", "'unsafe-inline'"],
              imgSrc: ["'self'", 'data:'],
              connectSrc: ["'self'"],
              objectSrc: ["'none'"],
              frameAncestors: ["'none'"],
              upgradeInsecureRequests: [],
            },
          }
        : false, // Swagger UI في التطوير يحتاج inline scripts
      crossOriginResourcePolicy: { policy: 'same-site' },
      hsts: env.isProduction ? { maxAge: 31_536_000, includeSubDomains: true, preload: true } : false,
    }),
  );

  app.use(cookieParser(env.get('COOKIE_SECRET')));

  /**
   * CORS بقائمة سماح صريحة.
   *
   * `credentials: true` إلزامي — بدونه لا يرسل المتصفح كوكيز الجلسة.
   * ومع credentials، **يمنع المتصفح** استخدام `origin: '*'` — وهذا جيد:
   * لا مجال لخطأ `*` الشائع الذي يفتح الـAPI للجميع.
   */
  app.enableCors({
    origin: [env.get('WEB_ORIGIN')],
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'X-CSRF-Token', 'X-Request-Id', 'Idempotency-Key'],
    exposedHeaders: ['X-Request-Id'],
    maxAge: 86_400,
  });

  // ثقة بالوكيل العكسي — كي يكون req.ip هو IP العميل الحقيقي لا الوكيل.
  // بدونه، حدود المعدل وقفل الحسابات تعدّ كل الطلبات من IP واحد.
  app.set('trust proxy', 1);

  // ── Swagger — في غير الإنتاج فقط ────────────────────────────────────────
  // نشره في الإنتاج يعني تسليم خريطة كاملة للـAPI (المسارات، الحقول، الأنواع)
  // لأي زائر. لا فائدة تشغيلية تبرّر ذلك.
  if (!env.isProduction) {
    const config = new DocumentBuilder()
      .setTitle('Oh-Finance API')
      .setDescription(
        'SaaS متعدد المحلات — الزبائن، الطلبات الآجلة، الدفعات، دفتر الحركات.\n\n' +
          '**المصادقة:** كوكيز HttpOnly. الطلبات المُغيِّرة للحالة تتطلب ترويسة `X-CSRF-Token`.\n\n' +
          '**المستأجر:** يُستخرج من الجلسة حصرًا — لا يُقبل من العميل.\n\n' +
          '**المبالغ:** نصوص عشرية ("1250.00")، لا أرقام JSON.',
      )
      .setVersion('0.1.0')
      .addCookieAuth('oh_at')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: { persistAuthorization: true },
    });
  }

  const port = env.get('API_PORT');
  const host = env.get('API_HOST');

  await app.listen(port, host);

  const logger = app.get(PinoLogger);
  logger.log(`الخادم يعمل على http://${host}:${port}/api`);
  if (!env.isProduction) {
    logger.log(`توثيق الـAPI: http://${host}:${port}/api/docs`);
  }
}

bootstrap().catch((error: unknown) => {
  /**
   * فشل الإقلاع — نميّز خطأ الإعداد عن غيره.
   *
   * خطأ بيئة يطبع قائمة واضحة بما ينقص. أي خطأ آخر يُطبع كاملًا.
   * في الحالتين نخرج بكود 1: خادم مالي بإعداد ناقص **يجب ألا يعمل**.
   */
  if (error instanceof EnvValidationError) {
    console.error(`\n\x1b[31m✗ ${error.message}\x1b[0m`);
    console.error('  انسخ .env.development.example إلى .env.development واملأ القيم.\n');
    process.exit(1);
  }
  console.error('\x1b[31m✗ فشل إقلاع الخادم:\x1b[0m', error);
  process.exit(1);
});
