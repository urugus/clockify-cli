import { createRequire } from "node:module";
import { password } from "@inquirer/prompts";
import { Command } from "commander";
import { type Result, ResultAsync } from "neverthrow";
import { createClockifyClient } from "../clockify/client.js";
import {
  defaultApiBaseUrl,
  defaultReportsBaseUrl,
  resolveProfile,
  resolveWorkspace,
  setDefaultProfile,
  setDefaultWorkspace,
  upsertProfile,
  validateProfileName,
} from "../config/config.js";
import { readConfigFile, writeConfigFile } from "../config/config-store.js";
import type { AppError } from "../errors/app-error.js";
import { readApiKey, saveApiKey } from "../keychain/keychain.js";
import { formatValue, parseOutputFormat } from "../output/format.js";
import {
  type ResourceListOptions,
  type TaskListOptions,
  type TimeEntriesListOptions,
  type TimerStartOptions,
  type TimerStopOptions,
  validateResourceListOptions,
  validateTaskListOptions,
  validateTimeEntriesListOptions,
  validateTimerStartOptions,
  validateTimerStopOptions,
} from "./validation.js";

const require = createRequire(import.meta.url);
const packageJson = require("../../package.json") as { version: string };

export type Io = {
  readonly stdout: Pick<NodeJS.WriteStream, "write">;
  readonly stderr: Pick<NodeJS.WriteStream, "write">;
};

export type PromptPassword = (message: string) => Promise<string>;
export type Now = () => Date;

export type ProgramDeps = {
  readonly io?: Io;
  readonly promptPassword?: PromptPassword;
  readonly now?: Now;
  readonly version?: string;
};

const printError = (io: Io, error: AppError): void => {
  io.stderr.write(`clockify: ${error.message}\n`);
};

const runTask = async <T>(
  io: Io,
  task: ResultAsync<T, AppError>,
  onSuccess: (value: T) => void,
): Promise<void> =>
  task.match(
    (value) => {
      onSuccess(value);
    },
    (error) => {
      printError(io, error);
      process.exitCode = 1;
    },
  );

const promptApiKey = (promptPassword: PromptPassword): ResultAsync<string, AppError> =>
  ResultAsync.fromPromise(
    promptPassword("Clockify API key"),
    (cause) =>
      ({
        code: "validation_error",
        message: "Failed to read API key input.",
        cause,
      }) as AppError,
  );

const resultToAsync = <T>(result: Result<T, AppError>): ResultAsync<T, AppError> =>
  ResultAsync.fromSafePromise(Promise.resolve()).andThen(() => result);

const loadProfile = (profileOption?: string) =>
  readConfigFile().andThen((config) => resolveProfile(config, profileOption));

const loadWorkspace = (profileOption?: string, workspaceOption?: string) =>
  readConfigFile().andThen((config) => resolveWorkspace(config, profileOption, workspaceOption));

const buildClientForProfile = (profileOption?: string) =>
  loadProfile(profileOption).andThen((profile) =>
    readApiKey(profile.name).map((apiKey) => ({
      profile,
      client: createClockifyClient({
        apiBaseUrl: profile.apiBaseUrl,
        reportsBaseUrl: profile.reportsBaseUrl,
        apiKey,
      }),
    })),
  );

const buildClientForWorkspace = (profileOption?: string, workspaceOption?: string) =>
  loadWorkspace(profileOption, workspaceOption).andThen((profile) =>
    readApiKey(profile.name).map((apiKey) => ({
      profile,
      client: createClockifyClient({
        apiBaseUrl: profile.apiBaseUrl,
        reportsBaseUrl: profile.reportsBaseUrl,
        apiKey,
      }),
    })),
  );

const printFormatted = (io: Io, value: unknown, formatOption?: string): void => {
  const format = parseOutputFormat(formatOption);
  if (format.isErr()) {
    printError(io, format.error);
    process.exitCode = 1;
    return;
  }

  io.stdout.write(formatValue(value, format.value));
};

