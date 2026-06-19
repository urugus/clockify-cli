import { err, ok, type Result, ResultAsync } from "neverthrow";
import { type AppError, appError } from "../errors/app-error.js";
import {
  appendPageParams,
  isLastPageHeader,
  normalizePageInput,
  type PageInput,
  type PageResult,
} from "./pagination.js";
import {
  type Client,
  type ClockifyUser,
  type DeleteResult,
  decodeClients,
  decodeProject,
  decodeProjectCustomFieldAssignment,
  decodeProjects,
  decodeTags,
  decodeTasks,
  decodeTimeEntries,
  decodeTimeEntry,
  decodeUnknownJson,
  decodeUser,
  decodeUserGroup,
  decodeUserGroups,
  decodeWorkspaces,
  decodeWorkspaceUser,
  decodeWorkspaceUsers,
  type Project,
  type ProjectCustomFieldAssignment,
  type Tag,
  type Task,
  type TimeEntry,
  type UserGroup,
  type Workspace,
  type WorkspaceUser,
} from "./schemas.js";

export type FetchLike = typeof globalThis.fetch;

export type ClockifyClientOptions = {
  readonly apiBaseUrl: string;
  readonly reportsBaseUrl: string;
  readonly apiKey: string;
  readonly fetchImpl?: FetchLike;
};

export type ListWorkspaceResourceInput = PageInput & {
  readonly workspaceId: string;
};

export type ListProjectsInput = ListWorkspaceResourceInput & {
  readonly name?: string;
  readonly strictNameSearch?: boolean;
};

export type ListTasksInput = ListWorkspaceResourceInput & {
  readonly projectId: string;
};

export type ListTimeEntriesInput = ListWorkspaceResourceInput & {
  readonly userId: string;
  readonly start?: string;
  readonly end?: string;
};

export type StartTimerInput = {
  readonly workspaceId: string;
  readonly start: string;
  readonly description: string;
  readonly projectId?: string;
  readonly taskId?: string;
  readonly tagIds?: readonly string[];
  readonly billable?: boolean;
};

export type StopTimerInput = {
  readonly workspaceId: string;
  readonly userId: string;
  readonly end: string;
};

export type GetTimeEntryInput = {
  readonly workspaceId: string;
  readonly timeEntryId: string;
};

export type CreateTimeEntryInput = {
  readonly workspaceId: string;
  readonly userId?: string;
  readonly start: string;
  readonly end: string;
  readonly description: string;
  readonly projectId: string;
  readonly taskId?: string | null;
  readonly tagIds?: readonly string[];
  readonly billable: boolean;
};

export type UpdateTimeEntryInput = {
  readonly workspaceId: string;
  readonly timeEntryId: string;
  readonly start: string;
  readonly end: string;
  readonly description: string;
  readonly projectId: string;
  readonly taskId?: string | null;
  readonly tagIds?: readonly string[];
  readonly billable?: boolean;
};

export type DeleteTimeEntryInput = {
  readonly workspaceId: string;
  readonly timeEntryId: string;
};

export type GetProjectInput = {
  readonly workspaceId: string;
  readonly projectId: string;
};

export type CreateProjectInput = {
  readonly workspaceId: string;
  readonly name: string;
  readonly clientId: string;
  readonly color?: string;
  readonly billable?: boolean;
  readonly public?: boolean;
};

export type UpdateProjectInput = {
  readonly workspaceId: string;
  readonly projectId: string;
  readonly name?: string;
  readonly clientId?: string | null;
  readonly color?: string;
  readonly archived?: boolean;
  readonly billable?: boolean;
  readonly isPublic?: boolean;
  readonly note?: string;
};

export type UpdateProjectCustomFieldInput = {
  readonly workspaceId: string;
  readonly projectId: string;
  readonly customFieldId: string;
  readonly defaultValue?: unknown;
  readonly status?: "INACTIVE" | "VISIBLE" | "INVISIBLE";
};

export type ListUserGroupsInput = ListWorkspaceResourceInput & {
  readonly includeTeamManagers: boolean;
};

export type UserGroupMutationResult = UserGroup | { readonly ok: true; readonly id: string };

export type UserGroupMembershipInput = {
  readonly workspaceId: string;
  readonly groupId: string;
  readonly userId: string;
};

export type ListUsersInput = ListWorkspaceResourceInput & {
  readonly email?: string;
};

export type InviteUserInput = {
  readonly workspaceId: string;
  readonly email: string;
  readonly sendEmail: boolean;
};

