import { Controller, Get, HttpCode, HttpStatus, ServiceUnavailableException } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { EnvService } from '../../core/config/env.service.js';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import { Public, SkipCsrf } from '../auth/decorators.js';

/**
 * فحوص الصحة.
 *
 * فحصان متمايزان — الخلط بينهما خطأ تشغيلي شائع:
 *
 *   /health/live   (liveness)  — هل العملية حيّة؟ لا تلمس قاعدة البيانات.
 *   /health        (readiness) — هل تستطيع خدمة الطلبات؟ تفحص قاعدة البيانات.
 *
 * لو جعلنا liveness يفحص قاعدة البيانات، لأعاد Kubernetes تشغيل الخادم عند
 * أي عطل عابر في قاعدة البيانات — وهو ما لا يُصلح شيئًا ويزيد الضرر. الصحيح
 * أن يخرج الخادم من موازِن الحمل (readiness) ويبقى حيًّا حتى تعود القاعدة.
 */
@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly env: EnvService,
  ) {}

  @Public()
  @SkipCsrf()
  @Get('live')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'العملية حيّة (لا تفحص قاعدة البيانات).' })
  live() {
    return { status: 'ok', uptime: Math.floor(process.uptime()) };
  }

  @Public()
  @SkipCsrf()
  @Get()
  @ApiOperation({ summary: 'جاهز لخدمة الطلبات (يفحص قاعدة البيانات).' })
  async ready() {
    const database = await this.prisma.ping();

    if (!database) {
      throw new ServiceUnavailableException({
        status: 'unavailable',
        checks: { database: 'down' },
      });
    }

    return {
      status: 'ok',
      environment: this.env.get('NODE_ENV'),
      checks: { database: 'up' },
    };
  }
}
