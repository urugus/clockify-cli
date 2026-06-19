---
name: clockify-cli-setup
description: Set up the clockify-cli repository or CLI from a fresh checkout or clean machine. Use this for checking Node.js and pnpm versions, installing dependencies, building, linking the local binary, configuring Clockify profiles, and verifying the CLI works.
---

# clockify-cli Setup

## Scope

Use this skill when the user wants to get clockify-cli installed, built, linked,
or configured for the first time.

Do not use this skill for implementation or release work; use
`clockify-cli-dev` instead. Do not use it for routine command guidance after
setup; use `clockify-cli-usage` instead.

## Prerequisites

- Require Node.js 20 or newer.
- Require pnpm 10.33.0 or newer for local development.
- Require macOS Keychain access when storing Clockify API keys.
- Require a Clockify API key only for profile configuration and live
  authentication checks.

Check versions:

```sh
node --version
pnpm --version
```

## Local Repository Setup

From the repository root:

```sh
pnpm install
pnpm build
node dist/index.js --help
```

If the user wants a local global `clockify` command for development:

```sh
pnpm link --global
clockify --help
```

Use `pnpm check` after setup when the user wants confidence that the checkout is
healthy. It runs formatting checks, linting, tests with coverage, and TypeScript
checks.

## Published Package Setup

If the user wants to install the published CLI instead of working from source:

```sh
npm install --global @urugus/clockify-cli
clockify --help
```

With pnpm:

```sh
pnpm add --global @urugus/clockify-cli
clockify --help
```

## Clockify Profile Setup

Only configure a profile when the user has a Clockify API key.

```sh
clockify config set --profile default
clockify config list
clockify config use default
clockify auth test
```

For regional or subdomain deployments, use explicit base URLs:

```sh
clockify config set \
  --profile eu \
  --api-base-url https://euc1.clockify.me/api/v1 \
  --reports-base-url https://euc1.clockify.me/report/v1
```

Set a default workspace after listing workspaces:

```sh
clockify workspaces list
clockify workspaces use <workspace-id>
```

Notes:

- The config file is stored at `~/.config/clockify-cli/config.json`.
- API keys are stored separately in macOS Keychain under the `clockify-cli`
  service.
- Do not ask the user to paste API keys into chat.
- Do not print or commit API keys.
- If authentication fails, verify the API key, selected profile, base URL, and
  network access before changing code.

## Troubleshooting

- If `clockify` is not found after `pnpm link --global`, inspect pnpm's global
  bin setup and PATH rather than changing package code.
- If `node dist/index.js --help` fails, run `pnpm build` again and inspect
  TypeScript or packaging errors.
- If dependency installation fails because of network or registry access, report
  the environment issue clearly.
- If Keychain access fails, distinguish macOS permission problems from
  application bugs.
