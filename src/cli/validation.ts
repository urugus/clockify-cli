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

const isoDateTimeSchema = z.string().datetime({ offset: true });

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
