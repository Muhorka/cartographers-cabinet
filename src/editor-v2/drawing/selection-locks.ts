import type { EditorProject } from "../model/project-model";
import type { SelectionReference } from "./selection-reference";

export type LockableSelection = SelectionReference;

function containsSelection(document: EditorProject["constructions"][number], selection: LockableSelection) {
  if (selection.kind === "wall") return document.walls.some(({ id }) => id === selection.id);
  if (selection.kind === "room") return document.rooms.some(({ id }) => id === selection.id);
  if (selection.kind === "opening") return document.openings.some(({ id }) => id === selection.id);
  return document.transitions.some(({ id }) => id === selection.id);
}

/** Resolves a structural selection only when its construction scope is exact. */
export function constructionForSelection(project: EditorProject, selection: LockableSelection) {
  if (selection.kind !== "wall" && selection.kind !== "room" && selection.kind !== "opening" && selection.kind !== "transition") return undefined;
  const candidates = project.constructions.filter((document) => containsSelection(document, selection));
  if (selection.scopeId) {
    const direct = candidates.find(({ id }) => id === selection.scopeId);
    if (direct) return direct;
    // Existing agent/story data may address a construction through its level
    // or owning place. Keep that narrow compatibility alias; UI selections
    // always emit the canonical construction id.
    const owner = project.places.find(({ id }) => id === selection.scopeId);
    return owner?.constructionId ? candidates.find(({ id }) => id === owner.constructionId) : undefined;
  }
  return candidates.length === 1 ? candidates[0] : undefined;
}

/** Resolves editability from the persisted owner record, including room/place and opening/wall ownership. */
export function selectionIsLocked(project: EditorProject, selection: LockableSelection) {
  if (selection.kind === "place" || selection.kind === "element" || selection.kind === "surface") {
    const item = selection.kind === "place" ? project.places.find(({ id }) => id === selection.id) : selection.kind === "element" ? project.elements.find(({ id }) => id === selection.id) : project.surfaces.find(({ id }) => id === selection.id);
    return item?.locked === true;
  }
  const document = constructionForSelection(project, selection);
  if (!document) return true;
  if (selection.kind === "room") return document.rooms.find(({ id }) => id === selection.id)?.locked === true || project.places.find(({ id }) => id === selection.id)?.locked === true;
  if (selection.kind === "wall") return document.walls.find(({ id }) => id === selection.id)?.locked === true;
  if (selection.kind === "opening") {
    const opening = document.openings.find(({ id }) => id === selection.id);
    return opening?.locked === true || document.walls.find(({ id }) => id === opening?.wallId)?.locked === true;
  }
  return document.transitions.find(({ id }) => id === selection.id)?.locked === true;
}
