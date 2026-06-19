import { createRequire } from "node:module";
import { password } from "@inquirer/prompts";
import { Command } from "commander";
import { type Result, ResultAsync } from "neverthrow";
import { createClockifyClient } from "../clockify/client.js";
import { buildProjectUpdatePayload, buildTimeEntryUpdatePayload } from "../clockify/payloads.js";
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
  type ProjectCreateOptions,
  type ProjectCustomFieldUpdateOptions,
  type ProjectListOptions,
  type ProjectUpdateOptions,
  type ResourceListOptions,
  type TaskListOptions,
  type TimeEntriesListOptions,
  type TimeEntryCreateOptions,
  type TimeEntryDeleteOptions,
  type TimeEntryUpdateOptions,
  type TimerStartOptions,
  type TimerStopOptions,
  type UserGroupListOptions,
  type UserGroupMembershipOptions,
  type UserInviteOptions,
  type UsersListOptions,
  validateProjectCreateOptions,
  validateProjectCustomFieldUpdateOptions,
  validateProjectListOptions,
  validateProjectUpdateOptions,
  validateResourceListOptions,
  validateTaskListOptions,
  validateTimeEntriesListOptions,
  validateTimeEntryCreateOptions,
  validateTimeEntryDeleteOptions,
  validateTimeEntryUpdateOptions,
  validateTimerStartOptions,
  validateTimerStopOptions,
  validateUserGroupListOptions,
  validateUserGroupMembershipOptions,
  validateUserInviteOptions,
  validateUsersListOptions,
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

  const projects = program.command("projects").description("Clockify project commands");

  projects
    .command("list")
    .option("--name <query>", "Project name search query")
    .option("--strict-name-search", "Match the project name exactly")
    .option("--profile <profile>", "Profile name")
    .option("--workspace-id <id>", "Workspace id")
    .option("--page <page>", "Page number", "1")
    .option("--page-size <size>", "Page size, up to 1000", "50")
    .option("--format <format>", "Output format: json or csv", "json")
    .description("List Clockify projects")
    .action(async (options: ProjectListOptions) => {
      await runTask(
        io,
        resultToAsync(validateProjectListOptions(options)).andThen((validOptions) =>
          buildClientForWorkspace(validOptions.profile, validOptions.workspaceId).andThen(
            ({ profile, client }) =>
              client
                .listProjects({
                  workspaceId: profile.workspaceId,
                  page: validOptions.page,
                  pageSize: validOptions.pageSize,
                  name: validOptions.name,
                  strictNameSearch: validOptions.strictNameSearch,
                })
                .map((page) => ({ page, format: validOptions.format })),
          ),
        ),
        ({ page, format }) => {
          printFormatted(io, page.items, format);
        },
      );
    });

  projects
    .command("create")
    .requiredOption("--name <name>", "Project name")
    .requiredOption("--client-id <id>", "Client id")
    .option("--color <hex>", "Project color as #RRGGBB")
    .option("--billable", "Create the project as billable")
    .option("--no-billable", "Create the project as non-billable")
    .option("--public", "Create the project as public")
    .option("--no-public", "Create the project as private")
    .option("--profile <profile>", "Profile name")
    .option("--workspace-id <id>", "Workspace id")
    .option("--format <format>", "Output format: json or csv", "json")
    .description("Create a Clockify project")
    .action(async (options: ProjectCreateOptions) => {
      await runTask(
        io,
        resultToAsync(validateProjectCreateOptions(options)).andThen((validOptions) =>
          buildClientForWorkspace(validOptions.profile, validOptions.workspaceId).andThen(
            ({ profile, client }) =>
              client
                .createProject({
                  workspaceId: profile.workspaceId,
                  name: validOptions.name,
                  clientId: validOptions.clientId,
                  color: validOptions.color,
                  billable: validOptions.billable,
                  public: validOptions.public,
                })
                .map((project) => ({ project, format: validOptions.format })),
          ),
        ),
        ({ project, format }) => {
          printFormatted(io, project, format);
        },
      );
    });

  projects
    .command("update")
    .argument("<project-id>", "Project id")
    .option("--name <name>", "Project name")
    .option("--client-id <id>", "Client id")
    .option("--color <hex>", "Project color as #RRGGBB")
    .option("--archived", "Archive the project")
    .option("--no-archived", "Unarchive the project")
    .option("--billable", "Mark the project as billable")
    .option("--no-billable", "Mark the project as non-billable")
    .option("--public", "Mark the project as public")
    .option("--no-public", "Mark the project as private")
    .option("--note <text>", "Project note")
    .option("--profile <profile>", "Profile name")
    .option("--workspace-id <id>", "Workspace id")
    .option("--format <format>", "Output format: json or csv", "json")
    .description("Update a Clockify project")
    .action(async (projectId: string, options: Omit<ProjectUpdateOptions, "projectId">) => {
      await runTask(
        io,
        resultToAsync(validateProjectUpdateOptions({ ...options, projectId })).andThen(
          (validOptions) =>
            buildClientForWorkspace(validOptions.profile, validOptions.workspaceId).andThen(
              ({ profile, client }) =>
                client
                  .getProject({
                    workspaceId: profile.workspaceId,
                    projectId: validOptions.projectId,
                  })
                  .andThen((current) =>
                    client.updateProject({
                      workspaceId: profile.workspaceId,
                      projectId: validOptions.projectId,
                      ...buildProjectUpdatePayload(current, {
                        name: validOptions.name,
                        clientId: validOptions.clientId,
                        color: validOptions.color,
                        archived: validOptions.archived,
                        billable: validOptions.billable,
                        public: validOptions.public,
                        note: validOptions.note,
                      }),
                    }),
                  )
                  .map((project) => ({ project, format: validOptions.format })),
            ),
        ),
        ({ project, format }) => {
          printFormatted(io, project, format);
        },
      );
    });

  const projectCustomFields = projects
    .command("custom-fields")
    .description("Clockify project custom field commands");

  projectCustomFields
    .command("update")
    .argument("<project-id>", "Project id")
    .argument("<custom-field-id>", "Custom field id")
    .option("--default-value <json>", "Default value as JSON")
    .option("--status <status>", "Status: INACTIVE, VISIBLE, or INVISIBLE")
    .option("--profile <profile>", "Profile name")
    .option("--workspace-id <id>", "Workspace id")
    .option("--format <format>", "Output format: json or csv", "json")
    .description("Update a custom field on a Clockify project")
    .action(
      async (
        projectId: string,
        customFieldId: string,
        options: Omit<ProjectCustomFieldUpdateOptions, "projectId" | "customFieldId">,
      ) => {
        await runTask(
          io,
          resultToAsync(
            validateProjectCustomFieldUpdateOptions({ ...options, projectId, customFieldId }),
          ).andThen((validOptions) =>
            buildClientForWorkspace(validOptions.profile, validOptions.workspaceId).andThen(
              ({ profile, client }) =>
                client
                  .updateProjectCustomField({
                    workspaceId: profile.workspaceId,
                    projectId: validOptions.projectId,
                    customFieldId: validOptions.customFieldId,
                    defaultValue: validOptions.defaultValue,
                    status: validOptions.status,
                  })
                  .map((customField) => ({ customField, format: validOptions.format })),
            ),
          ),
          ({ customField, format }) => {
            printFormatted(io, customField, format);
          },
        );
      },
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
    .command("create")
    .requiredOption("--start <iso>", "Start ISO date-time")
    .requiredOption("--end <iso>", "End ISO date-time")
    .requiredOption("--description <text>", "Time entry description")
    .requiredOption("--project-id <id>", "Project id")
    .option("--task-id <id>", "Task id")
    .option("--tag-id <id>", "Tag id", (value, previous: string[]) => [...previous, value], [])
    .option("--billable", "Mark the time entry as billable")
    .option("--no-billable", "Mark the time entry as non-billable")
    .option("--user-id <id>", "User id for creating an entry for another user")
    .option("--profile <profile>", "Profile name")
    .option("--workspace-id <id>", "Workspace id")
    .option("--format <format>", "Output format: json or csv", "json")
    .description("Create a Clockify time entry")
    .action(async (options: TimeEntryCreateOptions) => {
      await runTask(
        io,
        resultToAsync(validateTimeEntryCreateOptions(options)).andThen((validOptions) =>
          buildClientForWorkspace(validOptions.profile, validOptions.workspaceId).andThen(
            ({ profile, client }) =>
              client
                .createTimeEntry({
                  workspaceId: profile.workspaceId,
                  userId: validOptions.userId,
                  start: validOptions.start,
                  end: validOptions.end,
                  description: validOptions.description,
                  projectId: validOptions.projectId,
                  taskId: validOptions.taskId,
                  tagIds: validOptions.tagIds,
                  billable: validOptions.billable,
                })
                .map((entry) => ({ entry, format: validOptions.format })),
          ),
        ),
        ({ entry, format }) => {
          printFormatted(io, entry, format);
        },
      );
    });

  timeEntries
    .command("update")
    .argument("<time-entry-id>", "Time entry id")
    .requiredOption("--start <iso>", "Start ISO date-time")
    .requiredOption("--end <iso>", "End ISO date-time")
    .requiredOption("--description <text>", "Time entry description")
    .requiredOption("--project-id <id>", "Project id")
    .option("--task-id <id>", "Task id")
    .option("--tag-id <id>", "Tag id", (value, previous: string[]) => [...previous, value], [])
    .option("--clear-tags", "Clear all tags")
    .option("--billable", "Mark the time entry as billable")
    .option("--no-billable", "Mark the time entry as non-billable")
    .option("--profile <profile>", "Profile name")
    .option("--workspace-id <id>", "Workspace id")
    .option("--format <format>", "Output format: json or csv", "json")
    .description("Update a Clockify time entry")
    .action(async (timeEntryId: string, options: Omit<TimeEntryUpdateOptions, "timeEntryId">) => {
      await runTask(
        io,
        resultToAsync(validateTimeEntryUpdateOptions({ ...options, timeEntryId })).andThen(
          (validOptions) =>
            buildClientForWorkspace(validOptions.profile, validOptions.workspaceId).andThen(
              ({ profile, client }) =>
                client
                  .getTimeEntry({
                    workspaceId: profile.workspaceId,
                    timeEntryId: validOptions.timeEntryId,
                  })
                  .andThen((current) =>
                    client.updateTimeEntry({
                      workspaceId: profile.workspaceId,
                      timeEntryId: validOptions.timeEntryId,
                      ...buildTimeEntryUpdatePayload(current, {
                        start: validOptions.start,
                        end: validOptions.end,
                        description: validOptions.description,
                        projectId: validOptions.projectId,
                        taskId: validOptions.taskId,
                        tagIds: validOptions.tagIds,
                        clearTags: validOptions.clearTags,
                        billable: validOptions.billable,
                      }),
                    }),
                  )
                  .map((entry) => ({ entry, format: validOptions.format })),
            ),
        ),
        ({ entry, format }) => {
          printFormatted(io, entry, format);
        },
      );
    });

  timeEntries
    .command("delete")
    .argument("<time-entry-id>", "Time entry id")
    .option("--profile <profile>", "Profile name")
    .option("--workspace-id <id>", "Workspace id")
    .description("Delete a Clockify time entry")
    .action(async (timeEntryId: string, options: Omit<TimeEntryDeleteOptions, "timeEntryId">) => {
      await runTask(
        io,
        resultToAsync(validateTimeEntryDeleteOptions({ ...options, timeEntryId })).andThen(
          (validOptions) =>
            buildClientForWorkspace(validOptions.profile, validOptions.workspaceId).andThen(
              ({ profile, client }) =>
                client.deleteTimeEntry({
                  workspaceId: profile.workspaceId,
                  timeEntryId: validOptions.timeEntryId,
                }),
            ),
        ),
        (result) => {
          printFormatted(io, result, "json");
        },
      );
    });

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

  const userGroups = program.command("user-groups").description("Clockify user group commands");

  userGroups
    .command("list")
    .option("--include-team-managers", "Include team manager data")
    .option("--profile <profile>", "Profile name")
    .option("--workspace-id <id>", "Workspace id")
    .option("--page <page>", "Page number", "1")
    .option("--page-size <size>", "Page size, up to 1000", "50")
    .option("--format <format>", "Output format: json or csv", "json")
    .description("List Clockify user groups")
    .action(async (options: UserGroupListOptions) => {
      await runTask(
        io,
        resultToAsync(validateUserGroupListOptions(options)).andThen((validOptions) =>
          buildClientForWorkspace(validOptions.profile, validOptions.workspaceId).andThen(
            ({ profile, client }) =>
              client
                .listUserGroups({
                  workspaceId: profile.workspaceId,
                  page: validOptions.page,
                  pageSize: validOptions.pageSize,
                  includeTeamManagers: validOptions.includeTeamManagers,
                })
                .map((page) => ({ page, format: validOptions.format })),
          ),
        ),
        ({ page, format }) => {
          printFormatted(io, page.items, format);
        },
      );
    });

  userGroups
    .command("add-user")
    .argument("<group-id>", "User group id")
    .argument("<user-id>", "User id")
    .option("--profile <profile>", "Profile name")
    .option("--workspace-id <id>", "Workspace id")
    .option("--format <format>", "Output format: json or csv", "json")
    .description("Add a user to a Clockify user group")
    .action(
      async (
        groupId: string,
        userId: string,
        options: Omit<UserGroupMembershipOptions, "groupId" | "userId">,
      ) => {
        await runTask(
          io,
          resultToAsync(
            validateUserGroupMembershipOptions({ ...options, groupId, userId }),
          ).andThen((validOptions) =>
            buildClientForWorkspace(validOptions.profile, validOptions.workspaceId).andThen(
              ({ profile, client }) =>
                client
                  .addUserToGroup({
                    workspaceId: profile.workspaceId,
                    groupId: validOptions.groupId,
                    userId: validOptions.userId,
                  })
                  .map((group) => ({ group, format: validOptions.format })),
            ),
          ),
          ({ group, format }) => {
            printFormatted(io, group, format);
          },
        );
      },
    );

  userGroups
    .command("remove-user")
    .argument("<group-id>", "User group id")
    .argument("<user-id>", "User id")
    .option("--profile <profile>", "Profile name")
    .option("--workspace-id <id>", "Workspace id")
    .option("--format <format>", "Output format: json or csv", "json")
    .description("Remove a user from a Clockify user group")
    .action(
      async (
        groupId: string,
        userId: string,
        options: Omit<UserGroupMembershipOptions, "groupId" | "userId">,
      ) => {
        await runTask(
          io,
          resultToAsync(
            validateUserGroupMembershipOptions({ ...options, groupId, userId }),
          ).andThen((validOptions) =>
            buildClientForWorkspace(validOptions.profile, validOptions.workspaceId).andThen(
              ({ profile, client }) =>
                client
                  .removeUserFromGroup({
                    workspaceId: profile.workspaceId,
                    groupId: validOptions.groupId,
                    userId: validOptions.userId,
                  })
                  .map((group) => ({ group, format: validOptions.format })),
            ),
          ),
          ({ group, format }) => {
            printFormatted(io, group, format);
          },
        );
      },
    );

  const users = program.command("users").description("Clockify workspace user commands");

  users
    .command("list")
    .option("--email <email>", "Filter by email")
    .option("--profile <profile>", "Profile name")
    .option("--workspace-id <id>", "Workspace id")
    .option("--page <page>", "Page number", "1")
    .option("--page-size <size>", "Page size, up to 1000", "50")
    .option("--format <format>", "Output format: json or csv", "json")
    .description("List Clockify workspace users")
    .action(async (options: UsersListOptions) => {
      await runTask(
        io,
        resultToAsync(validateUsersListOptions(options)).andThen((validOptions) =>
          buildClientForWorkspace(validOptions.profile, validOptions.workspaceId).andThen(
            ({ profile, client }) =>
              client
                .listUsers({
                  workspaceId: profile.workspaceId,
                  page: validOptions.page,
                  pageSize: validOptions.pageSize,
                  email: validOptions.email,
                })
                .map((page) => ({ page, format: validOptions.format })),
          ),
        ),
        ({ page, format }) => {
          printFormatted(io, page.items, format);
        },
      );
    });

  users
    .command("invite")
    .argument("<email>", "Email address")
    .option("--send-email", "Send the invitation email")
    .option("--no-send-email", "Do not send the invitation email")
    .option("--profile <profile>", "Profile name")
    .option("--workspace-id <id>", "Workspace id")
    .option("--format <format>", "Output format: json or csv", "json")
    .description("Invite a user to a Clockify workspace")
    .action(async (email: string, options: Omit<UserInviteOptions, "email">) => {
      await runTask(
        io,
        resultToAsync(validateUserInviteOptions({ ...options, email })).andThen((validOptions) =>
          buildClientForWorkspace(validOptions.profile, validOptions.workspaceId).andThen(
            ({ profile, client }) =>
              client
                .inviteUser({
                  workspaceId: profile.workspaceId,
                  email: validOptions.email,
                  sendEmail: validOptions.sendEmail,
                })
                .map((user) => ({ user, format: validOptions.format })),
          ),
        ),
        ({ user, format }) => {
          printFormatted(io, user, format);
        },
      );
    });

  return program;
};
