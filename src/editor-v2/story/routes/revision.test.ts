import { describe, expect, it } from "vitest";
import { createConstructionDocument } from "../../construction/construction-document";
import type { CanonicalWall } from "../../geometry/geometry-types";
import { emptyProject, type EditorProject } from "../../model/project-model";
import { EditorSession } from "../../state/editor-session";
import { zoneMatchesProject } from "../project-adapter";
import { defaultStoryAccessPolicy, type StoryAccessPolicy } from "../types";
import { isStoryRouteCurrent, legacyStoryRouteRevision, rebaseCurrentStoryRoutes, routeTransitionPoint, storyRouteRevision } from "./revision";
import { pointInRegion } from "../../geometry/region-constraints";
import type { StoryRouteRecord } from "./types";

const wall = (id: string, x1: number, y1: number, x2: number, y2: number, role: CanonicalWall["role"] = "boundary"): CanonicalWall => ({
  id, start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness: .2, role,
});
const access = (overrides: Partial<StoryAccessPolicy> = {}): StoryAccessPolicy => ({ ...defaultStoryAccessPolicy(), ...overrides });
const copy = <T>(value: T): T => structuredClone(value);

function fixture() {
  const project = emptyProject("route-source", "Route source"); let room = 0;
  const document = createConstructionDocument("plan", [
    wall("north", 0, 0, 10, 0), wall("east", 10, 0, 10, 10), wall("south", 10, 10, 0, 10), wall("west", 0, 10, 0, 0),
    wall("middle", 5, 0, 5, 10, "partition"),
  ], { createId: () => `room-${++room}`, createName: (index) => `Room ${index}` }, { kind: "rectangle", x: 0, y: 0, width: 10, height: 10 });
  document.openings = [{ id: "door", kind: "door", wallId: "middle", position: .5, width: 1 }];
  document.transitions = [{ id: "stairs", kind: "stairs", footprint: { kind: "rectangle", x: 1, y: 1, width: 2, height: 2 }, sourceLevelId: "level", targetLevelId: "upper", connectedLevelIds: ["level", "upper"] }];
  project.places.push(
    { id: "world", name: "World", kind: "world", transform: { x: 0, y: 0, rotation: 0 }, boundary: { kind: "rectangle", x: -20, y: -20, width: 60, height: 60 }, tags: [], access: [], properties: {} },
    { id: "house", parentId: "world", name: "House", kind: "building", transform: { x: 3, y: 4, rotation: 0 }, boundary: { kind: "rectangle", x: 0, y: 0, width: 10, height: 10 }, tags: [], access: [], properties: {} },
    { id: "level", parentId: "house", name: "Ground", kind: "level", transform: { x: 0, y: 0, rotation: 0 }, constructionId: "plan", tags: [], access: [], properties: {} },
    { id: "upper", parentId: "house", name: "Upper", kind: "level", transform: { x: 0, y: 0, rotation: 0 }, tags: [], access: [], properties: {} },
  );
  project.constructions.push(document);
  project.elements.push(
    { id: "road", belongsToId: "world", name: "Road", layerId: "roads", subjectId: "road", geometry: { kind: "path", points: [{ x: 0, y: 0 }, { x: 20, y: 0 }], closed: false }, widthMeters: 3, visible: true, locked: false, tags: [], access: [], properties: {} },
    { id: "river", belongsToId: "world", name: "River", layerId: "terrain", subjectId: "terrain.river", geometry: { kind: "region", shape: { kind: "rectangle", x: 8, y: -10, width: 2, height: 20 } }, visible: true, locked: false, tags: ["water"], access: [], properties: {} },
    { id: "bridge", belongsToId: "world", name: "Bridge", layerId: "equipment", subjectId: "equipment.bridge", geometry: { kind: "region", shape: { kind: "rectangle", x: 7, y: -2, width: 4, height: 4 } }, visible: true, locked: false, tags: ["bridge"], access: [], properties: {} },
    { id: "note", belongsToId: "world", name: "Note", layerId: "sketch", subjectId: "note", geometry: { kind: "point", at: { x: 2, y: 2 } }, visible: true, locked: false, tags: [], access: [], properties: {} },
  );
  project.story.world.push(
    { id: "alice", kind: "character", name: "Alice", tags: [], properties: {} },
    { id: "staff", kind: "access-group", name: "Staff", tags: [], properties: {} },
    { id: "brass", kind: "key", name: "Brass key", tags: [], properties: {} },
  );
  project.story.memberships.push(
    { subjectId: "alice", groupId: "staff", kind: "member-of", source: "manual", note: "employee" },
    { subjectId: "staff", groupId: "brass", kind: "holds-key", source: "manual" },
  );
  project.story.objects.push({
    ref: { kind: "opening", id: "door", scopeId: "plan" },
    metadata: { narrativeLabel: "Servants' door", narrativeDescription: "Quiet", tags: ["old"], properties: { mood: "calm" }, access: access({ permission: "restricted", allow: ["staff"], physicalState: "closed", lock: "locked", keyIds: ["brass"] }), owners: ["staff"] },
  });
  project.story.zones.push({ id: "service", name: "Service wing", description: "Backstage", ownerPlaceId: "level", shape: { kind: "rectangle", x: 0, y: 0, width: 5, height: 10 }, members: [], tags: ["service"], color: "#123456", metadata: { access: access({ permission: "restricted", allow: ["staff"] }), owners: ["staff"], narrativeLabel: "Wing", tags: ["quiet"], properties: { mood: "busy" } } });
  project.story.scenarios.push({ id: "night", name: "Night", description: "After dark", patches: [{ id: "close", target: { kind: "opening", id: "door", scopeId: "plan" }, title: "Night door", description: "Closed", properties: { mood: "dark" }, metadata: { access: access({ permission: "nobody" }), owners: ["staff"], tags: ["night"] } }], steps: [{ id: "lockdown", name: "Lockdown", description: "Alarm", patches: [{ id: "seal", target: { kind: "opening", id: "door", scopeId: "plan" }, metadata: { access: access({ lock: "sealed" }) } }] }] });
  return project;
}

