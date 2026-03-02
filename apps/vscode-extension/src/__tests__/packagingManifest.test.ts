import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

function readExtensionPackageJson(): {
  main: string;
  version: string;
  license?: string;
  repository?: {
    type?: string;
    url?: string;
  };
  homepage?: string;
  bugs?: {
    url?: string;
  };
  activationEvents: readonly string[];
  contributes: {
    views: Record<string, readonly { id: string; name: string }[]>;
  };
} {
  const candidates = [
    path.resolve(process.cwd(), 'package.json'),
    path.resolve(process.cwd(), 'apps/vscode-extension/package.json')
  ];
  const filePath = candidates.find((candidate) => fs.existsSync(candidate));
  if (!filePath) {
    throw new Error('Unable to locate apps/vscode-extension/package.json');
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as ReturnType<typeof readExtensionPackageJson>;
}

test('extension package keeps production packaging whitelist and activation events stable', () => {
  const manifest = readExtensionPackageJson();

  assert.equal(manifest.version, '0.1.0');
  assert.equal(manifest.license, 'UNLICENSED');
  assert.deepEqual(manifest.repository, {
    type: 'git',
    url: 'git+https://github.com/mark-yjx/comp9021-oj.git'
  });
  assert.equal(manifest.homepage, 'https://github.com/mark-yjx/comp9021-oj');
  assert.deepEqual(manifest.bugs, {
    url: 'https://github.com/mark-yjx/comp9021-oj/issues'
  });
  assert.equal(manifest.main, './dist/extension.js');
  assert.ok(manifest.activationEvents.includes('onCommand:oj.login'));
  assert.ok(manifest.activationEvents.includes('onView:ojProblems'));
  assert.ok(manifest.activationEvents.includes('onView:ojSubmissions'));
  assert.deepEqual(manifest.contributes.views.explorer, [
    { id: 'ojProblems', name: 'OJ Problems' },
    { id: 'ojSubmissions', name: 'OJ Submissions' }
  ]);
});
