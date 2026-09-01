import type { EditorSession } from "../state/editor-session";
import { setPreference } from "../persistence/project-library";
import type { InspectorFocus } from "./workbench-inspector-focus";
import { inspectorFocus, placeOpenIntent } from "./workbench-inspector-focus";
import { activatePreferredLayer, viewportFor } from "./workbench-helpers";
import { expandedPlaceIds } from "./use-workbench-session-refresh";

type WorkbenchPlaceOpenActions = {
  inspect(focus: InspectorFocus | undefined): void;
  expand(placeIds: readonly string[]): void;
  clearSelection(): void;
  setViewport(viewport: ReturnType<typeof viewportFor>): void;
  refresh(): void;
};

/** Opens a sheet only when needed, while always applying the requested inspector focus. */
export function openWorkbenchPlace(session: EditorSession, requestedPlaceId: string, actions: WorkbenchPlaceOpenActions) {
  const current = session.getState(); const intent = placeOpenIntent(current.project, requestedPlaceId, current.activePlaceId); if (!intent) return false;
  const displayChanged = current.activePlaceId !== intent.displayedPlaceId;
  if (displayChanged && !session.openPlace(intent.displayedPlaceId).changed) return false;
  actions.inspect(inspectorFocus(current.project, intent.inspectedPlaceId));
  actions.expand([...expandedPlaceIds(current.project, intent.inspectedPlaceId), ...expandedPlaceIds(current.project, intent.displayedPlaceId)]);
  actions.clearSelection();
  if (!displayChanged) return true;
  activatePreferredLayer(session, intent.displayedPlaceId); actions.setViewport(viewportFor(current.project, intent.displayedPlaceId));
  void setPreference(`activePlaceId:${current.project.id}`, intent.displayedPlaceId); actions.refresh(); return true;
}
