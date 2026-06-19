import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Io } from "../../src/cli/program.js";

const configStoreMocks = vi.hoisted(() => ({
  readConfigFile: vi.fn(),
  writeConfigFile: vi.fn(),
}));

const keychainMocks = vi.hoisted(() => ({
  readApiKey: vi.fn(),
  saveApiKey: vi.fn(),
}));

const clockifyMocks = vi.hoisted(() => {
  const client = {
    getCurrentUser: vi.fn(),
    listWorkspaces: vi.fn(),
    listProjects: vi.fn(),
    listClients: vi.fn(),
    listTags: vi.fn(),
    listTasks: vi.fn(),
    listTimeEntries: vi.fn(),
    listInProgressTimeEntries: vi.fn(),
    startTimer: vi.fn(),
    stopTimer: vi.fn(),
  };

  return {
    client,
    createClockifyClient: vi.fn(() => client),
  };
});

vi.mock("../../src/config/config-store.js", () => configStoreMocks);
vi.mock("../../src/keychain/keychain.js", () => keychainMocks);
vi.mock("../../src/clockify/client.js", () => ({
  createClockifyClient: clockifyMocks.createClockifyClient,
}));

const okAsync = async <T>(value: T) => {
  const { ResultAsync } = await import("neverthrow");

  return ResultAsync.fromSafePromise(Promise.resolve(value));
};

const errAsync = async (message: string, code = "clockify_http_error" as const) => {
  const { ResultAsync } = await import("neverthrow");

  return ResultAsync.fromPromise(Promise.reject(new Error(message)), () => ({
    code,
    message,
  }));
};

const storedConfig = {
  defaultProfile: "default",
  profiles: {
    default: {
      apiBaseUrl: "https://api.clockify.me/api/v1",
      reportsBaseUrl: "https://reports.api.clockify.me/v1",
      defaultWorkspaceId: "w1",
    },
  },
};

const createTestIo = (): {
  readonly io: Io;
  readonly stdout: () => string;
  readonly stderr: () => string;
} => {
  let stdout = "";
  let stderr = "";

  return {
    io: {
      stdout: {
        write: (chunk: string) => {
          stdout += chunk;
          return true;
        },
      },
      stderr: {
        write: (chunk: string) => {
          stderr += chunk;
          return true;
        },
      },
    },
    stdout: () => stdout,
    stderr: () => stderr,
  };
};

