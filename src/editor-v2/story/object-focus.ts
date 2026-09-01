import type { EditorProject } from "../model/project-model";
import { resolveStoryObject } from "./project-adapter";
import { storyRefKey, type StoryObjectRef } from "./types";

/** Resolve a canonical story reference to the sheet where it can be selected. */
export function storyObjectLocation(project: EditorProject, ref: StoryObjectRef, activePlaceId?: string) {
  const object = resolveStoryObject(project, project.story, ref);
  if (!object) return undefined;
  let placeId = object.ownerPlaceId;
  if (object.ref.kind === "place") placeId ??= object.ref.id;
  if (!placeId && object.ref.scopeId) {
    const owners = project.places.filter((place) => place.constructionId === object.ref.scopeId);
    const preferred = owners.find(({ id }) => id === ref.scopeId) ?? owners.find(({ id }) => id === activePlaceId);
    placeId = preferred?.id ?? (owners.length === 1 ? owners[0].id : undefined);
  }
  if (!placeId || !project.places.some(({ id }) => id === placeId)) return undefined;
  return { placeId, ref: object.ref, selection: { kind: object.ref.kind, id: object.ref.id } };
}

type FocusState = { project: EditorProject; activePlaceId?: string };
type Selection = { kind: StoryObjectRef["kind"]; id: string };

/** UI and agent focus use the same scoped resolver; never guess a same-name room. */
export function createStoryObjectFocus(
  getState: () => FocusState | undefined,
  openPlace: (id: string) => void,
  select: (items: Selection[]) => void,
) {
  return (refs: readonly StoryObjectRef[]) => {
    const state = getState(); if (!state || !refs.length) return false;
    const locations = refs.map((ref) => storyObjectLocation(state.project, ref, state.activePlaceId));
    if (locations.some((location) => !location)) return false;
    const first = locations[0]!;
    // A map selection belongs to one sheet. Cross-sheet requests must choose a sheet first.
    if (locations.some((location) => location!.placeId !== first.placeId)) return false;
    const unique = new Map(locations.map((location) => [storyRefKey(location!.ref), location!.selection]));
    if (state.activePlaceId !== first.placeId) openPlace(first.placeId);
    select([...unique.values()]);
    return true;
  };
}
