# Admin Problem Import And Local Content Workflow

This is the supported local admin path for importing problem content and verifying that students can use it through the real extension + API + worker stack.

## Supported Inputs

Use the filesystem import source under `data/problems`.

Sample problem source in this repository:
- `data/problems/collapse/problem.json`
- `data/problems/collapse/statement.md`
- `data/problems/collapse/starter.py`
- `data/problems/collapse/tests/public.json`
- `data/problems/collapse/tests/hidden.json`

Supported import command:

```bash
npm run import:problems -- --dir data/problems
```

This normal workflow does not require manual database edits.

## Admin Import Flow

1. Install dependencies:

```bash
npm install
```

2. Start the supported local stack:

```bash
npm run local:up
npm run local:db:setup
```

3. Verify the real local runtime before import:

```bash
npm run local:ps
curl http://localhost:3100/healthz
curl http://localhost:3100/readyz
```

4. Import problem content from the repository source:

```bash
npm run import:problems -- --dir data/problems
```

Expected:
- the command reports imported or skipped problem versions
- `collapse` is available from the imported content source in `data/problems/collapse`
- no SQL console step is required for the normal path

## Publish And Student Verification

The repository sample `collapse` problem is defined as public content, so the imported version is expected to be available to the student flow after import.

Verify it from the real student-facing stack:

1. Install the VSIX or launch the extension development host.
2. Set:

```json
{
  "oj.apiBaseUrl": "http://localhost:3100",
  "oj.requestTimeoutMs": 10000
}
```

3. Run `OJ: Login`.
4. Run `OJ: Fetch Problems`.
5. Select `collapse` in `OJ Problems`.

Expected:
- the statement shown in VS Code matches `data/problems/collapse/statement.md`
- the opened starter file is `.oj/problems/collapse.py`
- the starter file content matches `data/problems/collapse/starter.py`

## Judge Verification

Verify that the imported problem can be judged through the supported stack:

1. Edit `.oj/problems/collapse.py`.
2. Run `OJ: Submit Current File`.
3. Observe the submission lifecycle:

```text
queued -> running -> finished|failed
```

4. Run `OJ: View Result`.

Expected:
- the submission is processed by the real compose worker path
- the final result shows a terminal verdict or a visible failure reason
- no hidden test contents are shown in the extension

## Manual Walkthrough Record

Use this checklist when verifying the admin import path:
- local stack booted with `npm run local:up`
- schema + seed applied with `npm run local:db:setup`
- import completed with `npm run import:problems -- --dir data/problems`
- `collapse` appears in the student problem list
- the student statement matches `data/problems/collapse/statement.md`
- the student starter file matches `data/problems/collapse/starter.py`
- a student submission reaches `finished` or `failed` after `queued -> running`

## Minimal Admin API Operability (No Admin UI Required)

Use authenticated admin HTTP calls for create, update, publish, and submission inspection.

1. Login as admin and capture token:

```bash
ADMIN_TOKEN=$(curl -sS -X POST http://localhost:3100/auth/login \
  -H 'content-type: application/json' \
  -d '{"email":"admin@example.com","password":"ignored"}' | \
  node -e 'const body=JSON.parse(require("fs").readFileSync(0,"utf8")); process.stdout.write(body.accessToken)')
```

2. Create a problem draft:

```bash
curl -sS -X POST http://localhost:3100/admin/problems \
  -H 'content-type: application/json' \
  -H "authorization: Bearer $ADMIN_TOKEN" \
  -d '{"problemId":"admin-demo-1","versionId":"admin-demo-1-v1","title":"Admin Demo","statement":"Draft statement"}'
```

3. Update with a new version:

```bash
curl -sS -X PUT http://localhost:3100/admin/problems/admin-demo-1 \
  -H 'content-type: application/json' \
  -H "authorization: Bearer $ADMIN_TOKEN" \
  -d '{"versionId":"admin-demo-1-v2","title":"Admin Demo Updated","statement":"Updated statement"}'
```

4. Publish the latest version:

```bash
curl -sS -X POST http://localhost:3100/admin/problems/admin-demo-1/publish \
  -H "authorization: Bearer $ADMIN_TOKEN"
```

5. Inspect any submission detail as admin:

```bash
curl -sS http://localhost:3100/admin/submissions/<submissionId> \
  -H "authorization: Bearer $ADMIN_TOKEN"
```

RBAC expectation:
- admin token can call these `/admin/...` endpoints
- student token receives `403 FORBIDDEN` on the same endpoints
