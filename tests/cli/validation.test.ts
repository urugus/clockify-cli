import { describe, expect, it } from "vitest";
import {
  validateIsoDateTime,
  validateOptionalIsoDateTime,
  validateOptionalText,
  validatePageOptions,
  validatePositiveInteger,
  validateProjectCustomFieldUpdateOptions,
  validateProjectUpdateOptions,
  validateRequiredText,
  validateResourceListOptions,
  validateTaskListOptions,
  validateTimeEntriesListOptions,
  validateTimeEntryUpdateOptions,
  validateTimerStartOptions,
  validateTimerStopOptions,
  validateUserInviteOptions,
} from "../../src/cli/validation.js";

describe("CLI validation", () => {
  it("validates text", () => {
    expect(validateRequiredText(" value ", "Field").value).toBe("value");
    expect(validateRequiredText(" ", "Field")._unsafeUnwrapErr().message).toBe(
      "Field is required.",
    );
    expect(validateOptionalText(undefined, "Field").value).toBeUndefined();
    expect(validateOptionalText(" x ", "Field").value).toBe("x");
  });

  it("validates positive integers", () => {
    expect(validatePositiveInteger("10", "Page").value).toBe(10);
    expect(validatePositiveInteger("0", "Page")._unsafeUnwrapErr().message).toBe(
      "Page must be a positive integer.",
    );
    expect(validatePositiveInteger("1.5", "Page")._unsafeUnwrapErr().message).toBe(
      "Page must be a positive integer.",
    );
  });

  it("validates ISO datetimes with timezone", () => {
    expect(validateIsoDateTime("2026-06-19T00:00:00.000Z", "From").value).toBe(
      "2026-06-19T00:00:00.000Z",
    );
    expect(validateOptionalIsoDateTime(undefined, "From").value).toBeUndefined();
    expect(validateIsoDateTime("2026-06-19", "From")._unsafeUnwrapErr().message).toBe(
      "From must be an ISO date-time with timezone.",
    );
  });

  it("validates page options", () => {
    expect(validatePageOptions({}).value).toEqual({ page: 1, pageSize: 50 });
    expect(validatePageOptions({ pageSize: "1001" })._unsafeUnwrapErr().message).toBe(
      "Page size must be less than or equal to 1000.",
    );
  });

  it("validates resource and task options", () => {
    expect(
      validateResourceListOptions({
        profile: "default",
        workspaceId: "w1",
        page: "2",
        pageSize: "20",
        format: "csv",
      }).value,
    ).toEqual({
      profile: "default",
      workspaceId: "w1",
      page: 2,
      pageSize: 20,
      format: "csv",
    });
    expect(validateTaskListOptions({ projectId: "p1" }).value.projectId).toBe("p1");
    expect(validateTaskListOptions({ projectId: " " })._unsafeUnwrapErr().message).toBe(
      "Project id is required.",
    );
  });

  it("validates time entry options", () => {
    expect(
      validateTimeEntriesListOptions({
        userId: " u1 ",
        from: "2026-06-19T00:00:00.000Z",
        to: "2026-06-20T00:00:00.000Z",
      }).value,
    ).toEqual({
      page: 1,
      pageSize: 50,
      profile: undefined,
      workspaceId: undefined,
      format: undefined,
      userId: "u1",
      start: "2026-06-19T00:00:00.000Z",
      end: "2026-06-20T00:00:00.000Z",
    });
  });

  it("validates timer options", () => {
    expect(
      validateTimerStartOptions({
        description: " Work ",
        projectId: " p1 ",
        taskId: " task1 ",
        tagId: ["tag1"],
        billable: true,
      }).value,
    ).toEqual({
      profile: undefined,
      workspaceId: undefined,
      description: "Work",
      projectId: "p1",
      taskId: "task1",
      tagIds: ["tag1"],
      billable: true,
    });
    expect(validateTimerStartOptions({ description: " " })._unsafeUnwrapErr().message).toBe(
      "Description is required.",
    );
    expect(
      validateTimerStopOptions({
        userId: " u1 ",
        end: "2026-06-19T01:00:00.000Z",
      }).value,
    ).toEqual({
      profile: undefined,
      workspaceId: undefined,
      userId: "u1",
      end: "2026-06-19T01:00:00.000Z",
    });
  });

  it("validates write command options", () => {
    expect(
      validateTimeEntryUpdateOptions({
        timeEntryId: "te1",
        start: "2026-06-19T00:00:00.000Z",
        end: "2026-06-19T01:00:00.000Z",
        description: "Work",
        projectId: "p1",
        tagId: ["tag1"],
        clearTags: true,
      })._unsafeUnwrapErr().message,
    ).toBe("Clear tags cannot be combined with tag ids.");

    expect(
      validateProjectUpdateOptions({
        projectId: "p1",
        color: "#123ABC",
        archived: false,
      }).value,
    ).toEqual({
      profile: undefined,
      workspaceId: undefined,
      format: undefined,
      projectId: "p1",
      name: undefined,
      clientId: undefined,
      color: "#123ABC",
      archived: false,
      billable: undefined,
      public: undefined,
      note: undefined,
    });
    expect(validateProjectUpdateOptions({ projectId: "p1" })._unsafeUnwrapErr().message).toBe(
      "At least one project field is required.",
    );
    expect(
      validateProjectUpdateOptions({ projectId: "p1", color: "123ABC" })._unsafeUnwrapErr().message,
    ).toBe("Color must be a #RRGGBB color.");
  });

  it("validates custom field JSON and user invite email", () => {
    expect(
      validateProjectCustomFieldUpdateOptions({
        projectId: "p1",
        customFieldId: "cf1",
        defaultValue: '"Internal"',
        status: "VISIBLE",
      }).value,
    ).toEqual({
      profile: undefined,
      workspaceId: undefined,
      format: undefined,
      projectId: "p1",
      customFieldId: "cf1",
      defaultValue: "Internal",
      status: "VISIBLE",
    });
    expect(
      validateProjectCustomFieldUpdateOptions({
        projectId: "p1",
        customFieldId: "cf1",
        defaultValue: "{",
      })._unsafeUnwrapErr().message,
    ).toBe("Default value must be valid JSON.");
    expect(
      validateProjectCustomFieldUpdateOptions({
        projectId: "p1",
        customFieldId: "cf1",
      })._unsafeUnwrapErr().message,
    ).toBe("At least one custom field update option is required.");
    expect(validateUserInviteOptions({ email: "bad" })._unsafeUnwrapErr().message).toBe(
      "Email must be an email address.",
    );
  });
});
