import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { AuthController } from './auth.controller.js';

const SKIP_DEFAULT_THROTTLE = 'THROTTLER:SKIPdefault';

describe('AuthController rate-limit metadata', () => {
  it.each(['login', 'logout', 'refresh'] as const)(
    'exempts successful %s requests from the global request counter',
    (method) => {
      expect(Reflect.getMetadata(SKIP_DEFAULT_THROTTLE, AuthController.prototype[method])).toBe(true);
    },
  );
});
