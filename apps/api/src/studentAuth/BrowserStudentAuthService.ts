import crypto from 'node:crypto';
import { Email, Role } from '@placeholder/domain/src/identity';
import { hashPassword, SessionTokenIssuer } from '@placeholder/application/src/auth/PasswordCredentialAuthService';

export type StudentAuthRole = 'student' | 'admin';
export type StudentAuthStatus = 'active' | 'disabled';

export type StudentAuthUserRecord = {
  userId: string;
  email: string;
  displayName: string;
  role: StudentAuthRole;
  status: StudentAuthStatus;
  passwordHash: string;
};

export interface StudentAuthUserRepository {
  findByEmail(email: string): Promise<StudentAuthUserRecord | null>;
  createStudent(input: {
    email: string;
    displayName: string;
    passwordHash: string;
  }): Promise<StudentAuthUserRecord>;
  updateLastLoginAt(userId: string): Promise<void>;
}

export type BrowserAuthCompletion = {
  accessToken: string;
  email: string;
  role: 'student';
};

export class StudentAuthError extends Error {
  constructor(
    readonly code:
      | 'AUTH_INVALID_CREDENTIALS'
      | 'AUTH_DUPLICATE_EMAIL'
      | 'AUTH_DISABLED_USER'
      | 'AUTH_STUDENT_ONLY'
      | 'AUTH_INVALID_EXCHANGE_CODE',
    message: string
  ) {
    super(message);
    this.name = 'StudentAuthError';
  }
}

type PendingBrowserAuth = BrowserAuthCompletion & {
  expiresAt: number;
};

const DEFAULT_CODE_TTL_MS = 10 * 60 * 1000;

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
  if (left.length !== right.length) {
    return false;
  }
  return crypto.timingSafeEqual(left, right);
}

function verifyPassword(password: string, storedHash: string): boolean {
  const { salt, hash } = parseStoredHash(storedHash);
  return constantTimeEqualHex(hash, derivePasswordHash(password, salt));
}

function createPasswordHash(password: string): string {
  return hashPassword(password, crypto.randomBytes(16).toString('hex'));
}

export function createOneTimeAuthCode(): string {
  return crypto.randomBytes(5).toString('hex').toUpperCase();
}

export class InMemoryBrowserAuthCodeStore {
  private readonly codes = new Map<string, PendingBrowserAuth>();

  constructor(private readonly ttlMs = DEFAULT_CODE_TTL_MS) {}

  issue(input: BrowserAuthCompletion): { code: string; expiresAt: string } {
    const code = createOneTimeAuthCode();
    const expiresAt = Date.now() + this.ttlMs;
    this.codes.set(code, {
      ...input,
      expiresAt
    });
    return {
      code,
      expiresAt: new Date(expiresAt).toISOString()
    };
  }

  consume(code: string): BrowserAuthCompletion {
    const normalizedCode = code.trim().toUpperCase();
    if (!normalizedCode) {
      throw new StudentAuthError('AUTH_INVALID_EXCHANGE_CODE', 'The sign-in code is required.');
    }

    const match = this.codes.get(normalizedCode);
    if (!match) {
      throw new StudentAuthError(
        'AUTH_INVALID_EXCHANGE_CODE',
        'That sign-in code is invalid or has already been used.'
      );
    }

    this.codes.delete(normalizedCode);
    if (match.expiresAt < Date.now()) {
      throw new StudentAuthError(
        'AUTH_INVALID_EXCHANGE_CODE',
        'That sign-in code has expired. Start again from the browser sign-in page.'
      );
    }

    return {
      accessToken: match.accessToken,
      email: match.email,
      role: match.role
    };
  }
}

export class PostgresStudentAuthUserRepository implements StudentAuthUserRepository {
  constructor(
    private readonly sqlClient: {
      query: <T>(sql: string, params?: readonly unknown[]) => Promise<readonly T[]>;
      execute: (sql: string, params?: readonly unknown[]) => Promise<void>;
    }
  ) {}

