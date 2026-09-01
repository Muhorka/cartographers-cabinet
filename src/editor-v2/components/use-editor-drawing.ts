"use client";
import { useCallback, useMemo, useRef, useState } from "react";
import { type MapGesture, type MapGestureDraft } from "./map-sheet-gesture";
import type { MapSelection } from "./map-sheet";
import type { DrawingNoticeModel } from "./drawing-notice";
import type { EditorLocale, WorkbenchCopy } from "../i18n/workbench-copy";
import type { EditorSession, EditorSessionState } from "../state/editor-session";
import type { SemanticDraft } from "../draft/semantic-draft";
import { applyMapGesture, saveGestureDraftAsSketch, savePendingDraftAsPath, savePendingDraftAsSketch, type MapGestureCommandInput } from "../drawing/map-gesture-command";
import { deletePlaceSubtree } from "../model/hierarchy-operations";
import { proposeDraftClosure } from "../draft/auto-close-draft";
import { drawingIdentity, drawingNaming } from "./drawing-naming";
import { closableGesture, gestureWithoutLastPoint } from "./drawing-gesture-helpers";
import { editorDrawingNotice, type DrawingNoticeActionId } from "./editor-drawing-notice";
import { applyOutlineGesture } from "./drawing-outline-gesture";
import { finishAutomaticClosure, finishCorrectedDraft, type ClosureReview } from "./drawing-draft-completion";
type Continuation = () => void;
export type TransitionPlacementConfig = NonNullable<MapGestureCommandInput["transition"]>;
type TransitionRequest = { gesture: MapGesture; input: MapGestureCommandInput };
export function useEditorDrawing({ session, snapshot, locale, copy, refresh, onSelection, cutoutActive = false, addOutlineActive = false, cutoutTarget }: {
  session?: EditorSession;
  snapshot?: EditorSessionState;
  locale: EditorLocale;
  copy: WorkbenchCopy;
  refresh(): void;
  onSelection(selection?: MapSelection): void;
  cutoutActive?: boolean;
  addOutlineActive?: boolean;
  cutoutTarget?: MapSelection;
}) {
  const [pendingDraft, setPendingDraft] = useState<SemanticDraft>();
  const [redoStrokes, setRedoStrokes] = useState<SemanticDraft["strokes"]>([]);
  const [gestureDraft, setGestureDraft] = useState<MapGestureDraft>();
  const [redoGestureDrafts, setRedoGestureDrafts] = useState<MapGestureDraft[]>([]);
  const [deleteCandidateIds, setDeleteCandidateIds] = useState<string[]>([]);
  const [blockedReason, setBlockedReason] = useState<keyof WorkbenchCopy["drawingStatus"]["blocked"]>();
  const [waitingToLeave, setWaitingToLeave] = useState(false);
  const [closureReview, setClosureReview] = useState<ClosureReview>();
  const [transitionRequest, setTransitionRequest] = useState<TransitionRequest>();
  const continuation = useRef<Continuation | undefined>(undefined);
  const identity = useMemo(() => drawingIdentity(locale), [locale]);
  const naming = useMemo(() => drawingNaming(locale, snapshot?.project), [locale, snapshot?.project]);
  const transact = useCallback((id: string, project: EditorSessionState["project"]) => {
    if (!session) return;
    session.executeTransaction({ id, apply: () => project });
    refresh();
  }, [refresh, session]);
  const applyGesture = useCallback((gesture: MapGesture, override?: MapGestureCommandInput) => {
    if (!session || !snapshot?.activePlaceId) return;
    if (addOutlineActive || cutoutActive) {
      const result = applyOutlineGesture(snapshot.project, snapshot.activePlaceId, cutoutTarget, gesture, identity, addOutlineActive ? "add" : "cut");
      setClosureReview(undefined); setBlockedReason(result.state === "blocked" ? result.reason : undefined);
      if (result.state === "applied") {
        transact(result.transactionId, result.project); setPendingDraft(undefined); setGestureDraft(undefined); onSelection(result.selection);
        if (result.mode === "cut") { setRedoStrokes([]); setRedoGestureDrafts([]); }
      }
      return;
    }
    const memory = snapshot.toolbox.byLayer[snapshot.toolbox.activeLayerId];
    const input = override ?? { activePlaceId: snapshot.activePlaceId, layerId: snapshot.toolbox.activeLayerId, subjectId: memory.subjectId, widthMeters: memory.widthMeters, gesture, boundaryEditing: snapshot.boundaryEditing, pendingDraft };
    setClosureReview(undefined);
    let result = applyMapGesture(snapshot.project, input, identity, naming);
    if (result.state === "clip-review") {
      result = applyMapGesture(snapshot.project, { ...input, acceptClip: true }, identity, naming);
    }
    setBlockedReason(undefined);
    if (result.state === "applied") {
      transact(`draw:${input.layerId}:${input.gesture.instrumentId}`, result.project);
      setPendingDraft(result.pendingDraft);
      setRedoStrokes([]);
      setGestureDraft(undefined);
      setRedoGestureDrafts([]);
      if (result.selection) onSelection(result.selection);
      return;
    }
    if (result.state === "draft-updated") {
      setPendingDraft(result.pendingDraft);
      setRedoStrokes([]);
      return;
    }
    if (result.state === "review-required") { setDeleteCandidateIds(result.candidateIds); return; }
    if (result.state === "transition-config-required") { setTransitionRequest({ gesture: input.gesture, input }); setGestureDraft(undefined); return; }
    if (result.state === "blocked") setBlockedReason(result.reason);
  }, [addOutlineActive, cutoutActive, cutoutTarget, identity, naming, onSelection, pendingDraft, session, snapshot, transact]);
  function runContinuation() {
    const action = continuation.current;
    continuation.current = undefined;
    setWaitingToLeave(false);
    action?.();
  }
  function requestAfterDraft(action: Continuation) {
    if (transitionRequest) { continuation.current = action; return; }
    if (!pendingDraft?.strokes.length && !gestureDraft?.points.length) { action(); return; }
    continuation.current = action;
    setWaitingToLeave(true);
  }
  function keepDrawing() {
    continuation.current = undefined;
    setWaitingToLeave(false);
    setClosureReview(undefined);
  }
  const leaveDrawing = useCallback(() => setBlockedReason(undefined), []);
  function discardDraft() {
    setPendingDraft(undefined);
    setRedoStrokes([]);
    setGestureDraft(undefined);
    setRedoGestureDrafts([]);
    setClosureReview(undefined);
    runContinuation();
  }
  function keepAsSketch() {
    if (!session || !snapshot?.activePlaceId) return;
    const project = gestureDraft
      ? saveGestureDraftAsSketch(snapshot.project, snapshot.activePlaceId, gestureDraft, identity, locale === "pl" ? "Szkic" : "Sketch")
      : pendingDraft
        ? savePendingDraftAsSketch(snapshot.project, pendingDraft, identity, (index) => locale === "pl" ? `Szkic ${index}` : `Sketch ${index}`)
        : snapshot.project;
    transact("draft:keep-as-sketch", project);
    setPendingDraft(undefined);
    setRedoStrokes([]);
    setGestureDraft(undefined);
    setRedoGestureDrafts([]);
    setClosureReview(undefined);
    runContinuation();
  }
  function keepAsPath() {
    if (!session || !snapshot || !pendingDraft) return;
    const project = savePendingDraftAsPath(snapshot.project, pendingDraft, identity, naming);
    transact("draft:keep-as-path", project);
    setPendingDraft(undefined);
    setRedoStrokes([]);
    setClosureReview(undefined);
    runContinuation();
  }

  const semanticClosure = useMemo(() => {
    if (!pendingDraft || !snapshot) return undefined;
    const boundary = snapshot.project.places.find(({ id }) => id === pendingDraft.belongsToId)?.boundary;
    return proposeDraftClosure(pendingDraft, `${pendingDraft.id}:auto-close`, boundary);
  }, [pendingDraft, snapshot]);
  const gestureClosure = useMemo(() => closableGesture(gestureDraft), [gestureDraft]);

  function reviewAutomaticClosure() {
    if (semanticClosure) setClosureReview({ kind: "semantic", proposal: semanticClosure });
    else if (gestureDraft && gestureClosure) setClosureReview({ kind: "gesture", before: gestureDraft, after: gestureClosure });
  }

  function confirmAutomaticClosure() {
    if (!closureReview || !snapshot || !session) return;
    const completed = finishAutomaticClosure(snapshot.project, closureReview, identity, { ...naming, roomName: identity.createRoomName });
    if (completed.state === "gesture") { setClosureReview(undefined); setGestureDraft(undefined); if (completed.gesture) applyGesture(completed.gesture); return; }
    if (completed.state === "blocked") { setClosureReview(undefined); setBlockedReason("geometry-conflict"); return; }
    transact("draft:auto-close", completed.result.project); const id = completed.result.createdIds[0];
    if (id) onSelection(completed.result.project.places.some((place) => place.id === id) ? { kind: "place", id } : completed.result.project.surfaces.some((surface) => surface.id === id) ? { kind: "surface", id } : { kind: "element", id });
    setPendingDraft(undefined);
    setRedoStrokes([]);
    setClosureReview(undefined);
    runContinuation();
  }

  function confirmTransition(config: TransitionPlacementConfig) {
    if (!transitionRequest) return;
    const request = transitionRequest; setTransitionRequest(undefined);
    applyGesture(request.gesture, { ...request.input, transition: config });
    runContinuation();
  }

  function cancelTransition() { setTransitionRequest(undefined); runContinuation(); }

  function confirmDelete() {
    if (!snapshot || !deleteCandidateIds.length) return;
    const project = deleteCandidateIds.reduce((next, id) => next.places.some((place) => place.id === id) ? deletePlaceSubtree(next, id) : next, snapshot.project);
    transact("eraser:delete-places", project);
    setDeleteCandidateIds([]);
    onSelection(undefined);
  }

  function correctPendingDraft(tolerance: number) {
    if (!pendingDraft || !snapshot || !session) return;
    const { corrected, analysis, result } = finishCorrectedDraft(snapshot.project, pendingDraft, tolerance, identity, { ...naming, roomName: identity.createRoomName });
    if (result.state !== "created") { setPendingDraft(result.state === "incomplete" ? analysis.length ? { ...corrected, strokes: analysis } : undefined : corrected); return; }
    transact("draft:correct-gaps", result.project); setPendingDraft(analysis.length ? { ...corrected, id: identity.createId(), strokes: analysis } : undefined); setRedoStrokes([]);
    const id = result.createdIds[0]; if (id) onSelection(result.project.places.some((place) => place.id === id) ? { kind: "place", id } : result.project.surfaces.some((surface) => surface.id === id) ? { kind: "surface", id } : { kind: "element", id });
  }

  function undoDraft() {
    if (gestureDraft?.points.length) {
      setRedoGestureDrafts((current) => [gestureDraft, ...current]);
      setGestureDraft(gestureWithoutLastPoint(gestureDraft));
      return true;
    }
    if (!pendingDraft?.strokes.length) return false;
    const removed = pendingDraft.strokes.at(-1)!;
    const strokes = pendingDraft.strokes.slice(0, -1);
    setPendingDraft({ ...pendingDraft, strokes });
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

  const canSavePath = pendingDraft?.layerId === "terrain" && ["terrain.water", "terrain.custom"].includes(pendingDraft.subjectId);
  const noticeSpec = editorDrawingNotice({ copy, deleteCandidates: deleteCandidateIds.length > 0, closureReview: Boolean(closureReview), hasDraft: Boolean(pendingDraft?.strokes.length || gestureDraft?.points.length), waitingToLeave, canAutoClose: Boolean(semanticClosure || gestureClosure), canSavePath, blockedReason });
  const noticeActions: Record<DrawingNoticeActionId, () => void> = { delete: confirmDelete, cancel: () => setDeleteCandidateIds([]), "apply-auto-close": confirmAutomaticClosure, "cancel-auto-close": () => setClosureReview(undefined), continue: keepDrawing, "auto-close": reviewAutomaticClosure, path: keepAsPath, sketch: keepAsSketch, discard: discardDraft, close: () => setBlockedReason(undefined) };
  const notice: DrawingNoticeModel | undefined = noticeSpec && { ...noticeSpec, actions: noticeSpec.actions.map((action) => ({ ...action, onClick: noticeActions[action.id] })) };

  return {
    pendingDraft,
    gestureDraft: closureReview?.kind === "gesture" ? closureReview.after : gestureDraft,
    setGestureDraft: (next?: MapGestureDraft) => { setGestureDraft(next); setClosureReview(undefined); if (next) setRedoGestureDrafts([]); },
    draftStrokes: (closureReview?.kind === "semantic" ? closureReview.proposal.after : pendingDraft)?.strokes.map(({ points }) => points) ?? [],
    notice,
    transitionRequest,
    confirmTransition,
    cancelTransition,
    applyGesture,
    requestAfterDraft,
    undoDraft,
    redoDraft,
    cancelCurrentDrawing,
    correctPendingDraft,
    canUndoDraft: Boolean(pendingDraft?.strokes.length || gestureDraft?.points.length),
    canRedoDraft: redoStrokes.length > 0 || redoGestureDrafts.length > 0,
    hasGestureDraft: Boolean(gestureDraft?.points.length),
    leaveDrawing,
    reset: () => { continuation.current = undefined; setWaitingToLeave(false); setPendingDraft(undefined); setRedoStrokes([]); setGestureDraft(undefined); setRedoGestureDrafts([]); setDeleteCandidateIds([]); setBlockedReason(undefined); setClosureReview(undefined); setTransitionRequest(undefined); },
  };
}
