# clockify-cli

A small command-line client for Clockify.

This tool manages local Clockify profiles, stores API keys in macOS Keychain,
and wraps common Clockify API operations for workspaces, projects, clients,
tags, tasks, time entries, and timers.

## Requirements

- Node.js 20 or newer
- pnpm 10.33.0 or newer for local development
- macOS Keychain access for storing Clockify API keys
- A Clockify API key

## Development

```sh
pnpm install
pnpm check
pnpm build
```

Build output is written to `dist/`.

The build uses `tsgo` from `@typescript/native-preview`; `pnpm check` runs both
`tsgo --noEmit` and `tsc --noEmit`.

Run the CLI locally:

```sh
node dist/index.js --help
```

## Configuration

Create or update a profile:

```sh
clockify config set --profile default
```

The command prompts for a Clockify API key. Profile metadata is saved to:

```text
~/.config/clockify-cli/config.json
```

API keys are stored separately in macOS Keychain under the `clockify-cli`
service.

For regional or subdomain Clockify deployments, override the base URLs:

```sh
clockify config set \
  --profile eu \
  --api-base-url https://euc1.clockify.me/api/v1 \
  --reports-base-url https://euc1.clockify.me/report/v1
```

List profiles:

```sh
clockify config list
```

Set the default profile:

```sh
clockify config use default
```

Set the default workspace for the current profile:

```sh
clockify workspaces use <workspace-id>
```

## Commands

Test authentication:

```sh
clockify auth test
```

Show the current user:

```sh
clockify me
clockify me --format csv
```

List workspaces:

```sh
clockify workspaces list
```

List workspace resources:

```sh
clockify projects list
clockify clients list
clockify tags list
clockify tasks list --project-id <project-id>
```

Use explicit paging:

```sh
clockify projects list --page 2 --page-size 100
```

List time entries:

```sh
clockify time-entries list \
  --from 2026-06-19T00:00:00.000Z \
  --to 2026-06-20T00:00:00.000Z
```

Show currently running timers:

```sh
clockify timer current
```

Start and stop a timer:

```sh
clockify timer start --description "Implementation work" --project-id <project-id>
clockify timer stop
```

Use a non-default profile or workspace:

```sh
clockify projects list --profile staging --workspace-id <workspace-id>
```

## Design

See [docs/design.md](docs/design.md).

## Agent Plugins

This repository includes shareable plugins for Codex and Claude Code. Both
plugins package the same clockify-cli skills:

- `clockify-cli-dev`: repository development, tests, package metadata, plugin
  skills, and release preparation.
- `clockify-cli-setup`: first-time setup from source or from the published npm
  package.
- `clockify-cli-usage`: day-to-day use of the installed `clockify` command.

The skills live under:

```text
plugins/clockify-cli/skills/
```

They are packaged as plugins instead of standalone project skills so other
users can install only these clockify-cli workflows from a marketplace.

### Codex

Codex uses:

- Plugin manifest: `plugins/clockify-cli/.codex-plugin/plugin.json`
- Marketplace manifest: `.agents/plugins/marketplace.json`

Install the marketplace and plugin:

```sh
codex plugin marketplace add urugus/clockify-cli
codex plugin add clockify-cli@clockify-cli
```

Start a new Codex thread after installing so Codex can discover the plugin
skills.

### Claude Code

Claude Code uses:

- Plugin manifest: `plugins/clockify-cli/.claude-plugin/plugin.json`
- Marketplace manifest: `.claude-plugin/marketplace.json`

Install the marketplace and plugin:

```sh
claude plugin marketplace add urugus/clockify-cli
claude plugin install clockify-cli@clockify-cli
```

Plugin skills are namespaced in Claude Code:

```text
/clockify-cli:clockify-cli-usage
/clockify-cli:clockify-cli-setup
/clockify-cli:clockify-cli-dev
```

For local Claude Code plugin development, load the plugin directly:

```sh
claude --plugin-dir ./plugins/clockify-cli
```

Validate the Claude Code marketplace and plugin:

```sh
claude plugin validate .
```
