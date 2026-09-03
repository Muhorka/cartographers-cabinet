import { describe, expect, it } from "vitest";
import { svgId } from "./svg-id";

describe("svgId", () => {
  it("keeps short safe ids readable", () => {
    expect(svgId("upper-plan_2")).toBe("upper-plan_2");
  });

  it("does not collapse different authored ids to the same fragment", () => {
    expect(svgId("a:b")).not.toBe(svgId("a?b"));
    expect(svgId("ab")).not.toBe(svgId("a\u0000b"));
    expect(svgId("x".repeat(500) + "a")).not.toBe(svgId("x".repeat(500) + "b"));
  });

  it("always returns a non-empty safe fragment", () => {
    expect(svgId("")).toMatch(/^id-[a-z0-9]+$/i);
    expect(svgId("quoted\" id")).toMatch(/^[a-zA-Z0-9_-]+$/);
  });
});
