import { describe, expect, it } from "vitest";
import {
  decodeClients,
  decodeProjects,
  decodeTags,
  decodeTasks,
  decodeTimeEntries,
  decodeTimeEntry,
  decodeUnknownJson,
  decodeUser,
  decodeWorkspaces,
} from "../../src/clockify/schemas.js";

describe("Clockify schemas", () => {
  it("decodes valid response shapes", () => {
    expect(decodeUser({ id: "u1", extra: true }).value).toEqual({ id: "u1", extra: true });
    expect(decodeWorkspaces([{ id: "w1", name: "Main" }]).value).toEqual([
      { id: "w1", name: "Main" },
    ]);
    expect(decodeProjects([{ id: "p1", name: "Project" }]).value).toEqual([
      { id: "p1", name: "Project" },
    ]);
    expect(decodeClients([{ id: "c1", name: "Client" }]).value).toEqual([
      { id: "c1", name: "Client" },
    ]);
    expect(decodeTags([{ id: "t1", name: "Tag" }]).value).toEqual([{ id: "t1", name: "Tag" }]);
    expect(decodeTasks([{ id: "task1", name: "Task" }]).value).toEqual([
      { id: "task1", name: "Task" },
    ]);
    expect(decodeTimeEntry({ id: "te1" }).value).toEqual({ id: "te1" });
    expect(decodeTimeEntries([{ id: "te1" }]).value).toEqual([{ id: "te1" }]);
  });

  it("rejects invalid response shapes", () => {
    expect(decodeUser({})._unsafeUnwrapErr().code).toBe("clockify_invalid_response");
    expect(decodeWorkspaces({})._unsafeUnwrapErr().message).toBe(
      "Clockify workspaces response is invalid.",
    );
    expect(decodeProjects([{}])._unsafeUnwrapErr().message).toBe(
      "Clockify projects response is invalid.",
    );
    expect(decodeClients([{}])._unsafeUnwrapErr().message).toBe(
      "Clockify clients response is invalid.",
    );
    expect(decodeTags([{}])._unsafeUnwrapErr().message).toBe("Clockify tags response is invalid.");
    expect(decodeTasks([{}])._unsafeUnwrapErr().message).toBe(
      "Clockify tasks response is invalid.",
    );
    expect(decodeTimeEntry({})._unsafeUnwrapErr().message).toBe(
      "Clockify time entry response is invalid.",
    );
    expect(decodeTimeEntries([{}])._unsafeUnwrapErr().message).toBe(
      "Clockify time entries response is invalid.",
    );
  });

  it("rejects empty JSON", () => {
    expect(decodeUnknownJson(null, "test")._unsafeUnwrapErr().message).toBe(
      "Clockify returned empty JSON for test.",
    );
  });
});
