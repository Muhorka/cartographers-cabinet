import { describe, expect, it } from "vitest";
import { createProjectCheckpoint, type ProjectCheckpoint } from "../../persistence/project-checkpoint";
import { defaultStoryAccessPolicy, type StoryObjectRef } from "../types";
import { readProposalChanges } from "./proposal-change-review";
import { reviewFixture } from "./review-test-fixture";

const roomA: StoryObjectRef = { kind: "room", id: "room-0", scopeId: "construction" };
const roomAAlias: StoryObjectRef = { kind: "room", id: "room-0", scopeId: "level" };
const roomB: StoryObjectRef = { kind: "room", id: "room-1", scopeId: "construction" };
const roomCollision: StoryObjectRef = { kind: "room", id: "room-0", scopeId: "construction-b" };

function access(lock: "none" | "locked" = "none") {
  return { ...defaultStoryAccessPolicy(), lock };
}

function proposalPair() {
  const before = reviewFixture();
  before.story.world.push({ id: "bob", kind: "character", name: "Bob", tags: [], properties: {} });
  const secondConstruction = structuredClone(before.constructions[0]!);
  secondConstruction.id = "construction-b";
  before.constructions.push(secondConstruction);
  before.places.push({ id: "level-b", name: "Second level", kind: "level", constructionId: "construction-b", transform: { x: 0, y: 0, rotation: 0 }, access: [], tags: [], properties: {} });
  before.places.push({ id: "room-0", parentId: "level", name: "Room 1", kind: "room", transform: { x: 0, y: 0, rotation: 0 }, access: [], tags: [], properties: {} });
  before.story.objects = [
    { ref: roomA, metadata: { owners: ["alice"], access: access() } },
    { ref: roomB, metadata: { owners: ["alice"], properties: {} } },
    { ref: roomCollision, metadata: { owners: ["alice"] } },
  ];
  before.story.groups = [{ id: "inherited", name: "Inherited owners", memberRefs: [roomB], entryIds: [], metadata: { owners: ["bob"] } }];
  before.story.scenarios = [{ id: "night", name: "Night before", patches: [], steps: [{ id: "lock", name: "Lock before", patches: [{ id: "room-step", target: roomA, metadata: { owners: ["alice"], access: access() } }] }] }];

  const after = structuredClone(before);
  after.story.world.find(({ id }) => id === "alice")!.name = "Bob";
  after.places.find(({ id }) => id === "room-0")!.name = "Renamed room";
  after.constructions[1]!.rooms[0]!.name = "Other room";
  after.story.scenarios[0]!.name = "Night after";
  after.story.scenarios[0]!.steps[0]!.name = "Lock after";
  after.story.scenarios[0]!.steps[0]!.patches[0]!.metadata = { owners: ["bob"], access: access("locked") };
  after.story.objects.find(({ ref }) => ref.scopeId === roomCollision.scopeId)!.metadata.owners = ["bob"];
  delete after.story.objects[1]!.metadata.owners;
  after.story.objects[1]!.metadata.properties = { empty: [], flag: false, score: 0 };
  return { before, after };
}

function checkpoint(before: ReturnType<typeof reviewFixture>, after: ReturnType<typeof reviewFixture>): ProjectCheckpoint {
  return createProjectCheckpoint(after, { id: "proposal", name: "Synthetic proposal", kind: "proposal", baseSnapshot: before });
}

