import { describe, expect, it } from "vitest";
import { parseTextareaSizes, textareaSizeStorageKey } from "./use-persisted-textarea-sizes";

describe("textarea size persistence", () => {
  it("scopes preferences to a project", () => {
    expect(textareaSizeStorageKey("estate")).toBe("cartographer-textarea-sizes:estate");
    expect(textareaSizeStorageKey("other")).not.toBe(textareaSizeStorageKey("estate"));
  });

  it("accepts safe pixel heights and ignores malformed browser data", () => {
    expect(parseTextareaSizes(JSON.stringify({ description: "180px", tiny: "12px", huge: "9000px", width: "50%" }))).toEqual({ description: "180px" });
    expect(parseTextareaSizes("not json")).toEqual({});
  });
});
