import type { EditorProject } from "./project-model";

export function placeToOpenAbove(project: EditorProject, activePlaceId: string) {
  const active = project.places.find(({ id }) => id === activePlaceId); if (!active?.parentId) return undefined;
  const parent = project.places.find(({ id }) => id === active.parentId); if (!parent) return undefined;
  if (active.kind !== "level" || parent.kind !== "building") return parent.id;
  const levels = project.places.filter(({ parentId, kind }) => parentId === parent.id && kind === "level");
  return levels.length === 1 ? parent.parentId : parent.id;
}

export function placeToOpenAfterDeletion(before: EditorProject, after: EditorProject, deletedPlaceId: string, activePlaceId: string) {
  if (after.places.some(({ id }) => id === activePlaceId)) return activePlaceId;
  const deleted = before.places.find(({ id }) => id === deletedPlaceId);
  if (deleted?.kind === "level" && deleted.parentId) {
    const sibling = after.places.find(({ parentId, kind }) => parentId === deleted.parentId && kind === "level");
    if (sibling) return sibling.id;
  }
  if (deleted?.parentId && after.places.some(({ id }) => id === deleted.parentId)) return deleted.parentId;
  return after.places.find(({ parentId }) => !parentId)?.id;
}
