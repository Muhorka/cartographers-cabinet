import { afterEach, describe, expect, it } from "vitest";
import { addElement } from "../model/hierarchy-operations";
import { createStarterProject } from "../model/starter-project";
import { EditorSession } from "../state/editor-session";
import { registerEditorV2Tools } from "./register-editor-tools";
import { getWebMcpDiagnostics } from "./diagnostics";
import { buildMetadataChange } from "./agent-object-command";
import { hierarchySnapshot } from "./project-read-model";
import { addConstructionSurface } from "../model/hierarchy-operations";
import { editorProjectSchema } from "../persistence/project-file";
import { effectiveProjectStoryObject } from "../story/project-effective";

afterEach(() => Reflect.deleteProperty(document, "modelContext"));

function projectFixture() {
  const base = createStarterProject("project", "Dolina Rzeki", "pl"); const location = base.places.find(({ kind }) => kind === "location")!;
  return addElement(base, { id: "river", name: "Rzeka Szeptów", description: "Szeroka rzeka przy starym mieście", layerId: "terrain", subjectId: "terrain.water", geometry: { kind: "path", points: [{ x: 0, y: 0 }, { x: 20, y: 10 }], closed: false }, visible: true, locked: false, tags: ["woda", "żeglowna"], access: [], properties: { depth: 4 } }, location.id);
}

async function registeredTools(project = projectFixture()) {
  const tools: WebMcpTool[] = []; const signals: AbortSignal[] = [];
  Object.defineProperty(document, "modelContext", { configurable: true, value: { registerTool: async (tool: WebMcpTool, options?: { signal?: AbortSignal }) => { tools.push(tool); if (options?.signal) signals.push(options.signal); } } });
  const activePlaceId = project.places.find(({ kind }) => kind === "location")!.id;
  const session = new EditorSession(project, { initialPlaceId: activePlaceId });
  const registration = await registerEditorV2Tools({ getSession: () => session, getProject: () => session.getState().project, getActivePlaceId: () => session.getState().activePlaceId ?? activePlaceId, refresh: () => undefined });
  return { project, session, tools, signals, registration };
}

