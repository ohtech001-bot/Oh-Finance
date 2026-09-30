import { describe, expect, it, vi } from 'vitest';
import type { JwtService } from '@nestjs/jwt';
import type { EnvService } from '../../core/config/env.service.js';
import type { TxClient } from '../../core/prisma/prisma.service.js';
import type { PasswordService } from './password.service.js';
import { TokenService } from './token.service.js';

function service() {
  return new TokenService(
    {} as JwtService,
    {} as EnvService,
    { hashToken: () => 'test-token-hash' } as unknown as PasswordService,
  );
}

describe('session security', () => {
  it('waits for the refresh-token lock before reading or rotating a session', async () => {
    let unlock!: () => void;
    const lock = new Promise<void>((resolve) => {
      unlock = resolve;
    });
    const findUnique = vi.fn().mockResolvedValue(null);
    const tx = {
      $executeRaw: vi.fn().mockReturnValue(lock),
      session: { findUnique },
    } as unknown as TxClient;
    const pending = service().rotateRefreshToken(tx, 'test-only-token', {
      userAgent: null,
      ipAddress: null,
    });
    await Promise.resolve();
    expect(findUnique).not.toHaveBeenCalled();
    unlock();
    await expect(pending).resolves.toEqual({ outcome: 'INVALID' });
  });
  it.each([
    ['INACTIVE', false, 'ACTIVE', false],
    ['ACTIVE', false, 'SUSPENDED', false],
    ['ACTIVE', false, 'CANCELLED', false],
    ['ACTIVE', false, 'ACTIVE', true],
    ['ACTIVE', true, 'SUSPENDED', true],
  ])('checks user %s and tenant %s state', async (status, isSuperAdmin, tenantStatus, expected) => {
    const tx = {
      session: {
        findUnique: vi.fn().mockResolvedValue({
          revokedAt: null,
          expiresAt: new Date(Date.now() + 60_000),
          user: { status, isSuperAdmin },
          tenant: { status: tenantStatus },
        }),
      },
    } as unknown as TxClient;
    await expect(service().isSessionActive(tx, 'session')).resolves.toBe(expected);
  });
});
