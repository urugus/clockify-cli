# clockify-cli design

## Goals

Build a small, robust Clockify CLI by reusing the architectural shape of
`redash-cli`, while making the Clockify-specific API surface explicit and
type-safe.

Primary engineering constraints:

- Use `neverthrow` for recoverable errors and async workflows.
- Prefer pure functions for parsing, validation, URL/path construction, config
  transformation, and output formatting.
- Keep side effects at narrow boundaries: filesystem, Keychain, prompts,
  process IO, and HTTP.
- Use `zod` to validate all untrusted data: config files, CLI options after
  commander parsing, and Clockify API responses.
- Drive implementation with Vitest and keep coverage close to 100%.

## Reference Shape

The `redash-cli` reference has a clean layered structure:

```text
CLI program -> validation -> config/keychain -> API client -> output
```

For `clockify-cli`, keep the same shape and replace only the domain-specific
parts:

- Redash API client becomes Clockify API client.
- `Authorization: Key ...` becomes `X-Api-Key: ...`.
- Redash profile URL becomes Clockify API base URLs plus an optional default
  workspace.
- Query/dashboard/admin commands become workspace, project, tag, task, and time
  entry commands.

## Proposed File Layout

```text
src/
  index.ts
  cli/
    program.ts
    validation.ts
  clockify/
    client.ts
    pagination.ts
    schemas.ts
  config/
    config.ts
    config-store.ts
  errors/
    app-error.ts
  keychain/
    keychain.ts
  lib/
    result.ts
  output/
    format.ts
tests/
  cli/
  clockify/
  config/
  keychain/
  output/
```

## Dependency Choices

- `commander`: command tree and option parsing.
- `@inquirer/prompts`: masked API key prompt.
- `neverthrow`: `Result` and `ResultAsync` as the normal error contract.
- `zod`: runtime validation and inferred TypeScript types.
- `vitest`: unit tests and coverage.
- `@vitest/coverage-v8`: coverage reporting.
- `biome` and `oxlint`: formatting and linting, matching `redash-cli`.

## Error Model

Every recoverable failure should return `Result<T, AppError>` or
`ResultAsync<T, AppError>`.

```ts
export type AppErrorCode =
  | "clockify_http_error"
  | "clockify_invalid_response"
  | "config_invalid"
  | "config_write_failed"
  | "keychain_failed"
  | "profile_not_found"
  | "validation_error";

export type AppError = {
  readonly code: AppErrorCode;
  readonly message: string;
  readonly cause?: unknown;
};
```

Rules:

- Pure functions return `Result`.
- Side-effecting async functions return `ResultAsync`.
- CLI command actions call a shared `runTask` helper that prints errors and sets
  `process.exitCode = 1`.
- Do not throw intentionally from domain code.
- Let truly unrecoverable programmer errors fail tests rather than encoding them
  as app errors.

## Functional Boundaries

Pure modules:

- `config/config.ts`: parse, serialize, normalize, upsert, resolve profile.
- `cli/validation.ts`: convert commander string options into domain inputs.
- `clockify/schemas.ts`: zod schemas and decoders.
- `clockify/pagination.ts`: query construction and `Last-Page` interpretation.
- `output/format.ts`: JSON/CSV/table formatting.
- `lib/result.ts`: small generic parsing helpers.

Effect modules:

- `config/config-store.ts`: read/write `~/.config/clockify-cli/config.json`.
- `keychain/keychain.ts`: call `/usr/bin/security`.
- `clockify/client.ts`: call `fetch`.
- `cli/program.ts`: prompt, stdout/stderr, process exit code.
- `index.ts`: package version and top-level CLI execution.

The important design rule is that effect modules should compose pure functions,
not hide parsing and validation inside ad hoc imperative code.

## Configuration

Non-secret config:

```json
{
  "defaultProfile": "default",
  "profiles": {
    "default": {
      "apiBaseUrl": "https://api.clockify.me/api/v1",
      "reportsBaseUrl": "https://reports.api.clockify.me/v1",
      "defaultWorkspaceId": "64a687e29ae1f428e7ebe303"
    }
  }
}
```

