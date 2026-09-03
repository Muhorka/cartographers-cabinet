import { describe, expect, it } from "vitest";
import { emptyProject, type EditorProject } from "../model/project-model";
import { createIndependentLevel } from "../model/hierarchy-operations";
import { agentSafetyReasons, assertAgentLocks } from "./agent-change-policy";
import { EditorSession } from "../state/editor-session";
import { EditorCommandCoordinator } from "./editor-command-coordinator";
import { buildDeleteChange, buildMetadataChange } from "./agent-object-command";

function fixture() {
  let index = 0;
  const project = createIndependentLevel(emptyProject("lock-order", "Synthetic floor"), { id: "lock-level", constructionId: "lock-plan", name: "Synthetic floor", boundary: { kind: "rectangle", x: -30, y: -20, width: 60, height: 40 } }, { createId: () => `lock-shape-${++index}` });
  const owner = project.places[0].id; const construction = project.constructions[0];
  project.elements.push({ id: "note", belongsToId: owner, name: "Note", layerId: "sketch", subjectId: "sketch.note", geometry: { kind: "note", at: { x: 0, y: 0 }, text: "Keep this", width: 2, height: 1 }, visible: true, locked: false, tags: [], access: [], properties: {} });
  project.surfaces.push({ id: "stage", belongsToId: owner, name: "Stage", kind: "stage", attachment: "free", shape: { kind: "rectangle", x: 2, y: 2, width: 3, height: 2 }, elevation: 1, visible: true, locked: false, tags: [], access: [], properties: {} });
  construction.openings.push({ id: "door", kind: "door", wallId: construction.walls[0].id, position: .5, width: 1 });
  construction.transitions.push({ id: "stairs", kind: "stairs", footprint: { kind: "rectangle", x: 4, y: 4, width: 2, height: 2 }, sourceLevelId: owner, sameLevelRise: true });
  return project;
}

// Recreate JSON with different object insertion order, never changing array order.
function reverseKeys<T>(value: T): T {
  return JSON.parse(JSON.stringify(value, (_key, entry) => entry && typeof entry === "object" && !Array.isArray(entry)
    ? Object.fromEntries(Object.entries(entry).reverse()) : entry)) as T;
}

function targets(project: EditorProject) {
  const construction = project.constructions[0];
  return { place: project.places[0], element: project.elements[0], surface: project.surfaces[0], wall: construction.walls[0], room: construction.rooms[0], opening: construction.openings[0], transition: construction.transitions[0] };
}

