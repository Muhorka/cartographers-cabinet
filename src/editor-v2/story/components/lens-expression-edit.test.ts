import { describe, expect, it } from "vitest";
import { appendLensPredicate, changeLensMode, removeLensNode } from "./lens-expression-edit";
import type { StoryLensExpression } from "../types";

const nested: StoryLensExpression = { kind: "all", items: [
  { kind: "predicate", predicate: { kind: "owner", entryId: "anna" } },
  { kind: "any", items: [
    { kind: "predicate", predicate: { kind: "tag", value: "romantic" } },
    { kind: "not", item: { kind: "predicate", predicate: { kind: "zone", zoneId: "danger" } } },
  ] },
] };

describe("shared lens expression editing", () => {
  it("retains nested conditions when adding a rule", () => {
    const result = appendLensPredicate(nested, { kind: "access", entryId: "guest", state: "allowed" });
    expect(result).toMatchObject({ kind: "all", items: [...nested.items, { kind: "predicate", predicate: { kind: "access", entryId: "guest", state: "allowed" } }] });
  });
  it("negates the whole expression, without losing all but its first rule", () => {
    expect(changeLensMode(nested, "not")).toEqual({ kind: "not", item: nested });
    expect(changeLensMode(changeLensMode(nested, "not"), "all")).toEqual(nested);
  });
  it("removes only the indicated nested rule", () => {
    expect(removeLensNode(nested, [1, 0])).toEqual({ kind: "all", items: [nested.items[0], { kind: "any", items: [(nested.items[1] as { kind: "any"; items: StoryLensExpression[] }).items[1]] }] });
    expect(nested.items).toHaveLength(2);
  });
});
