import { Role } from '../identity';

export class AuthorizationPolicyService {
  canAccessAdmin(roles: readonly Role[]): boolean {
    return roles.includes(Role.ADMIN);
  }

  canSubmit(roles: readonly Role[]): boolean {
    return roles.includes(Role.STUDENT);
  }
}
