"use client";
import { useLayoutEffect, useRef, type Dispatch, type SetStateAction } from "react";
import type { EditorProject } from "../model/project-model";
import { workLayerAvailability } from "../model/work-context";
import { setPreference } from "../persistence/project-library";
import type { EditorSession, EditorSessionState } from "../state/editor-session";
import type { SheetViewport } from "./map-sheet-geometry";
import type { MapSelection } from "./map-sheet-types";
import { activatePreferredLayer, viewportFor } from "./workbench-helpers";
import { reconcileInspectorFocus, type InspectorFocus } from "./workbench-inspector-focus";

function constructionSelectionExists(project: EditorProject, selection: MapSelection) {
  return project.constructions.some((construction) => {
    if (selection.kind === "wall") return construction.walls.some(({ id }) => id === selection.id);
    if (selection.kind === "room") return construction.rooms.some(({ id }) => id === selection.id);
    if (selection.kind === "opening") return construction.openings.some(({ id }) => id === selection.id);
    return selection.kind === "transition" && construction.transitions.some(({ id }) => id === selection.id);
  });
}

function mapSelectionExists(project: EditorProject, selection: MapSelection) {
  if (selection.kind === "place") return project.places.some(({ id }) => id === selection.id);
  if (selection.kind === "element") return project.elements.some(({ id }) => id === selection.id);
  if (selection.kind === "surface") return project.surfaces.some(({ id }) => id === selection.id);
  return constructionSelectionExists(project, selection);
}

export function reconcileMapSelections(project: EditorProject, selections: MapSelection[]) {
  const remaining = selections.filter((selection) => mapSelectionExists(project, selection));
  return remaining.length === selections.length ? selections : remaining;
}

export function expandedPlaceIds(project: EditorProject, activePlaceId: string) {
  const byId = new Map(project.places.map((place) => [place.id, place]));
  const result: string[] = []; const seen = new Set<string>(); let id: string | undefined = activePlaceId;
  while (id && !seen.has(id)) { seen.add(id); result.push(id); id = byId.get(id)?.parentId; }
  return result;
}

type Input = {
  session?: EditorSession; snapshot?: EditorSessionState;
  setSnapshot(snapshot: EditorSessionState): void;
  setSelections: Dispatch<SetStateAction<MapSelection[]>>;
  setInspectorFocus: Dispatch<SetStateAction<InspectorFocus | undefined>>;
  setViewport: Dispatch<SetStateAction<SheetViewport>>;
  setExpandedIds: Dispatch<SetStateAction<Set<string>>>;
  setCutoutActive: Dispatch<SetStateAction<boolean>>;
  setAddOutlineActive: Dispatch<SetStateAction<boolean>>;
};

/** Reconciles every workbench-only view state after the session installs a project snapshot. */
export function useWorkbenchSessionRefresh(input: Input) {
  const sessionRef = useRef(input.session); const snapshotRef = useRef(input.snapshot);
  useLayoutEffect(() => { sessionRef.current = input.session; snapshotRef.current = input.snapshot; }, [input.session, input.snapshot]);
  function refresh(candidate = sessionRef.current) {
    if (!candidate || candidate !== sessionRef.current) return;
    const before = snapshotRef.current; let after = candidate.getViewState();
    const activeChanged = before?.project.id !== after.project.id || before?.activePlaceId !== after.activePlaceId;
    if (after.activePlaceId && (activeChanged || !workLayerAvailability(after.project, after.activePlaceId, after.toolbox.activeLayerId).available)) {
      activatePreferredLayer(candidate, after.activePlaceId); after = candidate.getViewState();
    }
    snapshotRef.current = after; input.setSnapshot(after);
    input.setSelections((current) => activeChanged ? [] : reconcileMapSelections(after.project, current));
    input.setInspectorFocus((current) => reconcileInspectorFocus(current, after.project, after.activePlaceId));
    if (!activeChanged) return;
    input.setCutoutActive(false); input.setAddOutlineActive(false); input.setViewport(viewportFor(after.project, after.activePlaceId));
    if (!after.activePlaceId) return;
    input.setExpandedIds((current) => new Set([...current, ...expandedPlaceIds(after.project, after.activePlaceId!)]));
    void setPreference(`activePlaceId:${after.project.id}`, after.activePlaceId);
  }
  return { refresh };
}