describe("proposal change review", () => {
  it("keeps an authored change when a later patch leaves the effective value unchanged", () => {
    const { before } = proposalPair();
    before.story.scenarios[0].patches = [{ id: "first", target: roomA, title: "Earlier" }, { id: "last", target: roomA, title: "Visible" }];
    const after = structuredClone(before); after.story.scenarios[0].patches[0].title = "Proposed";
    const result = readProposalChanges(checkpoint(before, after), before, { checkpointId: "proposal" });
    expect(result).toMatchObject({ status: "ready", total: 1, rows: [{ authoredBefore: { present: true, value: "Earlier" }, authoredAfter: { present: true, value: "Proposed" }, effectiveBefore: { present: true, value: "Visible" }, effectiveAfter: { present: true, value: "Visible" }, effectiveChanged: false }] });
  });

  it("fails closed for ambiguous patch and context identities in stored proposals", () => {
    for (const collision of ["patch", "step", "scenario"] as const) {
      const { before, after } = proposalPair();
      const saved = checkpoint(before, after);
      const scenario = after.story.scenarios[0]; const step = scenario.steps[0];
      if (collision === "patch") step.patches.push({ ...structuredClone(step.patches[0]), target: roomB });
      if (collision === "step") scenario.steps.push({ ...structuredClone(step), patches: [{ id: "other-patch", target: roomB, metadata: { tags: ["new"] } }] });
      if (collision === "scenario") after.story.scenarios.push({ ...structuredClone(scenario), patches: [], steps: [] });
      saved.snapshot = after; // Exercise the pure reader directly with a malformed historical pair.
      const result = readProposalChanges(saved, before, { checkpointId: "proposal", context: { scenarioId: "night", stepId: "lock" } });
      expect(result).toMatchObject({ status: "ready", rows: [], coverage: { unsupportedChanges: expect.arrayContaining(["ambiguous-story-records"]) } });
    }
  });

  it("returns unavailable when the stored after snapshot is absent", () => {
    const { before, after } = proposalPair(); const saved = checkpoint(before, after);
    Reflect.deleteProperty(saved, "snapshot");
    expect(readProposalChanges(saved, before, { checkpointId: "proposal" })).toEqual({ status: "unavailable", reason: "proposal-pair-unavailable" });
  });

  it("reads exact owner and lock changes in the same step context", () => {
    const { before, after } = proposalPair();
    const result = readProposalChanges(checkpoint(before, after), before, { checkpointId: "proposal", context: { scenarioId: "night", stepId: "lock" } });
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.applicability).toBe("current");
    expect(result.rows.filter(({ ref }) => ref.id === roomA.id).map(({ fieldKey, authoredBefore, authoredAfter, effectiveBefore, effectiveAfter }) => ({ fieldKey, authoredBefore, authoredAfter, effectiveBefore, effectiveAfter }))).toEqual([
      { fieldKey: "access.lock", authoredBefore: { present: true, value: "none" }, authoredAfter: { present: true, value: "locked" }, effectiveBefore: { present: true, value: "none" }, effectiveAfter: { present: true, value: "locked" } },
      { fieldKey: "owners", authoredBefore: { present: true, value: ["alice"] }, authoredAfter: { present: true, value: ["bob"] }, effectiveBefore: { present: true, value: ["alice"] }, effectiveAfter: { present: true, value: ["bob"] } },
    ]);
  });

  it("keeps scoped room references separate and preserves historical names", () => {
    const { before, after } = proposalPair();
    const saved = checkpoint(before, after);
    const result = readProposalChanges(saved, before, { checkpointId: "proposal", refs: [roomA, roomCollision] });
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.rows.some(({ ref }) => ref.scopeId === "construction-b" && ref.id === roomA.id)).toBe(true);
    const aliasResult = readProposalChanges(saved, before, { checkpointId: "proposal", refs: [roomAAlias] });
    expect(aliasResult.status).toBe("ready");
    if (aliasResult.status !== "ready") return;
    expect(aliasResult.total).toBe(result.rows.filter(({ ref }) => ref.scopeId === "construction").length);
    const owner = result.rows.find(({ fieldKey, source }) => fieldKey === "owners" && source.stepId === "lock");
    expect(owner?.names).toMatchObject({ scenarioBefore: "Night before", scenarioAfter: "Night after", stepBefore: "Lock before", stepAfter: "Lock after", scopeBefore: "Hall level", scopeAfter: "Hall level" });
    expect(owner?.display.pl).toMatchObject({ objectBefore: "Room 1", objectAfter: "Renamed room", authoredBefore: "Alice", authoredAfter: "Bob" });
    expect(after.story.scenarios[0]!.steps[0]!.patches[0]!.metadata?.owners).toEqual(["bob"]);
  });

  it("reports authored removals separately from inherited effective values and keeps explicit falsy values", () => {
    const { before, after } = proposalPair();
    const result = readProposalChanges(checkpoint(before, after), before, { checkpointId: "proposal", refs: [roomB] });
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    const fields = result.rows.map(({ fieldKey, operation, authoredBefore, authoredAfter, effectiveBefore, effectiveAfter }) => ({ fieldKey, operation, authoredBefore, authoredAfter, effectiveBefore, effectiveAfter }));
    expect(fields).toEqual(expect.arrayContaining([
      { fieldKey: "owners", operation: "remove", authoredBefore: { present: true, value: ["alice"] }, authoredAfter: { present: false }, effectiveBefore: { present: true, value: ["alice"] }, effectiveAfter: { present: true, value: ["bob"] } },
      { fieldKey: "property:empty", operation: "add", authoredBefore: { present: false }, authoredAfter: { present: true, value: [] }, effectiveBefore: { present: false }, effectiveAfter: { present: true, value: [] } },
      { fieldKey: "property:flag", operation: "add", authoredBefore: { present: false }, authoredAfter: { present: true, value: false }, effectiveBefore: { present: false }, effectiveAfter: { present: true, value: false } },
      { fieldKey: "property:score", operation: "add", authoredBefore: { present: false }, authoredAfter: { present: true, value: 0 }, effectiveBefore: { present: false }, effectiveAfter: { present: true, value: 0 } },
    ]));
  });

  it("marks a current project stale without rebasing historical rows", () => {
    const { before, after } = proposalPair();
    const current = structuredClone(after);
    current.story.world.find(({ id }) => id === "alice")!.name = "Current name";
    const result = readProposalChanges(checkpoint(before, after), current, { checkpointId: "proposal", refs: [roomA] });
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.applicability).toBe("stale");
    const owner = result.rows.find(({ fieldKey, source }) => fieldKey === "owners" && source.stepId === "lock");
    expect(owner?.display.pl.authoredBefore).toBe("Alice");
    expect(owner?.display.pl.authoredAfter).toBe("Bob");
  });

  it("supports 25 and 50 row pages, explicit empty scope, and cursor bindings", () => {
    const { before, after } = proposalPair();
    for (let index = 0; index < 55; index += 1) {
      const ref = { kind: "place" as const, id: `missing-${index}` };
      before.story.objects.push({ ref, metadata: {} });
      after.story.objects.push({ ref, metadata: { tags: [`tag-${index}`] } });
    }
    const saved = checkpoint(before, after);
    const page25 = readProposalChanges(saved, before, { checkpointId: "proposal", limit: 25 });
    expect(page25.status).toBe("ready");
    if (page25.status !== "ready" || !page25.nextCursor) return;
    expect(page25.limit).toBe(25);
    expect(page25.rows).toHaveLength(25);
    const page50 = readProposalChanges(saved, before, { checkpointId: "proposal", limit: 50 });
    expect(page50.status).toBe("ready");
    if (page50.status !== "ready") return;
    expect(page50.rows).toHaveLength(50);
    expect(readProposalChanges(saved, before, { checkpointId: "proposal", refs: [] })).toMatchObject({ status: "ready", total: 0, rows: [] });
    expect(readProposalChanges(saved, before, { checkpointId: "proposal", refs: [roomA], cursor: page25.nextCursor })).toMatchObject({ status: "invalid-cursor" });
    expect(readProposalChanges(saved, before, { checkpointId: "proposal", limit: 0 })).toMatchObject({ status: "invalid-input" });
    expect(readProposalChanges(saved, before, { checkpointId: "proposal", limit: 51 })).toMatchObject({ status: "invalid-input" });
    const changed = structuredClone(saved); changed.snapshot.story.objects[0]!.metadata.tags = ["revision-change"];
    expect(readProposalChanges(changed, before, { checkpointId: "proposal", cursor: page25.nextCursor })).toMatchObject({ status: "invalid-cursor" });
  });

  it("reports unsupported group changes and missing historical contexts", () => {
    const { before, after } = proposalPair();
    const withGroupChange = structuredClone(after);
    withGroupChange.story.groups.push({ id: "new-group", name: "Unsupported group", memberRefs: [], entryIds: [], metadata: {} });
    const groupResult = readProposalChanges(checkpoint(before, withGroupChange), before, { checkpointId: "proposal" });
    expect(groupResult.status).toBe("ready");
    if (groupResult.status !== "ready") return;
    expect(groupResult.coverage.unsupportedChanges).toContain("story.zones");

    const withoutContext = structuredClone(after);
    withoutContext.story.scenarios = [];
    const missingResult = readProposalChanges(checkpoint(before, withoutContext), before, { checkpointId: "proposal", context: { scenarioId: "night", stepId: "lock" } });
    expect(missingResult.status).toBe("ready");
    if (missingResult.status !== "ready") return;
    expect(missingResult.rows.some(({ missing }) => missing.contextBefore === false && missing.contextAfter === true)).toBe(true);
  });
});
