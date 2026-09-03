import { describe, expect, it } from "vitest";
import { createStarterProject } from "../model/starter-project";
import { emptyProject } from "../model/project-model";
import type { DrawingElement } from "../model/project-model";
import { MAX_PROJECT_FILE_BYTES, PROJECT_FILE_FORMAT, PROJECT_FILE_VERSION, cloneImportedProject, parseProjectFile, projectExportFileName, renameProject, serializeProjectFile } from "./project-file";

describe("editor v2 project files", () => {
  const project = createStarterProject("project-original", "Dolina Brzasku", "pl");
  const envelope = (candidate: typeof project) => ({ format: PROJECT_FILE_FORMAT, fileVersion: PROJECT_FILE_VERSION, exportedAt: project.updatedAt, project: candidate });
  const withTransition = (references: { sourceLevelId?: string; targetLevelId?: string; connectedLevelIds?: string[] }) => {
    const candidate = structuredClone(project);
    candidate.constructions[0]!.transitions = [{ id: "stairs", kind: "stairs", footprint: { kind: "rectangle", x: 1, y: 1, width: 2, height: 3 }, ...references }];
    return candidate;
  };

  it("exports a versioned application-specific envelope", () => {
    const exportedAt = "2026-08-29T20:00:00.000Z";
    const envelope = parseProjectFile(serializeProjectFile(project, exportedAt));
    expect(envelope).toMatchObject({ format: PROJECT_FILE_FORMAT, fileVersion: PROJECT_FILE_VERSION, exportedAt, project: { id: "project-original", schemaVersion: 9 } });
    expect(projectExportFileName("Dolina Brzàsku")).toBe("dolina-brzasku.cartographer.json");
  });

  it("round-trips the complete V2 JSON payload and enforces the byte limit", () => {
    expect(parseProjectFile(serializeProjectFile(project, "2026-08-29T20:00:00.000Z")).project).toEqual(project);
    expect(() => parseProjectFile("{" + "x".repeat(MAX_PROJECT_FILE_BYTES) + "}")).toThrow(/too large/);
  });

  it("round-trips zone-owned story metadata and color through project files", () => {
    const zoneProject = { ...project, story: { ...project.story, zones: [{ id: "zone", name: "Quiet court", members: [], tags: ["private"], color: "#445566", metadata: { narrativeLabel: "Court", properties: { mood: "quiet" } } }] } };
    expect(parseProjectFile(serializeProjectFile(zoneProject)).project.story.zones[0]).toMatchObject({ color: "#445566", metadata: { narrativeLabel: "Court", properties: { mood: "quiet" } } });
  });

  it("migrates an early Story payload before enforcing the current Story schema", () => {
    const legacy = structuredClone(project) as unknown as Record<string, unknown>;
    legacy.schemaVersion = 7;
    legacy.story = { characters: [{ id: "legacy-character", name: "Legacy character", description: "Imported from an early Story card." }] };
    const restored = parseProjectFile({ format: PROJECT_FILE_FORMAT, fileVersion: PROJECT_FILE_VERSION, exportedAt: project.updatedAt, project: legacy }).project;
    expect(restored.story.world).toContainEqual(expect.objectContaining({ id: "legacy-character", kind: "character", name: "Legacy character" }));
  });

  it("round-trips an optional note rotation while retaining legacy notes", () => {
    const note = { id: "note", belongsToId: project.places[0]!.id, name: "Note", layerId: "sketch" as const, subjectId: "sketch.note", geometry: { kind: "note" as const, at: { x: 1, y: 2 }, width: 12, height: 8, rotation: 37, text: "Rotated" }, visible: true, locked: false, tags: [], access: [], properties: {} };
    const roundTrip = parseProjectFile(serializeProjectFile({ ...project, elements: [note] })).project.elements[0]!.geometry;
    expect(roundTrip).toEqual(note.geometry);
    const legacy = parseProjectFile(serializeProjectFile({ ...project, elements: [{ ...note, geometry: { ...note.geometry, rotation: undefined } }] })).project.elements[0]!.geometry;
    expect(legacy).not.toHaveProperty("rotation");
  });

  it("rejects a bare project, unknown fields and unsupported versions", () => {
    expect(() => parseProjectFile(project)).toThrow();
    expect(() => parseProjectFile({ format: PROJECT_FILE_FORMAT, fileVersion: 99, exportedAt: project.updatedAt, project })).toThrow();
    expect(() => parseProjectFile({ format: PROJECT_FILE_FORMAT, fileVersion: PROJECT_FILE_VERSION, exportedAt: project.updatedAt, project, executable: "no" })).toThrow();
  });

  it("rejects an empty persisted project instead of leaving the workbench loading forever", () => {
    const empty = emptyProject("empty", "Empty");
    expect(() => parseProjectFile({ format: PROJECT_FILE_FORMAT, fileVersion: PROJECT_FILE_VERSION, exportedAt: empty.updatedAt, project: empty })).toThrow(/at least one map/);
  });

  it("rejects broken ownership and cyclic hierarchies", () => {
    const brokenOwner = structuredClone(project);
    brokenOwner.elements.push({ id: "orphan", belongsToId: "missing", name: "Orphan", layerId: "sketch", subjectId: "sketch.note", geometry: { kind: "note", at: { x: 0, y: 0 }, text: "" }, visible: true, locked: false, tags: [], access: [], properties: {} });
    expect(() => parseProjectFile(JSON.stringify({ format: PROJECT_FILE_FORMAT, fileVersion: PROJECT_FILE_VERSION, exportedAt: project.updatedAt, project: brokenOwner }))).toThrow(/Missing element owner/);

    const cycle = structuredClone(project); cycle.places[0]!.parentId = cycle.places[0]!.id;
    expect(() => parseProjectFile({ format: PROJECT_FILE_FORMAT, fileVersion: PROJECT_FILE_VERSION, exportedAt: project.updatedAt, project: cycle })).toThrow(/Hierarchy cycle/);
  });

  it("rejects duplicate room ids within one construction", () => {
    const broken = structuredClone(project);
    const construction = broken.constructions[0]!;
    const value = construction.rooms[0]!;
    construction.rooms.push(structuredClone(value));
    expect(() => parseProjectFile(envelope(broken))).toThrow(/Duplicate room id.*project-original:plan/);
  });

  it("rejects duplicate opening ids within one construction", () => {
    const broken = structuredClone(project);
    const construction = broken.constructions[0]!;
    const value = { id: "opening-duplicate", kind: "door" as const, wallId: construction.walls[0]!.id, position: .5, width: 2 };
    construction.openings.push(value, structuredClone(value));
    expect(() => parseProjectFile(envelope(broken))).toThrow(/Duplicate opening id.*opening-duplicate/);
  });

  it("rejects duplicate transition ids within one construction", () => {
    const broken = structuredClone(project);
    const construction = broken.constructions[0]!;
    const value = { id: "transition-duplicate", kind: "stairs" as const, footprint: { kind: "rectangle" as const, x: 0, y: 0, width: 2, height: 2 } };
    construction.transitions.push(value, structuredClone(value));
    expect(() => parseProjectFile(envelope(broken))).toThrow(/Duplicate transition id.*transition-duplicate/);
  });

  it("allows the same local construction ids in separate constructions", () => {
    const broken = structuredClone(project);
    const first = broken.constructions[0]!;
    broken.constructions.push({ ...structuredClone(first), id: "second-plan", rooms: [] });
    expect(() => parseProjectFile(envelope(broken))).not.toThrow();
  });

  it("requires room ids to stay global because they are navigable place ids", () => {
    const broken = structuredClone(project);
    const first = broken.constructions[0]!;
    broken.constructions.push({ ...structuredClone(first), id: "second-plan" });
    expect(() => parseProjectFile(envelope(broken))).toThrow(/Duplicate room id across constructions/);
  });

  it.each([
    ["sourceLevelId", "room", project.places.find(({ kind }) => kind === "room")!.id],
    ["targetLevelId", "location", project.places.find(({ kind }) => kind === "location")!.id],
  ] as const)("rejects a %s that names an existing %s", (field, kind, placeId) => {
    const candidate = withTransition({ [field]: placeId });
    expect(() => parseProjectFile(envelope(candidate))).toThrow(new RegExp(`not a level: ${placeId} \\(${kind}\\)`));
  });

  it("rejects mixed connected level ids when one existing place is not a level", () => {
    const levelId = project.places.find(({ kind }) => kind === "level")!.id;
    const locationId = project.places.find(({ kind }) => kind === "location")!.id;
    expect(() => parseProjectFile(envelope(withTransition({ connectedLevelIds: [levelId, locationId] })))).toThrow(new RegExp(`not a level: ${locationId} \\(location\\)`));
  });

  it("keeps the missing-level error and accepts source, target and connected level ids", () => {
    expect(() => parseProjectFile(envelope(withTransition({ sourceLevelId: "missing-level" })))).toThrow(/Vertical connection references a missing level: missing-level/);
    const firstLevel = project.places.find(({ kind }) => kind === "level")!;
    const secondLevel = { ...firstLevel, id: "project-original:upper-level", name: "Piętro", constructionId: undefined, order: 1 };
    const valid = withTransition({ sourceLevelId: firstLevel.id, targetLevelId: secondLevel.id, connectedLevelIds: [firstLevel.id, secondLevel.id] });
    valid.places.push(secondLevel);
    expect(parseProjectFile(envelope(valid)).project.constructions[0]!.transitions[0]).toMatchObject({ sourceLevelId: firstLevel.id, targetLevelId: secondLevel.id, connectedLevelIds: [firstLevel.id, secondLevel.id] });
  });

  it("imports only under a fresh id without mutating the source", () => {
    const copy = cloneImportedProject(project, "project-imported", "2026-08-29T21:00:00.000Z");
    expect(copy).toMatchObject({ id: "project-imported", name: "Dolina Brzasku", updatedAt: "2026-08-29T21:00:00.000Z" });
    expect(project.id).toBe("project-original");
    expect(() => cloneImportedProject(project, project.id)).toThrow(/fresh identifier/);
  });

  it("renames a clone and refuses an empty name", () => {
    const renamed = renameProject(project, "  Nowa nazwa  ", "2026-08-29T22:00:00.000Z");
    expect(renamed).toMatchObject({ id: project.id, name: "Nowa nazwa", updatedAt: "2026-08-29T22:00:00.000Z" });
    expect(project.name).toBe("Dolina Brzasku");
    expect(() => renameProject(project, "   ")).toThrow(/cannot be empty/);
  });

  it("loads and cleans the obsolete room appearance field from earlier V2 previews", () => {
    const legacy = structuredClone(project) as unknown as { constructions: Array<{ rooms: Array<Record<string, unknown>> }> };
    legacy.constructions[0]!.rooms[0]!.appearance = { fillColor: "#123456", fillOpacity: .5 };
    const envelope = parseProjectFile({ format: PROJECT_FILE_FORMAT, fileVersion: PROJECT_FILE_VERSION, exportedAt: project.updatedAt, project: legacy });
    expect(envelope.project.constructions[0]!.rooms[0]).not.toHaveProperty("appearance");
  });

  it("validates road geometry and bounded, ordered width profiles", () => {
    const road: DrawingElement = { id: "road", belongsToId: project.places[0]!.id, name: "Road", layerId: "roads", subjectId: "road.paved", geometry: { kind: "path", points: [{ x: 0, y: 0 }, { x: 10, y: 0 }], closed: false }, visible: true, locked: false, tags: [], access: [], properties: {}, widthMeters: 8, widthProfile: [{ t: 0, left: 4, right: 4 }, { t: 1, left: 6, right: 5 }], ribbonCutouts: [{ kind: "rectangle", x: 3, y: -1, width: 2, height: 2 }] };
    const withRoad = { ...project, elements: [road] };
    const envelope = parseProjectFile({ format: PROJECT_FILE_FORMAT, fileVersion: PROJECT_FILE_VERSION, exportedAt: project.updatedAt, project: withRoad });
    expect(envelope.project.elements[0]).toMatchObject({ layerId: "roads", widthMeters: 8, widthProfile: [{ t: 0 }, { t: 1 }] });
    expect(parseProjectFile(serializeProjectFile(withRoad, project.updatedAt)).project.elements[0]?.ribbonCutouts).toEqual(road.ribbonCutouts);
    const invalidGeometry = { ...withRoad, elements: [{ ...road, geometry: { kind: "point", at: { x: 0, y: 0 } } }] };
    expect(() => parseProjectFile({ format: PROJECT_FILE_FORMAT, fileVersion: PROJECT_FILE_VERSION, exportedAt: project.updatedAt, project: invalidGeometry })).toThrow(/path or bezier/);
    const onePoint = { ...withRoad, elements: [{ ...road, geometry: { kind: "path", points: [{ x: 0, y: 0 }], closed: false } }] };
    expect(() => parseProjectFile({ format: PROJECT_FILE_FORMAT, fileVersion: PROJECT_FILE_VERSION, exportedAt: project.updatedAt, project: onePoint })).toThrow(/at least two distinct points/);
    const repeatedPoint = { ...withRoad, elements: [{ ...road, geometry: { kind: "bezier", nodes: [{ anchor: { x: 1, y: 1 } }, { anchor: { x: 1, y: 1 } }], closed: false } }] };
    expect(() => parseProjectFile({ format: PROJECT_FILE_FORMAT, fileVersion: PROJECT_FILE_VERSION, exportedAt: project.updatedAt, project: repeatedPoint })).toThrow(/at least two distinct points/);
    const invalidProfile = { ...withRoad, elements: [{ ...road, widthProfile: [{ t: 0, left: 1, right: 1 }, { t: 0, left: 1, right: 1 }] }] };
    expect(() => parseProjectFile({ format: PROJECT_FILE_FORMAT, fileVersion: PROJECT_FILE_VERSION, exportedAt: project.updatedAt, project: invalidProfile })).toThrow(/strictly increasing/);
  });

  it("rejects road junctions with broken identity or ownership", () => {
    const ownerId = project.places[0]!.id;
    const road = (id: string, points: { x: number; y: number }[]): DrawingElement => ({ id, belongsToId: ownerId, name: id, layerId: "roads", subjectId: "road.paved", geometry: { kind: "path", points, closed: false }, visible: true, locked: false, tags: [], access: [], properties: {} });
    const roads = [road("horizontal", [{ x: 0, y: 5 }, { x: 10, y: 5 }]), road("vertical", [{ x: 5, y: 0 }, { x: 5, y: 10 }])];
    const candidate = { ...project, elements: roads, roadJunctions: [{ id: "junction", belongsToId: "missing", point: { x: 5, y: 5 }, roadIds: ["horizontal", "vertical"] }] };
    expect(() => parseProjectFile(envelope(candidate))).toThrow(/Missing road junction owner/);
    expect(() => parseProjectFile(envelope({ ...candidate, roadJunctions: [{ ...candidate.roadJunctions[0]!, belongsToId: ownerId, roadIds: ["horizontal", "horizontal"] }] }))).toThrow(/two distinct roads/);
    expect(() => parseProjectFile(envelope({ ...candidate, roadJunctions: [
      { ...candidate.roadJunctions[0]!, belongsToId: ownerId },
      { ...candidate.roadJunctions[0]!, belongsToId: ownerId },
    ] }))).toThrow(/Duplicate road junction id/);
  });
});
