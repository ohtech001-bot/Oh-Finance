import 'reflect-metadata';
import { Logger as PinoLogger } from 'nestjs-pino';
import { EnvValidationError } from '@oh/config';
import { createApplication } from './bootstrap.js';
import { EnvService } from './core/config/env.service.js';

async function bootstrap(): Promise<void> {
  const app = await createApplication();
  const env = app.get(EnvService);

  const port = process.env.PORT ? Number(process.env.PORT) : env.get('API_PORT');
  const host = env.isProduction ? '0.0.0.0' : env.get('API_HOST');

  await app.listen(port, host);

  const logger = app.get(PinoLogger);
  logger.log(`الخادم يعمل على http://${host}:${port}/api`);
  if (!env.isProduction) {
    logger.log(`توثيق الـAPI: http://${host}:${port}/api/docs`);
  }
}

bootstrap().catch((error: unknown) => {
  if (error instanceof EnvValidationError) {
    console.error(`\n\x1b[31m✗ ${error.message}\x1b[0m`);
    console.error('  انسخ .env.development.example إلى .env.development واملأ القيم.\n');
    process.exit(1);
  }
  console.error('\x1b[31m✗ فشل إقلاع الخادم:\x1b[0m', error);
  process.exit(1);
});
