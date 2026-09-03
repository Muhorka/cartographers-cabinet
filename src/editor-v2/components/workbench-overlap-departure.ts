import { buildingOverlapGroups } from "../drawing/building-overlap-operations";
import type { EditorSession } from "../state/editor-session";

type Continuation = { action(replacementPlaceId?: string): void; targetPlaceId?: string };

export function createOverlapDepartureRequest({
  session,
  continuation,
  setPendingOverlapDeparture,
  setDismissedOverlapSignature,
}: {
  session?: EditorSession;
  continuation: { current: Continuation | undefined };
  setPendingOverlapDeparture(value: boolean): void;
  setDismissedOverlapSignature(value: string | undefined): void;
}) {
  return (action: (replacementPlaceId?: string) => void, targetPlaceId?: string) => {
    if (!session) return;
    const current = session.getState();
    const groups = current.activePlaceId ? buildingOverlapGroups(current.project, current.activePlaceId) : [];
    if (!groups.length) { action(); return; }
    continuation.current = { action, targetPlaceId };
    setPendingOverlapDeparture(true);
    setDismissedOverlapSignature(undefined);
  };
}
