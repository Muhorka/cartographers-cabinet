import { describe, expect, it } from "vitest";
import { sameJsonValue, stableJsonStringify } from "./json-value";

describe("stable JSON values", () => {
  it("compares object key order while preserving array order", () => {
    expect(sameJsonValue({ b: 2, a: 1 }, { a: 1, b: 2 })).toBe(true);
    expect(sameJsonValue({ values: [1, 2] }, { values: [2, 1] })).toBe(false);
  });

  it("retains nested values without mutating the inputs", () => {
    const left = { nested: { b: { value: false }, a: { value: 0 } }, refs: [{ id: "one", scope: "north" }] };
    const right = { refs: [{ scope: "north", id: "one" }], nested: { a: { value: 0 }, b: { value: false } } };
    const before = structuredClone(left);
    expect(sameJsonValue(left, right)).toBe(true);
    expect(left).toEqual(before);
  });

  it("matches JSON semantics for undefined and safely retains a __proto__ key", () => {
    expect(stableJsonStringify(undefined)).toBeUndefined();
    expect(stableJsonStringify({ omitted: undefined, kept: null })).toBe('{"kept":null}');
    const value = JSON.parse('{"__proto__":{"safe":true}}') as Record<string, unknown>;
    expect(stableJsonStringify(value)).toBe('{"__proto__":{"safe":true}}');
    expect(Object.prototype).not.toHaveProperty("safe");
  });
});
