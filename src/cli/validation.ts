import { err, ok, Result, type Result as ResultType } from "neverthrow";
import { z } from "zod";
import { type AppError, appError } from "../errors/app-error.js";
import { nonEmptyTrimmed } from "../lib/result.js";

export type FormatOption = {
  readonly format?: string;
};

export type ProfileOption = {
  readonly profile?: string;
};

export type WorkspaceOption = ProfileOption & {
  readonly workspaceId?: string;
};

export type PageOptions = {
  readonly page?: string;
  readonly pageSize?: string;
};

export type ResourceListOptions = WorkspaceOption & PageOptions & FormatOption;

export type TaskListOptions = ResourceListOptions & {
  readonly projectId: string;
};

export type ProjectListOptions = ResourceListOptions & {
  readonly name?: string;
  readonly strictNameSearch?: boolean;
};

export type TimeEntriesListOptions = ResourceListOptions & {
  readonly userId?: string;
  readonly from?: string;
  readonly to?: string;
};

export type TimerStartOptions = WorkspaceOption & {
  readonly description: string;
  readonly projectId?: string;
  readonly taskId?: string;
  readonly tagId?: readonly string[];
  readonly billable?: boolean;
};

export type TimerStopOptions = WorkspaceOption & {
  readonly userId?: string;
  readonly end?: string;
};

export type TimeEntryCreateOptions = WorkspaceOption &
  FormatOption & {
    readonly start: string;
    readonly end: string;
    readonly description: string;
    readonly projectId: string;
    readonly taskId?: string;
    readonly tagId?: readonly string[];
    readonly billable?: boolean;
    readonly userId?: string;
  };

export type TimeEntryUpdateOptions = WorkspaceOption &
  FormatOption & {
    readonly timeEntryId: string;
    readonly start: string;
    readonly end: string;
    readonly description: string;
    readonly projectId: string;
    readonly taskId?: string;
    readonly tagId?: readonly string[];
    readonly clearTags?: boolean;
    readonly billable?: boolean;
  };

export type TimeEntryDeleteOptions = WorkspaceOption & {
  readonly timeEntryId: string;
};

export type ProjectCreateOptions = WorkspaceOption &
  FormatOption & {
    readonly name: string;
    readonly clientId: string;
    readonly color?: string;
    readonly billable?: boolean;
    readonly public?: boolean;
  };

export type ProjectUpdateOptions = WorkspaceOption &
  FormatOption & {
    readonly projectId: string;
    readonly name?: string;
    readonly clientId?: string;
    readonly color?: string;
    readonly archived?: boolean;
    readonly billable?: boolean;
    readonly public?: boolean;
    readonly note?: string;
  };

export type ProjectCustomFieldUpdateOptions = WorkspaceOption &
  FormatOption & {
    readonly projectId: string;
    readonly customFieldId: string;
    readonly defaultValue?: string;
    readonly status?: string;
  };

export type UserGroupListOptions = ResourceListOptions & {
  readonly includeTeamManagers?: boolean;
};

export type UserGroupMembershipOptions = WorkspaceOption &
  FormatOption & {
    readonly groupId: string;
    readonly userId: string;
  };

export type UsersListOptions = ResourceListOptions & {
  readonly email?: string;
};

export type UserInviteOptions = WorkspaceOption &
  FormatOption & {
    readonly email: string;
    readonly sendEmail?: boolean;
  };

export type ValidPageOptions = {
  readonly page: number;
  readonly pageSize: number;
};

export type ValidResourceListOptions = WorkspaceOption &
  ValidPageOptions & {
    readonly format?: string;
  };

export type ValidTaskListOptions = ValidResourceListOptions & {
  readonly projectId: string;
};

export type ValidProjectListOptions = ValidResourceListOptions & {
  readonly name?: string;
  readonly strictNameSearch: boolean;
};

