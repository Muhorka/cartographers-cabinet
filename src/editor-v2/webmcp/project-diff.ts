import type { EditorProject } from "../model/project-model";
import { stableJsonStringify } from "../model/json-value";
import { storyCollectionEntryId } from "../story/collection-identity";
import { projectStoryData } from "../story/project-effective";

type ChangeCount = { added: number; removed: number; changed: number };
export type ProjectDiff = Record<"places" | "elements" | "surfaces" | "constructions" | "roadJunctions" | "story", ChangeCount>;

function collectionDiff<T extends { id: string }>(before: readonly T[], after: readonly T[]): ChangeCount {
  const old = new Map(before.map((item) => [item.id, stableJsonStringify(item)]));
  const next = new Map(after.map((item) => [item.id, stableJsonStringify(item)]));
  return {
    added: [...next.keys()].filter((id) => !old.has(id)).length,
    removed: [...old.keys()].filter((id) => !next.has(id)).length,
    changed: [...next].filter(([id, value]) => old.has(id) && old.get(id) !== value).length,
  };
}

export function projectDiff(before: EditorProject, after: EditorProject): ProjectDiff {
  const story = (project: EditorProject): { id: string; value: unknown }[] => Object.entries(projectStoryData(project)).flatMap(([collection, value]): { id: string; value: unknown }[] =>
    Array.isArray(value) ? value.map((entry) => ({ value: entry, id: `${collection}:${storyCollectionEntryId(entry)}` })) : [{ id: collection, value }]);
  return {
    places: collectionDiff(before.places, after.places), elements: collectionDiff(before.elements, after.elements),
    surfaces: collectionDiff(before.surfaces, after.surfaces), constructions: collectionDiff(before.constructions, after.constructions),
    roadJunctions: collectionDiff(before.roadJunctions ?? [], after.roadJunctions ?? []), story: collectionDiff(story(before), story(after)),
  };
}