  async findByEmail(email: string): Promise<StudentAuthUserRecord | null> {
    const rows = await this.sqlClient.query<{
      id: string;
      email: string;
      display_name: string;
      role: StudentAuthRole;
      status: StudentAuthStatus;
      password_hash: string;
    }>(
      `
        SELECT id, email, display_name, role, status, password_hash
        FROM users
        WHERE email = $1
        LIMIT 1
      `,
      [email]
    );

    const row = rows[0];
    if (!row) {
      return null;
    }

    return {
      userId: row.id,
      email: row.email,
      displayName: row.display_name,
      role: row.role,
      status: row.status,
      passwordHash: row.password_hash
    };
  }

  async createStudent(input: {
    email: string;
    displayName: string;
    passwordHash: string;
  }): Promise<StudentAuthUserRecord> {
    const existing = await this.findByEmail(input.email);
    if (existing) {
      throw new StudentAuthError(
        'AUTH_DUPLICATE_EMAIL',
        'An account with that email already exists. Sign in instead.'
      );
    }

    const userId = `student-${crypto.randomUUID()}`;
    await this.sqlClient.execute(
      `
        INSERT INTO users (
          id,
          email,
          display_name,
          role,
          status,
          password_hash,
          created_at,
          updated_at
        )
        VALUES ($1, $2, $3, 'student', 'active', $4, NOW(), NOW())
      `,
      [userId, input.email, input.displayName, input.passwordHash]
    );

    return {
      userId,
      email: input.email,
      displayName: input.displayName,
      role: 'student',
      status: 'active',
      passwordHash: input.passwordHash
    };
  }

  async updateLastLoginAt(userId: string): Promise<void> {
    await this.sqlClient.execute(
      `
        UPDATE users
        SET last_login_at = NOW(),
            updated_at = NOW()
        WHERE id = $1
      `,
      [userId]
    );
  }
}

export class BrowserStudentAuthService {
  constructor(
    private readonly users: StudentAuthUserRepository,
    private readonly tokenIssuer: SessionTokenIssuer,
    private readonly handoffStore: InMemoryBrowserAuthCodeStore
  ) {}

  async signUp(input: {
    email: string;
    displayName: string;
    password: string;
  }): Promise<{ code: string; expiresAt: string; email: string; displayName: string }> {
    const email = Email.create(input.email).toString();
    const displayName = input.displayName.trim();
    if (!displayName) {
      throw new Error('Display name is required');
    }

    const password = input.password.trim();
    if (!password) {
      throw new Error('Password is required');
    }

    const created = await this.users.createStudent({
      email,
      displayName,
      passwordHash: createPasswordHash(password)
    });

    const token = await this.tokenIssuer.issue({
      userId: created.userId,
      roles: [Role.STUDENT]
    });
    await this.users.updateLastLoginAt(created.userId);
    const handoff = this.handoffStore.issue({
      accessToken: token,
      email: created.email,
      role: 'student'
    });

    return {
      code: handoff.code,
      expiresAt: handoff.expiresAt,
      email: created.email,
      displayName: created.displayName
    };
  }

  async signIn(input: {
    email: string;
    password: string;
  }): Promise<{ code: string; expiresAt: string; email: string; displayName: string }> {
    const email = Email.create(input.email).toString();
    const account = await this.users.findByEmail(email);
    if (!account || !verifyPassword(input.password, account.passwordHash)) {
      throw new StudentAuthError('AUTH_INVALID_CREDENTIALS', 'Invalid email or password.');
    }

    if (account.status !== 'active') {
      throw new StudentAuthError(
        'AUTH_DISABLED_USER',
        'This account is disabled. Contact the platform administrator.'
      );
    }

    if (account.role !== 'student') {
      throw new StudentAuthError(
        'AUTH_STUDENT_ONLY',
        'This sign-in is for students only. Administrators must use Web Admin.'
      );
    }

    const token = await this.tokenIssuer.issue({
      userId: account.userId,
      roles: [Role.STUDENT]
    });
    await this.users.updateLastLoginAt(account.userId);
    const handoff = this.handoffStore.issue({
      accessToken: token,
      email: account.email,
      role: 'student'
    });

    return {
      code: handoff.code,
      expiresAt: handoff.expiresAt,
      email: account.email,
      displayName: account.displayName
    };
  }

  async exchange(input: { code: string }): Promise<BrowserAuthCompletion> {
    return this.handoffStore.consume(input.code);
  }
}
