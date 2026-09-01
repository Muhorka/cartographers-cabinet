import { deletePlaceSubtree } from "../model/hierarchy-operations";
import { placeToOpenAfterDeletion } from "../model/navigation-fallback";
import type { EditorSession } from "../state/editor-session";
import { activatePreferredLayer } from "./workbench-helpers";

export function deleteWorkbenchPlace(session: EditorSession, placeId: string) {
  const before = session.getState();
  if (before.project.places.find(({ id }) => id === placeId)?.locked) return undefined;
  session.executeTransaction({ id: `delete:${placeId}`, apply: (project) => deletePlaceSubtree(project, placeId) });
  const after = session.getState().project;
  const fallbackId = placeToOpenAfterDeletion(before.project, after, placeId, before.activePlaceId ?? "");
  if (fallbackId) { session.openPlace(fallbackId); activatePreferredLayer(session, fallbackId); }
  return { project: after, fallbackId };
}