export type ClockifyClient = {
  readonly getCurrentUser: () => ResultAsync<ClockifyUser, AppError>;
  readonly listWorkspaces: () => ResultAsync<readonly Workspace[], AppError>;
  readonly listProjects: (input: ListProjectsInput) => ResultAsync<PageResult<Project>, AppError>;
  readonly listClients: (
    input: ListWorkspaceResourceInput,
  ) => ResultAsync<PageResult<Client>, AppError>;
  readonly listTags: (input: ListWorkspaceResourceInput) => ResultAsync<PageResult<Tag>, AppError>;
  readonly listTasks: (input: ListTasksInput) => ResultAsync<PageResult<Task>, AppError>;
  readonly listTimeEntries: (
    input: ListTimeEntriesInput,
  ) => ResultAsync<PageResult<TimeEntry>, AppError>;
  readonly listInProgressTimeEntries: (
    input: ListWorkspaceResourceInput,
  ) => ResultAsync<PageResult<TimeEntry>, AppError>;
  readonly startTimer: (input: StartTimerInput) => ResultAsync<TimeEntry, AppError>;
  readonly stopTimer: (input: StopTimerInput) => ResultAsync<TimeEntry, AppError>;
  readonly getTimeEntry: (input: GetTimeEntryInput) => ResultAsync<TimeEntry, AppError>;
  readonly createTimeEntry: (input: CreateTimeEntryInput) => ResultAsync<TimeEntry, AppError>;
  readonly updateTimeEntry: (input: UpdateTimeEntryInput) => ResultAsync<TimeEntry, AppError>;
  readonly deleteTimeEntry: (input: DeleteTimeEntryInput) => ResultAsync<DeleteResult, AppError>;
  readonly getProject: (input: GetProjectInput) => ResultAsync<Project, AppError>;
  readonly createProject: (input: CreateProjectInput) => ResultAsync<Project, AppError>;
  readonly updateProject: (input: UpdateProjectInput) => ResultAsync<Project, AppError>;
  readonly updateProjectCustomField: (
    input: UpdateProjectCustomFieldInput,
  ) => ResultAsync<ProjectCustomFieldAssignment, AppError>;
  readonly listUserGroups: (
    input: ListUserGroupsInput,
  ) => ResultAsync<PageResult<UserGroup>, AppError>;
  readonly addUserToGroup: (
    input: UserGroupMembershipInput,
  ) => ResultAsync<UserGroupMutationResult, AppError>;
  readonly removeUserFromGroup: (
    input: UserGroupMembershipInput,
  ) => ResultAsync<UserGroupMutationResult, AppError>;
  readonly listUsers: (input: ListUsersInput) => ResultAsync<PageResult<WorkspaceUser>, AppError>;
  readonly inviteUser: (input: InviteUserInput) => ResultAsync<WorkspaceUser, AppError>;
};

type JsonRequestResult = {
  readonly json: unknown;
  readonly response: Response;
};

const encodePath = (value: string): string => encodeURIComponent(value);

const buildUrl = (baseUrl: string, path: string, params = new URLSearchParams()): string => {
  const query = params.toString();
  return `${baseUrl}${path}${query.length > 0 ? `?${query}` : ""}`;
};

const parseJsonResponse = (
  response: Response,
  context: string,
): ResultAsync<JsonRequestResult, AppError> =>
  ResultAsync.fromPromise(response.json() as Promise<unknown>, (cause) =>
    appError("clockify_invalid_response", `Failed to parse JSON for ${context}.`, cause),
  ).andThen((json) =>
    decodeUnknownJson(json, context).map((decoded) => ({ json: decoded, response })),
  );

const requestJson = (
  baseUrl: string,
  apiKey: string,
  fetchImpl: FetchLike,
  path: string,
  init: RequestInit = {},
  params = new URLSearchParams(),
): ResultAsync<JsonRequestResult, AppError> => {
  const url = buildUrl(baseUrl, path, params);
  const hasBody = init.body != null;

  return ResultAsync.fromPromise(
    fetchImpl(url, {
      ...init,
      headers: {
        "X-Api-Key": apiKey,
        ...(hasBody ? { "Content-Type": "application/json" } : {}),
        ...init.headers,
      },
    }),
    (cause) => appError("clockify_http_error", `Failed to request Clockify: ${path}`, cause),
  ).andThen((response) => {
    if (!response.ok) {
      if (response.status === 429) {
        return err(appError("clockify_rate_limited", `Clockify HTTP 429: ${path}`));
      }

      if (response.status === 403 && /user-groups|custom-fields/.test(path)) {
        return err(
          appError(
            "clockify_http_error",
            `Clockify HTTP 403: ${path}. This endpoint may require a different Clockify plan or permission level.`,
          ),
        );
      }

      return err(appError("clockify_http_error", `Clockify HTTP ${response.status}: ${path}`));
    }

    if (response.status === 204) {
      return ok({ json: undefined, response });
    }

    return parseJsonResponse(response, path);
  });
};

