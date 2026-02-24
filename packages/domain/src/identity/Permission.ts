export enum Permission {
  PROBLEM_READ = 'problem:read',
  PROBLEM_WRITE = 'problem:write',
  SUBMISSION_CREATE = 'submission:create',
  SUBMISSION_MANAGE = 'submission:manage',
  ANNOUNCEMENT_PUBLISH = 'announcement:publish'
}

export const ROLE_PERMISSIONS: Readonly<Record<string, readonly Permission[]>> = {
  student: [Permission.PROBLEM_READ, Permission.SUBMISSION_CREATE],
  admin: [
    Permission.PROBLEM_READ,
    Permission.PROBLEM_WRITE,
    Permission.SUBMISSION_MANAGE,
    Permission.ANNOUNCEMENT_PUBLISH
  ]
};
