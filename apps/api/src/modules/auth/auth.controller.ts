import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, Res } from '@nestjs/common';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import {
  forgotPasswordRequestSchema,
  changePasswordRequestSchema,
  loginRequestSchema,
  resetPasswordRequestSchema,
  type ForgotPasswordRequest,
  type LoginRequest,
  type ChangePasswordRequest,
  type ResetPasswordRequest,
} from '@oh/contracts';
import { zodBody } from '../../core/validation/zod.pipe.js';
import { AppError } from '../../core/errors/app-error.js';
import { AuthService } from './auth.service.js';
import { COOKIE_NAMES, type AccessTokenPayload } from './token.service.js';
import { AllowPendingPasswordChange, CurrentUser, Public, SkipCsrf } from './decorators.js';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  /**
   * تسجيل الدخول.
   *
   * النجاح غير محدود. `AuthService` يسجل في Redis محاولات بيانات الدخول
   * الخاطئة فقط، بينما يبقى قفل الحساب طبقة مستقلة ضد التخمين الموزع.
   */
  @Public()
  @SkipCsrf()
  @SkipThrottle()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'تسجيل الدخول — يضع رموز الجلسة في كوكيز HttpOnly.' })
  async login(
    @Body(zodBody(loginRequestSchema)) dto: LoginRequest,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.auth.login(dto, res, {
      ip: req.ip ?? null,
      userAgent: req.headers['user-agent'] ?? null,
    });
  }

  /**
   * تجديد الجلسة.
   *
   * عام (لا يتطلب رمز وصول صالح — فالوصول انتهى، وهذا سبب النداء)، لكنه
   * يتطلب كوكي التجديد الصالح، وهو HttpOnly ومقيّد بالمسار.
   */
  @Public()
  @SkipCsrf()
  @SkipThrottle()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'تجديد الجلسة مع تدوير الرمز وكشف إعادة الاستخدام.' })
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const cookies = req.cookies as Record<string, string> | undefined;
    const token = cookies?.[COOKIE_NAMES.REFRESH];

    if (!token) {
      throw AppError.tokenExpired();
    }

    return this.auth.refresh(token, res, {
      ip: req.ip ?? null,
      userAgent: req.headers['user-agent'] ?? null,
    });
  }

  @Post('logout')
  @AllowPendingPasswordChange()
  @SkipThrottle()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'إنهاء الجلسة الحالية ومسح الكوكيز.' })
  async logout(
    @CurrentUser() user: AccessTokenPayload,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.auth.logout(user.sid, res);
  }

  @Get('me')
  @AllowPendingPasswordChange()
  @ApiOperation({ summary: 'المستخدم الحالي وصلاحياته.' })
  async me() {
    return this.auth.me();
  }

  @Post('support/exit')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'إنهاء جلسة دعم المدير العام والعودة إلى لوحة المنصة.' })
  async exitSupport(
    @CurrentUser() user: AccessTokenPayload,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.auth.exitSupportSession(user, res, {
      ip: req.ip ?? null,
      userAgent: req.headers['user-agent'] ?? null,
    });
  }

  @Post('change-initial-password')
  @AllowPendingPasswordChange()
  @HttpCode(HttpStatus.NO_CONTENT)
  async changeInitialPassword(
    @Body(zodBody(changePasswordRequestSchema)) dto: ChangePasswordRequest,
    @CurrentUser() user: AccessTokenPayload,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.auth.changeInitialPassword(user.sub, user.sid, dto, res);
  }

  /**
   * استعادة كلمة المرور.
   *
   * الرد موحّد دائمًا — لا يكشف إن كان البريد مسجّلًا (منع تعداد المستخدمين).
   * الإرسال الفعلي مؤجّل للمرحلة 7 (وحدة الرسائل). الواجهة تعرض نفس رسالة
   * النجاح، وهي **صادقة**: نحن فعلًا لا نعِد بالإرسال، بل بالإرسال «إن كان مسجّلًا».
   */
  @Public()
  @SkipCsrf()
  @Throttle({ default: { limit: 3, ttl: 900_000 } })
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'طلب استعادة كلمة المرور — رد موحّد لمنع تعداد المستخدمين.' })
  async forgotPassword(@Body(zodBody(forgotPasswordRequestSchema)) dto: ForgotPasswordRequest) {
    return this.auth.forgotPassword(dto.email);
  }

  @Public()
  @SkipCsrf()
  @Throttle({ default: { limit: 5, ttl: 900_000 } })
  @Post('reset-initial-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'تعيين كلمة السر الأولى عبر رابط البريد الموقّع.' })
  async resetInitialPassword(
    @Body(zodBody(resetPasswordRequestSchema)) dto: ResetPasswordRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.auth.resetInitialPassword(dto);
    this.auth.clearAuthCookies(res);
  }
}
