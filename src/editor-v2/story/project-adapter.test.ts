import { describe, expect, it } from "vitest";
import { createConstructionDocument } from "../construction/construction-document";
import { emptyProject, type EditorProject, type RegionShape } from "../model/project-model";
import { emptyStoryData, type StoryData, type StoryObjectRef } from "./types";
import { zoneMatchesProject } from "./project-adapter";

function projectWithNestedLevel(): EditorProject {
  const project = emptyProject("zones", "Zone tests");
  const place = (id: string, parentId: string | undefined, kind: "location" | "building" | "level", x: number, y: number) => ({
    id,
    parentId,
    name: id,
    kind,
    transform: { x, y, rotation: 0 },
    boundary: { kind: "rectangle" as const, x: -10, y: -10, width: 80, height: 80 },
    tags: [],
    access: [],
    properties: {},
    visible: true,
    locked: false,
  });
  project.places.push(place("location", undefined, "location", 100, 50), place("building", "location", "building", 10, 5), place("level", "building", "level", 4, 3));
  project.elements.push(
    {
      id: "inside",
      belongsToId: "level",
      name: "Inside",
      layerId: "terrain",
      subjectId: "terrain.grass",
      geometry: { kind: "region", shape: { kind: "rectangle", x: 1, y: 1, width: 2, height: 2 } },
      visible: true,
      locked: false,
      tags: [],
      access: [],
      properties: {},
    },
    {
      id: "overlap",
      belongsToId: "level",
      name: "Overlap",
      layerId: "terrain",
      subjectId: "terrain.grass",
      geometry: { kind: "region", shape: { kind: "rectangle", x: 14, y: 5, width: 10, height: 4 } },
      visible: true,
      locked: false,
      tags: [],
      access: [],
      properties: {},
    },
    {
      id: "hole",
      belongsToId: "level",
      name: "Hole",
      layerId: "terrain",
      subjectId: "terrain.grass",
      geometry: { kind: "region", shape: { kind: "rectangle", x: 3, y: 8, width: 4, height: 4 } },
      visible: true,
      locked: false,
      tags: [],
      access: [],
      properties: {},
    },
  );
  return project;
}

function storyFor(shape: RegionShape): StoryData {
  return {
    ...emptyStoryData(),
    zones: [{ id: "zone", name: "Zone", ownerPlaceId: "location", shape, members: [], tags: [] }],
  };
}

function match(project: EditorProject, story: StoryData, id: string) {
  const ref: StoryObjectRef = { kind: "element", id };
  return zoneMatchesProject(project, story, "zone", ref);
}

function projectWithRiver() {
  const project = projectWithNestedLevel();
  project.elements.push({
    id: "river",
    belongsToId: "level",
    name: "River",
    layerId: "terrain",
    subjectId: "terrain.river",
    geometry: { kind: "path", points: [{ x: 5, y: 10 }, { x: 15, y: 10 }], closed: false },
    widthMeters: 4,
    visible: true,
    locked: false,
    tags: [],
    access: [],
    properties: {},
  });
  return project;
}

