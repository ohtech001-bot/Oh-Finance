import { randomUUID } from 'node:crypto';
import type { Params } from 'nestjs-pino';
import { REDACTED_KEYS, type Env } from '@oh/config';
import type { IncomingMessage, ServerResponse } from 'node:http';

/**
 * سجلّات منظّمة (Pino) مع تنقيح إلزامي للبيانات الحسّاسة.
 *
 * التنقيح ليس اختياريًا: سطر سجل واحد يحتوي على `Authorization: Bearer ...`
 * أو `password` يعني أن كل من يصل إلى السجلات (فريق الدعم، مزوّد المراقبة،
 * نسخة احتياطية مسرّبة) يملك بيانات اعتماد حيّة.
 *
 * `censor: '[منقّح]'` بدل الحذف — كي يبقى وجود الحقل مرئيًا في التشخيص.
 */
export function buildLoggerConfig(env: Env): Params {
  const isProduction = env.NODE_ENV === 'production';

  // نبني مسارات التنقيح لكل موضع محتمل في السجل.
  const redactPaths = REDACTED_KEYS.flatMap((key) => [
    key,
    `*.${key}`,
    `req.body.${key}`,
    `req.headers.${key}`,
    `res.headers.${key}`,
    `err.${key}`,
    `context.${key}`,
  ]);

  return {
    pinoHttp: {
      level: env.LOG_LEVEL,

      // معرّف الطلب: نحترم الترويسة الواردة (تتبّع موزّع) أو نولّد واحدًا.
      genReqId: (req: IncomingMessage, res: ServerResponse) => {
        const incoming = req.headers['x-request-id'];
        const id = (Array.isArray(incoming) ? incoming[0] : incoming) ?? randomUUID();
        res.setHeader('X-Request-Id', id);
        return id;
      },

      redact: {
        paths: redactPaths,
        censor: '[منقّح]',
      },

      // في الإنتاج: JSON خام (للتجميع). في التطوير: مقروء للبشر.
      transport: isProduction
        ? undefined
        : {
            target: 'pino-pretty',
            options: {
              colorize: true,
              singleLine: true,
              translateTime: 'HH:MM:ss',
              ignore: 'pid,hostname,req.headers,res.headers',
            },
          },

      // نسجّل ما يلزم للتشخيص فقط — لا الجسم كاملًا (قد يحوي بيانات زبائن).
      serializers: {
        req: (req: { id: string; method: string; url: string; remoteAddress?: string }) => ({
          id: req.id,
          method: req.method,
          url: req.url,
          ip: req.remoteAddress,
        }),
        res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
      },

      customLogLevel: (_req, res, err) => {
        if (err) return 'error';
        if (res.statusCode >= 500) return 'error';
        if (res.statusCode >= 400) return 'warn';
        return 'info';
      },

      // فحوص الصحة تُغرق السجل بلا فائدة.
      autoLogging: {
        ignore: (req: IncomingMessage) => req.url === '/api/health' || req.url === '/api/health/live',
      },
    },
  };
}