describe("read-only WebMCP tools for editor V2", () => {
  it("registers the shared scene review as a read-only tool without mutating the plan", async () => {
    const { session, tools, registration } = await registeredTools();
    const before = session.getState().project;
    const review = tools.find(({ name }) => name === "check_story_scene")!;
    expect(review.annotations?.readOnlyHint).toBe(true);
    const result = await review.execute({ scope: "all" }) as { structuredContent: { status: string; total: number } };
    expect(result.structuredContent).toMatchObject({ status: "complete", total: 0 });
    expect(session.getState().project).toEqual(before);
    registration.dispose();
  });

  it("updates visibility and lock state through one operation for places, rooms, elements, and surfaces", () => {
    let project = projectFixture(); const location = project.places.find(({ kind }) => kind === "location")!; const room = project.places.find(({ kind }) => kind === "room")!;
    project = addConstructionSurface(project, { id: "deck", belongsToId: location.id, name: "Deck", kind: "terrace", shape: { kind: "rectangle", x: 1, y: 1, width: 2, height: 2 }, attachment: "free", elevation: 0, visible: true, locked: false, tags: [], access: [], properties: {} }, location.id);
    for (const ref of [{ type: "place", id: location.id }, { type: "room", id: room.id }, { type: "element", id: "river" }, { type: "surface", id: "deck" }] as const) {
      project = buildMetadataChange(project, room.id, { ref, metadata: { visible: false, locked: true } }).project;
    }
    expect(project.places.find(({ id }) => id === location.id)).toMatchObject({ visible: false, locked: true });
    expect(project.places.find(({ id }) => id === room.id)).toMatchObject({ visible: false, locked: true });
    expect(project.elements.find(({ id }) => id === "river")).toMatchObject({ visible: false, locked: true });
    expect(project.surfaces.find(({ id }) => id === "deck")).toMatchObject({ visible: false, locked: true });
  });

  it("keeps omitted room tags during a partial metadata update and clears them explicitly", () => {
    const project = projectFixture(); const room = project.places.find(({ kind }) => kind === "room")!;
    const construction = project.constructions.find(({ rooms }) => rooms.some(({ id }) => id === room.id))!;
    const beforePlaceTags = [...room.tags]; const beforeRoomTags = [...construction.rooms.find(({ id }) => id === room.id)!.tags];
    const updated = buildMetadataChange(project, room.id, { ref: { type: "room", id: room.id, scopeId: construction.id }, metadata: { name: "Named room", description: "Partial description" } }).project;
    expect(() => editorProjectSchema.parse(updated)).not.toThrow();
    expect(updated.places.find(({ id }) => id === room.id)).toMatchObject({ name: "Named room", description: "Partial description", tags: beforePlaceTags });
    expect(updated.constructions.find(({ id }) => id === construction.id)!.rooms.find(({ id }) => id === room.id)).toMatchObject({ name: "Named room", description: "Partial description", tags: beforeRoomTags });
    const cleared = buildMetadataChange(updated, room.id, { ref: { type: "room", id: room.id, scopeId: construction.id }, metadata: { tags: [] } }).project;
    expect(cleared.places.find(({ id }) => id === room.id)!.tags).toEqual([]);
    expect(cleared.constructions.find(({ id }) => id === construction.id)!.rooms.find(({ id }) => id === room.id)!.tags).toEqual([]);
  });

  it("includes construction surfaces in the hierarchy with an explicit reference", () => {
    const project = projectFixture(); const location = project.places.find(({ kind }) => kind === "location")!;
    const withSurface = addConstructionSurface(project, { id: "deck", belongsToId: location.id, name: "Deck", kind: "terrace", shape: { kind: "rectangle", x: 1, y: 1, width: 2, height: 2 }, attachment: "free", elevation: 0, visible: true, locked: false, tags: [], access: [], properties: {} }, location.id);
    expect(hierarchySnapshot(withSurface)).toContainEqual(expect.objectContaining({ id: "deck", kind: "surface", ownerId: location.id, ref: { type: "surface", id: "deck" } }));
  });

  it("distinguishes registration from a successful agent call", async () => {
    const { tools } = await registeredTools();
    expect(getWebMcpDiagnostics().lastSuccessfulTool).toBeUndefined();
    await expect(tools.find(({ name }) => name === "inspect_project_object")!.execute({})).rejects.toThrow();
    expect(getWebMcpDiagnostics().lastSuccessfulTool).toBeUndefined();
    await tools.find(({ name }) => name === "inspect_cartographers_project")!.execute({});
    expect(getWebMcpDiagnostics().lastSuccessfulTool).toBe("inspect_cartographers_project");
  });
  it("reports missing browser support without hiding it", async () => {
    const registration = await registerEditorV2Tools({} as Parameters<typeof registerEditorV2Tools>[0]);
    expect(registration.available).toBe(false);
    expect(getWebMcpDiagnostics()).toMatchObject({ state: "unavailable", registered: 0 });
  });

  it("names failed registrations in diagnostics", async () => {
    Object.defineProperty(document, "modelContext", { configurable: true, value: { registerTool: async (tool: WebMcpTool) => { if (tool.name === "inspect_open_map") throw new Error("Permission denied"); } } });
    const registration = await registerEditorV2Tools({} as Parameters<typeof registerEditorV2Tools>[0]);
    expect(registration.available).toBe(false);
    expect(getWebMcpDiagnostics()).toMatchObject({ state: "error", registered: 0, errors: ["inspect_open_map: Permission denied"] });
    registration.dispose();
  });
  it("registers the read tools and the guarded command tools together", async () => {
    const { tools, signals, registration } = await registeredTools();
    expect(tools.length).toBeGreaterThan(45); expect(tools.map(({ name }) => name)).toContain("prepare_align_objects");
    expect(tools.slice(0, 6).map(({ name }) => name)).toEqual(["inspect_cartographers_project", "list_project_hierarchy", "inspect_open_map", "search_project_objects", "inspect_project_object", "check_project_consistency"]);
    expect(tools.slice(0, 6).every(({ annotations }) => annotations?.readOnlyHint)).toBe(true);
    expect(tools.find(({ name }) => name === "prepare_create_map_object")?.annotations?.readOnlyHint).toBe(false);
    expect(registration).toMatchObject({ available: true, registered: tools.length });
    expect(getWebMcpDiagnostics()).toMatchObject({ state: "ready", registered: tools.length, total: tools.length, errors: [] });
    registration.dispose(); expect(signals.every(({ aborted }) => aborted)).toBe(true);
  });

  it("prepares without mutation, applies once, and remains undoable", async () => {
    const { tools, project } = await registeredTools(); const before = structuredClone(project);
    const prepare = tools.find(({ name }) => name === "prepare_create_map_object")!;
    const preview = await prepare.execute({ ownerId: project.places.find(({ kind }) => kind === "location")!.id, layerId: "terrain", subjectId: "terrain.meadow", instrumentId: "rectangle", points: [{ x: 4, y: 4 }, { x: 12, y: 9 }], name: "Łąka agenta" }) as { structuredContent: { status: string; token: string } };
    const inspect = tools.find(({ name }) => name === "inspect_cartographers_project")!;
    expect((await inspect.execute({}) as { structuredContent: { counts: { elements: number } } }).structuredContent.counts.elements).toBe(before.elements.length);
    const apply = tools.find(({ name }) => name === "apply_prepared_editor_change")!;
    expect((await apply.execute({ token: preview.structuredContent.token }) as { structuredContent: { status: string } }).structuredContent.status).toBe("applied");
    expect((await apply.execute({ token: preview.structuredContent.token }) as { structuredContent: { alreadyApplied: boolean } }).structuredContent.alreadyApplied).toBe(true);
    expect((await inspect.execute({}) as { structuredContent: { counts: { elements: number } } }).structuredContent.counts.elements).toBe(before.elements.length + 1);
    await tools.find(({ name }) => name === "undo_editor_change")!.execute({});
    expect((await inspect.execute({}) as { structuredContent: { counts: { elements: number } } }).structuredContent.counts.elements).toBe(before.elements.length);
  });

  it("rejects a prepared command after another project transaction", async () => {
    const { tools } = await registeredTools();
    const preview = await tools.find(({ name }) => name === "prepare_create_map_object")!.execute({ layerId: "sketch", subjectId: "sketch.note", instrumentId: "note", points: [{ x: 3, y: 3 }], name: "Notatka" }) as { structuredContent: { token: string } };
    const update = await tools.find(({ name }) => name === "prepare_update_project_object")!.execute({ ref: { type: "element", id: "river" }, description: "zmiana równoległa" }) as { structuredContent: { token: string } };
    await tools.find(({ name }) => name === "apply_prepared_editor_change")!.execute({ token: update.structuredContent.token });
    const stale = await tools.find(({ name }) => name === "apply_prepared_editor_change")!.execute({ token: preview.structuredContent.token }) as { structuredContent: { status: string } };
    expect(stale.structuredContent.status).toBe("stale");
  });

  it("keeps agent equipment categories aligned with the unified catalogue", async () => {
    const { tools, project } = await registeredTools();
    const locationId = project.places.find(({ kind }) => kind === "location")!.id;
    const prepare = tools.find(({ name }) => name === "prepare_create_map_object")!;
    const result = await prepare.execute({ ownerId: locationId, layerId: "equipment", subjectId: "equipment.furniture", instrumentId: "rectangle", points: [{ x: 1, y: 1 }, { x: 2, y: 2 }] }) as { structuredContent: { status: string; reason?: string } };
    expect(result.structuredContent.status).toBe("prepared");
    expect(result.structuredContent.reason).toBeUndefined();
    const levelId = project.places.find(({ kind }) => kind === "level")!.id;
    const indoor = await prepare.execute({ ownerId: levelId, layerId: "equipment", subjectId: "equipment.vegetation", instrumentId: "rectangle", points: [{ x: 1, y: 1 }, { x: 2, y: 2 }] }) as { structuredContent: { status: string; reason?: string } };
    expect(indoor.structuredContent.status).toBe("prepared");
    expect(indoor.structuredContent.reason).toBeUndefined();
  });

  it("preserves authored vegetation appearance through agent creation", async () => {
    const { tools, project, session } = await registeredTools();
    const locationId = project.places.find(({ kind }) => kind === "location")!.id;
    const prepare = tools.find(({ name }) => name === "prepare_create_map_object")!;
    const apply = tools.find(({ name }) => name === "apply_prepared_editor_change")!;
    const preview = await prepare.execute({ ownerId: locationId, layerId: "equipment", subjectId: "equipment.vegetation", instrumentId: "rectangle", points: [{ x: 3, y: 3 }, { x: 4, y: 4 }], name: "Authored plant", appearance: { fillColor: "#123456", fillOpacity: .6 } }) as { structuredContent: { token: string } };
    await apply.execute({ token: preview.structuredContent.token });
    expect(session.getState().project.elements.find(({ name }) => name === "Authored plant")).toMatchObject({ appearance: { fillColor: "#123456", fillOpacity: .6 } });
  });

  it("creates semantic objects on every editor work layer", async () => {
    const { tools, session, project } = await registeredTools();
    const prepare = tools.find(({ name }) => name === "prepare_create_map_object")!; const apply = tools.find(({ name }) => name === "apply_prepared_editor_change")!;
    const commit = async (input: Record<string, unknown>) => {
      const preview = await prepare.execute(input) as { structuredContent: { status: string; token: string } };
      expect(preview.structuredContent.status).toBe("prepared");
      const result = await apply.execute({ token: preview.structuredContent.token }) as { structuredContent: { status: string } };
      expect(result.structuredContent.status).toBe("applied");
    };
    const locationId = project.places.find(({ kind }) => kind === "location")!.id;
    const worldId = project.places.find(({ kind }) => kind === "world")!.id;
    await commit({ ownerId: worldId, layerId: "boundaries", subjectId: "boundary.place", instrumentId: "rectangle", points: [{ x: 2, y: 2 }, { x: 8, y: 7 }], name: "Lokalizacja agenta" });
    await commit({ ownerId: locationId, layerId: "terrain", subjectId: "terrain.forest", instrumentId: "circle", points: [{ x: 26, y: 14 }, { x: 29, y: 14 }], name: "Las agenta" });
    await commit({ ownerId: locationId, layerId: "buildings", subjectId: "building.tower", instrumentId: "rectangle", points: [{ x: 24, y: -6 }, { x: 30, y: 1 }], name: "Wieża agenta" });
    const levelId = project.places.find(({ kind }) => kind === "level")!.id; session.openPlace(levelId);
    await commit({ ownerId: levelId, layerId: "construction", subjectId: "construction.partition", instrumentId: "line", points: [{ x: -16, y: 0 }, { x: 16, y: 0 }], acceptClip: true });
    await commit({ ownerId: levelId, layerId: "openings", subjectId: "opening.window", instrumentId: "place", points: [{ x: 0, y: 0 }], openingWidth: 1.6, name: "Named window", description: "Window description" });
    await commit({ ownerId: levelId, layerId: "openings", subjectId: "opening.stairs", instrumentId: "rectangle", points: [{ x: -10, y: -8 }, { x: -7, y: -4 }], sourceLevelId: levelId, connectedLevelIds: [levelId], transitionStyle: "spiral", direction: 90, sameLevelRise: true, name: "Named stairs", description: "Stairs description" });
    await commit({ ownerId: levelId, layerId: "equipment", subjectId: "equipment.marker", instrumentId: "point", points: [{ x: 4, y: 4 }], name: "Znacznik agenta" });
    await commit({ ownerId: levelId, layerId: "sketch", subjectId: "sketch.note", instrumentId: "note", points: [{ x: 6, y: 6 }], name: "Notatka agenta" });
    const state = session.getState().project;
    expect(state.elements).toEqual(expect.arrayContaining([expect.objectContaining({ name: "Las agenta" }), expect.objectContaining({ name: "Znacznik agenta" }), expect.objectContaining({ name: "Notatka agenta" })]));
    expect(state.places).toContainEqual(expect.objectContaining({ name: "Wieża agenta", kind: "building" }));
    const construction = state.constructions.find(({ id }) => id === project.places.find(({ id }) => id === levelId)!.constructionId);
    expect(construction?.openings).toHaveLength(1);
    expect(construction?.transitions).toContainEqual(expect.objectContaining({ kind: "stairs", sourceLevelId: levelId, connectedLevelIds: [levelId], style: "spiral", direction: 90, sameLevelRise: true }));
    const transitionId = construction!.transitions[0].id;
    expect(effectiveProjectStoryObject(state, { kind: "opening", id: construction!.openings[0].id, scopeId: construction!.id })).toMatchObject({ name: "Named window", description: "Window description" });
    expect(effectiveProjectStoryObject(state, { kind: "transition", id: transitionId, scopeId: construction!.id })).toMatchObject({ name: "Named stairs", description: "Stairs description" });
    const update = await tools.find(({ name }) => name === "prepare_update_project_object")!.execute({ ref: { type: "transition", id: transitionId }, transitionStyle: "curved", direction: 180 }) as { structuredContent: { token: string } };
    await apply.execute({ token: update.structuredContent.token });
    expect(session.getState().project.constructions.flatMap(({ transitions }) => transitions).find(({ id }) => id === transitionId)).toMatchObject({ style: "curved", direction: 180 });
  });

  it("searches descriptions, tags and properties and then inspects the exact object", async () => {
    const { tools } = await registeredTools();
    const search = tools.find(({ name }) => name === "search_project_objects")!;
    const searchResult = await search.execute({ query: "żeglowna stary", types: ["element"] }) as { structuredContent: { count: number; matches: Array<{ ref: { id: string; type: string } }> } };
    expect(searchResult.structuredContent).toMatchObject({ count: 1, matches: [{ ref: { id: "river", type: "element" } }] });
    const inspect = tools.find(({ name }) => name === "inspect_project_object")!;
    const inspected = await inspect.execute({ id: "river", type: "element" }) as { structuredContent: { matches: Array<{ data: { properties: { depth: number } } }> } };
    expect(inspected.structuredContent.matches[0].data.properties.depth).toBe(4);
  });

  it("reports the active map and project consistency without mutating project data", async () => {
    const { project, tools } = await registeredTools(); const before = structuredClone(project);
    const map = await tools.find(({ name }) => name === "inspect_open_map")!.execute({}) as { structuredContent: { active: { kind: string }; elements: Array<{ id: string }> } };
    const report = await tools.find(({ name }) => name === "check_project_consistency")!.execute({}) as { structuredContent: { valid: boolean; issues: unknown[] } };
    expect(map.structuredContent.active.kind).toBe("location"); expect(map.structuredContent.elements).toContainEqual(expect.objectContaining({ id: "river" }));
    expect(report.structuredContent).toMatchObject({ valid: true, issues: [] }); expect(project).toEqual(before);
  });

  it("exposes the semantic drawing catalog and construction surfaces", async () => {
    const { tools, project, session } = await registeredTools();
    const catalog = await tools.find(({ name }) => name === "inspect_drawing_catalog")!.execute({}) as { structuredContent: { layers: Array<{ id: string; subjects?: Array<{ id: string }> }>; constructionCategories: Array<{ id: string }>; instruments: Array<{ id: string }> } };
    expect(catalog.structuredContent.layers.map(({ id }) => id)).toContain("construction");
    expect(catalog.structuredContent.constructionCategories.map(({ id }) => id)).toContain("platforms");
    expect(catalog.structuredContent.instruments.map(({ id }) => id)).toContain("wall-run");
    const outdoorEquipment = catalog.structuredContent.layers.find(({ id }) => id === "equipment")!.subjects!.map(({ id }) => id);
    expect(outdoorEquipment).toEqual(expect.arrayContaining(["equipment.furniture", "equipment.object", "equipment.vegetation", "equipment.monument", "equipment.small-architecture", "equipment.bridge", "equipment.marker", "equipment.custom"]));
    const locationId = project.places.find(({ kind }) => kind === "location")!.id;
    const prepare = tools.find(({ name }) => name === "prepare_create_map_object")!;
    const apply = tools.find(({ name }) => name === "apply_prepared_editor_change")!;
    const preview = await prepare.execute({ ownerId: locationId, layerId: "construction", subjectId: "platform.stage", instrumentId: "rectangle", points: [{ x: 4, y: 4 }, { x: 8, y: 7 }], name: "Scena" }) as { structuredContent: { token: string } };
    await apply.execute({ token: preview.structuredContent.token });
    const surface = session.getState().project.surfaces.find(({ name }) => name === "Scena");
    const inspected = await tools.find(({ name }) => name === "inspect_project_object")!.execute({ type: "surface", id: surface?.id }) as { structuredContent: { count: number; matches: Array<{ data: { kind: string } }> } };
    expect(inspected.structuredContent).toMatchObject({ count: 1, matches: [{ data: { kind: "stage" } }] });
    const levelId = project.places.find(({ kind }) => kind === "level")!.id;
    const interiorCatalog = await tools.find(({ name }) => name === "inspect_drawing_catalog")!.execute({ placeId: levelId }) as { structuredContent: { layers: Array<{ id: string; subjects?: Array<{ id: string }> }> } };
    const interiorEquipment = interiorCatalog.structuredContent.layers.find(({ id }) => id === "equipment")!.subjects!.map(({ id }) => id);
    expect(interiorEquipment).toEqual(outdoorEquipment);
  });

  it("prepares and applies view and measurement preferences", async () => {
    const { tools, session } = await registeredTools();
    const prepare = await tools.find(({ name }) => name === "prepare_update_project_settings")!.execute({ measureSettings: { units: "imperial", gridVisible: true, showAxes: true, gridSpacingMeters: 5, showRoomAreas: true } }) as { structuredContent: { token: string } };
    expect(session.getState().project.measureSettings.units).toBe("metric");
    await tools.find(({ name }) => name === "apply_prepared_editor_change")!.execute({ token: prepare.structuredContent.token });
    expect(session.getState().project.measureSettings).toMatchObject({ units: "imperial", gridVisible: true, showAxes: true, gridSpacingMeters: 5, showRoomAreas: true });
  });

  it("routes arbitrary WebMCP rotation through the shared selection operation", async () => {
    const { tools, project, session } = await registeredTools();
    const before = project.elements.find(({ id }) => id === "river")!.geometry;
    const transform = tools.find(({ name }) => name === "prepare_transform_project_objects")!;
    expect((transform.inputSchema as { properties: { transformation: { oneOf: Array<{ properties: { degrees?: { enum?: number[] } } }> } } }).properties.transformation.oneOf[1]?.properties.degrees?.enum).toBeUndefined();
    const preview = await transform.execute({ refs: [{ type: "element", id: "river" }], transformation: { kind: "rotate", degrees: 33 } }) as { structuredContent: { status: string; token: string } };
    expect(preview.structuredContent.status).toBe("prepared");
    await tools.find(({ name }) => name === "apply_prepared_editor_change")!.execute({ token: preview.structuredContent.token });
    const after = session.getState().project.elements.find(({ id }) => id === "river")!.geometry;
    expect(after).not.toEqual(before);
  });
});
