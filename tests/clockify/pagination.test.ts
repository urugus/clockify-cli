import { describe, expect, it } from "vitest";
import {
  appendPageParams,
  isLastPageHeader,
  normalizePageInput,
  validatePageNumber,
  validatePageSize,
} from "../../src/clockify/pagination.js";

describe("pagination", () => {
  it("normalizes default page input", () => {
    expect(normalizePageInput({}).value).toEqual({ page: 1, pageSize: 50 });
  });

  it("validates page numbers and page size", () => {
    expect(validatePageNumber(1, "Page").value).toBe(1);
    expect(validatePageNumber(0, "Page")._unsafeUnwrapErr().message).toBe(
      "Page must be a positive integer.",
    );
    expect(validatePageSize(1001)._unsafeUnwrapErr().message).toBe(
      "Page size must be less than or equal to 1000.",
    );
  });

  it("appends page params without mutating existing params", () => {
    const params = new URLSearchParams({ archived: "false" });
    const result = appendPageParams(params, { page: 2, pageSize: 100 });

    expect(params.toString()).toBe("archived=false");
    expect(result.toString()).toBe("archived=false&page=2&pageSize=100");
  });

  it("detects last page headers", () => {
    expect(isLastPageHeader("true")).toBe(true);
    expect(isLastPageHeader("TRUE")).toBe(true);
    expect(isLastPageHeader("false")).toBe(false);
    expect(isLastPageHeader(null)).toBe(false);
  });
});