Notes:

- `apiBaseUrl` defaults to `https://api.clockify.me/api/v1`.
- `reportsBaseUrl` defaults to `https://reports.api.clockify.me/v1`.
- `defaultWorkspaceId` is optional until the user runs
  `clockify workspaces use <workspace-id>`.
- API keys are never stored in the JSON file.
- API keys are stored in macOS Keychain under service `clockify-cli` and account
  `<profile>:api-key`.

Config functions:

- `emptyConfig(): CliConfig`
- `parseConfigJson(value): Result<CliConfig, AppError>`
- `parseConfigText(text): Result<CliConfig, AppError>`
- `serializeConfig(config): string`
- `normalizeBaseUrl(url, fieldName): Result<string, AppError>`
- `validateProfileName(profile): Result<string, AppError>`
- `upsertProfile(config, profile, input): Result<CliConfig, AppError>`
- `setDefaultProfile(config, profile): Result<CliConfig, AppError>`
- `setDefaultWorkspace(config, profile, workspaceId): Result<CliConfig, AppError>`
- `resolveProfile(config, profileOption): Result<ResolvedProfile, AppError>`
- `resolveWorkspace(config, profileOption, workspaceOption): Result<ResolvedWorkspace, AppError>`

## Clockify Client

Client construction:

```ts
export type ClockifyClientOptions = {
  readonly apiBaseUrl: string;
  readonly reportsBaseUrl: string;
  readonly apiKey: string;
  readonly fetchImpl?: FetchLike;
};
```

Request helper:

- Builds full URLs from normalized base URL and encoded path/query.
- Sends `X-Api-Key`.
- Sends `Content-Type: application/json` when a body is present.
- Accepts JSON responses.
- Handles `204 No Content`.
- Converts failed fetches and non-2xx statuses into `AppError`.
- Decodes response bodies with zod-specific decoders.

Client methods for MVP:

- `getCurrentUser()`
- `listWorkspaces()`
- `listProjects(input)`
- `listClients(input)`
- `listTags(input)`
- `listTasks(input)`
- `listTimeEntries(input)`
- `listInProgressTimeEntries(input)`
- `startTimer(input)`
- `stopTimer(input)`

Reports API should be a second phase because it has a separate base URL and a
larger request body surface.

## Zod Strategy

Use zod at every boundary where unknown data enters the app.

Config:

- Strict config schema.
- Optional fields have explicit defaults applied in pure functions, not by
  mutating parsed data.

CLI validation:

- Commander still parses all options as strings.
- Convert strings to domain types through pure validation functions.
- Validate IDs as non-empty strings.
- Validate positive integers with both regex and safe integer checks.
- Validate ISO date-time strings with `z.string().datetime({ offset: true })`.

API responses:

- Prefer permissive entity schemas with required core fields and `.passthrough()`
  for API compatibility.
- Decode only what commands need.
- Avoid typing entire Clockify responses upfront if the CLI only prints them.

Example entity schema policy:

```ts
const workspaceSchema = z
  .object({
    id: z.string().min(1),
    name: z.string(),
  })
  .passthrough();
```

This catches broken core contracts while tolerating additional Clockify fields.

## Command Design

Initial commands:

```text
clockify config set --profile <name> [--api-base-url <url>] [--reports-base-url <url>]
clockify config list
clockify config use <profile>

clockify auth test [--profile <name>]
clockify me [--profile <name>] [--format json|csv]

clockify workspaces list [--profile <name>] [--format json|csv]
clockify workspaces use <workspace-id> [--profile <name>]

clockify projects list [--profile <name>] [--workspace-id <id>] [--page <n>] [--page-size <n>] [--format json|csv]
clockify clients list [--profile <name>] [--workspace-id <id>] [--page <n>] [--page-size <n>] [--format json|csv]
clockify tags list [--profile <name>] [--workspace-id <id>] [--page <n>] [--page-size <n>] [--format json|csv]
clockify tasks list --project-id <id> [--profile <name>] [--workspace-id <id>] [--page <n>] [--page-size <n>] [--format json|csv]

clockify time-entries list [--profile <name>] [--workspace-id <id>] [--user-id <id>] [--from <iso>] [--to <iso>] [--page <n>] [--page-size <n>] [--format json|csv]
clockify timer current [--profile <name>] [--workspace-id <id>]
clockify timer start --description <text> [--project-id <id>] [--task-id <id>] [--tag-id <id>...] [--billable] [--profile <name>] [--workspace-id <id>]
clockify timer stop [--end <iso>] [--profile <name>] [--workspace-id <id>] [--user-id <id>]
```

