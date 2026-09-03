import { describe, expect, it } from "vitest";
import { storyCollectionSchemas } from "./schema";

function nestedNot(depth: number) {
  let expression: unknown = { kind: "predicate", predicate: { kind: "tag", value: "quiet" } };
  for (let index = 0; index < depth; index += 1) expression = { kind: "not", item: expression };
  return expression;
}

describe("lens expression complexity preflight", () => {
  it("rejects a very deep expression without a recursive validation exception", () => {
    const candidate = [{ id: "deep", name: "Deep", color: "#123456", expression: nestedNot(1_000) }];
    let result: ReturnType<typeof storyCollectionSchemas.lenses.safeParse>;
    expect(() => { result = storyCollectionSchemas.lenses.safeParse(candidate); }).not.toThrow();
    expect(result!.success).toBe(false);
  });

  it("accepts a normal nested expression", () => {
    const candidate = [{ id: "nested", name: "Nested", color: "#123456", expression: nestedNot(8) }];
    expect(storyCollectionSchemas.lenses.safeParse(candidate).success).toBe(true);
  });
});
