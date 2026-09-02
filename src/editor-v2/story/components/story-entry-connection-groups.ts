import { storyRefKey } from "../types";
import type { StoryResolvedObject } from "./story-types";

const structuralKinds = new Set(["wall", "opening", "transition"]);

function byName(left: StoryResolvedObject, right: StoryResolvedObject) {
  return (left.name ?? left.ref.id).localeCompare(right.name ?? right.ref.id, undefined, { sensitivity: "base", numeric: true });
}

function placeObjects(objects: readonly StoryResolvedObject[]) {
  return new Map(objects.flatMap((object) => object.ref.kind === "place" || object.ref.kind === "room" ? [[object.ref.id, object] as const] : []));
}

function ancestors(object: StoryResolvedObject, places: ReadonlyMap<string, StoryResolvedObject>) {
  const result: StoryResolvedObject[] = [];
  const seen = new Set<string>();
  let ownerId = object.ownerPlaceId;
  while (ownerId && !seen.has(ownerId)) {
    seen.add(ownerId);
    const owner = places.get(ownerId);
    if (!owner) break;
    result.push(owner);
    ownerId = owner.ownerPlaceId;
  }
  return result;
}

export type OwnershipDisplayGroups = {
  roots: StoryResolvedObject[];
  inherited: StoryResolvedObject[];
  structural: StoryResolvedObject[];
  exceptions: StoryResolvedObject[];
};

/** Compresses effective ownership into top-level scopes without discarding inspectable detail. */
export function ownershipDisplayGroups(objects: readonly StoryResolvedObject[], ownerId: string): OwnershipDisplayGroups {
  const places = placeObjects(objects);
  const owns = (object: StoryResolvedObject) => object.metadata?.owners?.includes(ownerId) ?? false;
  const owned = objects.filter(owns);
  const structural = owned.filter(({ ref }) => structuralKinds.has(ref.kind)).toSorted(byName);
  const nonStructural = owned.filter(({ ref }) => !structuralKinds.has(ref.kind));
  const ownedKeys = new Set(nonStructural.map(({ ref }) => storyRefKey(ref)));
  const roots = nonStructural.filter((object) => !ancestors(object, places).some(({ ref }) => ownedKeys.has(storyRefKey(ref)))).toSorted(byName);
  const rootIds = new Set(roots.flatMap(({ ref }) => ref.kind === "place" || ref.kind === "room" ? [ref.id] : []));
  const inherited = nonStructural.filter((object) => !roots.includes(object)).toSorted(byName);
  const exceptions = objects.filter((object) => {
    if (owns(object)) return false;
    const chain = ancestors(object, places);
    const rootIndex = chain.findIndex(({ ref }) => rootIds.has(ref.id));
    if (rootIndex < 0) return false;
    // A non-owned parent already represents the excluded branch; do not repeat all of its children.
    return chain.slice(0, rootIndex).every(owns);
  }).toSorted(byName);
  return { roots, inherited, structural, exceptions };
}
