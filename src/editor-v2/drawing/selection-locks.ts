import type { EditorProject } from "../model/project-model";

export type LockableSelection = { kind: "place" | "element" | "surface" | "room" | "wall" | "opening" | "transition"; id: string };

/** Resolves editability from the persisted owner record, including room/place and opening/wall ownership. */
export function selectionIsLocked(project: EditorProject, selection: LockableSelection) {
  if (selection.kind === "place" || selection.kind === "element" || selection.kind === "surface") {
    const item = selection.kind === "place" ? project.places.find(({ id }) => id === selection.id) : selection.kind === "element" ? project.elements.find(({ id }) => id === selection.id) : project.surfaces.find(({ id }) => id === selection.id);
    return item?.locked === true;
  }
  const document = project.constructions.find(({ walls, rooms, openings, transitions }) => selection.kind === "wall" ? walls.some(({ id }) => id === selection.id) : selection.kind === "room" ? rooms.some(({ id }) => id === selection.id) : selection.kind === "opening" ? openings.some(({ id }) => id === selection.id) : transitions.some(({ id }) => id === selection.id));
  if (!document) return false;
  if (selection.kind === "room") return document.rooms.find(({ id }) => id === selection.id)?.locked === true || project.places.find(({ id }) => id === selection.id)?.locked === true;
  if (selection.kind === "wall") return document.walls.find(({ id }) => id === selection.id)?.locked === true;
  if (selection.kind === "opening") {
    const opening = document.openings.find(({ id }) => id === selection.id);
    return opening?.locked === true || document.walls.find(({ id }) => id === opening?.wallId)?.locked === true;
  }
  return document.transitions.find(({ id }) => id === selection.id)?.locked === true;
}
