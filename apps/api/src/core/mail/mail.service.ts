import { Injectable } from '@nestjs/common';
import nodemailer from 'nodemailer';
import { EnvService } from '../config/env.service.js';
import { AppError } from '../errors/app-error.js';

@Injectable()
export class MailService {
  constructor(private readonly env: EnvService) {}

  private transport() {
    const host = this.env.get('SMTP_HOST');
    const user = this.env.get('SMTP_USER');
    const pass = this.env.get('SMTP_PASSWORD');
    if (!host || !user || !pass) {
      throw AppError.validation('خدمة البريد غير مهيأة. أضف إعدادات SMTP لبريد info@oh-tech.co.');
    }
    return nodemailer.createTransport({
      host,
      port: this.env.get('SMTP_PORT'),
      secure: this.env.get('SMTP_SECURE'),
      auth: { user, pass },
    });
  }

  async sendVerificationCode(to: string, code: string): Promise<void> {
    await this.transport().sendMail({
      from: { name: this.env.get('SMTP_FROM_NAME'), address: this.env.get('SMTP_FROM_EMAIL') },
      to,
      subject: 'OH Finance - Email verification code',
      text: `Your OH Finance verification code is ${code}. It expires in 10 minutes.`,
      html: `<div dir="rtl" style="font-family:Arial,sans-serif"><h2>رمز التحقق من البريد</h2><p>رمز التحقق الخاص بك في OH Finance هو:</p><p style="font-size:28px;font-weight:700;letter-spacing:6px" dir="ltr">${code}</p><p>ينتهي الرمز خلال 10 دقائق.</p></div>`,
    });
  }

  async sendTemporaryPassword(to: string, name: string, password: string): Promise<void> {
    await this.transport().sendMail({
      from: { name: this.env.get('SMTP_FROM_NAME'), address: this.env.get('SMTP_FROM_EMAIL') },
      to,
      subject: 'OH Finance - Your account is ready',
      text: `Hello ${name}. Your temporary password is ${password}. You must change it immediately after signing in.`,
      html: `<div dir="rtl" style="font-family:Arial,sans-serif"><h2>تم إنشاء حسابك في OH Finance</h2><p>مرحباً ${name}، كلمة المرور المؤقتة هي:</p><p style="font-size:22px;font-weight:700" dir="ltr">${password}</p><p>هذه كلمة مرور أحادية الاستعمال، وسيطلب منك النظام تغييرها فور الدخول.</p></div>`,
    });
  }
}
