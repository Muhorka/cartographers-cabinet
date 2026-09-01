import { storyRefKey, type StoryData, type StoryObjectRef } from "../types";
import type { StoryResolvedObject } from "./story-types";

export type StoryObjectOptionPurpose = "all" | "zone-membership" | "group-membership" | "membership" | "route";
type StoryObjectOption = { id: string; name: string; ref: StoryObjectRef };

function includeForPurpose(ref: StoryObjectRef, purpose: StoryObjectOptionPurpose) {
  // Construction walls are technical segments. Openings remain selectable for route/key/access work.
  return !(["zone-membership", "group-membership", "membership"] as StoryObjectOptionPurpose[]).includes(purpose) || ref.kind !== "wall";
}

function ownerPath(object: StoryResolvedObject, byPlaceId: ReadonlyMap<string, StoryResolvedObject>) {
  const path: string[] = [];
  const seen = new Set<string>();
  let ownerId = object.ownerPlaceId;
  while (ownerId && !seen.has(ownerId)) {
    seen.add(ownerId);
    const owner = byPlaceId.get(ownerId);
    if (!owner) break;
    const ownerName = owner.name?.trim();
    if (ownerName) path.push(ownerName);
    ownerId = owner.ownerPlaceId;
  }
  return path;
}

function disambiguateRepeatedNames(options: StoryObjectOption[], resolved: readonly StoryResolvedObject[]) {
  const byRef = new Map(resolved.map((object) => [storyRefKey(object.ref), object]));
  const byPlaceId = new Map(resolved.flatMap((object) => object.ref.kind === "place" || object.ref.kind === "room" ? [[object.ref.id, object] as const] : []));
  const groups = new Map<string, number[]>();
  options.forEach((option, index) => {
    const indexes = groups.get(option.name) ?? [];
    indexes.push(index);
    groups.set(option.name, indexes);
  });
  for (const indexes of groups.values()) {
    if (indexes.length < 2) continue;
    const descriptors = indexes.map((index) => {
      const option = options[index]!;
      const object = byRef.get(option.id);
      return { option, path: object ? ownerPath(object, byPlaceId) : [], fallback: option.id };
    });
    const maxDepth = Math.max(...descriptors.map(({ path }) => path.length), 0);
    for (let depth = 1; depth <= maxDepth + 1; depth++) {
      const suffixes = descriptors.map(({ path, fallback }) => path.length >= depth ? path.slice(0, depth).join(" — ") : fallback);
      if (new Set(suffixes).size !== suffixes.length) continue;
      descriptors.forEach(({ option }, index) => { option.name = `${option.name} — ${suffixes[index]}`; });
      break;
    }
  }
}

export function storyObjectOptions(story: StoryData, resolved?: readonly StoryResolvedObject[], purpose: StoryObjectOptionPurpose = "all") {
  const options = new Map<string, StoryObjectOption>();
  if (resolved === undefined) {
    for (const { ref, metadata } of story.objects) if (includeForPurpose(ref, purpose)) options.set(storyRefKey(ref), { id: storyRefKey(ref), name: metadata.narrativeLabel ?? ref.id, ref });
    return [...options.values()];
  }
  const authored = new Map(story.objects.map((object) => [storyRefKey(object.ref), object]));
  // A supplied live catalogue is authoritative for selectable objects. Story records remain untouched.
  for (const { ref, name, metadata } of resolved) {
    if (!includeForPurpose(ref, purpose)) continue;
    const authoredName = authored.get(storyRefKey(ref))?.metadata.narrativeLabel;
    options.set(storyRefKey(ref), { id: storyRefKey(ref), name: name ?? metadata?.narrativeLabel ?? authoredName ?? ref.id, ref });
  }
  const values = [...options.values()];
  disambiguateRepeatedNames(values, resolved);
  return values;
}
