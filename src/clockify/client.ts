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
  decodeClients,
  decodeProjects,
  decodeTags,
  decodeTasks,
  decodeTimeEntries,
  decodeTimeEntry,
  decodeUnknownJson,
  decodeUser,
  decodeWorkspaces,
  type Project,
  type Tag,
  type Task,
  type TimeEntry,
  type Workspace,
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

export type ClockifyClient = {
  readonly getCurrentUser: () => ResultAsync<ClockifyUser, AppError>;
  readonly listWorkspaces: () => ResultAsync<readonly Workspace[], AppError>;
  readonly listProjects: (
    input: ListWorkspaceResourceInput,
  ) => ResultAsync<PageResult<Project>, AppError>;
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

  const listProjects = (
    input: ListWorkspaceResourceInput,
  ): ResultAsync<PageResult<Project>, AppError> =>
    listPage(
      (page) =>
        requestJson(
          apiBaseUrl,
          apiKey,
          fetchImpl,
          `/workspaces/${encodePath(input.workspaceId)}/projects`,
          {},
          appendPageParams(new URLSearchParams(), page),
        ),
      decodeProjects,
      input,
    );

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
    listClients,
    listTags,
    listTasks,
    listTimeEntries,
    listInProgressTimeEntries,
    startTimer,
    stopTimer,
  };
};
