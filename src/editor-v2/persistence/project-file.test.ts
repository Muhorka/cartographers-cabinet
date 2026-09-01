import { describe, expect, it } from "vitest";
import { createStarterProject } from "../model/starter-project";
import type { DrawingElement } from "../model/project-model";
import { MAX_PROJECT_FILE_BYTES, PROJECT_FILE_FORMAT, PROJECT_FILE_VERSION, cloneImportedProject, parseProjectFile, projectExportFileName, renameProject, serializeProjectFile } from "./project-file";

describe("editor v2 project files", () => {
  const project = createStarterProject("project-original", "Dolina Brzasku", "pl");

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

  it("rejects broken ownership and cyclic hierarchies", () => {
    const brokenOwner = structuredClone(project);
    brokenOwner.elements.push({ id: "orphan", belongsToId: "missing", name: "Orphan", layerId: "sketch", subjectId: "sketch.note", geometry: { kind: "note", at: { x: 0, y: 0 }, text: "" }, visible: true, locked: false, tags: [], access: [], properties: {} });
    expect(() => parseProjectFile(JSON.stringify({ format: PROJECT_FILE_FORMAT, fileVersion: PROJECT_FILE_VERSION, exportedAt: project.updatedAt, project: brokenOwner }))).toThrow(/Missing element owner/);

    const cycle = structuredClone(project); cycle.places[0]!.parentId = cycle.places[0]!.id;
    expect(() => parseProjectFile({ format: PROJECT_FILE_FORMAT, fileVersion: PROJECT_FILE_VERSION, exportedAt: project.updatedAt, project: cycle })).toThrow(/Hierarchy cycle/);
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
    const invalidProfile = { ...withRoad, elements: [{ ...road, widthProfile: [{ t: 0, left: 1, right: 1 }, { t: 0, left: 1, right: 1 }] }] };
    expect(() => parseProjectFile({ format: PROJECT_FILE_FORMAT, fileVersion: PROJECT_FILE_VERSION, exportedAt: project.updatedAt, project: invalidProfile })).toThrow(/strictly increasing/);
  });
});
