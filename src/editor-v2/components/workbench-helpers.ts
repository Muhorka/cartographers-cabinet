import type { EditorLocale } from "../i18n/workbench-copy";
import type { EditorProject } from "../model/project-model";
import { preferredWorkLayer, workLayerAvailability } from "../model/work-context";
import { EditorSession } from "../state/editor-session";
import { createToolboxState } from "../toolbox/toolbox-state";
import type { MapSelection } from "./map-sheet";
import { fitViewportToRegion, viewportRegion } from "./map-sheet-geometry";
import { editableOutlineTarget } from "../drawing/outline-target";
import { selectionIsLocked } from "../drawing/selection-locks";

export function viewportFor(project: EditorProject, placeId?: string) {
  return fitViewportToRegion(placeId ? viewportRegion(project, placeId) : undefined);
}

/** Shared pointer selection policy, independent of map rendering and story mode. */
export function nextMapSelection(current: MapSelection[], next?: MapSelection, additive = false): MapSelection[] {
  if (!next) return [];
  const index = current.findIndex(({ kind, id }) => kind === next.kind && id === next.id);
  if (additive) return index >= 0 ? current.filter((_, candidateIndex) => candidateIndex !== index) : [...current, next];
  return index >= 0 && current.length > 1 ? current : [next];
}

export function makeSession(project: EditorProject, placeId: string | undefined, locale: EditorLocale) {
  return new EditorSession(project, { initialPlaceId: placeId, initialToolbox: createToolboxState(placeId ? preferredWorkLayer(project, placeId) : "sketch"), createRoomName: (index) => locale === "pl" ? `Pomieszczenie ${index}` : `Room ${index}` });
}

export function activatePreferredLayer(session: EditorSession, placeId: string) {
  const state = session.getState(); const remembered = state.toolbox.activeLayerId;
  session.activateLayer(workLayerAvailability(state.project, placeId, remembered).available ? remembered : preferredWorkLayer(state.project, placeId));
}

export function preferredCutoutTarget(project: EditorProject | undefined, selection: MapSelection | undefined, activePlaceId: string | undefined, boundaryEditing = false, operation: "add" | "cut" = "cut") {
  if (!project) return undefined;
  if (selection) {
    if (selectionIsLocked(project, selection)) return undefined;
    const selectedTarget = editableOutlineTarget(project, selection, operation);
    if (selectedTarget) {
      // The open sheet's outline stays protected until explicitly unlocked,
      // regardless of whether the sheet is a world, location, building or floor.
      if (selectedTarget.kind === "place" && selectedTarget.id === activePlaceId && !boundaryEditing) return undefined;
      return selectedTarget;
    }
  }
  if (!boundaryEditing || !activePlaceId) return undefined;
  return editableOutlineTarget(project, { kind: "place", id: activePlaceId });
}
