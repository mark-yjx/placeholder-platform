import { Email } from './Email';
import { PasswordHash } from './PasswordHash';
import { Role } from './Role';

export class User {
  private readonly rolesSet: Set<Role>;

  constructor(
    public readonly id: string,
    public readonly email: Email,
    public readonly passwordHash: PasswordHash,
    roles: readonly Role[]
  ) {
    if (id.trim().length === 0) {
      throw new Error('User id is required');
    }
    if (roles.length === 0) {
      throw new Error('At least one role is required');
    }
    this.rolesSet = new Set(roles);
  }

  get roles(): readonly Role[] {
    return Array.from(this.rolesSet);
  }

  assignRole(role: Role): void {
    if (this.rolesSet.has(role)) {
      throw new Error(`Role already assigned: ${role}`);
    }
    this.rolesSet.add(role);
  }
}
