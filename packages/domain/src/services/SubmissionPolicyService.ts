import { Role } from '../identity';
import { PublicationState } from '../problem';

export type SubmissionPolicyInput = {
  actorRoles: readonly Role[];
  isProblemPublished: boolean;
  language: string;
};

export type SubmissionPolicyDecision = {
  allowed: boolean;
  reason?: string;
};

const SUPPORTED_LANGUAGE = 'python';

export class SubmissionPolicyService {
  evaluate(input: SubmissionPolicyInput): SubmissionPolicyDecision {
    if (!input.actorRoles.includes(Role.STUDENT)) {
      return { allowed: false, reason: 'Only students may submit solutions' };
    }
    if (!input.isProblemPublished) {
      return { allowed: false, reason: 'Problem must be published' };
    }
    if (input.language.toLowerCase() !== SUPPORTED_LANGUAGE) {
      return { allowed: false, reason: 'Unsupported language' };
    }
    return { allowed: true };
  }

  isPublishedState(state: PublicationState): boolean {
    return state === PublicationState.PUBLISHED;
  }
}
