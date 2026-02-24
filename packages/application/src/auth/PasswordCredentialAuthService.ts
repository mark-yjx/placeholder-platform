import crypto from 'node:crypto';
import { Email, Role } from '@packages/domain/src/identity';

export type CredentialRecord = {
  userId: string;
  email: string;
  passwordHash: string;
  roles: readonly Role[];
};

export interface CredentialRepository {
  findByEmail(email: string): Promise<CredentialRecord | null>;
}

export interface SessionTokenIssuer {
  issue(input: { userId: string; roles: readonly Role[] }): Promise<string>;
}

export type PasswordLoginInput = {
  email: string;
  password: string;
};

export type PasswordLoginResult = {
  userId: string;
  token: string;
  roles: readonly Role[];
};

function derivePasswordHash(password: string, salt: string): string {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

function parseStoredHash(storedHash: string): { salt: string; hash: string } {
  const [scheme, salt, hash] = storedHash.split('$');
  if (scheme !== 'scrypt' || !salt || !hash) {
    throw new Error('Invalid stored credential hash format');
  }
  return { salt, hash };
}

function constantTimeEqualHex(leftHex: string, rightHex: string): boolean {
  const left = Buffer.from(leftHex, 'hex');
  const right = Buffer.from(rightHex, 'hex');
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

export function hashPassword(password: string, salt: string): string {
  return `scrypt$${salt}$${derivePasswordHash(password, salt)}`;
}

export class PasswordCredentialAuthService {
  constructor(
    private readonly credentials: CredentialRepository,
    private readonly tokenIssuer: SessionTokenIssuer
  ) {}

  async login(input: PasswordLoginInput): Promise<PasswordLoginResult> {
    const email = Email.create(input.email);
    const record = await this.credentials.findByEmail(email.toString());
    if (!record) {
      throw new Error('Authentication failed');
    }

    const { salt, hash } = parseStoredHash(record.passwordHash);
    const candidate = derivePasswordHash(input.password, salt);
    if (!constantTimeEqualHex(hash, candidate)) {
      throw new Error('Authentication failed');
    }

    const token = await this.tokenIssuer.issue({
      userId: record.userId,
      roles: record.roles
    });

    return {
      userId: record.userId,
      token,
      roles: record.roles
    };
  }
}