export type ValidTimeEntriesListOptions = ValidResourceListOptions & {
  readonly userId?: string;
  readonly start?: string;
  readonly end?: string;
};

export type ValidTimerStartOptions = WorkspaceOption & {
  readonly description: string;
  readonly projectId?: string;
  readonly taskId?: string;
  readonly tagIds?: readonly string[];
  readonly billable: boolean;
};

export type ValidTimerStopOptions = WorkspaceOption & {
  readonly userId?: string;
  readonly end?: string;
};

export type ValidTimeEntryCreateOptions = WorkspaceOption & {
  readonly format?: string;
  readonly start: string;
  readonly end: string;
  readonly description: string;
  readonly projectId: string;
  readonly taskId?: string;
  readonly tagIds?: readonly string[];
  readonly billable: boolean;
  readonly userId?: string;
};

export type ValidTimeEntryUpdateOptions = WorkspaceOption & {
  readonly format?: string;
  readonly timeEntryId: string;
  readonly start: string;
  readonly end: string;
  readonly description: string;
  readonly projectId: string;
  readonly taskId?: string;
  readonly tagIds?: readonly string[];
  readonly clearTags: boolean;
  readonly billable?: boolean;
};

export type ValidTimeEntryDeleteOptions = WorkspaceOption & {
  readonly timeEntryId: string;
};

export type ValidProjectCreateOptions = WorkspaceOption & {
  readonly format?: string;
  readonly name: string;
  readonly clientId: string;
  readonly color?: string;
  readonly billable?: boolean;
  readonly public?: boolean;
};

export type ValidProjectUpdateOptions = WorkspaceOption & {
  readonly format?: string;
  readonly projectId: string;
  readonly name?: string;
  readonly clientId?: string;
  readonly color?: string;
  readonly archived?: boolean;
  readonly billable?: boolean;
  readonly public?: boolean;
  readonly note?: string;
};

export type ValidProjectCustomFieldUpdateOptions = WorkspaceOption & {
  readonly format?: string;
  readonly projectId: string;
  readonly customFieldId: string;
  readonly defaultValue?: unknown;
  readonly status?: "INACTIVE" | "VISIBLE" | "INVISIBLE";
};

export type ValidUserGroupListOptions = ValidResourceListOptions & {
  readonly includeTeamManagers: boolean;
};

export type ValidUserGroupMembershipOptions = WorkspaceOption & {
  readonly format?: string;
  readonly groupId: string;
  readonly userId: string;
};

export type ValidUsersListOptions = ValidResourceListOptions & {
  readonly email?: string;
};

export type ValidUserInviteOptions = WorkspaceOption & {
  readonly format?: string;
  readonly email: string;
  readonly sendEmail: boolean;
};

const isoDateTimeSchema = z.string().datetime({ offset: true });
const emailSchema = z.string().email();

export const validateRequiredText = (value: string, field: string): Result<string, AppError> =>
  nonEmptyTrimmed(value, appError("validation_error", `${field} is required.`));

export const validateOptionalText = (
  value: string | undefined,
  field: string,
): Result<string | undefined, AppError> =>
  value == null ? ok(undefined) : validateRequiredText(value, field).map((text) => text);

export const validatePositiveInteger = (value: string, field: string): Result<number, AppError> => {
  if (!/^[1-9]\d*$/.test(value)) {
    return err(appError("validation_error", `${field} must be a positive integer.`));
  }

  const parsed = Number(value);

  if (!Number.isSafeInteger(parsed)) {
    return err(appError("validation_error", `${field} must be a positive integer.`));
  }

  return ok(parsed);
};

export const validateIsoDateTime = (value: string, field: string): Result<string, AppError> => {
  const parsed = isoDateTimeSchema.safeParse(value);

  if (!parsed.success) {
    return err(appError("validation_error", `${field} must be an ISO date-time with timezone.`));
  }

  return ok(parsed.data);
};

