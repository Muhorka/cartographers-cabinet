import type { MapSelection } from "./map-sheet";
import type { SheetViewport } from "./map-sheet-geometry";
import { constructionClearCategoryForToolbox } from "./construction-clear-notice";
import { initialExpandedPlaceIds } from "./use-workbench-session-refresh";
import { inspectorFocus } from "./workbench-inspector-focus";
import { restoreWorkbenchProject } from "./workbench-project-loading";
import type { EditorSession, EditorSessionState } from "../state/editor-session";

type LoadedWorkbenchProject = Awaited<ReturnType<typeof restoreWorkbenchProject>>;

export function installLoadedWorkbenchProject(loaded: LoadedWorkbenchProject, actions: {
  setSession(value: EditorSession): void;
  setSnapshot(value: EditorSessionState): void;
  setSelections(value: MapSelection[]): void;
  setViewport(value: SheetViewport): void;
  setPendingDeleteId(value: string | undefined): void;
  setPendingPlaceDeleteId(value: string | undefined): void;
  setPendingClearLayer(value: boolean): void;
  setPendingClearCategory(value: ReturnType<typeof constructionClearCategoryForToolbox>): void;
  setPendingOverlapDeparture(value: boolean): void;
  setDismissedOverlapSignature(value: string | undefined): void;
  overlapContinuation: { current: { action(replacementPlaceId?: string): void; targetPlaceId?: string } | undefined };
  setInspectorTarget(value: ReturnType<typeof inspectorFocus>): void;
  setExpandedIds(value: Set<string>): void;
  setSketchVisible(value: boolean): void;
  setSketchOpacity(value: number): void;
  setEraserSize(value: number): void;
  setGapClosingEnabled(value: boolean): void;
  setGapClosingTolerance(value: number): void;
}) {
  actions.setSession(loaded.session);
  actions.setSnapshot(loaded.snapshot);
  actions.setSelections([]);
  actions.setViewport(loaded.viewport);
  actions.setPendingDeleteId(undefined);
  actions.setPendingPlaceDeleteId(undefined);
  actions.setPendingClearLayer(false);
  actions.setPendingClearCategory("all");
  actions.setPendingOverlapDeparture(false);
  actions.setDismissedOverlapSignature(undefined);
  actions.overlapContinuation.current = undefined;
  actions.setInspectorTarget(inspectorFocus(loaded.project, loaded.snapshot.activePlaceId));
  actions.setExpandedIds(initialExpandedPlaceIds(loaded.project, loaded.snapshot.activePlaceId));
  actions.setSketchVisible(loaded.sketchVisible);
  actions.setSketchOpacity(loaded.sketchOpacity);
  actions.setEraserSize(loaded.eraserSize);
  actions.setGapClosingEnabled(loaded.gapClosingEnabled);
  actions.setGapClosingTolerance(loaded.gapClosingTolerance);
}