describe("zoneMatchesProject", () => {
  it("transforms nested level geometry into its location frame", () => {
    const project = projectWithNestedLevel();
    const result = match(project, storyFor({ kind: "rectangle", x: 0, y: 0, width: 40, height: 40 }), "inside");
    expect(result).toEqual({ matches: true, relation: "inside", partial: false, reason: "exact-local-geometry" });
  });

  it("applies ancestor rotation instead of comparing source-local coordinates", () => {
    const project = projectWithNestedLevel();
    project.places.find(({ id }) => id === "building")!.transform.rotation = 90;
    const result = match(project, storyFor({ kind: "rectangle", x: -1, y: 9, width: 8, height: 8 }), "inside");
    expect(result).toEqual({ matches: true, relation: "inside", partial: false, reason: "exact-local-geometry" });
  });

  it("transforms a room boundary from the room frame, not only its level frame", () => {
    const project = projectWithNestedLevel();
    project.places.push({
      id: "room",
      parentId: "level",
      name: "Room",
      kind: "room",
      transform: { x: 20, y: 10, rotation: 0 },
      boundary: { kind: "rectangle", x: 0, y: 0, width: 4, height: 4 },
      tags: [],
      access: [],
      properties: {},
      visible: true,
      locked: false,
    });
    const story = storyFor({ kind: "rectangle", x: 30, y: 15, width: 10, height: 10 });
    expect(zoneMatchesProject(project, story, "zone", { kind: "room", id: "room" })).toEqual({
      matches: true,
      relation: "inside",
      partial: false,
      reason: "exact-local-geometry",
    });
  });

  it("derives geometry for a construction room without a duplicate place record", () => {
    const project = projectWithNestedLevel();
    project.places.find(({ id }) => id === "level")!.constructionId = "plan";
    const construction = createConstructionDocument("plan", [
      { id: "north", start: { x: 0, y: 0 }, end: { x: 10, y: 0 }, thickness: .2, role: "boundary" },
      { id: "east", start: { x: 10, y: 0 }, end: { x: 10, y: 10 }, thickness: .2, role: "boundary" },
      { id: "south", start: { x: 10, y: 10 }, end: { x: 0, y: 10 }, thickness: .2, role: "boundary" },
      { id: "west", start: { x: 0, y: 10 }, end: { x: 0, y: 0 }, thickness: .2, role: "boundary" },
    ], { createId: () => "construction-room", createName: () => "Construction room" });
    project.constructions.push(construction);
    const room = construction.rooms[0];
    if (!room) throw new Error("expected a room face from the construction shell");
    const story = storyFor({ kind: "rectangle", x: 10, y: 4, width: 20, height: 20 });
    expect(zoneMatchesProject(project, story, "zone", { kind: "room", id: room.id, scopeId: "plan" })).toEqual({
      matches: true,
      relation: "inside",
      partial: false,
      reason: "exact-local-geometry",
    });
  });

  it("reports a transformed partial intersection separately from inside", () => {
    const project = projectWithNestedLevel();
    const result = match(project, storyFor({ kind: "rectangle", x: 0, y: 0, width: 30, height: 30 }), "overlap");
    expect(result).toEqual({ matches: true, relation: "overlaps", partial: true, reason: "exact-local-intersection" });
  });

  it("does not match geometry that lies in a zone hole", () => {
    const project = projectWithNestedLevel();
    const result = match(project, storyFor({
      kind: "compound",
      polygons: [{ outer: [{ x: 0, y: 0 }, { x: 40, y: 0 }, { x: 40, y: 40 }, { x: 0, y: 40 }], holes: [[{ x: 15, y: 15 }, { x: 25, y: 15 }, { x: 25, y: 25 }, { x: 15, y: 25 }]] }],
    }), "hole");
    expect(result).toEqual({ matches: false, reason: "exact-local-disjoint" });
  });

  it("uses the ribbon area for rivers, including its width", () => {
    const project = projectWithRiver();
    const result = match(project, storyFor({ kind: "rectangle", x: 0, y: 0, width: 40, height: 40 }), "river");
    expect(result).toEqual({ matches: true, relation: "inside", partial: false, reason: "exact-local-geometry" });
  });

  it("treats a river that only touches a zone edge as non-overlapping", () => {
    const project = projectWithRiver();
    const touching = match(project, storyFor({ kind: "rectangle", x: 0, y: 0, width: 19, height: 40 }), "river");
    const outside = match(project, storyFor({ kind: "rectangle", x: 0, y: 0, width: 18, height: 40 }), "river");
    expect(touching).toEqual({ matches: false, reason: "exact-local-disjoint" });
    expect(outside).toEqual({ matches: false, reason: "exact-local-disjoint" });
  });

  it("accepts a descendant owner but rejects an unrelated place", () => {
    const project = projectWithNestedLevel();
    const story = storyFor({ kind: "rectangle", x: 0, y: 0, width: 40, height: 40 });
    project.places.push({ id: "other", name: "Other", kind: "location", transform: { x: 0, y: 0, rotation: 0 }, tags: [], access: [], properties: {}, visible: true, locked: false });
    project.elements.push({
      id: "outside",
      belongsToId: "other",
      name: "Outside",
      layerId: "terrain",
      subjectId: "terrain.grass",
      geometry: { kind: "region", shape: { kind: "rectangle", x: 1, y: 1, width: 2, height: 2 } },
      visible: true,
      locked: false,
      tags: [],
      access: [],
      properties: {},
    });
    expect(match(project, story, "inside").matches).toBe(true);
    expect(match(project, story, "outside")).toEqual({ matches: false, reason: "outside-owner-place" });
  });
});
