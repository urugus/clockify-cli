import { describe, expect, it } from "vitest";
import {
  buildProfileConfig,
  defaultApiBaseUrl,
  defaultReportsBaseUrl,
  emptyConfig,
  normalizeBaseUrl,
  parseConfigText,
  resolveProfile,
  resolveWorkspace,
  serializeConfig,
  setDefaultProfile,
  setDefaultWorkspace,
  upsertProfile,
  validateProfileName,
  validateWorkspaceId,
} from "../../src/config/config.js";

const config = {
  defaultProfile: "default",
  profiles: {
    default: {
      apiBaseUrl: "https://api.clockify.me/api/v1",
      reportsBaseUrl: "https://reports.api.clockify.me/v1",
      defaultWorkspaceId: "workspace-1",
    },
  },
};

describe("config", () => {
  it("creates empty config", () => {
    expect(emptyConfig()).toEqual({ profiles: {} });
  });

  it("normalizes base URLs", () => {
    expect(normalizeBaseUrl("https://example.com/path/").value).toBe("https://example.com/path");
  });

  it("rejects invalid base URLs", () => {
    expect(normalizeBaseUrl("", "API base URL")._unsafeUnwrapErr().message).toBe(
      "API base URL is required.",
    );
    expect(normalizeBaseUrl("ftp://example.com", "API base URL")._unsafeUnwrapErr().message).toBe(
      "API base URL must start with http:// or https://.",
    );
    expect(normalizeBaseUrl("not url", "API base URL")._unsafeUnwrapErr().message).toBe(
      "API base URL is invalid.",
    );
  });

  it("parses and serializes config", () => {
    const text = serializeConfig(config);
    expect(parseConfigText(text).value).toEqual(config);
  });

  it("rejects invalid config text and shape", () => {
    expect(parseConfigText("{")._unsafeUnwrapErr().code).toBe("config_invalid");
    expect(parseConfigText("{}")._unsafeUnwrapErr().message).toBe("Config file format is invalid.");
  });

  it("validates profile names", () => {
    expect(validateProfileName(" default ").value).toBe("default");
    expect(validateProfileName(" ")._unsafeUnwrapErr().message).toBe("Profile name is required.");
    expect(validateProfileName("__proto__").isErr()).toBe(true);
  });

  it("validates workspace ids", () => {
    expect(validateWorkspaceId(" w1 ").value).toBe("w1");
    expect(validateWorkspaceId(" ")._unsafeUnwrapErr().message).toBe("Workspace id is required.");
  });

  it("builds profile config with defaults", () => {
    expect(buildProfileConfig({}).value).toEqual({
      apiBaseUrl: defaultApiBaseUrl,
      reportsBaseUrl: defaultReportsBaseUrl,
      defaultWorkspaceId: undefined,
    });
  });

  it("upserts profiles and preserves default workspace", () => {
    const result = upsertProfile(config, "default", {
      apiBaseUrl: "https://new.example.com/api/",
    });

    expect(result.value.profiles.default).toEqual({
      apiBaseUrl: "https://new.example.com/api",
      reportsBaseUrl: defaultReportsBaseUrl,
      defaultWorkspaceId: "workspace-1",
    });
  });

  it("sets the first upserted profile as default", () => {
    const result = upsertProfile(emptyConfig(), "default", {});

    expect(result.value.defaultProfile).toBe("default");
  });

  it("sets default profile", () => {
    expect(setDefaultProfile(config, "default").value.defaultProfile).toBe("default");
    expect(setDefaultProfile(config, "missing")._unsafeUnwrapErr().message).toBe(
      "Profile not found: missing",
    );
  });

  it("sets default workspace", () => {
    expect(setDefaultWorkspace(config, "default", "workspace-2").value.profiles.default).toEqual({
      ...config.profiles.default,
      defaultWorkspaceId: "workspace-2",
    });
    expect(setDefaultWorkspace(config, "missing", "workspace-2")._unsafeUnwrapErr().message).toBe(
      "Profile not found: missing",
    );
  });

  it("resolves profiles and workspaces", () => {
    expect(resolveProfile(config).value.name).toBe("default");
    expect(resolveWorkspace(config).value.workspaceId).toBe("workspace-1");
    expect(resolveWorkspace(config, "default", "workspace-2").value.workspaceId).toBe(
      "workspace-2",
    );
  });

  it("rejects missing profiles and workspaces", () => {
    expect(resolveProfile(emptyConfig())._unsafeUnwrapErr().message).toBe(
      "Profile is not specified and no default profile is set.",
    );
    expect(resolveProfile(config, "missing")._unsafeUnwrapErr().message).toBe(
      "Profile not found: missing",
    );
    expect(
      resolveWorkspace(
        {
          defaultProfile: "default",
          profiles: {
            default: {
              apiBaseUrl: defaultApiBaseUrl,
              reportsBaseUrl: defaultReportsBaseUrl,
            },
          },
        },
        undefined,
        undefined,
      )._unsafeUnwrapErr().message,
    ).toBe("Workspace id is not specified and no default workspace is set.");
  });
});