export const validateOptionalIsoDateTime = (
  value: string | undefined,
  field: string,
): Result<string | undefined, AppError> =>
  value == null ? ok(undefined) : validateIsoDateTime(value, field);

export const validateOptionalBoolean = (
  value: boolean | undefined,
): Result<boolean | undefined, AppError> => ok(value);

export const validateHexColor = (value: string, field: string): Result<string, AppError> => {
  const trimmed = value.trim();

  return /^#[0-9a-fA-F]{6}$/.test(trimmed)
    ? ok(trimmed)
    : err(appError("validation_error", `${field} must be a #RRGGBB color.`));
};

export const validateOptionalHexColor = (
  value: string | undefined,
  field: string,
): Result<string | undefined, AppError> =>
  value == null ? ok(undefined) : validateHexColor(value, field);

export const validateEmail = (value: string, field: string): Result<string, AppError> =>
  validateRequiredText(value, field).andThen((email) => {
    const parsed = emailSchema.safeParse(email);

    return parsed.success
      ? ok(parsed.data)
      : err(appError("validation_error", `${field} must be an email address.`));
  });

export const validateOptionalEmail = (
  value: string | undefined,
  field: string,
): Result<string | undefined, AppError> =>
  value == null ? ok(undefined) : validateEmail(value, field);

export const validateJsonValue = (value: string): Result<unknown, AppError> => {
  try {
    return ok(JSON.parse(value) as unknown);
  } catch (cause) {
    return err(appError("validation_error", "Default value must be valid JSON.", cause));
  }
};

export const validateCustomFieldStatus = (
  value: string | undefined,
): Result<"INACTIVE" | "VISIBLE" | "INVISIBLE" | undefined, AppError> => {
  if (value == null) {
    return ok(undefined);
  }

  if (value === "INACTIVE" || value === "VISIBLE" || value === "INVISIBLE") {
    return ok(value);
  }

  return err(appError("validation_error", "Status must be INACTIVE, VISIBLE, or INVISIBLE."));
};

export const validateAtLeastOnePresent = (
  entries: readonly (readonly [string, unknown])[],
  message: string,
): Result<void, AppError> =>
  entries.some(([, value]) => value !== undefined)
    ? ok(undefined)
    : err(appError("validation_error", message));

export const validatePageOptions = (options: PageOptions): ResultType<ValidPageOptions, AppError> =>
  Result.combine([
    validatePositiveInteger(options.page ?? "1", "Page"),
    validatePositiveInteger(options.pageSize ?? "50", "Page size"),
  ]).andThen(([page, pageSize]) => {
    if (pageSize > 1000) {
      return err(appError("validation_error", "Page size must be less than or equal to 1000."));
    }

    return ok({ page, pageSize });
  });

export const validateResourceListOptions = (
  options: ResourceListOptions,
): Result<ValidResourceListOptions, AppError> =>
  validatePageOptions(options).map((pageOptions) => ({
    ...pageOptions,
    profile: options.profile,
    workspaceId: options.workspaceId,
    format: options.format,
  }));

export const validateTaskListOptions = (
  options: TaskListOptions,
): Result<ValidTaskListOptions, AppError> =>
  validateRequiredText(options.projectId, "Project id").andThen((projectId) =>
    validateResourceListOptions(options).map((validOptions) => ({
      ...validOptions,
      projectId,
    })),
  );

export const validateProjectListOptions = (
  options: ProjectListOptions,
): Result<ValidProjectListOptions, AppError> =>
  Result.combine([
    validateResourceListOptions(options),
    validateOptionalText(options.name, "Name"),
  ]).map(([validOptions, name]) => ({
    ...validOptions,
    name,
    strictNameSearch: options.strictNameSearch === true,
  }));

