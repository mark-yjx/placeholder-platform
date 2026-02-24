import test from 'node:test';
import assert from 'node:assert/strict';
import { EngagementCommands } from '../engagement/EngagementCommands';
import { AuthCommands } from '../auth/AuthCommands';
import { PracticeCommands } from '../practice/PracticeCommands';
import { SessionTokenStore } from '../auth/SessionTokenStore';
import { registerExtensionCommands } from '../extensionCore';
import {
  InMemoryAuthClient,
  InMemoryEngagementApiClient,
  InMemoryPracticeApiClient
} from '../runtime/InMemoryExtensionClients';

test('registered command writes to output channel on success', async () => {
  const outputLines: string[] = [];
  const handlers = new Map<string, () => Promise<void>>();

  const tokenStore = new SessionTokenStore();
  const authCommands = new AuthCommands(new InMemoryAuthClient(), tokenStore);
  const practiceCommands = new PracticeCommands(new InMemoryPracticeApiClient(), tokenStore);
  const engagementCommands = new EngagementCommands(new InMemoryEngagementApiClient(), tokenStore);

  registerExtensionCommands({
    authCommands,
    practiceCommands,
    engagementCommands,
    output: { appendLine: (line) => outputLines.push(line) },
    window: {
      showErrorMessage: () => undefined,
      showInformationMessage: () => undefined
    },
    registerCommand: (commandId, callback) => {
      handlers.set(commandId, callback);
      return { dispose: () => undefined };
    }
  });

  await handlers.get('oj.login')?.();
  await handlers.get('oj.practice.fetchProblems')?.();

  assert.ok(outputLines.some((line) => line.includes('[oj.login] success')));
  assert.ok(outputLines.some((line) => line.includes('Problems loaded:')));
});

test('command error is reported cleanly', async () => {
  const outputLines: string[] = [];
  const shownErrors: string[] = [];
  const handlers = new Map<string, () => Promise<void>>();

  const tokenStore = new SessionTokenStore();
  const authCommands = new AuthCommands(new InMemoryAuthClient(), tokenStore);
  const practiceCommands = new PracticeCommands(new InMemoryPracticeApiClient(), tokenStore);
  const engagementCommands = new EngagementCommands(new InMemoryEngagementApiClient(), tokenStore);

  registerExtensionCommands({
    authCommands,
    practiceCommands,
    engagementCommands,
    output: { appendLine: (line) => outputLines.push(line) },
    window: {
      showErrorMessage: (message) => shownErrors.push(message),
      showInformationMessage: () => undefined
    },
    registerCommand: (commandId, callback) => {
      handlers.set(commandId, callback);
      return { dispose: () => undefined };
    }
  });

  await handlers.get('oj.practice.fetchProblems')?.();

  class FailingPracticeCommands extends PracticeCommands {
    override async fetchPublishedProblems(): Promise<readonly { problemId: string; title: string }[]> {
      throw new Error('boom');
    }
  }

  const failingPractice = new FailingPracticeCommands(new InMemoryPracticeApiClient(), tokenStore);
  const failingEngagement = new EngagementCommands(new InMemoryEngagementApiClient(), tokenStore);
  const failingAuth = new AuthCommands(new InMemoryAuthClient(), tokenStore);

  const failingHandlers = new Map<string, () => Promise<void>>();
  registerExtensionCommands({
    authCommands: failingAuth,
    practiceCommands: failingPractice,
    engagementCommands: failingEngagement,
    output: { appendLine: (line) => outputLines.push(line) },
    window: {
      showErrorMessage: (message) => shownErrors.push(message),
      showInformationMessage: () => undefined
    },
    registerCommand: (commandId, callback) => {
      failingHandlers.set(commandId, callback);
      return { dispose: () => undefined };
    }
  });

  await failingHandlers.get('oj.practice.fetchProblems')?.();

  assert.ok(outputLines.some((line) => line.includes('[oj.practice.fetchProblems] error: boom')));
  assert.ok(shownErrors.some((line) => line.includes('boom')));
});
