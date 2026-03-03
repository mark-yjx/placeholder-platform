export type MementoLike = {
  get<T>(key: string, defaultValue?: T): T | undefined;
  update(key: string, value: unknown): Promise<void> | PromiseLike<void>;
};

export type ProblemWorkspaceState = {
  lastOpenedFilePath?: string;
  lastSubmissionId?: string;
};

type PersistedPracticeState = {
  selectedProblemId?: string;
  problems?: Record<string, ProblemWorkspaceState>;
};

const LOCAL_PRACTICE_STATE_KEY = 'oj.practice.localState';

export class LocalPracticeStateStore {
  constructor(private readonly storage: MementoLike) {}

  getSelectedProblemId(): string | null {
    const state = this.readState();
    const selectedProblemId = state.selectedProblemId?.trim();
    return selectedProblemId ? selectedProblemId : null;
  }

  async setSelectedProblemId(problemId: string): Promise<void> {
    const normalizedProblemId = problemId.trim();
    if (!normalizedProblemId) {
      return;
    }

    const state = this.readState();
    await this.writeState({
      ...state,
      selectedProblemId: normalizedProblemId
    });
  }

  getProblemState(problemId: string): ProblemWorkspaceState | null {
    const normalizedProblemId = problemId.trim();
    if (!normalizedProblemId) {
      return null;
    }

    const state = this.readState();
    const persisted = state.problems?.[normalizedProblemId];
    if (!persisted) {
      return null;
    }

    return { ...persisted };
  }

  listProblemStates(): Readonly<Record<string, ProblemWorkspaceState>> {
    const state = this.readState();
    return { ...(state.problems ?? {}) };
  }

  async recordLastOpenedFile(problemId: string, filePath: string): Promise<void> {
    const normalizedProblemId = problemId.trim();
    const normalizedFilePath = filePath.trim();
    if (!normalizedProblemId || !normalizedFilePath) {
      return;
    }

    const state = this.readState();
    const existing = state.problems?.[normalizedProblemId] ?? {};
    await this.writeState({
      ...state,
      problems: {
        ...(state.problems ?? {}),
        [normalizedProblemId]: {
          ...existing,
          lastOpenedFilePath: normalizedFilePath
        }
      }
    });
  }

  async recordLastSubmission(problemId: string, submissionId: string): Promise<void> {
    const normalizedProblemId = problemId.trim();
    const normalizedSubmissionId = submissionId.trim();
    if (!normalizedProblemId || !normalizedSubmissionId) {
      return;
    }

    const state = this.readState();
    const existing = state.problems?.[normalizedProblemId] ?? {};
    await this.writeState({
      ...state,
      problems: {
        ...(state.problems ?? {}),
        [normalizedProblemId]: {
          ...existing,
          lastSubmissionId: normalizedSubmissionId
        }
      }
    });
  }

  async clearLastOpenedFile(problemId: string): Promise<void> {
    const normalizedProblemId = problemId.trim();
    if (!normalizedProblemId) {
      return;
    }

    const state = this.readState();
    const existing = state.problems?.[normalizedProblemId];
    if (!existing?.lastOpenedFilePath) {
      return;
    }

    await this.writeState({
      ...state,
      problems: {
        ...(state.problems ?? {}),
        [normalizedProblemId]: {
          ...existing,
          lastOpenedFilePath: undefined
        }
      }
    });
  }

  private readState(): PersistedPracticeState {
    const persisted =
      this.storage.get<PersistedPracticeState>(LOCAL_PRACTICE_STATE_KEY, {
        selectedProblemId: undefined,
        problems: {}
      }) ?? {};

    return {
      selectedProblemId: persisted.selectedProblemId,
      problems: persisted.problems ?? {}
    };
  }

  private async writeState(state: PersistedPracticeState): Promise<void> {
    await this.storage.update(LOCAL_PRACTICE_STATE_KEY, state);
  }
}
