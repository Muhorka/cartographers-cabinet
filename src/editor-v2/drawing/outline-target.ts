import type { EditorProject } from "../model/project-model";
import { selectionIsLocked, type LockableSelection } from "./selection-locks";
import { isRibbonElement, ribbonShape } from "../geometry/ribbon-geometry";

export type OutlineTarget = { kind: "element" | "surface" | "place"; id: string };

/** Outline operations depend on owned area geometry, never on the creation layer.
 * Rooms are derived from a wall network: changing their walls remains the source
 * of truth, rather than modifying only the cached room polygon. */
export function editableOutlineTarget(project: EditorProject, selection: LockableSelection, operation: "add" | "cut" = "add"): OutlineTarget | undefined {
  if (selectionIsLocked(project, selection)) return undefined;
  if (selection.kind === "element") {
    const element = project.elements.find(({ id }) => id === selection.id);
    return element && (element.geometry.kind === "region" || operation === "cut" && isRibbonElement(element) && ribbonShape(element)) ? { kind: selection.kind, id: selection.id } : undefined;
  }
  if (selection.kind === "surface") {
    return project.surfaces.some(({ id }) => id === selection.id) ? { kind: selection.kind, id: selection.id } : undefined;
  }
  if (selection.kind === "place") {
    const place = project.places.find(({ id }) => id === selection.id);
    return place?.boundary && place.kind !== "room" ? { kind: selection.kind, id: selection.id } : undefined;
  }
  return undefined;
}
