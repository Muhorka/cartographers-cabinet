import { describe, expect, it } from "vitest";
import { editorProjectSchema } from "../persistence/project-file";
import { emptyProject, type DrawingElement, type EditorProject } from "../model/project-model";
import { emptyStoryData } from "../story/types";
import { projectDiff } from "./project-diff";

function project(elements: DrawingElement[]): EditorProject {
  return { ...emptyProject("project", "Synthetic"), places: [{ id: "world", name: "World", kind: "world", transform: { x: 0, y: 0, rotation: 0 }, tags: [], access: [], properties: {} }], elements };
}

function roomProject(scope: "plan" | "other" | "level", includeOther = false): EditorProject {
  const result = emptyProject("rooms", "Room identity");
  const room = (id: string, parentId: string) => ({ id, name: `${id} room`, parentId, kind: "room" as const, transform: { x: 0, y: 0, rotation: 0 }, tags: [], access: [], properties: {} });
  const construction = (id: string) => ({ id, revision: 0, walls: [], rooms: [{ id: "room", faceId: "face", name: `${id} room`, tags: [], access: [], properties: {} }], openings: [], transitions: [] });
  result.places = [{ id: "level", name: "Plan", kind: "level", constructionId: "plan", transform: { x: 0, y: 0, rotation: 0 }, tags: [], access: [], properties: {} }, room("room", "level")];
  result.constructions = [construction("plan")];
  if (includeOther) {
    result.places.push({ id: "other-level", name: "Other", kind: "level", constructionId: "other", transform: { x: 0, y: 0, rotation: 0 }, tags: [], access: [], properties: {} }, room("room", "other-level"));
    result.constructions.push(construction("other"));
  }
  result.story = { ...emptyStoryData(), objects: [{ ref: { kind: "room", id: "room", scopeId: scope }, metadata: { properties: { status: "ready" } } }] };
  return result;
}

function elementInSchemaOrder(): DrawingElement {
  return { id: "rock", belongsToId: "world", name: "Rock", layerId: "terrain", subjectId: "terrain.rocks", geometry: { kind: "region", shape: { kind: "rectangle", x: 1, y: 2, width: 3, height: 4 } }, visible: true, locked: false, tags: ["old", "stone"], access: [], properties: {} };
}

function elementInDifferentKeyOrder(): DrawingElement {
  const source = elementInSchemaOrder();
  return { properties: source.properties, tags: source.tags, access: source.access, locked: source.locked, visible: source.visible, geometry: source.geometry, subjectId: source.subjectId, layerId: source.layerId, name: source.name, belongsToId: source.belongsToId, id: source.id };
}

describe("project diff semantic equality", () => {
  it("ignores object key order while preserving collection identity", () => {
    expect(projectDiff(project([elementInSchemaOrder()]), project([elementInDifferentKeyOrder()])).elements).toEqual({ added: 0, removed: 0, changed: 0 });
  });

  it("counts nested geometry and array order changes", () => {
    const before = elementInSchemaOrder();
    const geometryChanged = { ...before, geometry: { kind: "region" as const, shape: { kind: "rectangle" as const, x: 1, y: 2, width: 3.5, height: 4 } } };
    const tagsChanged = { ...before, tags: ["stone", "old"] };
    expect(projectDiff(project([before]), project([geometryChanged])).elements.changed).toBe(1);
    expect(projectDiff(project([before]), project([tagsChanged])).elements.changed).toBe(1);
  });

  it("counts one changed story metadata record", () => {
    const before = project([]); before.story = { ...emptyStoryData(), objects: [{ ref: { kind: "place", id: "world" }, metadata: { tags: ["old"] } }] };
    const after = structuredClone(before); after.story.objects[0]!.metadata.tags = ["new"];
    expect(projectDiff(before, after).story).toEqual({ added: 0, removed: 0, changed: 1 });
  });

  it("counts collection additions and removals", () => {
    const before = project([elementInSchemaOrder()]); const after = project([]);
    expect(projectDiff(before, after).elements).toEqual({ added: 0, removed: 1, changed: 0 });
    expect(projectDiff(after, before).elements).toEqual({ added: 1, removed: 0, changed: 0 });
  });

  it("ignores nested reference and property key order", () => {
    const before = project([]); before.story = { ...emptyStoryData(), objects: [{ ref: { kind: "place", id: "world" }, metadata: { properties: { link: { kind: "room", id: "room", scopeId: "north" }, flags: ["a", "b"] } } }] };
    const after = structuredClone(before); const metadata = after.story.objects[0]!.metadata;
    metadata.properties = { flags: ["a", "b"], link: { scopeId: "north", id: "room", kind: "room" } };
    expect(projectDiff(before, after).story).toEqual({ added: 0, removed: 0, changed: 0 });
  });

  it("treats an owning-level room scope alias as the same story object", () => {
    const before = roomProject("level"); const after = roomProject("plan");
    const beforeSnapshot = structuredClone(before); const afterSnapshot = structuredClone(after);
    expect(projectDiff(before, after).story).toEqual({ added: 0, removed: 0, changed: 0 });
    expect(before).toEqual(beforeSnapshot); expect(after).toEqual(afterSnapshot);
  });

  it("counts metadata edits on a scope alias as one change", () => {
    const before = roomProject("level"); const after = roomProject("plan");
    after.story.objects[0]!.metadata.properties = { status: "changed" };
    expect(projectDiff(before, after).story).toEqual({ added: 0, removed: 0, changed: 1 });
  });

  it("keeps genuinely different construction scopes separate", () => {
    const before = roomProject("plan", true); const after = roomProject("other", true);
    expect(projectDiff(before, after).story).toEqual({ added: 1, removed: 1, changed: 0 });
  });

  it("does not report a change after the production schema clone reorders keys", () => {
    const before = project([elementInDifferentKeyOrder()]);
    const parsed = editorProjectSchema.parse(structuredClone(before));
    expect(projectDiff(before, parsed).elements).toEqual({ added: 0, removed: 0, changed: 0 });
  });

  it("reports project name and measurement settings outside the object collections", () => {
    const before = project([]);
    const after = structuredClone(before);
    after.name = "Renamed";
    after.measureSettings.showAxes = true;
    expect(projectDiff(before, after).project).toEqual({ added: 0, removed: 0, changed: 2 });
  });
});
