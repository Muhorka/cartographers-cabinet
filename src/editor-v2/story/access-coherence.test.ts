import { describe, expect, it } from "vitest";
import { emptyProject } from "../model/project-model";
import { storyAccessDecision } from "./routes/access";
import { emptyStoryData } from "./types";
import { evaluateLens, evaluateProjectLens, storyAccess } from "./evaluation";

function fixture() {
  const project = emptyProject("access", "Access coherence");
  project.constructions = [{ id: "plan", revision: 0, walls: [], rooms: [], openings: [{ id: "door", kind: "door", wallId: "wall", position: .5, width: 1 }], transitions: [] }];
  project.story = { ...emptyStoryData(), world: [
    { id: "anna", kind: "character", name: "Anna", tags: [], properties: {} },
    { id: "staff", kind: "access-group", name: "Staff", tags: [], properties: {} },
    { id: "wardens", kind: "faction", name: "Wardens", tags: [], properties: {} },
    { id: "owner", kind: "character", name: "Owner", tags: [], properties: {} },
    { id: "intruder", kind: "character", name: "Intruder", tags: [], properties: {} },
    { id: "brass", kind: "key", name: "Brass", tags: [], properties: {} },
  ], memberships: [
    { subjectId: "anna", groupId: "staff", kind: "member-of", source: "manual" },
    { subjectId: "anna", groupId: "wardens", kind: "member-of", source: "manual" },
    { subjectId: "wardens", groupId: "brass", kind: "holds-key", source: "manual" },
    { subjectId: "intruder", groupId: "brass", kind: "holds-key", source: "manual" },
  ], objects: [{ ref: { kind: "opening", id: "door", scopeId: "plan" }, metadata: { owners: ["owner"], access: { allow: ["staff"], deny: ["intruder"], permission: "restricted", physicalState: "closed", lock: "locked", keyIds: ["brass"], guardIds: [], secretKnowledge: [] } } }], lenses: [
    { id: "access", name: "Access", color: "#000000", expression: { kind: "predicate", predicate: { kind: "access", entryId: "anna", state: "allowed" } } },
    { id: "owner", name: "Owner", color: "#000000", expression: { kind: "predicate", predicate: { kind: "owner", entryId: "owner" } } },
    { id: "excluded", name: "Excluded", color: "#000000", expression: { kind: "predicate", predicate: { kind: "access", entryId: "intruder", state: "denied" } } },
  ] };
  return project;
}

const opening = { kind: "opening" as const, id: "door", scopeId: "plan" };

describe("canonical story access", () => {
  it("uses transitive membership, ownership, exclusions, and stable ids in lenses", () => {
    const project = fixture(); project.story.world = project.story.world.map((entry) => entry.id === "anna" ? { ...entry, name: "Anna Renamed" } : entry.id === "staff" ? { ...entry, name: "Household" } : entry);
    expect(evaluateLens(project.story, "access", opening)?.match).toBe(true);
    expect(evaluateProjectLens(project, project.story, "access", opening)?.match).toBe(true);
    expect(evaluateLens(project.story, "owner", opening)?.match).toBe(true);
    expect(evaluateLens(project.story, "excluded", opening)?.match).toBe(true);
  });

  it("keeps permission and physical traversability separate while sharing key closure", () => {
    const project = fixture(); const narrative = storyAccess(project.story, opening, "anna");
    expect(narrative.allowed).toBe(true); expect(narrative.physicalOpen).toBe(false);
    const route = storyAccessDecision(project, opening, { actorId: "anna" });
    expect(route).toMatchObject({ allowed: true, conditions: ["Unlock and open door."] });
    const excluded = storyAccessDecision(project, opening, { actorId: "intruder" });
    expect(typeof excluded).toBe("object"); if (typeof excluded !== "boolean") { expect(excluded.allowed).toBe(false); expect(excluded.reason).toContain("explicit-deny"); }
  });
});
