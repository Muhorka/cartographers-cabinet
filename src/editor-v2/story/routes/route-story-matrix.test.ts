import { describe, expect, it } from "vitest";
import { createConstructionDocument } from "../../construction/construction-document";
import type { CanonicalWall } from "../../geometry/geometry-types";
import { emptyProject, type EditorProject } from "../../model/project-model";
import { effectiveWorldEntry } from "../world-entry-effective";
import { defaultStoryAccessPolicy, type StoryAccessPolicy } from "../types";
import { findStoryRoutes } from "./planner";
import type { StoryRouteRequest } from "./types";

const wall = (id: string, x1: number, y1: number, x2: number, y2: number, role: CanonicalWall["role"] = "boundary"): CanonicalWall => ({
  id, start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, role, thickness: 0.2,
});
const outerWalls = (width: number): CanonicalWall[] => [
  wall("south", 0, 0, width, 0), wall("east", width, 0, width, 10),
  wall("north", width, 10, 0, 10), wall("west", 0, 10, 0, 0),
];

function constructionProject(walls: CanonicalWall[], openings: EditorProject["constructions"][number]["openings"]) {
  let roomNumber = 0;
  const document = createConstructionDocument("construction", walls, {
    createId: () => `room-${roomNumber++}`,
    createName: (index) => `Room ${index}`,
  });
  document.openings = openings;
  const project = emptyProject("route-matrix", "Route matrix");
  project.places.push({ id: "level", name: "Ground", kind: "level", transform: { x: 0, y: 0, rotation: 0 }, constructionId: document.id, tags: [], access: [], properties: {} });
  project.constructions.push(document);
  return project;
}

function twoRoomProject() {
  const project = constructionProject([...outerWalls(10), wall("partition", 5, 0, 5, 10, "partition")], [
    { id: "door", kind: "door", wallId: "partition", position: 0.5, width: 1 },
  ]);
  project.story.world.push(
    { id: "alice", kind: "character", name: "Alice", tags: [], properties: { title: "steward" } },
    { id: "intruder", kind: "character", name: "Intruder", tags: [], properties: {} },
    { id: "staff", kind: "access-group", name: "Staff", tags: [], properties: { uniform: "blue" } },
    { id: "court", kind: "faction", name: "Court", tags: [], properties: { rank: "household" } },
    { id: "banned", kind: "access-group", name: "Banned", tags: [], properties: {} },
    { id: "brass", kind: "key", name: "Brass key", tags: [], properties: {} },
    { id: "secret", kind: "access-group", name: "Secret passage", tags: [], properties: {} },
  );
  project.story.memberships.push(
    { subjectId: "alice", groupId: "staff", kind: "member-of", source: "manual" },
    { subjectId: "staff", groupId: "court", kind: "member-of", source: "manual" },
    { subjectId: "intruder", groupId: "banned", kind: "member-of", source: "manual" },
  );
  return project;
}

const request = {
  from: { placeId: "level", point: { x: 2, y: 5 } },
  to: { placeId: "level", point: { x: 8, y: 5 } },
} satisfies StoryRouteRequest;
const doorRef = { kind: "opening" as const, id: "door", scopeId: "construction" };
const access = (changes: Partial<StoryAccessPolicy> = {}): StoryAccessPolicy => ({ ...defaultStoryAccessPolicy(), ...changes });
function setDoorAccess(project: EditorProject, value: StoryAccessPolicy) {
  project.story.objects = [{ ref: doorRef, metadata: { access: value } }];
}
function route(project: EditorProject, options: Omit<Partial<StoryRouteRequest>, "from" | "to"> = {}) {
  return findStoryRoutes(project, { ...request, ...options });
}
function diagnosticText(result: ReturnType<typeof findStoryRoutes>) {
  return [...(result.route?.conditions ?? []), ...result.missingFacts, ...result.reasons].join(" ");
}

