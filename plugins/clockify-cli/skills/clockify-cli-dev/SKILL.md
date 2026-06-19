---
name: clockify-cli-dev
description: Work in the clockify-cli repository on implementation, tests, README changes, package metadata, plugin skills, or release preparation. Use this for repo-scoped development tasks that need pnpm checks, TypeScript CLI conventions, neverthrow/zod patterns, macOS Keychain awareness, or npm release rules.
---

# clockify-cli Development

## Scope

Use this skill for source changes, tests, documentation updates, plugin skill
updates, package metadata, and release preparation in this repository.

Do not use it for ordinary CLI usage after installation; use
`clockify-cli-usage` instead. Do not use it for first-time machine setup; use
`clockify-cli-setup` instead.

## Repository Rules

- Think in English and reply to the user in Japanese unless they explicitly ask
  for another language.
- Treat this as a Node.js 20+ TypeScript CLI package managed with pnpm 10.33.0
  or newer.
- Prefer existing source, test, and command patterns over introducing new
  abstractions.
- Keep CLI behavior, command names, arguments, config format, and output format
  stable unless the requested change explicitly requires a breaking change.
- Preserve existing user changes in the working tree.
- Avoid broad cleanup or generated-file churn unless it is necessary for the
  requested task.

## Architecture

- Use `neverthrow` for recoverable errors.
- Pure functions should return `Result<T, AppError>`.
- Side-effecting async functions should return `ResultAsync<T, AppError>`.
- Keep filesystem, Keychain, prompts, process IO, and HTTP at narrow boundaries.
- Use `zod` for config parsing, CLI date-time validation, and Clockify API
  response decoding.
- Keep injected seams for side effects such as `fetchImpl`, Keychain `ExecLike`,
  prompt functions, and deterministic clocks in tests.

## Checks

- Use `pnpm check` as the main preflight because it runs formatting checks,
  linting, tests with coverage, native TypeScript checks, and `tsc`.
- Use narrower checks while iterating:
  - `pnpm test`
  - `pnpm test:coverage`
  - `pnpm lint`
  - `pnpm build`
  - `pnpm exec vitest run <test-file>`
- If Keychain-backed behavior cannot be verified because of OS, permission, or
  sandbox limits, state the limitation clearly.
- If live Clockify API behavior cannot be verified because no API key is
  available, state that limitation clearly and rely on mocked client tests.

## Test Expectations

- Keep pure validation/config/output functions close to 100% coverage.
- Add client tests with mocked `fetchImpl` for new API endpoints.
- Add CLI tests with mocked config store, Keychain, client, prompt, and IO for
  new commands.
- Cover error paths, not only happy paths.
- Do not weaken coverage intentionally to make a change pass.

## Documentation

- Keep README command examples aligned with actual CLI commands and package
  metadata.
- The npm package name is `@urugus/clockify-cli`.
- The installed binary name is `clockify`.
- Separate published package installation from local development setup:
  - Published package: `npm install --global @urugus/clockify-cli`
  - Local development: `pnpm install`, then `pnpm build`
- Keep plugin skills under `plugins/clockify-cli/skills/` aligned with README
  and command behavior.

## Release Management

- Keep `package.json` version, plugin manifest versions, marketplace versions,
  Git release tag, and npm package version aligned one-to-one.
- Use SemVer:
  - `patch` for bug fixes.
  - `minor` for backward-compatible CLI features.
  - `major` for breaking CLI behavior, command names, arguments, config format,
    output format, or plugin skill behavior.
- Do not edit `package.json` version manually for releases.
- Use package scripts when release scripts exist.
- Before creating a release, run `pnpm check` and `pnpm build`.
- Do not publish unbuilt or unverified packages.

## Safety

- Do not expose Clockify API keys or macOS Keychain contents.
- Do not ask users to paste API keys into chat.
- Treat timer start/stop commands as state-changing operations.
- Preserve existing local changes unless the user explicitly asks to discard
  them.
