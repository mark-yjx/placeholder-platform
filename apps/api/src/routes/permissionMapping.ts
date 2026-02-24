export const AUTH_ROUTE_PERMISSIONS = {
  issueInvite: 'identity:invite:issue'
} as const;

export const PROBLEM_ADMIN_ROUTE_PERMISSIONS = {
  createProblem: 'problem:create',
  updateProblem: 'problem:update',
  deleteProblem: 'problem:delete',
  publishProblem: 'problem:publish',
  unpublishProblem: 'problem:unpublish',
  inspectVersionHistory: 'problem:version_history:read'
} as const;

export const SUBMISSION_ADMIN_ROUTE_PERMISSIONS = {
  viewSubmissions: 'submission:admin:view',
  rejudgeSubmission: 'submission:admin:rejudge',
  deleteSubmission: 'submission:admin:delete',
  exportSubmissions: 'submission:admin:export'
} as const;
