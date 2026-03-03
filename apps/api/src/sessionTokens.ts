import crypto from 'node:crypto';
import type { Role } from '@packages/domain/src/identity';

type SessionTokenPayload = {
  userId: string;
  roles: readonly Role[];
};

function base64UrlEncode(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function base64UrlDecode(value: string): string {
  return Buffer.from(value, 'base64url').toString('utf8');
}

function signPayload(encodedPayload: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(encodedPayload).digest('base64url');
}

export class HmacSessionTokenIssuer {
  constructor(private readonly secret: string) {}

  async issue(input: { userId: string; roles: readonly Role[] }): Promise<string> {
    const encodedPayload = base64UrlEncode(
      JSON.stringify({
        userId: input.userId,
        roles: input.roles
      } satisfies SessionTokenPayload)
    );

    return `oj.${encodedPayload}.${signPayload(encodedPayload, this.secret)}`;
  }
}

export function resolveSessionToken(
  token: string,
  secret: string
): SessionTokenPayload | null {
  const [prefix, encodedPayload, signature] = token.split('.');
  if (prefix !== 'oj' || !encodedPayload || !signature) {
    return null;
  }

  const expectedSignature = signPayload(encodedPayload, secret);
  const providedSignature = Buffer.from(signature, 'utf8');
  const computedSignature = Buffer.from(expectedSignature, 'utf8');
  if (providedSignature.length !== computedSignature.length) {
    return null;
  }
  if (!crypto.timingSafeEqual(providedSignature, computedSignature)) {
    return null;
  }

  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload)) as {
      userId?: unknown;
      roles?: unknown;
    };

    if (
      typeof payload.userId !== 'string' ||
      !Array.isArray(payload.roles) ||
      payload.roles.some((role) => role !== 'admin' && role !== 'student')
    ) {
      return null;
    }

    return {
      userId: payload.userId,
      roles: payload.roles as readonly Role[]
    };
  } catch {
    return null;
  }
}
