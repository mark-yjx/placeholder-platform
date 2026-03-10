import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

function resolveRepoRoot(): string {
  const candidates = [process.cwd(), path.resolve(process.cwd(), '..', '..')];
  for (const candidate of candidates) {
    if (fs.existsSync(path.join(candidate, 'apps', 'api', 'src', 'studentAuth'))) {
      return candidate;
    }
  }
  throw new Error('Unable to resolve repository root for student auth tests');
}

function registerTsHook(): void {
  const existing = require.extensions['.ts'];
  if (existing) {
    return;
  }

  require.extensions['.ts'] = function registerTs(module, filename) {
    const source = fs.readFileSync(filename, 'utf8');
    const transpiled = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true
      },
      fileName: filename
    });

    (module as NodeModule & { _compile: (code: string, fileName: string) => void })._compile(
      transpiled.outputText,
      filename
    );
  };
}

function loadModule<T>(segments: string[]): T {
  registerTsHook();
  return require(path.join(resolveRepoRoot(), ...segments)) as T;
}

type StudentAuthUserRecord = {
  userId: string;
  email: string;
  displayName: string;
  role: 'student' | 'admin';
  status: 'active' | 'disabled';
  passwordHash: string;
};

type StudentAuthUserRepository = {
  findByEmail(email: string): Promise<StudentAuthUserRecord | null>;
  createStudent(input: {
    email: string;
    displayName: string;
    passwordHash: string;
  }): Promise<StudentAuthUserRecord>;
  updateLastLoginAt(userId: string): Promise<void>;
};

const {
  BrowserStudentAuthService,
  InMemoryBrowserAuthCodeStore,
  StudentAuthError
} = loadModule<typeof import('../studentAuth/BrowserStudentAuthService')>([
  'apps',
  'api',
  'src',
  'studentAuth',
  'BrowserStudentAuthService.ts'
]);
const {
  HmacSessionTokenIssuer,
  resolveSessionToken
} = loadModule<typeof import('../sessionTokens')>(['apps', 'api', 'src', 'sessionTokens.ts']);

class InMemoryStudentAuthUserRepository implements StudentAuthUserRepository {
  readonly records = new Map<string, StudentAuthUserRecord>();

  constructor(initialRecords: readonly StudentAuthUserRecord[] = []) {
    for (const record of initialRecords) {
      this.records.set(record.email, { ...record });
    }
  }

  async findByEmail(email: string): Promise<StudentAuthUserRecord | null> {
    return this.records.get(email) ?? null;
  }

  async createStudent(input: {
    email: string;
    displayName: string;
    passwordHash: string;
  }): Promise<StudentAuthUserRecord> {
    if (this.records.has(input.email)) {
      throw new StudentAuthError(
        'AUTH_DUPLICATE_EMAIL',
        'An account with that email already exists. Sign in instead.'
      );
    }

    const created: StudentAuthUserRecord = {
      userId: `student-${this.records.size + 1}`,
      email: input.email,
      displayName: input.displayName,
      role: 'student',
      status: 'active',
      passwordHash: input.passwordHash
    };
    this.records.set(created.email, created);
    return created;
  }

  async updateLastLoginAt(): Promise<void> {
    return;
  }
}

function createService(initialRecords: readonly StudentAuthUserRecord[] = []) {
  const repository = new InMemoryStudentAuthUserRepository(initialRecords);
  const tokenIssuer = new HmacSessionTokenIssuer('student-browser-auth-test-secret');
  const handoffStore = new InMemoryBrowserAuthCodeStore(60_000);

  return {
    repository,
    service: new BrowserStudentAuthService(repository, tokenIssuer, handoffStore)
  };
}

async function createStoredPasswordHash(password: string): Promise<string> {
  const { service, repository } = createService();
  await service.signUp({
    email: 'seed@example.com',
    displayName: 'Seed',
    password
  });
  return repository.records.get('seed@example.com')?.passwordHash ?? '';
}

