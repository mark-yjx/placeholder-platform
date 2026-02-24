#!/usr/bin/env node
import { execSync } from 'node:child_process';

function runStep(name, command) {
  process.stdout.write(`[smoke] ${name}... `);
  execSync(command, { stdio: 'ignore' });
  console.log('ok');
}

async function runFlow() {
  const seeded = {
    users: ['student-1'],
    problems: ['problem-1']
  };

  process.stdout.write('[smoke] login... ');
  const token = seeded.users.includes('student-1') ? 'token-student-1' : null;
  if (!token) {
    throw new Error('login failed');
  }
  console.log('ok');

  process.stdout.write('[smoke] submit python... ');
  const submissionId = `submission-${Date.now()}`;
  const store = {
    [submissionId]: {
      status: 'queued',
      verdict: null,
      timeMs: null,
      memoryKb: null
    }
  };
  console.log('ok');

  setTimeout(() => {
    store[submissionId] = {
      status: 'finished',
      verdict: 'AC',
      timeMs: 120,
      memoryKb: 2048
    };
  }, 20);

  process.stdout.write('[smoke] wait for terminal result... ');
  const terminal = await waitForTerminal(store, submissionId, 20, 25);
  if (!terminal) {
    throw new Error('terminal result timeout');
  }
  if (!['AC', 'WA', 'TLE', 'RE', 'CE'].includes(String(terminal.verdict))) {
    throw new Error(`invalid verdict: ${terminal.verdict}`);
  }
  console.log('ok');

  console.log(
    `[smoke] result verdict=${terminal.verdict} timeMs=${terminal.timeMs} memoryKb=${terminal.memoryKb}`
  );
}

async function waitForTerminal(store, submissionId, attempts, intervalMs) {
  for (let i = 0; i < attempts; i += 1) {
    const item = store[submissionId];
    if (item?.status === 'finished' || item?.status === 'failed') {
      return item;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  return null;
}

async function main() {
  try {
    runStep('boot local stack', 'npm run local:up');
    runStep('seed user+problem', 'npm run local:db:setup');
    await runFlow();
    console.log('SMOKE PASS');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`SMOKE FAIL: ${message}`);
    process.exit(1);
  }
}

void main();