export const validateTimeEntriesListOptions = (
  options: TimeEntriesListOptions,
): Result<ValidTimeEntriesListOptions, AppError> =>
  Result.combine([
    validateResourceListOptions(options),
    validateOptionalText(options.userId, "User id"),
    validateOptionalIsoDateTime(options.from, "From"),
    validateOptionalIsoDateTime(options.to, "To"),
  ]).map(([validOptions, userId, start, end]) => ({
    ...validOptions,
    userId,
    start,
    end,
  }));

export const validateTimerStartOptions = (
  options: TimerStartOptions,
): Result<ValidTimerStartOptions, AppError> =>
  Result.combine([
    validateRequiredText(options.description, "Description"),
    validateOptionalText(options.projectId, "Project id"),
    validateOptionalText(options.taskId, "Task id"),
  ]).map(([description, projectId, taskId]) => ({
    profile: options.profile,
    workspaceId: options.workspaceId,
    description,
    projectId,
    taskId,
    tagIds: options.tagId,
    billable: options.billable === true,
  }));

export const validateTimerStopOptions = (
  options: TimerStopOptions,
): Result<ValidTimerStopOptions, AppError> =>
  Result.combine([
    validateOptionalText(options.userId, "User id"),
    validateOptionalIsoDateTime(options.end, "End"),
  ]).map(([userId, end]) => ({
    profile: options.profile,
    workspaceId: options.workspaceId,
    userId,
    end,
  }));

const validateTagOptions = (
  tagIds: readonly string[] | undefined,
): Result<readonly string[] | undefined, AppError> => {
  if (tagIds == null || tagIds.length === 0) {
    return ok(undefined);
  }

  return Result.combine(tagIds.map((tagId) => validateRequiredText(tagId, "Tag id")));
};

export const validateTimeEntryCreateOptions = (
  options: TimeEntryCreateOptions,
): Result<ValidTimeEntryCreateOptions, AppError> =>
  Result.combine([
    validateIsoDateTime(options.start, "Start"),
    validateIsoDateTime(options.end, "End"),
    validateRequiredText(options.description, "Description"),
    validateRequiredText(options.projectId, "Project id"),
    validateOptionalText(options.taskId, "Task id"),
    validateTagOptions(options.tagId),
    validateOptionalText(options.userId, "User id"),
  ]).map(([start, end, description, projectId, taskId, tagIds, userId]) => ({
    profile: options.profile,
    workspaceId: options.workspaceId,
    format: options.format,
    start,
    end,
    description,
    projectId,
    taskId,
    tagIds,
    billable: options.billable === true,
    userId,
  }));

export const validateTimeEntryUpdateOptions = (
  options: TimeEntryUpdateOptions,
): Result<ValidTimeEntryUpdateOptions, AppError> =>
  Result.combine([
    validateRequiredText(options.timeEntryId, "Time entry id"),
    validateIsoDateTime(options.start, "Start"),
    validateIsoDateTime(options.end, "End"),
    validateRequiredText(options.description, "Description"),
    validateRequiredText(options.projectId, "Project id"),
    validateOptionalText(options.taskId, "Task id"),
    validateTagOptions(options.tagId),
  ]).andThen(([timeEntryId, start, end, description, projectId, taskId, tagIds]) => {
    if (options.clearTags === true && tagIds != null && tagIds.length > 0) {
      return err(appError("validation_error", "Clear tags cannot be combined with tag ids."));
    }

    return ok({
      profile: options.profile,
      workspaceId: options.workspaceId,
      format: options.format,
      timeEntryId,
      start,
      end,
      description,
      projectId,
      taskId,
      tagIds,
      clearTags: options.clearTags === true,
      billable: options.billable,
    });
  });

export const validateTimeEntryDeleteOptions = (
  options: TimeEntryDeleteOptions,
): Result<ValidTimeEntryDeleteOptions, AppError> =>
  validateRequiredText(options.timeEntryId, "Time entry id").map((timeEntryId) => ({
    profile: options.profile,
    workspaceId: options.workspaceId,
    timeEntryId,
  }));