describe("agent comparisons preserve locks without treating key order as an edit", () => {
  it.each(["place", "element", "surface", "wall", "room", "opening", "transition"] as const)("accepts reordered %s records but still rejects removal", (kind) => {
    const before = fixture(); targets(before)[kind].locked = true;
    const after = reverseKeys(before);
    expect(() => assertAgentLocks(before, after)).not.toThrow();
    targets(after)[kind].id += "-replacement";
    expect(() => assertAgentLocks(before, after)).toThrow("Object is locked for editing");
  });

  it("allows unlocking alone, but rejects unlocking and editing together", () => {
    const before = fixture(); before.elements[0].locked = true;
    const after = reverseKeys(before); after.elements[0].locked = false;
    expect(() => assertAgentLocks(before, after)).not.toThrow();
    after.elements[0].name = "Also edited";
    expect(() => assertAgentLocks(before, after)).toThrow("Object is locked for editing");
  });

  it.each(["place", "element", "surface", "wall", "room", "opening", "transition"] as const)("reports attempted metadata changes on a locked %s before a silent no-op", (kind) => {
    const project = fixture(); const target = targets(project)[kind]; target.locked = true;
    const ref = { type: kind, id: target.id, scopeId: ["wall", "room", "opening", "transition"].includes(kind) ? project.constructions[0].id : undefined };
    expect(() => buildMetadataChange(project, project.places[0].id, { ref, metadata: { visible: false } })).toThrow("Object is locked for editing");
    expect(() => buildMetadataChange(project, project.places[0].id, { ref, metadata: { locked: false, visible: false } })).toThrow("Object is locked for editing");
    expect(() => buildMetadataChange(project, project.places[0].id, { ref, metadata: { locked: false } })).not.toThrow();
  });

  it("ignores annotation key order while protecting actual values and array order", () => {
    const before = fixture(); before.elements[0].locked = true;
    before.story.objects.push({ ref: { kind: "element", id: "note" }, metadata: { owners: ["a", "b"], properties: { warm: true, quiet: false } } });
    const after = structuredClone(before);
    after.story.objects[0].metadata = reverseKeys(after.story.objects[0].metadata);
    expect(() => assertAgentLocks(before, after)).not.toThrow();
    after.story.objects[0].metadata.owners = ["b", "a"];
    expect(() => assertAgentLocks(before, after)).toThrow("Object is locked for editing");
    after.story.objects[0].metadata.owners = ["a", "b"];
    after.story.objects[0].metadata.properties!.quiet = true;
    expect(() => assertAgentLocks(before, after)).toThrow("Object is locked for editing");
  });

  it("does not request a safety tracing for key order, but still detects outline and topology edits", () => {
    const before = fixture(); const after = reverseKeys(before);
    expect(agentSafetyReasons(before, after)).toEqual([]);
    const manyRecords = structuredClone(before);
    manyRecords.elements.push(...Array.from({ length: 5 }, (_, index) => ({ ...before.elements[0], id: `many-${index}` })));
    expect(agentSafetyReasons(before, manyRecords)).toEqual(["many-targets"]);
    expect(agentSafetyReasons(before, after, { changedRecordCount: 5 })).toEqual(["many-targets"]);
    after.places[0].boundary = { kind: "rectangle", x: -31, y: -20, width: 62, height: 40 };
    expect(agentSafetyReasons(before, after)).toContain("structural-outline");
    after.constructions[0].rooms[0].faceId += "-changed";
    expect(agentSafetyReasons(before, after)).toContain("room-topology");
    after.elements = [];
    expect(() => assertAgentLocks({ ...before, elements: before.elements.map((item) => ({ ...item, locked: true })) }, after)).toThrow("Object is locked for editing");
  });

  it("prepares one real edit alongside an unchanged locked object through schema parsing and undo", () => {
    const source = fixture(); source.elements[0].locked = true;
    const session = new EditorSession(reverseKeys(source)); const before = session.getState().project;
    const coordinator = new EditorCommandCoordinator({ getSession: () => session, refresh: () => undefined });
    const prepared = coordinator.prepare("rename-stage", (project) => {
      project.surfaces[0].name = "Renamed stage";
      return { project, summary: "Rename one stage" };
    });
    expect(prepared.status).toBe("prepared");
    if (prepared.status !== "prepared") throw new Error(`Unexpected preparation: ${prepared.status}`);
    expect(prepared.changes.surfaces).toEqual({ added: 0, removed: 0, changed: 1 });
    for (const collection of ["places", "elements", "constructions", "roadJunctions", "story"] as const) {
      expect(prepared.changes[collection]).toEqual({ added: 0, removed: 0, changed: 0 });
    }
    const applied = coordinator.apply(prepared.token);
    expect(applied.status).toBe("applied");
    expect(session.getState().project.elements).toEqual(before.elements);
    expect(session.undo().changed).toBe(true);
    expect(session.getState().project).toEqual(before);
  });

  it("blocks an agent subtree deletion when a descendant place is locked", () => {
    const source = fixture(); const owner = source.places[0]!.id;
    source.places.push({ id: "locked-child", parentId: owner, name: "Locked child", kind: "custom", transform: { x: 0, y: 0, rotation: 0 }, tags: [], access: [], properties: {}, locked: true });
    const session = new EditorSession(source); const before = session.getState().project;
    const coordinator = new EditorCommandCoordinator({ getSession: () => session, refresh: () => undefined });
    const prepared = coordinator.prepare("delete-locked-subtree", (project) => buildDeleteChange(project, owner, [{ type: "place", id: owner }]));
    expect(prepared.status).toBe("blocked");
    if (prepared.status !== "blocked") throw new Error(`Unexpected preparation: ${prepared.status}`);
    expect(prepared.reason).toMatch(/place locked-child is locked/i);
    expect(session.getState().project).toEqual(before);
  });
});
