import { describe, expect, it, vi } from "vitest";
import { createClockifyClient, type FetchLike } from "../../src/clockify/client.js";

const jsonResponse = (json: unknown, status = 200, headers?: HeadersInit): Response =>
  new Response(JSON.stringify(json), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
  });

const clientWithFetch = (fetchImpl: FetchLike) =>
  createClockifyClient({
    apiBaseUrl: "https://api.clockify.me/api/v1",
    reportsBaseUrl: "https://reports.api.clockify.me/v1",
    apiKey: "key",
    fetchImpl,
  });

describe("Clockify client", () => {
  it("gets current user with X-Api-Key", async () => {
    const fetchImpl = vi.fn<FetchLike>().mockResolvedValue(jsonResponse({ id: "u1" }));
    const client = clientWithFetch(fetchImpl);

    const result = await client.getCurrentUser();

    expect(result.value).toEqual({ id: "u1" });
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://api.clockify.me/api/v1/user",
      expect.objectContaining({
        headers: expect.objectContaining({
          "X-Api-Key": "key",
        }),
      }),
    );
  });

  it("lists workspaces", async () => {
    const fetchImpl = vi
      .fn<FetchLike>()
      .mockResolvedValue(jsonResponse([{ id: "w1", name: "Main" }]));

    const result = await clientWithFetch(fetchImpl).listWorkspaces();

    expect(result.value).toEqual([{ id: "w1", name: "Main" }]);
  });

  it("lists workspace resources with paging", async () => {
    const fetchImpl = vi
      .fn<FetchLike>()
      .mockResolvedValue(
        jsonResponse([{ id: "p1", name: "Project" }], 200, { "Last-Page": "true" }),
      );

    const result = await clientWithFetch(fetchImpl).listProjects({
      workspaceId: "workspace 1",
      page: 2,
      pageSize: 100,
    });

    expect(result.value).toEqual({
      items: [{ id: "p1", name: "Project" }],
      lastPage: true,
    });
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://api.clockify.me/api/v1/workspaces/workspace%201/projects?page=2&pageSize=100",
      expect.anything(),
    );
  });

  it("lists clients, tags, tasks, time entries, and in-progress entries", async () => {
    const fetchImpl = vi
      .fn<FetchLike>()
      .mockResolvedValueOnce(jsonResponse([{ id: "c1", name: "Client" }]))
      .mockResolvedValueOnce(jsonResponse([{ id: "tag1", name: "Tag" }]))
      .mockResolvedValueOnce(jsonResponse([{ id: "task1", name: "Task" }]))
      .mockResolvedValueOnce(jsonResponse([{ id: "te1" }]))
      .mockResolvedValueOnce(jsonResponse([{ id: "te2" }]));
    const client = clientWithFetch(fetchImpl);

    expect((await client.listClients({ workspaceId: "w1" })).value.items).toEqual([
      { id: "c1", name: "Client" },
    ]);
    expect((await client.listTags({ workspaceId: "w1" })).value.items).toEqual([
      { id: "tag1", name: "Tag" },
    ]);
    expect((await client.listTasks({ workspaceId: "w1", projectId: "p1" })).value.items).toEqual([
      { id: "task1", name: "Task" },
    ]);
    expect(
      (
        await client.listTimeEntries({
          workspaceId: "w1",
          userId: "u1",
          start: "2026-06-19T00:00:00.000Z",
          end: "2026-06-20T00:00:00.000Z",
        })
      ).value.items,
    ).toEqual([{ id: "te1" }]);
    expect((await client.listInProgressTimeEntries({ workspaceId: "w1" })).value.items).toEqual([
      { id: "te2" },
    ]);
  });

  it("starts and stops timers", async () => {
    const fetchImpl = vi
      .fn<FetchLike>()
      .mockResolvedValueOnce(jsonResponse({ id: "start1" }))
      .mockResolvedValueOnce(jsonResponse({ id: "stop1" }));
    const client = clientWithFetch(fetchImpl);

    expect(
      (
        await client.startTimer({
          workspaceId: "w1",
          start: "2026-06-19T00:00:00.000Z",
          description: "Work",
          projectId: "p1",
          taskId: "task1",
          tagIds: ["tag1"],
          billable: true,
        })
      ).value,
    ).toEqual({ id: "start1" });
    expect(
      (
        await client.stopTimer({
          workspaceId: "w1",
          userId: "u1",
          end: "2026-06-19T01:00:00.000Z",
        })
      ).value,
    ).toEqual({ id: "stop1" });

    expect(fetchImpl).toHaveBeenNthCalledWith(
      1,
      "https://api.clockify.me/api/v1/workspaces/w1/time-entries",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({
          start: "2026-06-19T00:00:00.000Z",
          description: "Work",
          projectId: "p1",
          taskId: "task1",
          tagIds: ["tag1"],
          billable: true,
        }),
      }),
    );
    expect(fetchImpl).toHaveBeenNthCalledWith(
      2,
      "https://api.clockify.me/api/v1/workspaces/w1/user/u1/time-entries",
      expect.objectContaining({
        method: "PATCH",
      }),
    );
  });

  it("creates, updates, gets, and deletes time entries", async () => {
    const fetchImpl = vi
      .fn<FetchLike>()
      .mockResolvedValueOnce(jsonResponse({ id: "created1" }, 201))
      .mockResolvedValueOnce(jsonResponse({ id: "te1", tagIds: ["tag1"] }))
      .mockResolvedValueOnce(jsonResponse({ id: "updated1" }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    const client = clientWithFetch(fetchImpl);

    expect(
      (
        await client.createTimeEntry({
          workspaceId: "w1",
          userId: "u1",
          start: "2026-06-19T00:00:00.000Z",
          end: "2026-06-19T01:00:00.000Z",
          description: "Work",
          projectId: "p1",
          billable: true,
        })
      ).value,
    ).toEqual({ id: "created1" });
    expect((await client.getTimeEntry({ workspaceId: "w1", timeEntryId: "te1" })).value).toEqual({
      id: "te1",
      tagIds: ["tag1"],
    });
    expect(
      (
        await client.updateTimeEntry({
          workspaceId: "w1",
          timeEntryId: "te1",
          start: "2026-06-19T00:00:00.000Z",
          end: "2026-06-19T01:00:00.000Z",
          description: "Work",
          projectId: "p1",
          tagIds: [],
        })
      ).value,
    ).toEqual({ id: "updated1" });
    expect((await client.deleteTimeEntry({ workspaceId: "w1", timeEntryId: "te1" })).value).toEqual(
      {
        deleted: true,
        id: "te1",
      },
    );

    expect(fetchImpl).toHaveBeenNthCalledWith(
      1,
      "https://api.clockify.me/api/v1/workspaces/w1/user/u1/time-entries",
      expect.objectContaining({ method: "POST" }),
    );
    expect(fetchImpl).toHaveBeenNthCalledWith(
      3,
      "https://api.clockify.me/api/v1/workspaces/w1/time-entries/te1",
      expect.objectContaining({ method: "PUT" }),
    );
    expect(fetchImpl).toHaveBeenNthCalledWith(
      4,
      "https://api.clockify.me/api/v1/workspaces/w1/time-entries/te1",
      expect.objectContaining({ method: "DELETE" }),
    );
  });

  it("manages projects, custom fields, user groups, and users", async () => {
    const fetchImpl = vi
      .fn<FetchLike>()
      .mockResolvedValueOnce(jsonResponse([{ id: "p1", name: "Project" }]))
      .mockResolvedValueOnce(jsonResponse({ id: "p1", name: "Project" }))
      .mockResolvedValueOnce(jsonResponse({ id: "p2", name: "New" }, 201))
      .mockResolvedValueOnce(jsonResponse({ id: "p1", name: "Updated" }))
      .mockResolvedValueOnce(jsonResponse({ id: "cf1", name: "Cost" }))
      .mockResolvedValueOnce(jsonResponse([{ id: "g1", name: "Group" }]))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(jsonResponse({ id: "g1", name: "Group" }))
      .mockResolvedValueOnce(jsonResponse([{ id: "u1", email: "user@example.com" }]))
      .mockResolvedValueOnce(jsonResponse({ id: "u2", email: "new@example.com" }));
    const client = clientWithFetch(fetchImpl);

    await client.listProjects({
      workspaceId: "w1",
      name: "Project",
      strictNameSearch: true,
    });
    await client.getProject({ workspaceId: "w1", projectId: "p1" });
    await client.createProject({ workspaceId: "w1", name: "New", clientId: "c1" });
    await client.updateProject({ workspaceId: "w1", projectId: "p1", name: "Updated" });
    await client.updateProjectCustomField({
      workspaceId: "w1",
      projectId: "p1",
      customFieldId: "cf1",
      defaultValue: "Internal",
      status: "VISIBLE",
    });
    await client.listUserGroups({ workspaceId: "w1", includeTeamManagers: false });
    expect(
      (await client.addUserToGroup({ workspaceId: "w1", groupId: "g1", userId: "u1" })).value,
    ).toEqual({ ok: true, id: "g1" });
    expect(
      (await client.removeUserFromGroup({ workspaceId: "w1", groupId: "g1", userId: "u1" })).value,
    ).toEqual({ id: "g1", name: "Group" });
    await client.listUsers({ workspaceId: "w1", email: "user@example.com" });
    await client.inviteUser({ workspaceId: "w1", email: "new@example.com", sendEmail: false });

    expect(fetchImpl).toHaveBeenNthCalledWith(
      1,
      "https://api.clockify.me/api/v1/workspaces/w1/projects?page=1&pageSize=50&name=Project&strict-name-search=true",
      expect.anything(),
    );
    expect(fetchImpl).toHaveBeenNthCalledWith(
      6,
      "https://api.clockify.me/api/v1/workspaces/w1/user-groups?page=1&page-size=50&include-team-managers=false",
      expect.anything(),
    );
    expect(fetchImpl).toHaveBeenNthCalledWith(
      7,
      "https://api.clockify.me/api/v1/workspaces/w1/user-groups/g1/users",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ userId: "u1" }),
      }),
    );
    expect(fetchImpl).toHaveBeenNthCalledWith(
      10,
      "https://api.clockify.me/api/v1/workspaces/w1/users?send-email=false",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("rejects invalid page input before requesting", async () => {
    const fetchImpl = vi.fn<FetchLike>().mockResolvedValue(jsonResponse([]));

    const result = await clientWithFetch(fetchImpl).listProjects({
      workspaceId: "w1",
      page: 0,
    });

    expect(result._unsafeUnwrapErr().message).toBe("Page must be a positive integer.");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("maps HTTP, rate limit, fetch, JSON, and decode failures", async () => {
    const httpResult = await clientWithFetch(
      vi.fn<FetchLike>().mockResolvedValue(jsonResponse({}, 403)),
    ).getCurrentUser();
    const rateResult = await clientWithFetch(
      vi.fn<FetchLike>().mockResolvedValue(jsonResponse({}, 429)),
    ).getCurrentUser();
    const fetchResult = await clientWithFetch(
      vi.fn<FetchLike>().mockRejectedValue(new Error("offline")),
    ).getCurrentUser();
    const jsonResult = await clientWithFetch(
      vi.fn<FetchLike>().mockResolvedValue(new Response("not json")),
    ).getCurrentUser();
    const decodeResult = await clientWithFetch(
      vi.fn<FetchLike>().mockResolvedValue(jsonResponse({})),
    ).getCurrentUser();

    expect(httpResult._unsafeUnwrapErr().code).toBe("clockify_http_error");
    expect(rateResult._unsafeUnwrapErr().code).toBe("clockify_rate_limited");
    expect(fetchResult._unsafeUnwrapErr().message).toBe("Failed to request Clockify: /user");
    expect(jsonResult._unsafeUnwrapErr().message).toBe("Failed to parse JSON for /user.");
    expect(decodeResult._unsafeUnwrapErr().message).toBe("Clockify user response is invalid.");
  });
});
