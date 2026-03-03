#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDir, '../..');
const composeFile = path.join(root, 'deploy/local/docker-compose.yml');

const portChecks = [
  {
    port: 3100,
    service: 'api',
    message:
      'Port 3100 is used by the real local API container. If another app is already bound here, the local API cannot start.'
  },
  {
    port: 5432,
    service: 'postgres',
    message:
      'Port 5432 is used by local Postgres. If another Postgres instance is already bound here, the local DB container cannot start.'
  },
  {
    port: 6379,
    service: null,
    message:
      'Port 6379 is commonly used by Redis. This stack does not bind 6379 today, but an existing Redis process is worth noting if you add queue/cache services later.'
  }
];

function runDockerCompose(args) {
  execFileSync('docker', ['compose', '-f', composeFile, ...args], {
    cwd: root,
    stdio: 'inherit'
  });
}

function getRunningServices() {
  try {
    const output = execFileSync(
      'docker',
      ['compose', '-f', composeFile, 'ps', '--status', 'running', '--services'],
      { cwd: root, encoding: 'utf8' }
    ).trim();
    return new Set(output.length === 0 ? [] : output.split('\n'));
  } catch {
    return new Set();
  }
}

function canConnect(port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: '127.0.0.1', port });
    let settled = false;
    const finish = (value) => {
      if (settled) {
        return;
      }
      settled = true;
      socket.destroy();
      resolve(value);
    };

    socket.setTimeout(250);
    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(false));
    socket.once('error', () => finish(false));
  });
}

function printEndpoints() {
  console.log('');
  console.log('Local stack endpoints:');
  console.log('- Postgres: localhost:5432');
  console.log('- Real OJ API runtime: http://localhost:3100');
  console.log('- Extension setting: oj.apiBaseUrl=http://localhost:3100');
  console.log('');
  console.log('Next commands:');
  console.log('- npm run local:db:setup');
  console.log('- npm run smoke:local');
}

const runningServices = getRunningServices();
for (const check of portChecks) {
  const occupied = await canConnect(check.port);
  if (!occupied) {
    continue;
  }
  if (check.service && runningServices.has(check.service)) {
    continue;
  }
  console.warn(`Warning: port ${check.port} already has a listener.`);
  console.warn(check.message);
}

runDockerCompose(['up', '-d', '--wait']);
printEndpoints();