test('student sign up creates an active student account with a hashed password', async () => {
  const { service, repository } = createService();

  const result = await service.signUp({
    email: 'new-student@example.com',
    displayName: 'New Student',
    password: 'secret'
  });

  const created = repository.records.get('new-student@example.com');
  assert.ok(created);
  assert.equal(created?.role, 'student');
  assert.equal(created?.status, 'active');
  assert.ok(created?.passwordHash.startsWith('scrypt$'));
  assert.notEqual(created?.passwordHash, 'secret');
  assert.equal(result.email, 'new-student@example.com');
  assert.match(result.code, /^[A-F0-9]{10}$/);
});

test('student sign up rejects duplicate email addresses', async () => {
  const existingHash = await createStoredPasswordHash('secret');
  const { service } = createService([
    {
      userId: 'student-1',
      email: 'dup@example.com',
      displayName: 'Existing Student',
      role: 'student',
      status: 'active',
      passwordHash: existingHash
    }
  ]);

  await assert.rejects(
    service.signUp({
      email: 'dup@example.com',
      displayName: 'Duplicate',
      password: 'secret'
    }),
    (error: unknown) =>
      error instanceof StudentAuthError && error.code === 'AUTH_DUPLICATE_EMAIL'
  );
});

test('student sign in succeeds for an active student with valid credentials', async () => {
  const passwordHash = await createStoredPasswordHash('secret');
  const { service } = createService([
    {
      userId: 'student-1',
      email: 'student@example.com',
      displayName: 'Student Example',
      role: 'student',
      status: 'active',
      passwordHash
    }
  ]);

  const result = await service.signIn({
    email: 'student@example.com',
    password: 'secret'
  });

  assert.equal(result.email, 'student@example.com');
  assert.match(result.code, /^[A-F0-9]{10}$/);
});

test('student sign in rejects invalid passwords', async () => {
  const passwordHash = await createStoredPasswordHash('secret');
  const { service } = createService([
    {
      userId: 'student-1',
      email: 'student@example.com',
      displayName: 'Student Example',
      role: 'student',
      status: 'active',
      passwordHash
    }
  ]);

  await assert.rejects(
    service.signIn({
      email: 'student@example.com',
      password: 'wrong'
    }),
    (error: unknown) =>
      error instanceof StudentAuthError && error.code === 'AUTH_INVALID_CREDENTIALS'
  );
});

test('student sign in rejects disabled users', async () => {
  const passwordHash = await createStoredPasswordHash('secret');
  const { service } = createService([
    {
      userId: 'student-1',
      email: 'disabled@example.com',
      displayName: 'Disabled Student',
      role: 'student',
      status: 'disabled',
      passwordHash
    }
  ]);

  await assert.rejects(
    service.signIn({
      email: 'disabled@example.com',
      password: 'secret'
    }),
    (error: unknown) =>
      error instanceof StudentAuthError && error.code === 'AUTH_DISABLED_USER'
  );
});

test('student sign in rejects admin accounts from the student flow', async () => {
  const passwordHash = await createStoredPasswordHash('secret');
  const { service } = createService([
    {
      userId: 'admin-1',
      email: 'admin@example.com',
      displayName: 'Platform Admin',
      role: 'admin',
      status: 'active',
      passwordHash
    }
  ]);

  await assert.rejects(
    service.signIn({
      email: 'admin@example.com',
      password: 'secret'
    }),
    (error: unknown) => error instanceof StudentAuthError && error.code === 'AUTH_STUDENT_ONLY'
  );
});

test('one-time browser auth codes exchange into a student session exactly once', async () => {
  const passwordHash = await createStoredPasswordHash('secret');
  const { service } = createService([
    {
      userId: 'student-1',
      email: 'student@example.com',
      displayName: 'Student Example',
      role: 'student',
      status: 'active',
      passwordHash
    }
  ]);

  const handoff = await service.signIn({
    email: 'student@example.com',
    password: 'secret'
  });
  const session = await service.exchange({ code: handoff.code });
  const token = resolveSessionToken(session.accessToken, 'student-browser-auth-test-secret');

  assert.deepEqual(session, {
    accessToken: session.accessToken,
    email: 'student@example.com',
    role: 'student'
  });
  assert.deepEqual(token, {
    userId: 'student-1',
    roles: ['student']
  });

  await assert.rejects(
    service.exchange({ code: handoff.code }),
    (error: unknown) =>
      error instanceof StudentAuthError && error.code === 'AUTH_INVALID_EXCHANGE_CODE'
  );
});
