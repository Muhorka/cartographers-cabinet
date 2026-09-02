import { describe, expect, it, vi } from "vitest";
import { createConstructionDocument } from "../construction/construction-document";
import type { CanonicalWall } from "../geometry/geometry-types";
import { emptyProject, type EditorProject } from "../model/project-model";
import { createProjectCheckpoint, restoreCheckpointSnapshot } from "../persistence/project-checkpoint";
import { editorProjectSchema } from "../persistence/project-file";
import { emptyStoryData, type StoryData } from "../story/types";
import { EditorSession } from "../state/editor-session";
import { createEditorCommandTools } from "./create-editor-command-tools";
import { createInlineStoryRouteCalculationService, type StoryRouteCalculationService } from "../story/routes/route-service";
import type { EditorLiveContext } from "./editor-context";
import type { StoryRouteResult } from "../story/routes/types";
import type { RouteCalculationOutcome } from "../story/routes/route-service";
import { checkStoryIntention } from "../story/review/intention-check-service";

const wall = (id: string, start: { x: number; y: number }, end: { x: number; y: number }, role: CanonicalWall["role"] = "boundary"): CanonicalWall => ({ id, start, end, role, thickness: .2 });

function fixture(story: StoryData = emptyStoryData()) {
  let roomNumber = 0;
  const document = createConstructionDocument("construction", [
    wall("south", { x: 0, y: 0 }, { x: 10, y: 0 }), wall("east", { x: 10, y: 0 }, { x: 10, y: 10 }),
    wall("north", { x: 10, y: 10 }, { x: 0, y: 10 }), wall("west", { x: 0, y: 10 }, { x: 0, y: 0 }),
    wall("partition", { x: 5, y: 0 }, { x: 5, y: 10 }, "partition"),
  ], { createId: () => `room-${roomNumber++}`, createName: (index) => `Room ${index}` });
  document.openings = [{ id: "door", kind: "door", wallId: "partition", position: .5, width: 1 }];
  const project = emptyProject("route-tools", "Route tools");
  project.places.push({ id: "level", name: "Ground", kind: "level", transform: { x: 0, y: 0, rotation: 0 }, constructionId: document.id, tags: [], access: [], properties: {} });
  project.constructions.push(document); project.story = story;
  return project;
}

function setup(project = fixture(), routeService: StoryRouteCalculationService = createInlineStoryRouteCalculationService()) {
  const session = new EditorSession(project, { initialPlaceId: "level" });
  let live: EditorLiveContext = { mode: "story", selections: [], view: {} };
  const bridge = { getSession: () => session, getActivePlaceId: () => "level", refresh: () => undefined, getEditorContext: () => live, setStoryView: (view: EditorLiveContext["view"]) => { live = { ...live, view }; } };
  const tools = createEditorCommandTools(bridge, undefined, routeService);
  return { session, tools, setView: (view: EditorLiveContext["view"]) => { live = { ...live, view }; } };
}

function tool(tools: WebMcpTool[], name: string) {
  const found = tools.find((candidate) => candidate.name === name);
  if (!found) throw new Error(`Missing tool ${name}`);
  return found;
}

async function structured<T>(value: unknown) {
  return (await Promise.resolve(value) as { structuredContent: T }).structuredContent;
}

const query = { from: { placeId: "level", point: { x: 2, y: 5 } }, to: { placeId: "level", point: { x: 8, y: 5 } } };
const result = { status: "unreachable", revision: 0, sourceRevision: "r", routes: [], missingFacts: [], reasons: [] } as StoryRouteResult;

