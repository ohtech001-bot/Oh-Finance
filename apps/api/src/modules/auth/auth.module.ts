import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { PasswordService } from './password.service.js';
import { TokenService } from './token.service.js';
import { LoginFailureRateLimiter } from './login-failure-rate-limiter.js';

@Module({
  imports: [JwtModule.register({})], // الأسرار تُمرَّر لكل عملية توقيع صراحةً
  controllers: [AuthController],
  providers: [AuthService, PasswordService, TokenService, LoginFailureRateLimiter],
  exports: [AuthService, PasswordService, TokenService],
})
export class AuthModule {}
