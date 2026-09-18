# Contributing to FlowTask

Thank you for helping improve FlowTask For Super Productivity.

## Before you start

- Search existing issues and pull requests.
- For security problems, follow [SECURITY.md](SECURITY.md) instead of opening a public issue.
- Do not include private notes, task data, tokens, or vault files in commits.

## Local setup

```bash
git clone https://github.com/giba0/obisidan-flowtask-sp.git
cd obisidan-flowtask-sp
npm install
```

Run the full validation suite:

```bash
npm run typecheck
npm test
npm run build
```

For manual testing, copy the generated `main.js` and `manifest.json` into the target vault's `.obsidian/plugins/flowtask-super-productivity` directory and reload the plugin.

## Branches and commits

- Use a focused branch such as `fix/tasks-due-date` or `feature/project-filter`.
- Keep each commit focused on one behavior when practical.
- Use imperative commit subjects, for example `Fix Tasks due date mapping`.
- Do not commit `node_modules`, secrets, generated coverage, or unrelated files.

## Code standards

- Keep domain logic independent from Obsidian APIs whenever possible.
- Use `requestUrl()` for Super Productivity requests. Do not use browser `fetch()`.
- Preserve optional-token behavior.
- Treat date-only values as dates in a named timezone; do not parse user date strings with `new Date(string)`.
- Add regression tests for transport fields, date parsing, auth headers, and synchronization behavior.
- Keep user-facing strings in English.
- Update the README when changing commands, settings, syntax, or limitations.

## Pull requests

A pull request should include:

- A concise explanation of the user problem.
- The behavior that changed.
- Tests added or updated.
- The commands run and their results.
- Screenshots or a short recording for UI changes.
- Any compatibility or migration notes.

Before requesting review:

1. Rebase or merge the latest `main` when appropriate.
2. Run typecheck, tests, and production build.
3. Review the final diff for secrets and unrelated changes.
4. Confirm that the plugin still loads in Obsidian Desktop.

Maintainers may request changes to scope, tests, accessibility, documentation, or compatibility before merging.
