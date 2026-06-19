import { err, ok, type Result } from "neverthrow";
import { z } from "zod";
import { type AppError, appError } from "../errors/app-error.js";
import { parseJson } from "../lib/result.js";

export const defaultApiBaseUrl = "https://api.clockify.me/api/v1";
export const defaultReportsBaseUrl = "https://reports.api.clockify.me/v1";

export type ProfileConfig = {
  readonly apiBaseUrl: string;
  readonly reportsBaseUrl: string;
  readonly defaultWorkspaceId?: string;
};

export type CliConfig = {
  readonly defaultProfile?: string;
  readonly profiles: Readonly<Record<string, ProfileConfig>>;
};

export type ResolvedProfile = {
  readonly name: string;
  readonly apiBaseUrl: string;
  readonly reportsBaseUrl: string;
  readonly defaultWorkspaceId?: string;
};

export type ResolvedWorkspace = ResolvedProfile & {
  readonly workspaceId: string;
};

export type UpsertProfileInput = {
  readonly apiBaseUrl?: string;
  readonly reportsBaseUrl?: string;
};

const unsafeProfileNames = new Set(["__proto__", "constructor", "prototype"]);

const profileNameSchema = z
  .string()
  .trim()
  .min(1)
  .refine((value) => !unsafeProfileNames.has(value), "Profile name is reserved.");
const workspaceIdSchema = z.string().trim().min(1);

const profileConfigSchema = z
  .object({
    apiBaseUrl: z.string().min(1),
    reportsBaseUrl: z.string().min(1),
    defaultWorkspaceId: z.string().min(1).optional(),
  })
  .strict();

const cliConfigSchema = z
  .object({
    defaultProfile: z.string().min(1).optional(),
    profiles: z.record(z.string(), profileConfigSchema),
  })
  .strict();

export const emptyConfig = (): CliConfig => ({
  profiles: {},
});

export const normalizeBaseUrl = (url: string, fieldName = "URL"): Result<string, AppError> => {
  const trimmed = url.trim();

  if (trimmed.length === 0) {
    return err(appError("validation_error", `${fieldName} is required.`));
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return err(appError("validation_error", `${fieldName} must start with http:// or https://.`));
    }

    return ok(parsed.toString().replace(/\/$/, ""));
  } catch (cause) {
    return err(appError("validation_error", `${fieldName} is invalid.`, cause));
  }
};

export const parseConfigJson = (value: unknown): Result<CliConfig, AppError> => {
  const parsed = cliConfigSchema.safeParse(value);

  if (!parsed.success) {
    return err(appError("config_invalid", "Config file format is invalid.", parsed.error));
  }

  return ok(parsed.data);
};

export const parseConfigText = (text: string): Result<CliConfig, AppError> =>
  parseJson(text, (cause) =>
    appError("config_invalid", "Config file is not valid JSON.", cause),
  ).andThen((json) => parseConfigJson(json));

export const serializeConfig = (config: CliConfig): string =>
  `${JSON.stringify(config, null, 2)}\n`;

export const validateProfileName = (profile: string): Result<string, AppError> => {
  const parsed = profileNameSchema.safeParse(profile);

  if (!parsed.success) {
    return err(appError("validation_error", "Profile name is required.", parsed.error));
  }

  return ok(parsed.data);
};

export const validateWorkspaceId = (workspaceId: string): Result<string, AppError> => {
  const parsed = workspaceIdSchema.safeParse(workspaceId);

  if (!parsed.success) {
    return err(appError("validation_error", "Workspace id is required.", parsed.error));
  }

  return ok(parsed.data);
};

export const buildProfileConfig = (
  input: UpsertProfileInput,
  existing?: ProfileConfig,
): Result<ProfileConfig, AppError> =>
  normalizeBaseUrl(
    input.apiBaseUrl ?? existing?.apiBaseUrl ?? defaultApiBaseUrl,
    "API base URL",
  ).andThen((apiBaseUrl) =>
    normalizeBaseUrl(
      input.reportsBaseUrl ?? existing?.reportsBaseUrl ?? defaultReportsBaseUrl,
      "Reports base URL",
    ).map((reportsBaseUrl) => ({
      apiBaseUrl,
      reportsBaseUrl,
      defaultWorkspaceId: existing?.defaultWorkspaceId,
    })),
  );

export const upsertProfile = (
  config: CliConfig,
  profile: string,
  input: UpsertProfileInput,
): Result<CliConfig, AppError> =>
  buildProfileConfig(input, config.profiles[profile]).map((profileConfig) => ({
    defaultProfile: config.defaultProfile ?? profile,
    profiles: {
      ...config.profiles,
      [profile]: profileConfig,
    },
  }));

export const setDefaultProfile = (
  config: CliConfig,
  profile: string,
): Result<CliConfig, AppError> => {
  if (config.profiles[profile] == null) {
    return err(appError("profile_not_found", `Profile not found: ${profile}`));
  }

  return ok({
    ...config,
    defaultProfile: profile,
  });
};

export const setDefaultWorkspace = (
  config: CliConfig,
  profile: string,
  workspaceId: string,
): Result<CliConfig, AppError> => {
  const profileConfig = config.profiles[profile];

  if (profileConfig == null) {
    return err(appError("profile_not_found", `Profile not found: ${profile}`));
  }

  return validateWorkspaceId(workspaceId).map((validWorkspaceId) => ({
    ...config,
    profiles: {
      ...config.profiles,
      [profile]: {
        ...profileConfig,
        defaultWorkspaceId: validWorkspaceId,
      },
    },
  }));
};

export const resolveProfile = (
  config: CliConfig,
  profileOption?: string,
): Result<ResolvedProfile, AppError> => {
  const profile = profileOption ?? config.defaultProfile;

  if (profile == null || profile.trim().length === 0) {
    return err(
      appError("profile_not_found", "Profile is not specified and no default profile is set."),
    );
  }

  const profileConfig = config.profiles[profile];

  if (profileConfig == null) {
    return err(appError("profile_not_found", `Profile not found: ${profile}`));
  }

  return ok({ name: profile, ...profileConfig });
};

export const resolveWorkspace = (
  config: CliConfig,
  profileOption?: string,
  workspaceOption?: string,
): Result<ResolvedWorkspace, AppError> =>
  resolveProfile(config, profileOption).andThen((profile) => {
    const workspaceId = workspaceOption ?? profile.defaultWorkspaceId;

    if (workspaceId == null || workspaceId.trim().length === 0) {
      return err(
        appError(
          "validation_error",
          "Workspace id is not specified and no default workspace is set.",
        ),
      );
    }

    return validateWorkspaceId(workspaceId).map((validWorkspaceId) => ({
      ...profile,
      workspaceId: validWorkspaceId,
    }));
  });
