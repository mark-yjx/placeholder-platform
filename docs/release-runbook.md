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
- any docs that mention the packaged VSIX filename

Versioning rule:
- use Semantic Versioning (`MAJOR.MINOR.PATCH`)

### 2. Install Dependencies

```bash
npm install
```

Expected:
- `package-lock.json` matches the new extension version

### 3. Run Quality Gates

```bash
npm run typecheck
npm run -ws --if-present test
npm run -ws --if-present build
```

Expected:
- all commands pass before packaging

### 4. Build And Package The VSIX

```bash
npm run extension:package
```

Expected artifacts:
- `apps/vscode-extension/oj-vscode-extension-<version>.vsix`
- `dist/oj-vscode.vsix`

### 5. Smoke Check The Package

Recommended:
1. Install the generated VSIX into VS Code.
2. Set `oj.apiBaseUrl`.
3. Run the manual checklist in [OJ VSCode Demo Checklist](/home/mark/src/oj-vscode/docs/extension-demo-checklist.md).

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
5. Install and smoke-test the VSIX.
6. Create release notes.
7. Tag `v<version>`.
8. Publish release and attach artifact.
