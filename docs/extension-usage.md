# Extension Usage

This guide describes the primary student workflow inside the VS Code extension.

## Sidebar Layout

The extension adds an `OJ` activity bar entry with these sidebar views:

- `Problems`
- `Problem Detail`
- `Submissions`
- `Submission Detail`
- `Account`

The intended flow is sidebar-first rather than command-palette-first.

## Login

1. Open the `OJ` sidebar.
2. Go to `Account`.
3. Enter email and password.
4. Click `Login`.

On success, the extension stores the access token in VS Code `SecretStorage` and the panel switches to the authenticated state showing the current email and role.

## Fetch Problems

Use the `Fetch Problems` action in the `Problems` panel title.

This requests the published problem list from the API and updates the `Problems` tree.

## Select A Problem

Clicking a problem in the `Problems` tree:

- updates `Problem Detail`
- does not automatically open `statement.md`
- does not automatically open `starter.py`
- does not switch editor focus

The `Problem Detail` panel shows:

- title
- problem id
- entry function
- language when available
- rendered statement markdown

## Open Coding File

Click `Open Coding File` in `Problem Detail`.

The extension opens or creates:

```text
.oj/problems/<problemId>.py
```

Behavior:

- existing files are reopened instead of overwritten
- new files are created from imported starter content
- the selected problem remains the sidebar context for future actions

## Submit

Click `Submit` in `Problem Detail` or use the command fallback `OJ: Submit Current File`.

The submit flow:

1. reads the current Python file
2. extracts the configured `entryFunction`
3. posts the submission to the API
4. records a pending submission in the sidebar
5. polls until the result becomes terminal

## Submission Views

### `Submissions`

Shows recent submissions in a compact tree format, for example:

```text
WA    790ms | 0KB
```

### `Submission Detail`

Selecting a submission shows:

- submission id
- lifecycle status
- verdict
- time
- memory
- failure or compile/runtime information when available

## Command Palette Fallbacks

The extension still exposes command fallbacks such as:

- `OJ: Login`
- `OJ: Fetch Problems`
- `OJ: Submit Current File`

These are useful for debugging, but the primary UX is the sidebar.

## Typical Student Workflow

1. Login in `Account`.
2. Fetch problems from `Problems`.
3. Select a problem.
4. Review the statement in `Problem Detail`.
5. Open the coding file.
6. Implement the solution.
7. Submit.
8. Watch `queued -> running -> finished|failed`.
9. Inspect the result in `Submission Detail`.
