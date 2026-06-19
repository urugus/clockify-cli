---
name: clockify-cli-usage
description: Help someone use the installed clockify CLI. Use this for configuring profiles, checking authentication, listing workspaces/projects/clients/tags/tasks/time entries, starting or stopping timers, exporting JSON or CSV, and choosing safe command examples.
---

# clockify-cli Usage

## Scope

Use this skill after the CLI is installed and the user wants help running
`clockify` commands.

Do not use it for repository implementation or release changes; use
`clockify-cli-dev` instead. Do not use it for fresh machine or checkout setup;
use `clockify-cli-setup` instead.

## Core Principles

- Help the user run the installed `clockify` command, not modify the repository.
- Ask for missing Clockify-specific values only when required: profile name,
  workspace ID, project ID, task ID, tag ID, user ID, or ISO date-time range.
- Never ask the user to paste an API key into chat. The CLI prompts for it
  during `clockify config set`.
- Do not print, store, or commit API keys.
- Prefer commands that are explicit about `--profile` when the user mentions
  multiple environments.
- Use ISO date-times with timezone, for example `2026-06-19T00:00:00.000Z`.

## Profile And Authentication

Create or update a profile:

```sh
clockify config set --profile default
```

List profiles:

```sh
clockify config list
```

Set the default profile:

```sh
clockify config use default
```

Test authentication:

```sh
clockify auth test
```

Use a specific profile:

```sh
clockify auth test --profile staging
```

Notes:

- Profile metadata is stored at `~/.config/clockify-cli/config.json`.
- API keys are stored in macOS Keychain under the `clockify-cli` service.
- If authentication fails, check the API key, selected profile, base URL,
  network access, and whether the key works in Clockify.

## Workspace Discovery

Show the current user:

```sh
clockify me
clockify me --format csv
```

List workspaces:

```sh
clockify workspaces list
```

Set a default workspace:

```sh
clockify workspaces use <workspace-id>
```

Use `--workspace-id` on resource commands when the user does not want to change
the default workspace.

## Resource Commands

List workspace resources:

```sh
clockify projects list
clockify clients list
clockify tags list
clockify tasks list --project-id <project-id>
```

Use explicit paging when needed:

```sh
clockify projects list --page 2 --page-size 100
```

Use CSV when the user wants spreadsheet-friendly output:

```sh
clockify projects list --format csv
```

Use a non-default profile or workspace:

```sh
clockify projects list --profile staging --workspace-id <workspace-id>
```

## Time Entries

List the authenticated user's time entries for a date range:

```sh
clockify time-entries list \
  --from 2026-06-19T00:00:00.000Z \
  --to 2026-06-20T00:00:00.000Z
```

List a specific user's time entries:

```sh
clockify time-entries list \
  --user-id <user-id> \
  --from 2026-06-19T00:00:00.000Z \
  --to 2026-06-20T00:00:00.000Z
```

Guidance:

- Prefer explicit date ranges for time-entry queries.
- Use timezone-bearing ISO date-times.
- The CLI resolves the current user through Clockify when `--user-id` is
  omitted.

## Timers

Show currently running timers:

```sh
clockify timer current
```

Start a timer:

```sh
clockify timer start --description "Implementation work"
```

Start a billable project timer:

```sh
clockify timer start \
  --description "Implementation work" \
  --project-id <project-id> \
  --billable
```

Stop the current user's timer:

```sh
clockify timer stop
```

Stop a timer for a specific user:

```sh
clockify timer stop --user-id <user-id>
```

Guidance:

- `timer start` and `timer stop` affect Clockify state. State that plainly
  before suggesting execution when the user appears to be exploring.
- `timer stop` defaults the end timestamp to now.
- Use `--end <iso>` when the user needs an explicit stop time.

## Response Style

- Reply in Japanese unless the user asks for another language.
- Give the exact command first, then short notes about required placeholders and
  risks.
- When a command can affect Clockify state, state that plainly before suggesting
  execution.
- If the user reports an error, ask for the command, exit output, profile name,
  and whether the same API key works in Clockify, but do not request the API key
  itself.
