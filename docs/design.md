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
  | "clockify_rate_limited"
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

## Issue 4 Write and Management Interface

The write command surface should extend the current resource groups instead of
adding a separate admin namespace. Existing global conventions still apply:

- `--profile` and `--workspace-id` are accepted by every workspace-scoped
  command.
- Commands returning API entities accept `--format json|csv` and default to
  `json`, matching the existing read commands.
- Commands backed by `204 No Content` return a small JSON confirmation object by
  default, such as `{ "deleted": true, "id": "..." }`, so scripts do not have to
  parse human-only text.
- Boolean options use Commander paired flags, for example
  `--archived` and `--no-archived`. Update commands must leave the parsed value
  as `undefined` when neither flag is present so omission can mean "preserve the
  current value".
- Multi-value options repeat the singular flag name already used by
  `timer start`, for example `--tag-id <id> --tag-id <id>`.
- The first implementation should avoid a generic raw JSON option. Add typed
  flags for the fields the CLI deliberately supports, then add richer payload
  support only when there is a concrete workflow that needs it.

Planned CLI commands:

```text
clockify time-entries create --start <iso> --end <iso> --description <text> --project-id <id> [--task-id <id>] [--tag-id <id>...] [--billable] [--no-billable] [--user-id <id>] [--profile <name>] [--workspace-id <id>] [--format json|csv]
clockify time-entries update <time-entry-id> --start <iso> --end <iso> --description <text> --project-id <id> [--task-id <id>] [--tag-id <id>...] [--clear-tags] [--billable] [--no-billable] [--profile <name>] [--workspace-id <id>] [--format json|csv]
clockify time-entries delete <time-entry-id> [--profile <name>] [--workspace-id <id>]

clockify projects list [--name <query>] [--strict-name-search] [--profile <name>] [--workspace-id <id>] [--page <n>] [--page-size <n>] [--format json|csv]
clockify projects create --name <name> --client-id <id> [--color <hex>] [--billable] [--no-billable] [--public] [--no-public] [--profile <name>] [--workspace-id <id>] [--format json|csv]
clockify projects update <project-id> [--name <name>] [--client-id <id>] [--color <hex>] [--archived] [--no-archived] [--billable] [--no-billable] [--public] [--no-public] [--note <text>] [--profile <name>] [--workspace-id <id>] [--format json|csv]

clockify projects custom-fields update <project-id> <custom-field-id> [--default-value <json>] [--status INACTIVE|VISIBLE|INVISIBLE] [--profile <name>] [--workspace-id <id>] [--format json|csv]

clockify user-groups list [--include-team-managers] [--profile <name>] [--workspace-id <id>] [--page <n>] [--page-size <n>] [--format json|csv]
clockify user-groups add-user <group-id> <user-id> [--profile <name>] [--workspace-id <id>] [--format json|csv]
clockify user-groups remove-user <group-id> <user-id> [--profile <name>] [--workspace-id <id>] [--format json|csv]

clockify users list [--email <email>] [--profile <name>] [--workspace-id <id>] [--page <n>] [--page-size <n>] [--format json|csv]
clockify users invite <email> [--send-email] [--no-send-email] [--profile <name>] [--workspace-id <id>] [--format json|csv]
```

Time entry semantics:

- `time-entries create` uses the current user endpoint unless `--user-id` is
  provided. When `--user-id` is provided, use the "add time entry for another
  user" endpoint.
- `time-entries update` maps to Clockify's `PUT /time-entries/{id}` endpoint and
  is intentionally replace-like. Required flags are enforced even if some
  underlying API fields are optional, so the user cannot accidentally clear a
  field by omission.
- Omitted optional update fields preserve the current value. The CLI action
  should fetch the current time entry, then call a pure
  `buildTimeEntryUpdatePayload(current, patch)` helper before sending `PUT`.
  This is last-write-wins and should be documented in the command help.
- Tags are preserved when `--tag-id` is omitted. Passing one or more `--tag-id`
  values replaces the tag list. Passing `--clear-tags` sends an empty tag list,
  and cannot be combined with `--tag-id`.
- `timer start` remains the ergonomic running-timer command. `time-entries
  create` is for complete manual entries with explicit `--start` and `--end`.
- `--billable` defaults to `false` only for create commands. For update commands,
  omission means "do not include this optional field" unless the API contract for
  that endpoint requires it.
- `time-entries delete` always emits a JSON confirmation object and does not
  accept `--format`.

Project semantics:

- `projects list --name` is a narrow wrapper around the project list endpoint
  with the `name` query parameter. `--strict-name-search` maps to the API query
  flag and defaults to false.
- `projects create` starts with the fields needed by the tracked workflow:
  `name`, `clientId`, optional `color`, optional `billable`, and optional
  visibility. Rates, estimates, memberships, and templates remain out of scope.
- `projects update` validates that at least one mutable field is present. If the
  Clockify endpoint requires a full replacement payload in practice, the CLI
  action should fetch the current project, pass it with the parsed patch into a
  pure `buildProjectUpdatePayload(current, patch)` helper, and then send the
  complete supported payload. This is last-write-wins.
