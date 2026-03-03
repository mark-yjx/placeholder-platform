# Release Runbook

This runbook documents how to produce and publish the VS Code extension package.

Current extension versioning:
- Semantic Versioning
- Current packaged version: `0.1.0`

## Preconditions

Before releasing:
- working tree is clean
- CI is green
- changelog is updated for the target version
- extension metadata in `apps/vscode-extension/package.json` is correct
- extension metadata assets exist and match the manifest:
  - `apps/vscode-extension/CHANGELOG.md`
  - `apps/vscode-extension/LICENSE.txt`
  - `apps/vscode-extension/media/icon.png`
  - `description`, `categories`, `keywords`, and `activationEvents`

CI lanes:
- blocking for merge: `CI / checks`
- optional diagnostics: `CI / smoke`

Current workflow intent:
- pull requests run install, typecheck, tests, and build in the fast `checks` lane
- local smoke is optional and only runs on schedule or manual dispatch with `run_smoke=true`
- the smoke lane verifies the end-to-end local loop reaches terminal submission states `queued` -> `running` -> `finished|failed`

Recommended local verification:

```bash
npm install
npm run typecheck
npm run -ws --if-present test
npm run -ws --if-present build
```

## Release Steps

### 1. Bump The Version

Update the extension version in:
- `apps/vscode-extension/package.json`
- `package-lock.json` will update after `npm install`

Also update:
- `apps/vscode-extension/CHANGELOG.md`
- `apps/vscode-extension/LICENSE.txt` if release ownership or distribution terms changed
- `apps/vscode-extension/media/icon.png` if marketplace branding changed
- any docs that mention the packaged VSIX filename

Versioning rule:
- use Semantic Versioning (`MAJOR.MINOR.PATCH`)

### 2. Install Dependencies

```bash
npm install
```

Expected:
- `package-lock.json` matches the new extension version
- the local `@vscode/vsce` dependency is available before packaging

Packaging assumption:
- `npm run extension:package` uses the already-installed `node_modules/@vscode/vsce` binary
- packaging should not need `npx --yes` or an extra package download after `npm install`
- the remaining network-sensitive step is dependency installation itself

### 3. Run Quality Gates

```bash
npm run typecheck
npm run -ws --if-present test
npm run -ws --if-present build
```

Expected:
- all commands pass before packaging

### 3a. Verify Metadata Consistency

Confirm before packaging:
- `apps/vscode-extension/package.json` matches the intended release description, categories, keywords, icon path, and activation events
- `apps/vscode-extension/CHANGELOG.md` matches the release notes scope
- `apps/vscode-extension/LICENSE.txt` matches the `license` field and intended distribution status
- `apps/vscode-extension/media/icon.png` exists at the path referenced by the manifest

### 4. Build And Package The VSIX

```bash
npm run extension:package
```

Expected artifacts:
- `apps/vscode-extension/oj-vscode-extension-<version>.vsix`
- `dist/oj-vscode.vsix`

Packaging behavior:
- the versioned VSIX filename is derived from `apps/vscode-extension/package.json`
- `dist/oj-vscode.vsix` is the stable copy used by the release workflow artifact upload
- run packaging from a clean checkout after `npm install` to keep the result reproducible

### 5. Smoke Check The Package

Recommended:
1. Install the generated VSIX into VS Code.
2. Set `oj.apiBaseUrl`.
3. Run the manual checklist in [OJ VSCode Demo Checklist](/home/mark/src/oj-vscode/docs/extension-demo-checklist.md).
4. Confirm the installed extension activates and loads the `OJ Problems` and `OJ Submissions` views.
5. Remove the installed VSIX if the rehearsal build should not remain installed.

Minimum expected flow:
- login
- fetch problems
- submit code
- view result

### 6. Create Release Notes

Summarize:
- version number
- user-visible features/fixes
- environment/setup notes
- known issues

Primary source:
- `apps/vscode-extension/CHANGELOG.md`

### 7. Tag The Release

Create an annotated tag:

```bash
git tag -a v<version> -m "Release v<version>"
git push origin v<version>
```

Example:

```bash
git tag -a v0.1.0 -m "Release v0.1.0"
git push origin v0.1.0
```

### 8. Publish The GitHub Release

Use either:
- GitHub UI release flow
- or the `Release` workflow via GitHub Actions

Attach:
- `dist/oj-vscode.vsix`

Expected release workflow behavior:
- installs dependencies
- runs typecheck
- runs tests
- runs builds
- packages the VSIX
- uploads `dist/oj-vscode.vsix` as an artifact

## Rollback Guidance

If a release is bad:

1. Stop distributing the bad VSIX.
2. Mark the GitHub release as deprecated or replace the release notes with a rollback warning.
3. Re-tag only if your release policy allows it; otherwise publish a follow-up patch version.
4. Bump to the next patch version and release a fixed VSIX.

Preferred rollback strategy:
- do not overwrite an already-consumed version
- ship a new patch release instead

Example:
- bad release: `0.1.0`
- fix release: `0.1.1`

## Known Issues

Current known issues for release planning:
- local development still fails if `oj.apiBaseUrl` does not point to the real compose API runtime at `http://localhost:3100`
- in Remote SSH setups, `localhost` resolves on the remote host where the extension runs
- release packaging assumes the extension remains `UNLICENSED`; update metadata if licensing changes

## Quick Checklist

1. Update version and changelog.
2. Run `npm install`.
3. Run typecheck, tests, and build.
4. Run `npm run extension:package`.
5. Confirm `apps/vscode-extension/oj-vscode-extension-<version>.vsix` and `dist/oj-vscode.vsix` exist.
6. Install and smoke-test the VSIX.
7. Create release notes.
8. Tag `v<version>`.
9. Publish release and attach artifact.
