import { describe, expect, it } from "vitest";
import {
  buildProjectUpdatePayload,
  buildTimeEntryUpdatePayload,
} from "../../src/clockify/payloads.js";

describe("Clockify payload builders", () => {
  it("preserves optional time entry fields unless they are explicitly changed", () => {
    expect(
      buildTimeEntryUpdatePayload(
        {
          id: "te1",
          taskId: "task1",
          tagIds: ["tag1"],
          billable: true,
        },
        {
          start: "2026-06-19T00:00:00.000Z",
          end: "2026-06-19T01:00:00.000Z",
          description: "Work",
          projectId: "p1",
          clearTags: false,
        },
      ),
    ).toEqual({
      start: "2026-06-19T00:00:00.000Z",
      end: "2026-06-19T01:00:00.000Z",
      description: "Work",
      projectId: "p1",
      taskId: "task1",
      tagIds: ["tag1"],
      billable: true,
    });
  });

  it("replaces or clears time entry tags explicitly", () => {
    const current = { id: "te1", tagIds: ["tag1"] };
    const patch = {
      start: "2026-06-19T00:00:00.000Z",
      end: "2026-06-19T01:00:00.000Z",
      description: "Work",
      projectId: "p1",
      clearTags: false,
    };

    expect(buildTimeEntryUpdatePayload(current, { ...patch, tagIds: ["tag2"] }).tagIds).toEqual([
      "tag2",
    ]);
    expect(buildTimeEntryUpdatePayload(current, { ...patch, clearTags: true }).tagIds).toEqual([]);
  });

  it("coerces null tagIds from current entry to undefined in payload", () => {
    const current = { id: "te1", tagIds: null };
    const patch = {
      start: "2026-06-19T00:00:00.000Z",
      end: "2026-06-19T01:00:00.000Z",
      description: "Work",
      projectId: "p1",
      clearTags: false,
    };

    expect(buildTimeEntryUpdatePayload(current, patch).tagIds).toBeUndefined();
  });

  it("preserves project fields when building update payloads", () => {
    expect(
      buildProjectUpdatePayload(
        {
          id: "p1",
          name: "Old",
          clientId: "c1",
          color: "#000000",
          archived: false,
          billable: true,
          public: false,
          note: "Old note",
        },
        { name: "New" },
      ),
    ).toEqual({
      name: "New",
      clientId: "c1",
      color: "#000000",
      archived: false,
      billable: true,
      isPublic: false,
      note: "Old note",
    });
  });
});