- The CLI flags are `--public` and `--no-public`, while the request body field
  remains `isPublic` if required by the API.

Custom field semantics:

- `projects custom-fields update` is scoped under `projects` because the
  operation mutates a custom field assignment on a specific project, not the
  workspace-level custom field definition.
- `--default-value` is parsed as JSON. This keeps string, number, boolean,
  array, object, and null values representable without inventing per-type flags.
- At least one of `--default-value` or `--status` is required.
- JSON parsing must go through
  `validateJsonValue(raw: string): Result<unknown, AppError>` so malformed JSON
  returns `validation_error` instead of escaping the `Result` chain.
- The response is decoded as a project custom field assignment, not as a full
  `Project`.

User and group semantics:

- `users list --email` should prefer the workspace user filter endpoint if the
  public list endpoint cannot filter by email directly. The command still
  exposes one simple interface for duplicate checks.
- `users invite` maps to adding a user to a workspace and defaults
  `--send-email` to `true`, matching Clockify's API default and the command
  name.
- `user-groups add-user` and `remove-user` return the updated user group entity
  when Clockify returns one. If a group mutation endpoint returns no body, the
  client returns a JSON confirmation object rather than failing response
  decoding.
- User groups and project-level custom field defaults may be gated by Clockify
  plan or permission level. A 403 from these endpoints should produce a message
  that mentions the likely plan or permission requirement.

Client additions:

```ts
type ClockifyClient = {
  readonly getTimeEntry: (input: GetTimeEntryInput) => ResultAsync<TimeEntry, AppError>;
  readonly createTimeEntry: (input: CreateTimeEntryInput) => ResultAsync<TimeEntry, AppError>;
  readonly updateTimeEntry: (input: UpdateTimeEntryInput) => ResultAsync<TimeEntry, AppError>;
  readonly deleteTimeEntry: (input: DeleteTimeEntryInput) => ResultAsync<DeleteResult, AppError>;
  readonly getProject: (input: GetProjectInput) => ResultAsync<Project, AppError>;
  readonly createProject: (input: CreateProjectInput) => ResultAsync<Project, AppError>;
  readonly listProjects: (input: ListProjectsInput) => ResultAsync<PageResult<Project>, AppError>;
  readonly updateProject: (input: UpdateProjectInput) => ResultAsync<Project, AppError>;
  readonly updateProjectCustomField: (input: UpdateProjectCustomFieldInput) => ResultAsync<ProjectCustomFieldAssignment, AppError>;
  readonly listUserGroups: (input: ListUserGroupsInput) => ResultAsync<PageResult<UserGroup>, AppError>;
  readonly addUserToGroup: (input: UserGroupMembershipInput) => ResultAsync<UserGroupMutationResult, AppError>;
  readonly removeUserFromGroup: (input: UserGroupMembershipInput) => ResultAsync<UserGroupMutationResult, AppError>;
  readonly listUsers: (input: ListUsersInput) => ResultAsync<PageResult<WorkspaceUser>, AppError>;
  readonly inviteUser: (input: InviteUserInput) => ResultAsync<WorkspaceUser, AppError>;
};
```

Implementation notes:

- Add schemas for `UserGroup`, `WorkspaceUser`, `ProjectCustomFieldAssignment`,
  and mutation confirmation objects using the same "required core fields plus
  passthrough" policy.
- Add validation helpers for paired booleans, hex colors, enum values, email
  strings, JSON values, mutually exclusive options, and "at least one option
  present".
- Add a `requestNoContent` or `requestJsonOrNoContent` helper only when needed
  by mutation endpoints that can return 204; keep the current JSON path
  unchanged for existing commands.
- All new client methods inherit the existing 429 handling and return
  `clockify_rate_limited`.
- Watch Clockify's inconsistent query parameter casing: existing list helpers
  use `page` and `pageSize`; newer documented endpoints may require
  `page-size`. Encode that difference at the client method boundary, not in CLI
  validation.

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

Write command test cases:

- `buildTimeEntryUpdatePayload` preserves existing optional fields when update
  flags are omitted.
- `buildTimeEntryUpdatePayload` replaces tags when `--tag-id` is provided,
  clears tags only when `--clear-tags` is provided, and rejects combining both.
- `deleteTimeEntry` turns a 204 response into the documented confirmation JSON.
- `buildProjectUpdatePayload` preserves existing values, updates each supported
  field independently, and rejects an empty patch.
- `validateJsonValue` accepts valid JSON values and rejects malformed JSON as
  `validation_error`.
- `validateAtLeastOnePresent` is covered for `projects update` and
  `projects custom-fields update`.
- Hex color validation accepts only `#RRGGBB`.
- Paired boolean flags preserve `undefined` for omitted update values and parse
  explicit true/false values correctly.
- 403 responses from plan- or permission-sensitive endpoints produce targeted
  messages.

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
