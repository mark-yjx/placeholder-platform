import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

function readExtensionPackageJson(): {
  description: string;
  icon?: string;
  main: string;
  version: string;
  license?: string;
  categories?: readonly string[];
  keywords?: readonly string[];
  scripts: {
    build: string;
    'package:vsix': string;
  };
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
    configuration?: {
      properties?: Record<
        string,
        {
          type?: string;
          default?: unknown;
          description?: string;
        }
      >;
    };
    commands?: readonly {
      command: string;
      title: string;
      icon?: {
        light: string;
        dark: string;
      };
    }[];
    menus?: {
      'view/title'?: readonly {
        command: string;
        when?: string;
        group?: string;
      }[];
    };
    viewsContainers?: {
      activitybar?: readonly { id: string; title: string; icon: string }[];
      panel?: readonly { id: string; title: string; icon: string }[];
    };
    views: Record<string, readonly { id: string; name: string; type?: string; when?: string }[]>;
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
  const packageRoot = path.dirname(
    [path.resolve(process.cwd(), 'package.json'), path.resolve(process.cwd(), 'apps/vscode-extension/package.json')].find(
      (candidate) => fs.existsSync(candidate)
    ) as string
  );

  assert.equal(manifest.version, '0.1.0');
  assert.equal(manifest.license, 'UNLICENSED');
  assert.match(manifest.description, /Local-first Placeholder Practice workflow/);
  assert.deepEqual(manifest.repository, {
    type: 'git',
    url: 'git+https://github.com/mark-yjx/placeholder-platform.git'
  });
  assert.equal(manifest.homepage, 'https://github.com/mark-yjx/placeholder-platform');
  assert.deepEqual(manifest.bugs, {
    url: 'https://github.com/mark-yjx/placeholder-platform/issues'
  });
  assert.equal(manifest.main, './dist/extension.js');
  assert.equal(
    manifest.contributes.configuration?.properties?.['oj.apiBaseUrl']?.default,
    'http://127.0.0.1:3100'
  );
  assert.deepEqual(manifest.categories, ['Education', 'Programming Languages']);
  assert.deepEqual(manifest.keywords, [
    'online-judge',
    'comp9021',
    'python',
    'practice',
    'education'
  ]);
  assert.equal(manifest.icon, 'media/icon.png');
  assert.ok(fs.existsSync(path.join(packageRoot, 'CHANGELOG.md')));
  assert.ok(fs.existsSync(path.join(packageRoot, 'LICENSE.txt')));
  assert.ok(fs.existsSync(path.join(packageRoot, 'media', 'icon.png')));
  assert.ok(fs.existsSync(path.join(packageRoot, 'media', 'account-light.svg')));
  assert.ok(fs.existsSync(path.join(packageRoot, 'media', 'account-dark.svg')));
  assert.ok(fs.existsSync(path.join(packageRoot, 'media', 'fetch-problems-light.svg')));
  assert.ok(fs.existsSync(path.join(packageRoot, 'media', 'fetch-problems-dark.svg')));
  assert.equal(manifest.scripts.build, 'rm -rf dist && tsc -p tsconfig.build.json');
  assert.match(
    manifest.scripts['package:vsix'],
    /node \.\.\/\.\.\/node_modules\/@vscode\/vsce\/vsce package --no-dependencies --out placeholder-extension-\$\(node -p/
  );
  assert.doesNotMatch(manifest.scripts['package:vsix'], /npx --yes|--skip-license/);
  for (const command of manifest.contributes.commands ?? []) {
    assert.ok(
      manifest.activationEvents.includes(`onCommand:${command.command}`),
      `missing activation event for ${command.command}`
    );
  }
  assert.deepEqual(manifest.activationEvents, [
    'onStartupFinished',
    'onUri',
    'onCommand:oj.account.show',
    'onCommand:oj.logout',
    'onCommand:oj.login',
    'onCommand:oj.practice.fetchProblems',
    'onCommand:oj.practice.submitCode',
    'onCommand:oj.practice.submitCurrentFile',
    'onCommand:oj.practice.runPublicTests',
    'onCommand:oj.practice.viewResult',
    'onCommand:oj.practice.cancelPolling',
    'onCommand:oj.practice.selectSubmission',
    'onView:ojPracticeHome',
    'onView:ojProblems',
    'onView:ojSubmissions',
    'onView:ojSubmissionDetail',
    'onCommand:oj.engagement.favoriteProblem',
    'onCommand:oj.engagement.submitReview',
    'onCommand:oj.stats.show',
    'onCommand:oj.ranking.show'
  ]);
  assert.deepEqual(manifest.contributes.viewsContainers?.activitybar, [
    { id: 'ojSidebar', title: 'Placeholder', icon: 'media/icon.png' }
  ]);
  assert.deepEqual(manifest.contributes.viewsContainers?.panel, [
    { id: 'ojPanel', title: 'Placeholder Judge', icon: 'media/icon.png' }
  ]);
  assert.deepEqual(
    (manifest.contributes.commands ?? []).slice(0, 3),
    [
      {
        command: 'oj.account.show',
        title: 'Placeholder Practice: Open Account',
        icon: {
          light: 'media/account-light.svg',
          dark: 'media/account-dark.svg'
        }
      },
      { command: 'oj.logout', title: 'Placeholder Practice: Logout' },
      { command: 'oj.login', title: 'Placeholder Practice: Login' }
    ]
  );
  assert.deepEqual(
    manifest.contributes.commands?.find((command) => command.command === 'oj.practice.fetchProblems'),
    {
      command: 'oj.practice.fetchProblems',
      title: 'Placeholder Practice: Fetch Problems',
      icon: {
        light: 'media/fetch-problems-light.svg',
        dark: 'media/fetch-problems-dark.svg'
      }
    }
  );
  assert.deepEqual(
    manifest.contributes.views.ojSidebar.map((view) => ({
      id: view.id,
      name: view.name,
      when: view.when
    })),
    [
      { id: 'ojPracticeHome', name: 'Placeholder Practice', when: 'oj.practice.homeVisible' },
      { id: 'ojProblems', name: 'Problems', when: 'oj.practice.viewsReady' }
    ]
  );
  assert.deepEqual(
    manifest.contributes.views.ojPanel.map((view) => ({
      id: view.id,
      name: view.name,
      when: view.when
    })),
    [
      { id: 'ojSubmissions', name: 'Submissions', when: 'oj.practice.viewsReady' },
      { id: 'ojSubmissionDetail', name: 'Submission Detail', when: 'oj.practice.viewsReady' }
    ]
  );
  assert.equal(
    manifest.contributes.views.ojSidebar.find((view) => view.id === 'ojPracticeHome')?.type,
    'webview'
  );
  assert.equal(
    manifest.contributes.views.ojSidebar.find((view) => view.id === 'ojProblemDetail'),
    undefined
  );
  assert.equal(
    manifest.contributes.views.ojPanel.find((view) => view.id === 'ojSubmissionDetail')?.type,
    'webview'
  );
  assert.deepEqual(manifest.contributes.menus?.['view/title'], [
    {
      command: 'oj.practice.fetchProblems',
      when: 'view == ojProblems && oj.practice.viewsReady',
      group: 'navigation@1'
    },
    {
      command: 'oj.account.show',
      when: 'view == ojProblems && oj.practice.viewsReady',
      group: 'navigation@2'
    }
  ]);
});