describe("Story route WebMCP tools", () => {
  it("returns the same versioned intention observation as the UI service", async () => {
    const project = fixture();
    project.story.intentions = [{ id: "reach", subject: { kind: "place", id: "level" }, target: { kind: "place", id: "level" }, kind: "reachability", text: "Cross the level", status: "accepted" }];
    const { tools, session } = setup(project);
    const input = { intentionId: "reach", query, context: {} };
    const expected = await checkStoryIntention(session.getState().project, input, createInlineStoryRouteCalculationService());
    expect(await structured(tool(tools, "check_story_intention").execute(input))).toEqual(expected);
  });

  it("invalidates a pending intention result when the active scenario changes", async () => {
    const project = fixture();
    project.story.intentions = [{ id: "reach", subject: { kind: "place", id: "level" }, target: { kind: "place", id: "level" }, kind: "reachability", text: "Cross the level", status: "accepted" }];
    let resolve!: (value: RouteCalculationOutcome) => void;
    const routes: StoryRouteCalculationService = { calculate: vi.fn(() => new Promise<RouteCalculationOutcome>((done) => { resolve = done; })), cancel: vi.fn(), dispose: vi.fn() };
    const { tools, setView } = setup(project, routes);
    const pending = tool(tools, "check_story_intention").execute({ intentionId: "reach", query });
    setView({ scenarioId: "night" });
    resolve({ status: "ready", result, attemptId: 1 });
    expect(await structured(pending)).toMatchObject({ status: "stale", execution: "stale", reasonCode: "not-current" });
  });

  it("returns stale when the project changes while a route is being calculated", async () => {
    let resolve!: (value: Awaited<ReturnType<StoryRouteCalculationService["calculate"]>>) => void;
    const routeService: StoryRouteCalculationService = { calculate: vi.fn(() => new Promise<RouteCalculationOutcome>((done) => { resolve = done; })), cancel: vi.fn(), dispose: vi.fn() };
    const { session, tools } = setup(fixture(), routeService); const pending = tool(tools, "find_story_routes").execute({ query });
    session.executeTransaction({ id: "change", apply: (project) => ({ ...project, name: "Changed" }) });
    resolve({ status: "ready", result, attemptId: 1 });
    expect(await structured<{ status: string }>(pending)).toMatchObject({ status: "stale" });
  });

  it("finds a real route without mutating the project", async () => {
    const { session, tools } = setup(); const before = structuredClone(session.getState().project);
    const result = await structured<{ status: string; route?: { usedOpeningIds: string[] } }>(tool(tools, "find_story_routes").execute({ query }));
    expect(result.status).toBe("ready"); expect(result.route?.usedOpeningIds).toContain("door"); expect(session.getState().project).toEqual(before);
  });

  it("prepares and applies a named route using the shared editor transaction", async () => {
    const { session, tools } = setup();
    const prepared = await structured<{ status: string; token?: string }>(tool(tools, "prepare_save_story_route").execute({ id: "saved", name: "Door route", query }));
    expect(prepared.status).toBe("prepared"); expect(session.getState().project.story.routes).toHaveLength(0);
    const applied = await structured<{ status: string }>(tool(tools, "apply_prepared_editor_change").execute({ token: prepared.token }));
    expect(applied.status).toBe("applied"); expect(session.getState().project.story.routes[0]?.name).toBe("Door route");
  });

  it("reports saved routes current, then stale after source geometry changes", async () => {
    const { session, tools } = setup();
    const prepared = await structured<{ token: string }>(tool(tools, "prepare_save_story_route").execute({ id: "saved", name: "Door route", query }));
    await tool(tools, "apply_prepared_editor_change").execute({ token: prepared.token });
    const current = await structured<{ routes: Array<{ id: string; stale: boolean }> }>(tool(tools, "inspect_saved_story_routes").execute({}));
    expect(current.routes[0]).toMatchObject({ id: "saved", stale: false });
    expect(session.executeTransaction({ id: "geometry-change", apply: (project) => ({ ...project, constructions: project.constructions.map((document) => ({ ...document, revision: document.revision + 1, openings: document.openings.map((opening) => opening.id === "door" ? { ...opening, width: opening.width + .25 } : opening) })) }) }).changed).toBe(true);
    const stale = await structured<{ routes: Array<{ id: string; stale: boolean }> }>(tool(tools, "inspect_saved_story_routes").execute({}));
    expect(stale.routes[0]?.stale).toBe(true);
  });

  it("keeps saved routes out of source revisions and checkpoint/export round trips", async () => {
    const { session, tools } = setup();
    const prepared = await structured<{ token: string }>(tool(tools, "prepare_save_story_route").execute({ id: "saved", name: "Door route", query }));
    await tool(tools, "apply_prepared_editor_change").execute({ token: prepared.token });
    const saved = session.getState().project; const inspection = await structured<{ revision: string; routes: Array<{ sourceRevision: string }> }>(tool(tools, "inspect_saved_story_routes").execute({}));
    expect(inspection.routes[0]?.sourceRevision).toBe(inspection.revision);
    const checkpoint = createProjectCheckpoint(saved, { id: "route-checkpoint", name: "Route" });
    const roundTrip = editorProjectSchema.parse(JSON.parse(JSON.stringify(saved)) as EditorProject);
    expect(roundTrip.story.routes).toEqual(saved.story.routes); expect(restoreCheckpointSnapshot(checkpoint).story.routes).toEqual(saved.story.routes);
    const withOnlyAnotherRoute = { ...saved, story: { ...saved.story, routes: [...saved.story.routes, { ...saved.story.routes[0]!, id: "other" }] } };
    expect(editorProjectSchema.parse(withOnlyAnotherRoute).story.routes).toHaveLength(2);
  });

  it("checks access intentions with effective rules and leaves unproven reachability for the author", async () => {
    const story: StoryData = { ...emptyStoryData(), intentions: [
      { id: "access", subject: { kind: "place", id: "level" }, kind: "access-rule", text: "Staff may enter", status: "accepted", accessEntryId: "staff" },
      { id: "reach", subject: { kind: "place", id: "level" }, kind: "reachability", text: "Can cross the level", status: "accepted", target: { kind: "place", id: "level" } },
      { id: "avoid", subject: { kind: "place", id: "level" }, kind: "avoid-zone", text: "Avoid the well", status: "accepted", avoidZoneId: "well" },
    ], objects: [{ ref: { kind: "place", id: "level" }, metadata: { access: { allow: ["staff"], deny: [], permission: "restricted", physicalState: "open", lock: "none", keyIds: [], guardIds: [], secretKnowledge: [] } } }] };
    const { tools } = setup(fixture(story));
    const access = await structured<{ status: string }>(tool(tools, "check_story_intention").execute({ intentionId: "access", actorId: "staff" }));
    expect(access.status).toBe("satisfied");
    const reachability = await structured<{ status: string }>(tool(tools, "check_story_intention").execute({ intentionId: "reach" }));
    expect(reachability.status).toBe("needs-author-review");
    const unsupported = await structured<{ status: string }>(tool(tools, "check_story_intention").execute({ intentionId: "avoid" }));
    expect(unsupported.status).toBe("needs-author-review");
  });

  it("proves must-pass and avoid-zone only from the explicit calculated route", async () => {
    const story: StoryData = { ...emptyStoryData(), intentions: [
      { id: "pass", subject: { kind: "place", id: "level" }, kind: "must-pass", text: "Use the door", status: "accepted", through: [{ kind: "opening", id: "door", scopeId: "construction" }] },
      { id: "avoid", subject: { kind: "place", id: "level" }, kind: "avoid-zone", text: "Avoid the left zone", status: "accepted", avoidZoneId: "left" },
    ], zones: [{ id: "left", name: "Left zone", ownerPlaceId: "level", shape: { kind: "rectangle", x: 1, y: 1, width: 2, height: 8 }, members: [], tags: [] }] };
    const { tools } = setup(fixture(story));
    const pass = await structured<{ status: string; evidence?: { refs?: unknown[] } }>(tool(tools, "check_story_intention").execute({ intentionId: "pass", query }));
    expect(pass.status).toBe("satisfied"); expect(pass.evidence?.refs).toHaveLength(1);
    const avoid = await structured<{ status: string }>(tool(tools, "check_story_intention").execute({ intentionId: "avoid", query }));
    expect(avoid.status).toBe("blocked");
  });

  it("does not upgrade a conditional key route to guaranteed intention success", async () => {
    const story: StoryData = { ...emptyStoryData(), objects: [{ ref: { kind: "opening", id: "door", scopeId: "construction" }, metadata: { access: { allow: [], deny: [], permission: "open", physicalState: "closed", lock: "locked", keyIds: ["brass"], guardIds: [], secretKnowledge: [] } } }], memberships: [{ subjectId: "alice", groupId: "brass", kind: "holds-key", source: "manual" }], intentions: [{ id: "reach", subject: { kind: "place", id: "level" }, kind: "reachability", text: "Reach the other room", status: "accepted", target: { kind: "place", id: "level" } }] };
    const { tools } = setup(fixture(story));
    const result = await structured<{ status: string; conditions?: string[] }>(tool(tools, "check_story_intention").execute({ intentionId: "reach", actorId: "alice", query }));
    expect(result.status).toBe("conditional"); expect(result.conditions?.join(" ")).toContain("Unlock and open door");
  });

  it("does not treat an unowned or other-level zone as the query zone", async () => {
    const story: StoryData = { ...emptyStoryData(), intentions: [{ id: "avoid", subject: { kind: "place", id: "level" }, kind: "avoid-zone", text: "Avoid it", status: "accepted", avoidZoneId: "unowned" }], zones: [{ id: "unowned", name: "Unowned", shape: { kind: "rectangle", x: 1, y: 1, width: 2, height: 8 }, members: [], tags: [] }] };
    const { tools } = setup(fixture(story));
    const result = await structured<{ status: string }>(tool(tools, "check_story_intention").execute({ intentionId: "avoid", query }));
    expect(result.status).toBe("needs-author-review");
  });
});
