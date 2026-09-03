import type { Dispatch, SetStateAction } from "react";
import type { MapGestureDraft } from "./map-sheet-gesture";
import type { SemanticDraft } from "../draft/semantic-draft";
import { gestureWithoutLastPoint } from "./drawing-gesture-helpers";
import type { ClosureReview } from "./drawing-draft-completion";
import type { WorkbenchCopy } from "../i18n/workbench-copy";

type StateSetter<T> = Dispatch<SetStateAction<T>>;

export function createDrawingDraftHistory({
  pendingDraft,
  setPendingDraft,
  redoStrokes,
  setRedoStrokes,
  gestureDraft,
  setGestureDraft,
  redoGestureDrafts,
  setRedoGestureDrafts,
  setClosureReview,
  setBlockedReason,
}: {
  pendingDraft?: SemanticDraft;
  setPendingDraft: StateSetter<SemanticDraft | undefined>;
  redoStrokes: SemanticDraft["strokes"];
  setRedoStrokes: StateSetter<SemanticDraft["strokes"]>;
  gestureDraft?: MapGestureDraft;
  setGestureDraft: StateSetter<MapGestureDraft | undefined>;
  redoGestureDrafts: MapGestureDraft[];
  setRedoGestureDrafts: StateSetter<MapGestureDraft[]>;
  setClosureReview: StateSetter<ClosureReview | undefined>;
  setBlockedReason: StateSetter<keyof WorkbenchCopy["drawingStatus"]["blocked"] | undefined>;
}) {
  function undoDraft() {
    if (gestureDraft?.points.length) {
      setRedoGestureDrafts((current) => [gestureDraft, ...current]);
      setGestureDraft(gestureWithoutLastPoint(gestureDraft));
      return true;
    }
    if (!pendingDraft?.strokes.length) return false;
    const removed = pendingDraft.strokes.at(-1)!;
    setPendingDraft({ ...pendingDraft, strokes: pendingDraft.strokes.slice(0, -1) });
    setRedoStrokes((current) => [removed, ...current]);
    return true;
  }

  function redoDraft() {
    const gesture = redoGestureDrafts[0];
    if (gesture) {
      setGestureDraft(gesture);
      setRedoGestureDrafts((current) => current.slice(1));
      return true;
    }
    const restored = redoStrokes[0];
    if (!pendingDraft || !restored) return false;
    setPendingDraft({ ...pendingDraft, strokes: [...pendingDraft.strokes, restored] });
    setRedoStrokes((current) => current.slice(1));
    return true;
  }

  function cancelCurrentDrawing() {
    setClosureReview(undefined);
    setBlockedReason(undefined);
    if (gestureDraft?.points.length) {
      setGestureDraft(undefined);
      setRedoGestureDrafts([]);
      return;
    }
    if (!pendingDraft?.strokes.length) return;
    const strokes = pendingDraft.strokes.slice(0, -1);
    setPendingDraft(strokes.length ? { ...pendingDraft, strokes } : undefined);
    setRedoStrokes([]);
  }

  return { undoDraft, redoDraft, cancelCurrentDrawing };
}