export const validateProjectCreateOptions = (
  options: ProjectCreateOptions,
): Result<ValidProjectCreateOptions, AppError> =>
  Result.combine([
    validateRequiredText(options.name, "Name"),
    validateRequiredText(options.clientId, "Client id"),
    validateOptionalHexColor(options.color, "Color"),
  ]).map(([name, clientId, color]) => ({
    profile: options.profile,
    workspaceId: options.workspaceId,
    format: options.format,
    name,
    clientId,
    color,
    billable: options.billable,
    public: options.public,
  }));

export const validateProjectUpdateOptions = (
  options: ProjectUpdateOptions,
): Result<ValidProjectUpdateOptions, AppError> =>
  Result.combine([
    validateRequiredText(options.projectId, "Project id"),
    validateOptionalText(options.name, "Name"),
    validateOptionalText(options.clientId, "Client id"),
    validateOptionalHexColor(options.color, "Color"),
    validateOptionalText(options.note, "Note"),
  ]).andThen(([projectId, name, clientId, color, note]) => {
    const validOptions = {
      profile: options.profile,
      workspaceId: options.workspaceId,
      format: options.format,
      projectId,
      name,
      clientId,
      color,
      archived: options.archived,
      billable: options.billable,
      public: options.public,
      note,
    };

    return validateAtLeastOnePresent(
      [
        ["name", name],
        ["clientId", clientId],
        ["color", color],
        ["archived", options.archived],
        ["billable", options.billable],
        ["public", options.public],
        ["note", note],
      ],
      "At least one project field is required.",
    ).map(() => validOptions);
  });

export const validateProjectCustomFieldUpdateOptions = (
  options: ProjectCustomFieldUpdateOptions,
): Result<ValidProjectCustomFieldUpdateOptions, AppError> =>
  Result.combine([
    validateRequiredText(options.projectId, "Project id"),
    validateRequiredText(options.customFieldId, "Custom field id"),
    options.defaultValue == null ? ok(undefined) : validateJsonValue(options.defaultValue),
    validateCustomFieldStatus(options.status),
  ]).andThen(([projectId, customFieldId, defaultValue, status]) =>
    validateAtLeastOnePresent(
      [
        ["defaultValue", defaultValue],
        ["status", status],
      ],
      "At least one custom field update option is required.",
    ).map(() => ({
      profile: options.profile,
      workspaceId: options.workspaceId,
      format: options.format,
      projectId,
      customFieldId,
      defaultValue,
      status,
    })),
  );

export const validateUserGroupListOptions = (
  options: UserGroupListOptions,
): Result<ValidUserGroupListOptions, AppError> =>
  validateResourceListOptions(options).map((validOptions) => ({
    ...validOptions,
    includeTeamManagers: options.includeTeamManagers === true,
  }));

export const validateUserGroupMembershipOptions = (
  options: UserGroupMembershipOptions,
): Result<ValidUserGroupMembershipOptions, AppError> =>
  Result.combine([
    validateRequiredText(options.groupId, "Group id"),
    validateRequiredText(options.userId, "User id"),
  ]).map(([groupId, userId]) => ({
    profile: options.profile,
    workspaceId: options.workspaceId,
    format: options.format,
    groupId,
    userId,
  }));

export const validateUsersListOptions = (
  options: UsersListOptions,
): Result<ValidUsersListOptions, AppError> =>
  Result.combine([
    validateResourceListOptions(options),
    validateOptionalEmail(options.email, "Email"),
  ]).map(([validOptions, email]) => ({
    ...validOptions,
    email,
  }));

export const validateUserInviteOptions = (
  options: UserInviteOptions,
): Result<ValidUserInviteOptions, AppError> =>
  validateEmail(options.email, "Email").map((email) => ({
    profile: options.profile,
    workspaceId: options.workspaceId,
    format: options.format,
    email,
    sendEmail: options.sendEmail !== false,
  }));