const pageParams = (input: PageInput): ResultAsync<Required<PageInput>, AppError> =>
  ResultAsync.fromSafePromise(Promise.resolve()).andThen(() => normalizePageInput(input));

const appendKebabPageParams = (
  params: URLSearchParams,
  page: Required<PageInput>,
): URLSearchParams => {
  params.set("page", String(page.page));
  params.set("page-size", String(page.pageSize));
  return params;
};

const listPage = <T>(
  request: (page: Required<PageInput>) => ResultAsync<JsonRequestResult, AppError>,
  decode: (value: unknown) => Result<readonly T[], AppError>,
  input: PageInput,
): ResultAsync<PageResult<T>, AppError> =>
  pageParams(input)
    .andThen((page) => request(page))
    .andThen(({ json, response }) =>
      decode(json).map((items) => ({
        items,
        lastPage: isLastPageHeader(response.headers.get("Last-Page")),
      })),
    );

export const createClockifyClient = ({
  apiBaseUrl,
  reportsBaseUrl: _reportsBaseUrl,
  apiKey,
  fetchImpl = fetch,
}: ClockifyClientOptions): ClockifyClient => {
  const getCurrentUser = (): ResultAsync<ClockifyUser, AppError> =>
    requestJson(apiBaseUrl, apiKey, fetchImpl, "/user").andThen(({ json }) => decodeUser(json));

  const listWorkspaces = (): ResultAsync<readonly Workspace[], AppError> =>
    requestJson(apiBaseUrl, apiKey, fetchImpl, "/workspaces").andThen(({ json }) =>
      decodeWorkspaces(json),
    );

  const listProjects = (input: ListProjectsInput): ResultAsync<PageResult<Project>, AppError> =>
    listPage(
      (page) => {
        const params = appendPageParams(new URLSearchParams(), page);
        if (input.name != null) {
          params.set("name", input.name);
          params.set("strict-name-search", String(input.strictNameSearch === true));
        }

        return requestJson(
          apiBaseUrl,
          apiKey,
          fetchImpl,
          `/workspaces/${encodePath(input.workspaceId)}/projects`,
          {},
          params,
        );
      },
      decodeProjects,
      input,
    );

  const getProject = (input: GetProjectInput): ResultAsync<Project, AppError> =>
    requestJson(
      apiBaseUrl,
      apiKey,
      fetchImpl,
      `/workspaces/${encodePath(input.workspaceId)}/projects/${encodePath(input.projectId)}`,
    ).andThen(({ json }) => decodeProject(json));

  const createProject = (input: CreateProjectInput): ResultAsync<Project, AppError> =>
    requestJson(
      apiBaseUrl,
      apiKey,
      fetchImpl,
      `/workspaces/${encodePath(input.workspaceId)}/projects`,
      {
        method: "POST",
        body: JSON.stringify({
          name: input.name,
          clientId: input.clientId,
          color: input.color,
          billable: input.billable,
          isPublic: input.public,
        }),
      },
    ).andThen(({ json }) => decodeProject(json));

  const updateProject = (input: UpdateProjectInput): ResultAsync<Project, AppError> =>
    requestJson(
      apiBaseUrl,
      apiKey,
      fetchImpl,
      `/workspaces/${encodePath(input.workspaceId)}/projects/${encodePath(input.projectId)}`,
      {
        method: "PUT",
        body: JSON.stringify({
          name: input.name,
          clientId: input.clientId,
          color: input.color,
          archived: input.archived,
          billable: input.billable,
          isPublic: input.isPublic,
          note: input.note,
        }),
      },
    ).andThen(({ json }) => decodeProject(json));

  const updateProjectCustomField = (
    input: UpdateProjectCustomFieldInput,
  ): ResultAsync<ProjectCustomFieldAssignment, AppError> =>
    requestJson(
      apiBaseUrl,
      apiKey,
      fetchImpl,
      `/workspaces/${encodePath(input.workspaceId)}/projects/${encodePath(
        input.projectId,
      )}/custom-fields/${encodePath(input.customFieldId)}`,
      {
        method: "PATCH",
        body: JSON.stringify({
          defaultValue: input.defaultValue,
          status: input.status,
        }),
      },
    ).andThen(({ json }) => decodeProjectCustomFieldAssignment(json));

  const createTimeEntry = (input: CreateTimeEntryInput): ResultAsync<TimeEntry, AppError> => {
    const path =
      input.userId == null
        ? `/workspaces/${encodePath(input.workspaceId)}/time-entries`
        : `/workspaces/${encodePath(input.workspaceId)}/user/${encodePath(
            input.userId,
          )}/time-entries`;

    return requestJson(apiBaseUrl, apiKey, fetchImpl, path, {
      method: "POST",
      body: JSON.stringify({
        start: input.start,
        end: input.end,
        description: input.description,
        projectId: input.projectId,
        taskId: input.taskId,
        tagIds: input.tagIds,
        billable: input.billable,
      }),
    }).andThen(({ json }) => decodeTimeEntry(json));
  };

  const getTimeEntry = (input: GetTimeEntryInput): ResultAsync<TimeEntry, AppError> =>
    requestJson(
      apiBaseUrl,
      apiKey,
      fetchImpl,
      `/workspaces/${encodePath(input.workspaceId)}/time-entries/${encodePath(input.timeEntryId)}`,
    ).andThen(({ json }) => decodeTimeEntry(json));

  const updateTimeEntry = (input: UpdateTimeEntryInput): ResultAsync<TimeEntry, AppError> =>
    requestJson(
      apiBaseUrl,
      apiKey,
      fetchImpl,
      `/workspaces/${encodePath(input.workspaceId)}/time-entries/${encodePath(input.timeEntryId)}`,
      {
        method: "PUT",
        body: JSON.stringify({
          start: input.start,
          end: input.end,
          description: input.description,
          projectId: input.projectId,
          taskId: input.taskId,
          tagIds: input.tagIds,
          billable: input.billable,
        }),
      },
    ).andThen(({ json }) => decodeTimeEntry(json));

  const deleteTimeEntry = (input: DeleteTimeEntryInput): ResultAsync<DeleteResult, AppError> =>
    requestJson(
      apiBaseUrl,
      apiKey,
      fetchImpl,
      `/workspaces/${encodePath(input.workspaceId)}/time-entries/${encodePath(input.timeEntryId)}`,
      { method: "DELETE" },
    ).map(() => ({ deleted: true, id: input.timeEntryId }));

  const listUserGroups = (
    input: ListUserGroupsInput,
  ): ResultAsync<PageResult<UserGroup>, AppError> =>
    listPage(
      (page) => {
        const params = appendKebabPageParams(new URLSearchParams(), page);
        params.set("include-team-managers", String(input.includeTeamManagers));
        return requestJson(
          apiBaseUrl,
          apiKey,
          fetchImpl,
          `/workspaces/${encodePath(input.workspaceId)}/user-groups`,
          {},
          params,
        );
      },
      decodeUserGroups,
      input,
    );

  const addUserToGroup = (
    input: UserGroupMembershipInput,
  ): ResultAsync<UserGroupMutationResult, AppError> =>
    requestJson(
      apiBaseUrl,
      apiKey,
      fetchImpl,
      `/workspaces/${encodePath(input.workspaceId)}/user-groups/${encodePath(input.groupId)}/users`,
      {
        method: "POST",
        body: JSON.stringify({
          userId: input.userId,
        }),
      },
    ).andThen(({ json }) =>
      json == null ? ok({ ok: true as const, id: input.groupId }) : decodeUserGroup(json),
    );

  const removeUserFromGroup = (
    input: UserGroupMembershipInput,
  ): ResultAsync<UserGroupMutationResult, AppError> =>
    requestJson(
      apiBaseUrl,
      apiKey,
      fetchImpl,
      `/workspaces/${encodePath(input.workspaceId)}/user-groups/${encodePath(
        input.groupId,
      )}/users/${encodePath(input.userId)}`,
      { method: "DELETE" },
    ).andThen(({ json }) =>
      json == null ? ok({ ok: true as const, id: input.groupId }) : decodeUserGroup(json),
    );

  const listUsers = (input: ListUsersInput): ResultAsync<PageResult<WorkspaceUser>, AppError> =>
    listPage(
      (page) => {
        const params = appendKebabPageParams(new URLSearchParams(), page);
        if (input.email != null) {
          params.set("email", input.email);
        }

        return requestJson(
          apiBaseUrl,
          apiKey,
          fetchImpl,
          `/workspaces/${encodePath(input.workspaceId)}/users`,
          {},
          params,
        );
      },
      decodeWorkspaceUsers,
      input,
    );

  const inviteUser = (input: InviteUserInput): ResultAsync<WorkspaceUser, AppError> => {
    const params = new URLSearchParams();
    params.set("send-email", String(input.sendEmail));

    return requestJson(
      apiBaseUrl,
      apiKey,
      fetchImpl,
      `/workspaces/${encodePath(input.workspaceId)}/users`,
      {
        method: "POST",
        body: JSON.stringify({
          email: input.email,
        }),
      },
      params,
    ).andThen(({ json }) => decodeWorkspaceUser(json));
  };

  const listClients = (
    input: ListWorkspaceResourceInput,
  ): ResultAsync<PageResult<Client>, AppError> =>
    listPage(
      (page) =>
        requestJson(
          apiBaseUrl,
          apiKey,
          fetchImpl,
          `/workspaces/${encodePath(input.workspaceId)}/clients`,
          {},
          appendPageParams(new URLSearchParams(), page),
        ),
      decodeClients,
      input,
    );

  const listTags = (input: ListWorkspaceResourceInput): ResultAsync<PageResult<Tag>, AppError> =>
    listPage(
      (page) =>
        requestJson(
          apiBaseUrl,
          apiKey,
          fetchImpl,
          `/workspaces/${encodePath(input.workspaceId)}/tags`,
          {},
          appendPageParams(new URLSearchParams(), page),
        ),
      decodeTags,
      input,
    );

  const listTasks = (input: ListTasksInput): ResultAsync<PageResult<Task>, AppError> =>
    listPage(
      (page) =>
        requestJson(
          apiBaseUrl,
          apiKey,
          fetchImpl,
          `/workspaces/${encodePath(input.workspaceId)}/projects/${encodePath(
            input.projectId,
          )}/tasks`,
          {},
          appendPageParams(new URLSearchParams(), page),
        ),
      decodeTasks,
      input,
    );

  const listTimeEntries = (
    input: ListTimeEntriesInput,
  ): ResultAsync<PageResult<TimeEntry>, AppError> =>
    listPage(
      (page) => {
        const params = appendPageParams(new URLSearchParams(), page);
        if (input.start != null) {
          params.set("start", input.start);
        }
        if (input.end != null) {
          params.set("end", input.end);
        }

        return requestJson(
          apiBaseUrl,
          apiKey,
          fetchImpl,
          `/workspaces/${encodePath(input.workspaceId)}/user/${encodePath(
            input.userId,
          )}/time-entries`,
          {},
          params,
        );
      },
      decodeTimeEntries,
      input,
    );

  const listInProgressTimeEntries = (
    input: ListWorkspaceResourceInput,
  ): ResultAsync<PageResult<TimeEntry>, AppError> =>
    listPage(
      (page) =>
        requestJson(
          apiBaseUrl,
          apiKey,
          fetchImpl,
          `/workspaces/${encodePath(input.workspaceId)}/time-entries/status/in-progress`,
          {},
          appendPageParams(new URLSearchParams(), page),
        ),
      decodeTimeEntries,
      input,
    );

  const startTimer = (input: StartTimerInput): ResultAsync<TimeEntry, AppError> =>
    requestJson(
      apiBaseUrl,
      apiKey,
      fetchImpl,
      `/workspaces/${encodePath(input.workspaceId)}/time-entries`,
      {
        method: "POST",
        body: JSON.stringify({
          start: input.start,
          description: input.description,
          projectId: input.projectId,
          taskId: input.taskId,
          tagIds: input.tagIds,
          billable: input.billable ?? false,
        }),
      },
    ).andThen(({ json }) => decodeTimeEntry(json));

  const stopTimer = (input: StopTimerInput): ResultAsync<TimeEntry, AppError> =>
    requestJson(
      apiBaseUrl,
      apiKey,
      fetchImpl,
      `/workspaces/${encodePath(input.workspaceId)}/user/${encodePath(input.userId)}/time-entries`,
      {
        method: "PATCH",
        body: JSON.stringify({
          end: input.end,
        }),
      },
    ).andThen(({ json }) => decodeTimeEntry(json));

  return {
    getCurrentUser,
    listWorkspaces,
    listProjects,
    getProject,
    createProject,
    updateProject,
    updateProjectCustomField,
    listClients,
    listTags,
    listTasks,
    listTimeEntries,
    listInProgressTimeEntries,
    startTimer,
    stopTimer,
    getTimeEntry,
    createTimeEntry,
    updateTimeEntry,
    deleteTimeEntry,
    listUserGroups,
    addUserToGroup,
    removeUserFromGroup,
    listUsers,
    inviteUser,
  };
};