export const createProgram = ({
  io = { stdout: process.stdout, stderr: process.stderr },
  promptPassword = (message) => password({ message, mask: "*" }),
  now = () => new Date(),
  version = packageJson.version,
}: ProgramDeps = {}): Command => {
  const program = new Command();

  program.name("clockify").description("Small Clockify CLI").version(version);

  const config = program.command("config").description("Manage local Clockify profiles");

  config
    .command("set")
    .requiredOption("--profile <profile>", "Profile name")
    .option("--api-base-url <url>", "Clockify API base URL", defaultApiBaseUrl)
    .option("--reports-base-url <url>", "Clockify reports API base URL", defaultReportsBaseUrl)
    .description("Set a Clockify profile and save its API key in macOS Keychain")
    .action(
      async (options: {
        readonly profile: string;
        readonly apiBaseUrl?: string;
        readonly reportsBaseUrl?: string;
      }) => {
        await runTask(
          io,
          resultToAsync(validateProfileName(options.profile)).andThen((profile) =>
            readConfigFile()
              .andThen((currentConfig) =>
                upsertProfile(currentConfig, profile, {
                  apiBaseUrl: options.apiBaseUrl,
                  reportsBaseUrl: options.reportsBaseUrl,
                }),
              )
              .andThen((nextConfig) => writeConfigFile(nextConfig))
              .andThen(() => promptApiKey(promptPassword))
              .andThen((apiKey) => saveApiKey(profile, apiKey))
              .map(() => ({ profile })),
          ),
          ({ profile }) => {
            io.stdout.write(`Saved profile: ${profile}\n`);
          },
        );
      },
    );

  config
    .command("list")
    .description("List Clockify profiles without showing API keys")
    .action(async () => {
      await runTask(io, readConfigFile(), (storedConfig) => {
        const lines = Object.entries(storedConfig.profiles).map(([name, profile]) => {
          const marker = storedConfig.defaultProfile === name ? "*" : " ";
          const workspace = profile.defaultWorkspaceId ?? "-";
          return `${marker} ${name}\t${profile.apiBaseUrl}\tworkspace:${workspace}`;
        });
        io.stdout.write(`${lines.join("\n")}${lines.length === 0 ? "" : "\n"}`);
      });
    });

  config
    .command("use")
    .argument("<profile>", "Profile name")
    .description("Set default profile")
    .action(async (profile: string) => {
      await runTask(
        io,
        readConfigFile()
          .andThen((storedConfig) => setDefaultProfile(storedConfig, profile))
          .andThen((nextConfig) => writeConfigFile(nextConfig).map(() => profile)),
        (savedProfile) => {
          io.stdout.write(`Using profile: ${savedProfile}\n`);
        },
      );
    });

  const auth = program.command("auth").description("Clockify authentication commands");

  auth
    .command("test")
    .option("--profile <profile>", "Profile name")
    .description("Test Clockify API credentials")
    .action(async (options: { readonly profile?: string }) => {
      await runTask(
        io,
        buildClientForProfile(options.profile).andThen(({ profile, client }) =>
          client.getCurrentUser().map(() => profile.name),
        ),
        (profile) => {
          io.stdout.write(`Authenticated: ${profile}\n`);
        },
      );
    });

  program
    .command("me")
    .option("--profile <profile>", "Profile name")
    .option("--format <format>", "Output format: json or csv", "json")
    .description("Show the currently authenticated Clockify user")
    .action(async (options: { readonly profile?: string; readonly format?: string }) => {
      await runTask(
        io,
        buildClientForProfile(options.profile).andThen(({ client }) => client.getCurrentUser()),
        (user) => {
          printFormatted(io, user, options.format);
        },
      );
    });

  const workspaces = program.command("workspaces").description("Clockify workspace commands");

  workspaces
    .command("list")
    .option("--profile <profile>", "Profile name")
    .option("--format <format>", "Output format: json or csv", "json")
    .description("List Clockify workspaces")
    .action(async (options: { readonly profile?: string; readonly format?: string }) => {
      await runTask(
        io,
        buildClientForProfile(options.profile).andThen(({ client }) => client.listWorkspaces()),
        (value) => {
          printFormatted(io, value, options.format);
        },
      );
    });

  workspaces
    .command("use")
    .argument("<workspace-id>", "Workspace id")
    .option("--profile <profile>", "Profile name")
    .description("Set default workspace for a profile")
    .action(async (workspaceId: string, options: { readonly profile?: string }) => {
      await runTask(
        io,
        readConfigFile()
          .andThen((storedConfig) => resolveProfile(storedConfig, options.profile))
          .andThen((profile) =>
            readConfigFile()
              .andThen((storedConfig) =>
                setDefaultWorkspace(storedConfig, profile.name, workspaceId),
              )
              .andThen((nextConfig) =>
                writeConfigFile(nextConfig).map(() => ({ profile, workspaceId })),
              ),
          ),
        ({ profile, workspaceId: savedWorkspaceId }) => {
          io.stdout.write(`Using workspace: ${savedWorkspaceId} (${profile.name})\n`);
        },
      );
    });

  const addPagedResourceCommand = (
    parent: Command,
    description: string,
    list: (
      client: ReturnType<typeof createClockifyClient>,
      input: { readonly workspaceId: string; readonly page: number; readonly pageSize: number },
    ) => ResultAsync<{ readonly items: readonly unknown[]; readonly lastPage: boolean }, AppError>,
  ): void => {
    parent
      .command("list")
      .option("--profile <profile>", "Profile name")
      .option("--workspace-id <id>", "Workspace id")
      .option("--page <page>", "Page number", "1")
      .option("--page-size <size>", "Page size, up to 1000", "50")
      .option("--format <format>", "Output format: json or csv", "json")
      .description(description)
      .action(async (options: ResourceListOptions) => {
        await runTask(
          io,
          resultToAsync(validateResourceListOptions(options)).andThen((validOptions) =>
            buildClientForWorkspace(validOptions.profile, validOptions.workspaceId).andThen(
              ({ profile, client }) =>
                list(client, {
                  workspaceId: profile.workspaceId,
                  page: validOptions.page,
                  pageSize: validOptions.pageSize,
                }).map((page) => ({ page, format: validOptions.format })),
            ),
          ),
          ({ page, format }) => {
            printFormatted(io, page.items, format);
          },
        );
      });
  };

  addPagedResourceCommand(
    program.command("projects").description("Clockify project commands"),
    "List Clockify projects",
    (client, input) => client.listProjects(input),
  );

  addPagedResourceCommand(
    program.command("clients").description("Clockify client commands"),
    "List Clockify clients",
    (client, input) => client.listClients(input),
  );

  addPagedResourceCommand(
    program.command("tags").description("Clockify tag commands"),
    "List Clockify tags",
    (client, input) => client.listTags(input),
  );

  const tasks = program.command("tasks").description("Clockify task commands");

  tasks
    .command("list")
    .requiredOption("--project-id <id>", "Project id")
    .option("--profile <profile>", "Profile name")
    .option("--workspace-id <id>", "Workspace id")
    .option("--page <page>", "Page number", "1")
    .option("--page-size <size>", "Page size, up to 1000", "50")
    .option("--format <format>", "Output format: json or csv", "json")
    .description("List Clockify tasks")
    .action(async (options: TaskListOptions) => {
      await runTask(
        io,
        resultToAsync(validateTaskListOptions(options)).andThen((validOptions) =>
          buildClientForWorkspace(validOptions.profile, validOptions.workspaceId).andThen(
            ({ profile, client }) =>
              client
                .listTasks({
                  workspaceId: profile.workspaceId,
                  projectId: validOptions.projectId,
                  page: validOptions.page,
                  pageSize: validOptions.pageSize,
                })
                .map((page) => ({ page, format: validOptions.format })),
          ),
        ),
        ({ page, format }) => {
          printFormatted(io, page.items, format);
        },
      );
    });

  const timeEntries = program.command("time-entries").description("Clockify time entry commands");

  timeEntries
    .command("list")
    .option("--profile <profile>", "Profile name")
    .option("--workspace-id <id>", "Workspace id")
    .option("--user-id <id>", "User id; defaults to the authenticated user")
    .option("--from <iso>", "Start ISO date-time")
    .option("--to <iso>", "End ISO date-time")
    .option("--page <page>", "Page number", "1")
    .option("--page-size <size>", "Page size, up to 1000", "50")
    .option("--format <format>", "Output format: json or csv", "json")
    .description("List Clockify time entries")
    .action(async (options: TimeEntriesListOptions) => {
      await runTask(
        io,
        resultToAsync(validateTimeEntriesListOptions(options)).andThen((validOptions) =>
          buildClientForWorkspace(validOptions.profile, validOptions.workspaceId).andThen(
            ({ profile, client }) => {
              const userTask =
                validOptions.userId == null
                  ? client.getCurrentUser().map((user) => user.id)
                  : ResultAsync.fromSafePromise(Promise.resolve(validOptions.userId));

              return userTask.andThen((userId) =>
                client
                  .listTimeEntries({
                    workspaceId: profile.workspaceId,
                    userId,
                    start: validOptions.start,
                    end: validOptions.end,
                    page: validOptions.page,
                    pageSize: validOptions.pageSize,
                  })
                  .map((page) => ({ page, format: validOptions.format })),
              );
            },
          ),
        ),
        ({ page, format }) => {
          printFormatted(io, page.items, format);
        },
      );
    });

  const timer = program.command("timer").description("Clockify timer commands");

  timer
    .command("current")
    .option("--profile <profile>", "Profile name")
    .option("--workspace-id <id>", "Workspace id")
    .option("--page <page>", "Page number", "1")
    .option("--page-size <size>", "Page size, up to 1000", "50")
    .option("--format <format>", "Output format: json or csv", "json")
    .description("List running timers in a workspace")
    .action(async (options: ResourceListOptions) => {
      await runTask(
        io,
        resultToAsync(validateResourceListOptions(options)).andThen((validOptions) =>
          buildClientForWorkspace(validOptions.profile, validOptions.workspaceId).andThen(
            ({ profile, client }) =>
              client
                .listInProgressTimeEntries({
                  workspaceId: profile.workspaceId,
                  page: validOptions.page,
                  pageSize: validOptions.pageSize,
                })
                .map((page) => ({ page, format: validOptions.format })),
          ),
        ),
        ({ page, format }) => {
          printFormatted(io, page.items, format);
        },
      );
    });

  timer
    .command("start")
    .requiredOption("--description <text>", "Time entry description")
    .option("--project-id <id>", "Project id")
    .option("--task-id <id>", "Task id")
    .option("--tag-id <id>", "Tag id", (value, previous: string[]) => [...previous, value], [])
    .option("--billable", "Mark the time entry as billable")
    .option("--profile <profile>", "Profile name")
    .option("--workspace-id <id>", "Workspace id")
    .description("Start a Clockify timer")
    .action(async (options: TimerStartOptions) => {
      await runTask(
        io,
        resultToAsync(validateTimerStartOptions(options)).andThen((validOptions) =>
          buildClientForWorkspace(validOptions.profile, validOptions.workspaceId).andThen(
            ({ profile, client }) =>
              client.startTimer({
                workspaceId: profile.workspaceId,
                start: now().toISOString(),
                description: validOptions.description,
                projectId: validOptions.projectId,
                taskId: validOptions.taskId,
                tagIds: validOptions.tagIds,
                billable: validOptions.billable,
              }),
          ),
        ),
        (entry) => {
          printFormatted(io, entry, "json");
        },
      );
    });

  timer
    .command("stop")
    .option("--end <iso>", "End ISO date-time; defaults to now")
    .option("--user-id <id>", "User id; defaults to the authenticated user")
    .option("--profile <profile>", "Profile name")
    .option("--workspace-id <id>", "Workspace id")
    .description("Stop the current Clockify timer")
    .action(async (options: TimerStopOptions) => {
      await runTask(
        io,
        resultToAsync(validateTimerStopOptions(options)).andThen((validOptions) =>
          buildClientForWorkspace(validOptions.profile, validOptions.workspaceId).andThen(
            ({ profile, client }) => {
              const userTask =
                validOptions.userId == null
                  ? client.getCurrentUser().map((user) => user.id)
                  : ResultAsync.fromSafePromise(Promise.resolve(validOptions.userId));

              return userTask.andThen((userId) =>
                client.stopTimer({
                  workspaceId: profile.workspaceId,
                  userId,
                  end: validOptions.end ?? now().toISOString(),
                }),
              );
            },
          ),
        ),
        (entry) => {
          printFormatted(io, entry, "json");
        },
      );
    });

  return program;
};