describe("CLI program", () => {
  beforeEach(async () => {
    process.exitCode = undefined;
    vi.clearAllMocks();
    configStoreMocks.readConfigFile.mockReturnValue(await okAsync(storedConfig));
    configStoreMocks.writeConfigFile.mockReturnValue(await okAsync(undefined));
    keychainMocks.readApiKey.mockReturnValue(await okAsync("key"));
    keychainMocks.saveApiKey.mockReturnValue(await okAsync(undefined));
    clockifyMocks.createClockifyClient.mockReturnValue(clockifyMocks.client);
    clockifyMocks.client.getCurrentUser.mockReturnValue(await okAsync({ id: "u1" }));
    clockifyMocks.client.listWorkspaces.mockReturnValue(
      await okAsync([{ id: "w1", name: "Main" }]),
    );
    clockifyMocks.client.listProjects.mockReturnValue(
      await okAsync({ items: [{ id: "p1", name: "Project" }], lastPage: true }),
    );
    clockifyMocks.client.listClients.mockReturnValue(
      await okAsync({ items: [{ id: "c1", name: "Client" }], lastPage: true }),
    );
    clockifyMocks.client.listTags.mockReturnValue(
      await okAsync({ items: [{ id: "tag1", name: "Tag" }], lastPage: true }),
    );
    clockifyMocks.client.listTasks.mockReturnValue(
      await okAsync({ items: [{ id: "task1", name: "Task" }], lastPage: true }),
    );
    clockifyMocks.client.listTimeEntries.mockReturnValue(
      await okAsync({ items: [{ id: "te1" }], lastPage: true }),
    );
    clockifyMocks.client.listInProgressTimeEntries.mockReturnValue(
      await okAsync({ items: [{ id: "te2" }], lastPage: true }),
    );
    clockifyMocks.client.startTimer.mockReturnValue(await okAsync({ id: "start1" }));
    clockifyMocks.client.stopTimer.mockReturnValue(await okAsync({ id: "stop1" }));
  });

  afterEach(() => {
    process.exitCode = undefined;
  });

  it("sets a profile and saves the API key", async () => {
    const { createProgram } = await import("../../src/cli/program.js");
    const { io, stdout, stderr } = createTestIo();
    const promptPassword = vi.fn().mockResolvedValue("new-key");

    await createProgram({ io, promptPassword }).parseAsync([
      "node",
      "clockify",
      "config",
      "set",
      "--profile",
      "new",
      "--api-base-url",
      "https://example.com/api/v1/",
    ]);

    expect(stderr()).toBe("");
    expect(configStoreMocks.writeConfigFile).toHaveBeenCalledWith({
      defaultProfile: "default",
      profiles: {
        ...storedConfig.profiles,
        new: {
          apiBaseUrl: "https://example.com/api/v1",
          reportsBaseUrl: "https://reports.api.clockify.me/v1",
          defaultWorkspaceId: undefined,
        },
      },
    });
    expect(promptPassword).toHaveBeenCalledWith("Clockify API key");
    expect(keychainMocks.saveApiKey).toHaveBeenCalledWith("new", "new-key");
    expect(stdout()).toBe("Saved profile: new\n");
  });

  it("lists and switches profiles", async () => {
    const { createProgram } = await import("../../src/cli/program.js");
    const { io, stdout } = createTestIo();

    await createProgram({ io }).parseAsync(["node", "clockify", "config", "list"]);
    await createProgram({ io }).parseAsync(["node", "clockify", "config", "use", "default"]);

    expect(stdout()).toContain("* default\thttps://api.clockify.me/api/v1\tworkspace:w1\n");
    expect(stdout()).toContain("Using profile: default\n");
  });

  it("tests auth and prints me", async () => {
    const { createProgram } = await import("../../src/cli/program.js");
    const { io, stdout, stderr } = createTestIo();

    await createProgram({ io }).parseAsync(["node", "clockify", "auth", "test"]);
    await createProgram({ io }).parseAsync(["node", "clockify", "me", "--format", "csv"]);

    expect(stderr()).toBe("");
    expect(stdout()).toContain("Authenticated: default\n");
    expect(stdout()).toContain("id\nu1\n");
  });

  it("lists workspaces and workspace resources", async () => {
    const { createProgram } = await import("../../src/cli/program.js");
    const { io, stdout } = createTestIo();
    const program = createProgram({ io });

    await program.parseAsync(["node", "clockify", "workspaces", "list", "--format", "csv"]);
    await program.parseAsync(["node", "clockify", "projects", "list"]);
    await program.parseAsync(["node", "clockify", "clients", "list"]);
    await program.parseAsync(["node", "clockify", "tags", "list"]);
    await program.parseAsync(["node", "clockify", "tasks", "list", "--project-id", "p1"]);

    expect(stdout()).toContain("id,name\nw1,Main\n");
    expect(stdout()).toContain('"name": "Project"');
    expect(clockifyMocks.client.listTasks).toHaveBeenCalledWith({
      workspaceId: "w1",
      projectId: "p1",
      page: 1,
      pageSize: 50,
    });
  });

  it("sets default workspace", async () => {
    const { createProgram } = await import("../../src/cli/program.js");
    const { io, stdout } = createTestIo();

    await createProgram({ io }).parseAsync(["node", "clockify", "workspaces", "use", "w2"]);

    expect(configStoreMocks.writeConfigFile).toHaveBeenCalledWith({
      ...storedConfig,
      profiles: {
        default: {
          ...storedConfig.profiles.default,
          defaultWorkspaceId: "w2",
        },
      },
    });
    expect(stdout()).toBe("Using workspace: w2 (default)\n");
  });

  it("lists time entries using current user fallback", async () => {
    const { createProgram } = await import("../../src/cli/program.js");
    const { io } = createTestIo();

    await createProgram({ io }).parseAsync([
      "node",
      "clockify",
      "time-entries",
      "list",
      "--from",
      "2026-06-19T00:00:00.000Z",
    ]);

    expect(clockifyMocks.client.getCurrentUser).toHaveBeenCalled();
    expect(clockifyMocks.client.listTimeEntries).toHaveBeenCalledWith({
      workspaceId: "w1",
      userId: "u1",
      start: "2026-06-19T00:00:00.000Z",
      end: undefined,
      page: 1,
      pageSize: 50,
    });
  });

  it("starts and stops timers", async () => {
    const { createProgram } = await import("../../src/cli/program.js");
    const { io, stdout } = createTestIo();
    const now = () => new Date("2026-06-19T00:00:00.000Z");

    await createProgram({ io, now }).parseAsync([
      "node",
      "clockify",
      "timer",
      "start",
      "--description",
      "Work",
      "--tag-id",
      "tag1",
      "--billable",
    ]);
    await createProgram({ io, now }).parseAsync(["node", "clockify", "timer", "stop"]);

    expect(clockifyMocks.client.startTimer).toHaveBeenCalledWith({
      workspaceId: "w1",
      start: "2026-06-19T00:00:00.000Z",
      description: "Work",
      projectId: undefined,
      taskId: undefined,
      tagIds: ["tag1"],
      billable: true,
    });
    expect(clockifyMocks.client.stopTimer).toHaveBeenCalledWith({
      workspaceId: "w1",
      userId: "u1",
      end: "2026-06-19T00:00:00.000Z",
    });
    expect(stdout()).toContain('"id": "start1"');
    expect(stdout()).toContain('"id": "stop1"');
  });

  it("prints errors and sets exit code", async () => {
    const { createProgram } = await import("../../src/cli/program.js");
    const { io, stderr } = createTestIo();
    configStoreMocks.readConfigFile.mockReturnValue(
      await errAsync("broken config", "config_invalid"),
    );

    await createProgram({ io }).parseAsync(["node", "clockify", "auth", "test"]);

    expect(process.exitCode).toBe(1);
    expect(stderr()).toBe("clockify: broken config\n");
  });
});
