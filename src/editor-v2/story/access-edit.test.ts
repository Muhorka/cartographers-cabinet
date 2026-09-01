import { describe, expect, it } from "vitest";
import { defaultStoryAccessPolicy } from "./types";
import { editedAccessFields } from "./access-edit";
describe("sparse bulk access editing", () => {
  const base = { ...defaultStoryAccessPolicy(), deny: ["intruder"], guardIds: ["guard"], allow: ["staff"] };
  it("changes only requested policy fields", () => {
    const result = editedAccessFields(base, { ...defaultStoryAccessPolicy(), allow: ["guest"] }, ["allow"], "replace");
    expect(result.allow).toEqual(["guest"]); expect(result.deny).toEqual(["intruder"]); expect(result.guardIds).toEqual(["guard"]);
  });
  it("adding or removing one list does not remove the remaining rules", () => {
    for (const action of ["add", "remove"] as const) {
      const result = editedAccessFields(base, { ...defaultStoryAccessPolicy(), allow: ["staff"] }, ["allow"], action);
      expect(result.deny).toEqual(["intruder"]); expect(result.guardIds).toEqual(["guard"]); expect(result.allow).toEqual(action === "remove" ? [] : ["staff"]);
    }
  });
});
