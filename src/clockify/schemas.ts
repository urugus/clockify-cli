import { err, ok, type Result } from "neverthrow";
import { z } from "zod";
import { type AppError, appError } from "../errors/app-error.js";

const parseSchema = <T>(
  schema: z.ZodType<T>,
  value: unknown,
  message: string,
): Result<T, AppError> => {
  const parsed = schema.safeParse(value);

  return parsed.success
    ? ok(parsed.data)
    : err(appError("clockify_invalid_response", message, parsed.error));
};

export const userSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().optional(),
    email: z.string().optional(),
    activeWorkspace: z.string().optional(),
    defaultWorkspace: z.string().optional(),
  })
  .passthrough();

export type ClockifyUser = z.infer<typeof userSchema>;

export const workspaceSchema = z
  .object({
    id: z.string().min(1),
    name: z.string(),
  })
  .passthrough();

export type Workspace = z.infer<typeof workspaceSchema>;

export const projectSchema = z
  .object({
    id: z.string().min(1),
    name: z.string(),
    archived: z.boolean().optional(),
    clientId: z.string().nullable().optional(),
    workspaceId: z.string().optional(),
  })
  .passthrough();

export type Project = z.infer<typeof projectSchema>;

export const projectCustomFieldAssignmentSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().optional(),
    workspaceId: z.string().optional(),
  })
  .passthrough();

export type ProjectCustomFieldAssignment = z.infer<typeof projectCustomFieldAssignmentSchema>;

export const clientSchema = z
  .object({
    id: z.string().min(1),
    name: z.string(),
    archived: z.boolean().optional(),
    workspaceId: z.string().optional(),
  })
  .passthrough();

export type Client = z.infer<typeof clientSchema>;

export const tagSchema = z
  .object({
    id: z.string().min(1),
    name: z.string(),
    archived: z.boolean().optional(),
    workspaceId: z.string().optional(),
  })
  .passthrough();

export type Tag = z.infer<typeof tagSchema>;

export const taskSchema = z
  .object({
    id: z.string().min(1),
    name: z.string(),
    status: z.string().optional(),
    projectId: z.string().optional(),
  })
  .passthrough();

export type Task = z.infer<typeof taskSchema>;

export const timeEntrySchema = z
  .object({
    id: z.string().min(1),
    description: z.string().optional(),
    projectId: z.string().nullable().optional(),
    taskId: z.string().nullable().optional(),
    tagIds: z.array(z.string()).optional(),
    userId: z.string().optional(),
    workspaceId: z.string().optional(),
    billable: z.boolean().optional(),
    timeInterval: z
      .object({
        start: z.string().optional(),
        end: z.string().nullable().optional(),
        duration: z.string().nullable().optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

export type TimeEntry = z.infer<typeof timeEntrySchema>;

export const userGroupSchema = z
  .object({
    id: z.string().min(1),
    name: z.string(),
    userIds: z.array(z.string()).optional(),
    workspaceId: z.string().optional(),
  })
  .passthrough();

export type UserGroup = z.infer<typeof userGroupSchema>;

export const workspaceUserSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().optional(),
    email: z.string().optional(),
    status: z.string().optional(),
  })
  .passthrough();

export type WorkspaceUser = z.infer<typeof workspaceUserSchema>;

export const deleteResultSchema = z
  .object({
    deleted: z.boolean(),
    id: z.string().min(1),
  })
  .passthrough();

export type DeleteResult = z.infer<typeof deleteResultSchema>;

export const mutationResultSchema = z
  .object({
    ok: z.boolean(),
    id: z.string().min(1),
  })
  .passthrough();

export type MutationResult = z.infer<typeof mutationResultSchema>;

export const decodeUnknownJson = (value: unknown, context: string): Result<unknown, AppError> => {
  if (value == null) {
    return err(
      appError("clockify_invalid_response", `Clockify returned empty JSON for ${context}.`),
    );
  }

  return ok(value);
};

export const decodeUser = (value: unknown): Result<ClockifyUser, AppError> =>
  parseSchema(userSchema, value, "Clockify user response is invalid.");

export const decodeWorkspaces = (value: unknown): Result<readonly Workspace[], AppError> =>
  parseSchema(z.array(workspaceSchema), value, "Clockify workspaces response is invalid.");

export const decodeProjects = (value: unknown): Result<readonly Project[], AppError> =>
  parseSchema(z.array(projectSchema), value, "Clockify projects response is invalid.");

export const decodeProject = (value: unknown): Result<Project, AppError> =>
  parseSchema(projectSchema, value, "Clockify project response is invalid.");

export const decodeProjectCustomFieldAssignment = (
  value: unknown,
): Result<ProjectCustomFieldAssignment, AppError> =>
  parseSchema(
    projectCustomFieldAssignmentSchema,
    value,
    "Clockify project custom field response is invalid.",
  );

export const decodeClients = (value: unknown): Result<readonly Client[], AppError> =>
  parseSchema(z.array(clientSchema), value, "Clockify clients response is invalid.");

export const decodeTags = (value: unknown): Result<readonly Tag[], AppError> =>
  parseSchema(z.array(tagSchema), value, "Clockify tags response is invalid.");

export const decodeTasks = (value: unknown): Result<readonly Task[], AppError> =>
  parseSchema(z.array(taskSchema), value, "Clockify tasks response is invalid.");

export const decodeTimeEntry = (value: unknown): Result<TimeEntry, AppError> =>
  parseSchema(timeEntrySchema, value, "Clockify time entry response is invalid.");

export const decodeTimeEntries = (value: unknown): Result<readonly TimeEntry[], AppError> =>
  parseSchema(z.array(timeEntrySchema), value, "Clockify time entries response is invalid.");

export const decodeUserGroups = (value: unknown): Result<readonly UserGroup[], AppError> =>
  parseSchema(z.array(userGroupSchema), value, "Clockify user groups response is invalid.");

export const decodeUserGroup = (value: unknown): Result<UserGroup, AppError> =>
  parseSchema(userGroupSchema, value, "Clockify user group response is invalid.");

export const decodeWorkspaceUsers = (value: unknown): Result<readonly WorkspaceUser[], AppError> =>
  parseSchema(z.array(workspaceUserSchema), value, "Clockify workspace users response is invalid.");

export const decodeWorkspaceUser = (value: unknown): Result<WorkspaceUser, AppError> =>
  parseSchema(workspaceUserSchema, value, "Clockify workspace user response is invalid.");
