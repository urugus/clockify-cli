import { describe, expect, it } from "vitest";
import {
  csvColumns,
  formatCsv,
  formatJson,
  formatValue,
  parseOutputFormat,
} from "../../src/output/format.js";

describe("output format", () => {
  it("parses supported output formats", () => {
    expect(parseOutputFormat(undefined).value).toBe("json");
    expect(parseOutputFormat("json").value).toBe("json");
    expect(parseOutputFormat("csv").value).toBe("csv");
  });

  it("rejects unsupported output formats", () => {
    const result = parseOutputFormat("table");

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().message).toBe("Unsupported output format: table");
  });

  it("formats JSON", () => {
    expect(formatJson({ id: "u1" })).toBe('{\n  "id": "u1"\n}\n');
  });

  it("collects CSV columns in first-seen order", () => {
    expect(csvColumns([{ a: 1 }, { b: 2, a: 3 }])).toEqual(["a", "b"]);
  });

  it("formats CSV with escaping and nested values", () => {
    expect(
      formatCsv([
        { id: "1", text: "hello, world", nested: { ok: true }, empty: null },
        { id: "2", text: 'quote "here"', nested: ["x"], empty: undefined },
      ]),
    ).toBe(
      'id,text,nested,empty\n1,"hello, world","{""ok"":true}",\n2,"quote ""here""","[""x""]",\n',
    );
  });

  it("formats empty CSV as an empty string", () => {
    expect(formatCsv([])).toBe("");
  });

  it("formats scalar values as one CSV row", () => {
    expect(formatValue({ id: "x" }, "csv")).toBe("id\nx\n");
  });
});