Design choices:

- `--workspace-id` overrides the profile default workspace.
- Commands that require a workspace fail clearly when neither override nor
  profile default is available.
- `timer stop` defaults `--end` to the current time at the CLI boundary.
- `timer stop` resolves the current user through `getCurrentUser()` when
  `--user-id` is omitted.
- `startTimer` receives a timestamp from the caller, not from inside the pure
  payload builder, so tests stay deterministic.

## Pagination

Clockify list endpoints commonly use `page` and `pageSize`, with `Last-Page` in
the response headers.

MVP:

- Support explicit `--page` and `--page-size`.
- Return only one page.

Follow-up:

- Add `--all`.
- Implement a generic `paginateAll` helper in `clockify/pagination.ts`.
- Keep `paginateAll` dependency-injected over a page fetcher so it is fully
  unit-testable without HTTP.

## Output

Supported formats:

- `json`
- `csv`

Rules:

- JSON is pretty-printed.
- CSV columns are the union of keys in first-seen order.
- Nested values are JSON-stringified in CSV.
- Empty CSV row arrays render as an empty string.
- Formatting functions must be pure and fully covered by tests.
- Avoid table output in MVP because terminal-width behavior adds complexity and
  test fragility.

## Testing Strategy

Coverage target: close to 100%, with meaningful branch coverage.

Test levels:

- Pure function unit tests for config, validation, schemas, pagination, output.
- Client tests with mocked `fetchImpl`.
- Keychain command-builder tests without touching the real Keychain.
- Keychain side effects use an injectable `ExecLike` so tests do not need
  process-level mocking.
- CLI program tests with mocked config store, keychain, client, prompt, and IO.

Coverage expectations by module:

- `config/config.ts`: 100%.
- `cli/validation.ts`: 100%.
- `output/format.ts`: 100%.
- `clockify/schemas.ts`: 100% for decoders used by commands.
- `clockify/pagination.ts`: 100%.
- `clockify/client.ts`: high coverage for paths/statuses/headers/decoding.
- `cli/program.ts`: command behavior and error paths, but not every commander
  internal branch.
- `index.ts`: minimal smoke coverage or exclude only if needed.

Important test cases:

- Missing config file returns empty config.
- Invalid config JSON returns `config_invalid`.
- Profile set normalizes URLs and preserves existing profiles.
- API key is saved/read with the expected Keychain service/account.
- HTTP requests include `X-Api-Key`.
- Non-2xx Clockify responses become `clockify_http_error`.
- Invalid JSON and invalid response shapes become `clockify_invalid_response`.
- 204 responses are accepted for endpoints that allow no content.
- CLI prints errors to stderr and sets `process.exitCode = 1`.
- CLI never prints API keys.
- Timer payload construction is deterministic with injected timestamps.
- CSV handles nulls, commas, quotes, newlines, and nested values.
- CSV handles empty row arrays.

## Implementation Phases

1. Project scaffold: package metadata, TypeScript config, lint/format/test setup.
2. Shared primitives: `AppError`, `result` helpers, output formatting.
3. Config and Keychain: pure config logic plus effect wrappers.
4. Clockify schemas and client foundation.
5. CLI profile/auth/me/workspaces commands.
6. Workspace resource list commands: projects, clients, tags, tasks.
7. Time entry and timer commands.
8. README usage examples and release checklist.

Each phase should land with tests before expanding the command surface.
