import { expect, it } from "vitest";
import { emptyStoryData, storyRefKey } from "../types";
import { storyObjectOptions } from "./story-object-options";

it("uses live names and adds the shortest owner path for repeated rooms", () => {
  const ref = { kind: "room" as const, id: "r", scopeId: "floor-one" };
  const second = { ...ref, scopeId: "floor-two" };
  const story = { ...emptyStoryData(), objects: [{ ref, metadata: {} }] };
  const floorOne = { kind: "place" as const, id: "floor-one" };
  const floorTwo = { kind: "place" as const, id: "floor-two" };
  const live = [
    { ref, name: "Hall", ownerPlaceId: floorOne.id },
    { ref: second, name: "Hall", ownerPlaceId: floorTwo.id },
    { ref: floorOne, name: "Ground floor" },
    { ref: floorTwo, name: "Upper floor" },
  ];
  expect(storyObjectOptions(story, live).slice(0, 2)).toEqual([
    { id: storyRefKey(ref), name: "Hall — Ground floor", ref }, { id: storyRefKey(second), name: "Hall — Upper floor", ref: second },
  ]);
});

it("extends the owner path when same-named floors belong to different buildings", () => {
  const roomA = { kind: "room" as const, id: "room-a", scopeId: "construction-a" };
  const roomB = { kind: "room" as const, id: "room-b", scopeId: "construction-b" };
  const floorA = { kind: "place" as const, id: "floor-a" };
  const floorB = { kind: "place" as const, id: "floor-b" };
  const buildingA = { kind: "place" as const, id: "building-a" };
  const buildingB = { kind: "place" as const, id: "building-b" };
  const story = { ...emptyStoryData(), objects: [{ ref: roomA, metadata: {} }] };
  const live = [
    { ref: roomA, name: "Pomieszczenie 1", ownerPlaceId: floorA.id },
    { ref: roomB, name: "Pomieszczenie 1", ownerPlaceId: floorB.id },
    { ref: floorA, name: "Parter", ownerPlaceId: buildingA.id },
    { ref: floorB, name: "Parter", ownerPlaceId: buildingB.id },
    { ref: buildingA, name: "Budynek A" },
    { ref: buildingB, name: "Budynek B" },
  ];
  expect(storyObjectOptions(story, live).slice(0, 2).map(({ id, name, ref }) => ({ id, name, ref }))).toEqual([
    { id: storyRefKey(roomA), name: "Pomieszczenie 1 — Parter — Budynek A", ref: roomA },
    { id: storyRefKey(roomB), name: "Pomieszczenie 1 — Parter — Budynek B", ref: roomB },
  ]);
});

it("uses a complete live catalogue without exposing stale Story refs", () => {
  const place = { kind: "place" as const, id: "hall" };
  const staleWall = { kind: "wall" as const, id: "old-wall" };
  const story = { ...emptyStoryData(), objects: [
    { ref: place, metadata: { narrativeLabel: "Authored hall" } },
    { ref: staleWall, metadata: { narrativeLabel: "Removed wall" } },
  ] };
  expect(storyObjectOptions(story, [{ ref: place, name: "Native hall" }])).toEqual([{ id: storyRefKey(place), name: "Native hall", ref: place }]);
  expect(story.objects).toHaveLength(2);
});

it("prefers an effective scenario name from the live catalogue", () => {
  const ref = { kind: "place" as const, id: "hall" };
  const story = { ...emptyStoryData(), objects: [{ ref, metadata: { narrativeLabel: "Base hall" } }] };
  expect(storyObjectOptions(story, [{ ref, name: "Scenario hall", metadata: { narrativeLabel: "Scenario label" } }])[0]?.name).toBe("Scenario hall");
});

it("keeps sparse Story records available when no live catalogue is supplied", () => {
  const ref = { kind: "opening" as const, id: "door" };
  const story = { ...emptyStoryData(), objects: [{ ref, metadata: { narrativeLabel: "North door" } }] };
  expect(storyObjectOptions(story)).toEqual([{ id: storyRefKey(ref), name: "North door", ref }]);
  expect(storyObjectOptions(story, [])).toEqual([]);
});

it("filters technical wall segments only for membership selectors and preserves openings", () => {
  const wall = { kind: "wall" as const, id: "wall", scopeId: "plan" };
  const door = { kind: "opening" as const, id: "door", scopeId: "plan" };
  const story = { ...emptyStoryData(), objects: [{ ref: wall, metadata: {} }, { ref: door, metadata: {} }] };
  const live = [{ ref: wall, name: "Wall" }, { ref: door, name: "Door" }];
  expect(storyObjectOptions(story, live, "zone-membership").map(({ ref }) => ref)).toEqual([door]);
  expect(storyObjectOptions(story, live, "group-membership").map(({ ref }) => ref)).toEqual([door]);
  expect(storyObjectOptions(story, live, "route").map(({ ref }) => ref)).toEqual([wall, door]);
});