function route(sourceRevision: string): StoryRouteRecord {
  const alternative = { id: "route", sourceRevision, segments: [{ placeId: "level", levelId: "level", kind: "indoor" as const, points: [{ x: 1, y: 1 }, { x: 9, y: 9 }] }], points: [{ x: 1, y: 1 }, { x: 9, y: 9 }], distance: 12, conditions: [], reasons: [], usedOpeningIds: ["door"], usedTransitionIds: [] };
  return { id: "saved", name: "Saved", query: { from: { placeId: "level", point: { x: 1, y: 1 } }, to: { placeId: "level", point: { x: 9, y: 9 } } }, result: { status: "ready", revision: 0, sourceRevision, routes: [alternative], route: alternative, missingFacts: [], reasons: [] }, sourceRevision };
}

describe("story route semantic revision", () => {
  it("chooses a point guaranteed inside a concave transition footprint", () => {
    const transition = { id: "concave", kind: "stairs" as const, footprint: { kind: "polygon" as const, points: [{ x: 0, y: 0 }, { x: 6, y: 0 }, { x: 6, y: 2 }, { x: 2, y: 2 }, { x: 2, y: 6 }, { x: 0, y: 6 }] } };
    const point = routeTransitionPoint(transition);
    expect(point).toBeDefined();
    expect(pointInRegion(point!, transition.footprint)).toBe(true);
    expect(point).not.toEqual({ x: 16 / 6, y: 16 / 6 });
  });

  it("ignores narrative, presentation and unrelated project data", () => {
    const project = fixture(); const expected = storyRouteRevision(project); const changed = copy(project);
    changed.name = "Renamed project"; changed.updatedAt = "2030-01-01T00:00:00.000Z";
    Object.assign(changed.places[0]!, { name: "Renamed world", description: "New prose", order: 99, tags: ["pretty"], properties: { mood: "blue" }, appearance: { fillColor: "#abcdef" }, visible: false, locked: true });
    Object.assign(changed.constructions[0]!.rooms[0]!, { name: "Salon", description: "Prose", tags: ["warm"], properties: { mood: "warm" }, visible: false, locked: true });
    Object.assign(changed.constructions[0]!.walls[0]!, { visible: false, locked: true });
    Object.assign(changed.constructions[0]!.openings[0]!, { visible: false, locked: true });
    Object.assign(changed.constructions[0]!.transitions[0]!, { kind: "elevator", style: "spiral", direction: 90, visible: false, locked: true });
    changed.constructions[0]!.revision += 10; changed.measureSettings = { ...changed.measureSettings, units: "imperial", gridVisible: true, gridOpacity: .9 };
    Object.assign(changed.elements[0]!, { name: "Avenue", description: "Paved", subjectId: "cobblestone", tags: ["decorative"], properties: { era: 1900 }, appearance: { fillColor: "#fff" }, visible: false, locked: true });
    changed.elements[3]!.geometry = { kind: "point", at: { x: 200, y: 200 } };
    changed.surfaces.push({ id: "terrace", belongsToId: "house", name: "Terrace", kind: "terrace", shape: { kind: "rectangle", x: 0, y: 0, width: 3, height: 3 }, attachment: "attached", elevation: 1, visible: true, locked: false, tags: [], access: [], properties: {} });
    changed.roadJunctions = [{ id: "junction", belongsToId: "world", point: { x: 3, y: 3 }, roadIds: ["road", "other"] }];
    Object.assign(changed.story.world[0]!, { name: "Lady Alice", description: "Biography", tags: ["hero"], properties: { age: 30 } });
    Object.assign(changed.story.memberships[0]!, { source: "imported", note: "rewritten" });
    Object.assign(changed.story.objects[0]!.metadata, { narrativeLabel: "Secret door", narrativeDescription: "More prose", tags: ["renamed"], properties: { mood: "loud" } });
    Object.assign(changed.story.zones[0]!, { name: "Renamed wing", description: "More prose", color: "#ffffff", tags: ["other"], entryIds: ["alice"] });
    changed.story.zones[0]!.metadata = { ...changed.story.zones[0]!.metadata, narrativeLabel: "Renamed", narrativeDescription: "Text", tags: ["other"], properties: { mood: "quiet" } };
    Object.assign(changed.story.scenarios[0]!, { name: "Late night", description: "New prose" });
    Object.assign(changed.story.scenarios[0]!.patches[0]!, { id: "renamed-patch", title: "New title", description: "New text", properties: { mood: "later" } });
    Object.assign(changed.story.scenarios[0]!.steps[0]!, { name: "Alarm", description: "New step prose" });
    changed.story.propertyDefinitions.push({ id: "mood", name: "Mood", type: "text" });
    changed.story.lenses.push({ id: "lens", name: "Lens", color: "#fff", expression: { kind: "all", items: [] } });
    changed.story.relations.push({ id: "relation", from: { entryId: "alice" }, to: { kind: "place", id: "house" }, kind: "visits", label: "visits" });
    changed.story.intentions.push({ id: "intent", authorId: "alice", subject: { kind: "place", id: "house" }, kind: "reachability", text: "Reach it", status: "accepted" });
    changed.story.evidence.push({ id: "evidence", text: "Source", refs: [{ kind: "place", id: "house" }], source: "local" });
    changed.story.routes.push(route("unrelated"));
    expect(storyRouteRevision(changed)).toBe(expected);
  });

  it.each([
    ["place transform", (value: EditorProject) => { value.places[1]!.transform.x += 1; }],
    ["place hierarchy", (value: EditorProject) => { value.places[2]!.parentId = "world"; }],
    ["place boundary", (value: EditorProject) => { (value.places[0]!.boundary as { width: number }).width += 1; }],
    ["construction ownership", (value: EditorProject) => { value.places[2]!.constructionId = "other"; }],
    ["wall geometry", (value: EditorProject) => { value.constructions[0]!.walls[0]!.end.x += 1; }],
    ["wall clearance", (value: EditorProject) => { value.constructions[0]!.walls[0]!.thickness += .1; }],
    ["enclosure", (value: EditorProject) => { (value.constructions[0]!.enclosure as { width: number }).width -= 1; }],
    ["room identity", (value: EditorProject) => { value.constructions[0]!.rooms[0]!.faceId = "other-face"; }],
    ["opening geometry", (value: EditorProject) => { value.constructions[0]!.openings[0]!.position = .25; }],
    ["opening width", (value: EditorProject) => { value.constructions[0]!.openings[0]!.width = .5; }],
    ["opening kind", (value: EditorProject) => { value.constructions[0]!.openings[0]!.kind = "window"; }],
    ["transition landing", (value: EditorProject) => { (value.constructions[0]!.transitions[0]!.footprint as { x: number }).x += 1; }],
    ["transition connectivity", (value: EditorProject) => { value.constructions[0]!.transitions[0]!.connectedLevelIds = ["level"]; }],
    ["road geometry", (value: EditorProject) => { (value.elements[0]!.geometry as { points: Array<{ x: number; y: number }> }).points[1]!.y += 1; }],
    ["road width", (value: EditorProject) => { value.elements[0]!.widthMeters = 1; }],
    ["water geometry", (value: EditorProject) => { ((value.elements[1]!.geometry as { shape: { width: number } }).shape).width += 1; }],
    ["water classification", (value: EditorProject) => { value.elements[1]!.subjectId = "terrain.grass"; value.elements[1]!.tags = []; }],
    ["bridge geometry", (value: EditorProject) => { ((value.elements[2]!.geometry as { shape: { width: number } }).shape).width += 1; }],
  ] as const)("invalidates for %s", (_name, mutate) => {
    const project = fixture(); const changed = copy(project); mutate(changed);
    expect(storyRouteRevision(changed)).not.toBe(storyRouteRevision(project));
  });

  it.each([
    ["native place access", (value: EditorProject) => { value.places[0]!.access = ["staff"]; }],
    ["native room access", (value: EditorProject) => { value.constructions[0]!.rooms[0]!.access = ["staff"]; }],
    ["road access", (value: EditorProject) => { value.elements[0]!.access = ["staff"]; }],
    ["object access", (value: EditorProject) => { value.story.objects[0]!.metadata.access!.deny = ["staff"]; }],
    ["object ownership", (value: EditorProject) => { value.story.objects[0]!.metadata.owners = ["alice"]; }],
    ["zone access", (value: EditorProject) => { value.story.zones[0]!.metadata!.access!.permission = "nobody"; }],
    ["zone ownership", (value: EditorProject) => { value.story.zones[0]!.metadata!.owners = ["alice"]; }],
    ["membership", (value: EditorProject) => { value.story.memberships[0]!.groupId = "other"; }],
    ["actor group kind", (value: EditorProject) => { value.story.world[1]!.kind = "key"; }],
    ["scenario access", (value: EditorProject) => { value.story.scenarios[0]!.patches[0]!.metadata!.access!.permission = "open"; }],
    ["scenario ownership", (value: EditorProject) => { value.story.scenarios[0]!.patches[0]!.metadata!.owners = ["alice"]; }],
    ["scenario identity", (value: EditorProject) => { value.story.scenarios[0]!.id = "later"; }],
    ["step access", (value: EditorProject) => { value.story.scenarios[0]!.steps[0]!.patches[0]!.metadata!.access!.lock = "none"; }],
  ] as const)("invalidates for %s", (_name, mutate) => {
    const project = fixture(); const changed = copy(project); mutate(changed);
    expect(storyRouteRevision(changed)).not.toBe(storyRouteRevision(project));
  });

  it("normalizes set-like access and membership ordering", () => {
    const project = fixture(); project.story.objects[0]!.metadata.access!.allow = ["staff", "alice"];
    const changed = copy(project); changed.story.objects[0]!.metadata.access!.allow = ["alice", "staff", "alice"];
    changed.story.memberships.reverse(); changed.places.reverse(); changed.elements.reverse();
    expect(storyRouteRevision(changed)).toBe(storyRouteRevision(project));
  });

  it("tracks the full road ribbon when zone-based access membership changes", () => {
    const project = fixture(); project.elements[0]!.widthMeters = 3;
    project.story.zones.push({ id: "road-access", name: "Road access", ownerPlaceId: "world", shape: { kind: "rectangle", x: 4, y: 1.1, width: 2, height: .3 }, members: [], tags: [], metadata: { access: access({ permission: "nobody" }) } });
    const roadRef = { kind: "element" as const, id: "road" };
    expect(zoneMatchesProject(project, project.story, "road-access", roadRef).matches).toBe(true);

    const profiled = copy(project); profiled.elements[0]!.widthProfile = [{ t: 0, left: .5, right: 2.5 }, { t: 1, left: .5, right: 2.5 }];
    expect(zoneMatchesProject(profiled, profiled.story, "road-access", roadRef).matches).toBe(false);
    expect(storyRouteRevision(profiled)).not.toBe(storyRouteRevision(project));

    const cutOut = copy(project); cutOut.elements[0]!.ribbonCutouts = [{ kind: "rectangle", x: 3.5, y: 1, width: 3, height: 1 }];
    expect(zoneMatchesProject(cutOut, cutOut.story, "road-access", roadRef).matches).toBe(false);
    expect(storyRouteRevision(cutOut)).not.toBe(storyRouteRevision(project));
  });

  it("accepts and rebases only an exact legacy clone-id mismatch", () => {
    const template = fixture(); const legacy = legacyStoryRouteRevision(template); template.story.routes = [route(legacy)];
    const clone = { ...copy(template), id: "local-clone" };
    expect(isStoryRouteCurrent(clone, clone.story.routes[0]!)).toBe(true);
    const rebased = rebaseCurrentStoryRoutes(clone); const current = storyRouteRevision(rebased);
    expect(rebased.story.routes[0]!.sourceRevision).toBe(current);
    expect(rebased.story.routes[0]!.result.routes[0]!.sourceRevision).toBe(current);
    expect(current).toMatch(/^story-route:v1:/);

    const cosmeticallyChanged = copy(clone); cosmeticallyChanged.places[0]!.name = "Changed after cloning";
    expect(isStoryRouteCurrent(cosmeticallyChanged, cosmeticallyChanged.story.routes[0]!)).toBe(false);
    const geometricallyChanged = copy(clone); geometricallyChanged.constructions[0]!.walls[0]!.end.x += 1;
    expect(isStoryRouteCurrent(geometricallyChanged, geometricallyChanged.story.routes[0]!)).toBe(false);
  });

  it("migrates an exact current legacy record when opening an editor session", () => {
    const template = new EditorSession(fixture()).getState().project; const legacy = legacyStoryRouteRevision(template); template.story.routes = [route(legacy)];
    const session = new EditorSession({ ...copy(template), id: "browser-clone" }); const loaded = session.getState().project;
    expect(loaded.story.routes[0]!.sourceRevision).toBe(storyRouteRevision(loaded));
    expect(isStoryRouteCurrent(loaded, loaded.story.routes[0]!)).toBe(true);
  });
});
