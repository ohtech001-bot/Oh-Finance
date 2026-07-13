import { HttpException, HttpStatus } from '@nestjs/common';
import { ERROR_CODES, type ErrorCode } from '@oh/contracts';

/**
 * خطأ تطبيق بكود ثابت.
 *
 * الواجهة تتفرّع على `code` لا على نص الرسالة — الرسائل تُترجم وتتغيّر،
 * الأكواد عقد.
 */
export class AppError extends HttpException {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    status: HttpStatus,
    public readonly fields?: Record<string, string[]>,
  ) {
    super({ code, message, fields }, status);
  }

  static validation(message: string, fields?: Record<string, string[]>): AppError {
    return new AppError(ERROR_CODES.VALIDATION_FAILED, message, HttpStatus.BAD_REQUEST, fields);
  }

  static unauthenticated(message = 'يلزم تسجيل الدخول.'): AppError {
    return new AppError(ERROR_CODES.UNAUTHENTICATED, message, HttpStatus.UNAUTHORIZED);
  }

  /**
   * بيانات دخول خاطئة — رسالة **موحّدة** سواء كان البريد غير موجود أو
   * كلمة المرور خاطئة. التفرقة بينهما تكشف أي البُرد مسجّلة عندنا.
   */
  static invalidCredentials(): AppError {
    return new AppError(
      ERROR_CODES.INVALID_CREDENTIALS,
      'البريد الإلكتروني أو كلمة المرور غير صحيحة.',
      HttpStatus.UNAUTHORIZED,
    );
  }

  static accountLocked(minutes: number): AppError {
    return new AppError(
      ERROR_CODES.ACCOUNT_LOCKED,
      `الحساب مقفل مؤقتًا بسبب محاولات دخول فاشلة متكررة. حاول بعد ${minutes} دقيقة.`,
      HttpStatus.LOCKED,
    );
  }

  static accountInactive(): AppError {
    return new AppError(
      ERROR_CODES.ACCOUNT_INACTIVE,
      'هذا الحساب غير نشط. راجع صاحب المحل.',
      HttpStatus.FORBIDDEN,
    );
  }

  static twoFactorRequired(): AppError {
    return new AppError(
      ERROR_CODES.TWO_FACTOR_REQUIRED,
      'أدخل رمز التحقق بخطوتين.',
      HttpStatus.UNAUTHORIZED,
    );
  }

  static tokenExpired(): AppError {
    return new AppError(
      ERROR_CODES.TOKEN_EXPIRED,
      'انتهت صلاحية الجلسة. سجّل الدخول مجددًا.',
      HttpStatus.UNAUTHORIZED,
    );
  }

  /** كشف إعادة استخدام رمز تجديد — علامة سرقة. تُبطَل عائلة الجلسة كلها. */
  static tokenReused(): AppError {
    return new AppError(
      ERROR_CODES.TOKEN_REUSED,
      'اكتُشف استخدام غير طبيعي للجلسة. أُنهيت جميع الجلسات لحمايتك — سجّل الدخول مجددًا.',
      HttpStatus.UNAUTHORIZED,
    );
  }

  static csrfInvalid(): AppError {
    return new AppError(
      ERROR_CODES.CSRF_INVALID,
      'رمز الحماية غير صالح. حدّث الصفحة وأعد المحاولة.',
      HttpStatus.FORBIDDEN,
    );
  }

  static forbidden(message = 'ليس لديك صلاحية لهذا الإجراء.'): AppError {
    return new AppError(ERROR_CODES.FORBIDDEN, message, HttpStatus.FORBIDDEN);
  }

  static tenantSuspended(): AppError {
    return new AppError(
      ERROR_CODES.TENANT_SUSPENDED,
      'هذا المحل موقوف. راجع إدارة المنصة.',
      HttpStatus.FORBIDDEN,
    );
  }

  static subscriptionInactive(): AppError {
    return new AppError(
      ERROR_CODES.SUBSCRIPTION_INACTIVE,
      'الاشتراك غير نشط. جدّد الاشتراك لمتابعة العمل.',
      HttpStatus.PAYMENT_REQUIRED,
    );
  }

  static notFound(what = 'العنصر'): AppError {
    return new AppError(ERROR_CODES.NOT_FOUND, `${what} غير موجود.`, HttpStatus.NOT_FOUND);
  }

  static conflict(message: string): AppError {
    return new AppError(ERROR_CODES.CONFLICT, message, HttpStatus.CONFLICT);
  }

  static planLimitExceeded(resource: string, limit: number): AppError {
    return new AppError(
      ERROR_CODES.PLAN_LIMIT_EXCEEDED,
      `بلغت حد الباقة لـ${resource} (${limit}). رقِّ الباقة للمتابعة.`,
      HttpStatus.PAYMENT_REQUIRED,
    );
  }

  static internal(message = 'حدث خطأ غير متوقع.'): AppError {
    return new AppError(ERROR_CODES.INTERNAL, message, HttpStatus.INTERNAL_SERVER_ERROR);
  }
}
