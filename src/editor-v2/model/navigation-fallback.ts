import type { EditorProject } from "./project-model";

type PlaceSelection =
  | { kind: "place"; id: string }
  | { kind: "element"; id: string }
  | { kind: "wall"; id: string; constructionId: string }
  | { kind: "room"; id: string; constructionId: string };

export type SessionNavigation = {
  activePlaceId?: string;
  selection: readonly PlaceSelection[];
  boundaryEditing: boolean;
};

export function placeToOpenAbove(project: EditorProject, activePlaceId: string) {
  const active = project.places.find(({ id }) => id === activePlaceId); if (!active?.parentId) return undefined;
  const parent = project.places.find(({ id }) => id === active.parentId); if (!parent) return undefined;
  if (active.kind !== "level" || parent.kind !== "building") return parent.id;
  const levels = project.places.filter(({ parentId, kind }) => parentId === parent.id && kind === "level");
  return levels.length === 1 ? parent.parentId : parent.id;
}

/** Chooses the next map after a project snapshot removes the current place. */
export function placeToOpenAfterProjectInstall(before: EditorProject, after: EditorProject, activePlaceId?: string) {
  if (!activePlaceId) return undefined;
  if (after.places.some(({ id }) => id === activePlaceId)) return activePlaceId;
  const active = before.places.find(({ id }) => id === activePlaceId);
  if (active?.kind === "level" && active.parentId) {
    const sibling = after.places.find(({ parentId, kind }) => parentId === active.parentId && kind === "level");
    if (sibling) return sibling.id;
  }
  if (active?.parentId && after.places.some(({ id }) => id === active.parentId)) return active.parentId;
  return after.places.find(({ parentId }) => !parentId)?.id ?? after.places[0]?.id;
}

function selectionStillExists(project: EditorProject, selection: PlaceSelection) {
  if (selection.kind === "place") return project.places.some(({ id }) => id === selection.id);
  if (selection.kind === "element") return project.elements.some(({ id }) => id === selection.id);
  const construction = project.constructions.find(({ id }) => id === selection.constructionId);
  if (!construction) return false;
  return selection.kind === "wall"
    ? construction.walls.some(({ id }) => id === selection.id)
    : construction.rooms.some(({ id }) => id === selection.id);
}

/** Reconciles session-only navigation state whenever a project snapshot is installed. */
export function reconcileSessionNavigation<T extends PlaceSelection>(before: EditorProject, after: EditorProject, navigation: Omit<SessionNavigation, "selection"> & { selection: readonly T[] }) {
  const activePlaceId = placeToOpenAfterProjectInstall(before, after, navigation.activePlaceId);
  const activeChanged = activePlaceId !== navigation.activePlaceId;
  return {
    activePlaceId,
    selection: activeChanged ? [] : navigation.selection.filter((item) => selectionStillExists(after, item)),
    boundaryEditing: activeChanged ? false : navigation.boundaryEditing,
  };
}

export function placeToOpenAfterDeletion(before: EditorProject, after: EditorProject, _deletedPlaceId: string, activePlaceId: string) {
  return placeToOpenAfterProjectInstall(before, after, activePlaceId);
}