describe("route and Story access matrix", () => {
  it.each([
    { name: "no authored rule without actor", actorId: undefined, policy: undefined, status: "ready" },
    { name: "no authored rule with actor", actorId: "alice", policy: undefined, status: "ready" },
    { name: "allow rule without actor", actorId: undefined, policy: access({ permission: "restricted", allow: ["court"] }), status: "ready", text: "Confirm who" },
    { name: "allow rule with inherited group", actorId: "alice", policy: access({ permission: "restricted", allow: ["court"] }), status: "ready" },
    { name: "deny rule without actor", actorId: undefined, policy: access({ deny: ["banned"] }), status: "ready" },
    { name: "deny rule with matching actor", actorId: "intruder", policy: access({ deny: ["banned"] }), status: "unreachable", text: "explicit-deny" },
    { name: "Nobody rule without actor", actorId: undefined, policy: access({ permission: "nobody" }), status: "ready", text: "Nobody" },
    { name: "Nobody rule with actor", actorId: "alice", policy: access({ permission: "nobody" }), status: "unreachable", text: "nobody" },
  ])("resolves $name", ({ actorId, policy, status, text }) => {
    const project = twoRoomProject(); if (policy) setDoorAccess(project, policy);
    const result = route(project, actorId ? { actorId } : {});
    expect(result.status).toBe(status); if (text) expect(diagnosticText(result)).toContain(text);
  });

  it("keeps direct and inherited traits distinct while group access uses the same membership closure", () => {
    const project = twoRoomProject(); setDoorAccess(project, access({ permission: "restricted", allow: ["court"] }));
    const actor = effectiveWorldEntry(project.story, "alice");
    expect(actor?.properties).toMatchObject({ title: "steward", uniform: "blue", rank: "household" });
    expect(actor?.propertySources.title).toMatchObject({ inherited: false, sourceIds: ["alice"] });
    expect(actor?.propertySources.uniform).toMatchObject({ inherited: true, sourceIds: ["staff"] });
    expect(actor?.propertySources.rank).toMatchObject({ inherited: true, sourceIds: ["court"] });
    expect(route(project, { actorId: "alice" }).status).toBe("ready");
  });

  it.each([
    { name: "open", policy: access(), actorId: "alice", status: "ready", absent: "Open door" },
    { name: "closed", policy: access({ physicalState: "closed" }), actorId: "alice", status: "ready", text: "Open door" },
    { name: "locked, unowned key, actorless", policy: access({ lock: "locked", keyIds: ["brass"] }), actorId: undefined, status: "ready", text: "A key" },
    { name: "locked, unowned key, actor present", policy: access({ lock: "locked", keyIds: ["brass"] }), actorId: "alice", status: "unknown", text: "key is required" },
    { name: "locked, directly held key", policy: access({ physicalState: "closed", lock: "locked", keyIds: ["brass"] }), actorId: "alice", setup: "direct-key", status: "ready", text: "Unlock and open" },
    { name: "locked, group-held key", policy: access({ physicalState: "closed", lock: "locked", keyIds: ["brass"] }), actorId: "alice", setup: "group-key", status: "ready", text: "Unlock and open" },
    { name: "hidden, actorless", policy: access({ hidden: true, knownBy: ["alice"] }), actorId: undefined, status: "ready", text: "hidden passage" },
    { name: "hidden, unknown to actor", policy: access({ hidden: true, knownBy: ["secret"] }), actorId: "alice", status: "unknown", text: "hidden" },
    { name: "hidden, directly known", policy: access({ hidden: true, knownBy: ["alice"] }), actorId: "alice", status: "ready" },
    { name: "hidden, knowledge held by group", policy: access({ hidden: true, secretKnowledge: ["secret"] }), actorId: "alice", setup: "group-knows", status: "ready" },
  ])("resolves $name", ({ policy, actorId, setup, status, text, absent }) => {
    const project = twoRoomProject(); setDoorAccess(project, policy);
    if (setup === "direct-key") project.story.memberships.push({ subjectId: "alice", groupId: "brass", kind: "holds-key", source: "manual" });
    if (setup === "group-key") project.story.memberships.push({ subjectId: "staff", groupId: "brass", kind: "holds-key", source: "manual" });
    if (setup === "group-knows") project.story.memberships.push({ subjectId: "staff", groupId: "secret", kind: "knows", source: "manual" });
    const result = route(project, actorId ? { actorId } : {}); const details = diagnosticText(result);
    expect(result.status).toBe(status); if (text) expect(details).toContain(text); if (absent) expect(details).not.toContain(absent);
  });

  it("resolves base, whole-scenario, and step access independently", () => {
    const project = twoRoomProject(); setDoorAccess(project, access());
    project.story.scenarios = [{ id: "night", name: "Night", patches: [{ id: "close", target: doorRef, metadata: { access: access({ permission: "restricted", allow: ["court"], physicalState: "closed" }) } }], steps: [{ id: "lockdown", name: "Lockdown", patches: [{ id: "nobody", target: doorRef, metadata: { access: access({ permission: "nobody" }) } }] }] }];
    const base = route(project, { actorId: "alice" });
    const scenario = route(project, { actorId: "alice", scenarioId: "night" });
    const step = route(project, { actorId: "alice", scenarioId: "night", stepId: "lockdown" });
    expect(base.status).toBe("ready"); expect(base.route?.conditions).toEqual([]);
    expect(scenario.status).toBe("ready"); expect(diagnosticText(scenario)).toContain("Open door");
    expect(step.status).toBe("unreachable"); expect(diagnosticText(step)).toContain("nobody");
  });
});

function branchingProject() {
  return constructionProject([
    ...outerWalls(15), wall("first", 5, 0, 5, 10, "partition"), wall("second", 10, 0, 10, 10, "partition"),
  ], [
    { id: "common", kind: "door", wallId: "first", position: 0.5, width: 1 },
    { id: "upper", kind: "door", wallId: "second", position: 0.2, width: 1 },
    { id: "middle", kind: "door", wallId: "second", position: 0.5, width: 1 },
    { id: "lower", kind: "door", wallId: "second", position: 0.8, width: 1 },
  ]);
}

describe("route alternative bounds", () => {
  it("returns the first route by default and deterministic alternatives only on request", () => {
    const project = branchingProject(); const branchRequest = { ...request, to: { placeId: "level", point: { x: 13, y: 5 } } };
    const first = findStoryRoutes(project, branchRequest);
    const another = findStoryRoutes(project, { ...branchRequest, alternativeLimit: 2 });
    const repeated = findStoryRoutes(project, { ...branchRequest, alternativeLimit: 2 });
    expect(first.routes).toHaveLength(1); expect(another.routes).toHaveLength(2);
    expect(another.routes[0]?.id).toBe(first.route?.id);
    expect(repeated.routes.map(({ id }) => id)).toEqual(another.routes.map(({ id }) => id));
  });

  it("caps requested alternatives and repeated calculations to a small deterministic runtime", () => {
    const project = branchingProject(); const branchRequest = { ...request, to: { placeId: "level", point: { x: 13, y: 5 } } }; const started = performance.now(); const routeIds: string[][] = [];
    for (let index = 0; index < 12; index += 1) routeIds.push(findStoryRoutes(project, { ...branchRequest, alternativeLimit: 99 }).routes.map(({ id }) => id));
    expect(routeIds.every((ids) => ids.length === 3)).toBe(true);
    expect(routeIds.every((ids) => JSON.stringify(ids) === JSON.stringify(routeIds[0]))).toBe(true);
    expect(performance.now() - started).toBeLessThan(5_000);
  });
});
