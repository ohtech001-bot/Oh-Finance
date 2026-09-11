import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger as PinoLogger } from 'nestjs-pino';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import type { Request, Response, NextFunction } from 'express';
import { AppModule } from './app.module.js';
import { EnvService } from './core/config/env.service.js';

/** Builds the HTTP application without binding it to a long-lived port. */
export async function createApplication(): Promise<NestExpressApplication> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });

  app.useLogger(app.get(PinoLogger));
  const env = app.get(EnvService);

  app.setGlobalPrefix('api');
  app.use((_request: Request, response: Response, next: NextFunction) => {
    response.setHeader('Cache-Control', 'no-store');
    next();
  });

  app.use(
    helmet({
      contentSecurityPolicy: env.isProduction
        ? {
            directives: {
              defaultSrc: ["'self'"],
              scriptSrc: ["'self'"],
              styleSrc: ["'self'", "'unsafe-inline'"],
              imgSrc: [
                "'self'",
                'data:',
                ...(env.get('SUPABASE_URL') ? [new URL(env.get('SUPABASE_URL')!).origin] : []),
              ],
              connectSrc: ["'self'"],
              objectSrc: ["'none'"],
              frameAncestors: ["'none'"],
              upgradeInsecureRequests: [],
            },
          }
        : false,
      crossOriginResourcePolicy: { policy: 'same-site' },
      hsts: env.isProduction
        ? { maxAge: 31_536_000, includeSubDomains: true, preload: true }
        : false,
    }),
  );

  app.use(cookieParser(env.get('COOKIE_SECRET')));

  app.enableCors({
    origin: [env.get('WEB_ORIGIN')],
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'X-CSRF-Token', 'X-Request-Id', 'Idempotency-Key'],
    exposedHeaders: ['X-Request-Id'],
    maxAge: 86_400,
  });

  app.set('trust proxy', 1);

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

  return app;
}
