import {
  CredentialRecord,
  CredentialRepository
} from '@placeholder/application/src/auth/PasswordCredentialAuthService';
import { Role } from '@placeholder/domain/src/identity';

export type PostgresCredentialSqlClient = {
  query: <T>(sql: string, params?: readonly unknown[]) => Promise<readonly T[]>;
};

type CredentialRow = {
  id: string;
  email: string;
  role: string;
  password_hash: string;
};

function mapRole(role: string): Role {
  return role === 'admin' ? Role.ADMIN : Role.STUDENT;
}

export class PostgresCredentialRepository implements CredentialRepository {
  constructor(private readonly sqlClient: PostgresCredentialSqlClient) {}

  async findByEmail(email: string): Promise<CredentialRecord | null> {
    const rows = await this.sqlClient.query<CredentialRow>(
      `
        SELECT id, email, role, password_hash
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
      passwordHash: row.password_hash,
      roles: [mapRole(row.role)]
    };
  }
}
