"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { closableGesture } from "./drawing-gesture-helpers";
import { editorDrawingNotice, type DrawingNoticeActionId } from "./editor-drawing-notice";
import { applyOutlineGesture } from "./drawing-outline-gesture";
import { finishAutomaticClosure, finishCorrectedDraft, type ClosureReview } from "./drawing-draft-completion";
import { useEditorTransaction } from "./use-editor-transaction";
import { createDrawingDraftHistory } from "./drawing-draft-history";
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
  const [drawingSession, setDrawingSession] = useState(session);
  const identity = useMemo(() => drawingIdentity(locale), [locale]);
  const { commit: transact } = useEditorTransaction(session, refresh, setBlockedReason);
  function resetDrawingUiState() {
    setWaitingToLeave(false); setPendingDraft(undefined); setRedoStrokes([]); setGestureDraft(undefined);
    setRedoGestureDrafts([]); setDeleteCandidateIds([]); setBlockedReason(undefined); setClosureReview(undefined); setTransitionRequest(undefined);
  }
  function resetDrawingState() { continuation.current = undefined; resetDrawingUiState(); }
  useEffect(() => { continuation.current = undefined; }, [session]);
  if (drawingSession !== session) { setDrawingSession(session); resetDrawingUiState(); }
  const { undoDraft, redoDraft, cancelCurrentDrawing } = createDrawingDraftHistory({ pendingDraft, setPendingDraft, redoStrokes, setRedoStrokes, gestureDraft, setGestureDraft, redoGestureDrafts, setRedoGestureDrafts, setClosureReview, setBlockedReason });
  const applyGesture = useCallback((gesture: MapGesture, override?: MapGestureCommandInput) => {
    if (!session) return;
    const current = session.getViewState(); if (!current.activePlaceId) return;
    if (addOutlineActive || cutoutActive) {
      const result = applyOutlineGesture(current.project, current.activePlaceId, cutoutTarget, gesture, identity, addOutlineActive ? "add" : "cut");
      setClosureReview(undefined); setBlockedReason(result.state === "blocked" ? result.reason : undefined);
      if (result.state === "applied") {
        if (!transact(result.transactionId, result.project)) return;
        setPendingDraft(undefined); setGestureDraft(undefined); onSelection(result.selection);
        if (result.mode === "cut") { setRedoStrokes([]); setRedoGestureDrafts([]); }
      }
      return;
    }
    const memory = current.toolbox.byLayer[current.toolbox.activeLayerId];
    const input = override ?? { activePlaceId: current.activePlaceId, layerId: current.toolbox.activeLayerId, subjectId: memory.subjectId, widthMeters: memory.widthMeters, gesture, boundaryEditing: current.boundaryEditing, pendingDraft };
    setClosureReview(undefined);
    const currentNaming = drawingNaming(locale, current.project);
    let result = applyMapGesture(current.project, input, identity, currentNaming);
    if (result.state === "clip-review") {
      result = applyMapGesture(current.project, { ...input, acceptClip: true }, identity, currentNaming);
    }
    setBlockedReason(undefined);
    if (result.state === "applied") {
      if (!transact(`draw:${input.layerId}:${input.gesture.instrumentId}`, result.project)) return;
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
  }, [addOutlineActive, cutoutActive, cutoutTarget, identity, locale, onSelection, pendingDraft, session, transact]);
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
    if (!session) return;
    const activePlaceId = session.getViewState().activePlaceId;
    if (!activePlaceId) return;
    const gesture = gestureDraft; const pending = pendingDraft;
    const project = (current: EditorSessionState["project"]) => gesture
      ? saveGestureDraftAsSketch(current, activePlaceId, gesture, identity, locale === "pl" ? "Szkic" : "Sketch")
      : pending
        ? savePendingDraftAsSketch(current, pending, identity, (index) => locale === "pl" ? `Szkic ${index}` : `Sketch ${index}`)
        : current;
    if (!transact("draft:keep-as-sketch", project)) { continuation.current = undefined; setWaitingToLeave(false); return; }
    setPendingDraft(undefined);
    setRedoStrokes([]);
    setGestureDraft(undefined);
    setRedoGestureDrafts([]);
    setClosureReview(undefined);
    runContinuation();
  }
  function keepAsPath() {
    if (!session || !pendingDraft) return;
    const pending = pendingDraft;
    const project = (current: EditorSessionState["project"]) => savePendingDraftAsPath(current, pending, identity, drawingNaming(locale, current));
    if (!transact("draft:keep-as-path", project)) { continuation.current = undefined; setWaitingToLeave(false); return; }
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
    if (!closureReview || !session) return;
    const review = closureReview; let completed: ReturnType<typeof finishAutomaticClosure> | undefined;
    if (review.kind === "gesture") {
      completed = finishAutomaticClosure(session.getViewState().project, review, identity, { ...drawingNaming(locale, session.getViewState().project), roomName: identity.createRoomName });
      if (completed.state === "gesture") { setClosureReview(undefined); setGestureDraft(undefined); if (completed.gesture) applyGesture(completed.gesture); return; }
      setClosureReview(undefined); setBlockedReason("geometry-conflict"); return;
    }
    const accepted = transact("draft:auto-close", (current) => {
      completed = finishAutomaticClosure(current, review, identity, { ...drawingNaming(locale, current), roomName: identity.createRoomName });
      return completed.state === "created" ? completed.result.project : current;
    });
    if (!accepted) { setClosureReview(undefined); return; }
    const created = completed?.state === "created" ? completed.result : undefined;
    if (!created) { setClosureReview(undefined); setBlockedReason("geometry-conflict"); return; }
    const id = created.createdIds[0];
    if (id) onSelection(created.project.places.some((place) => place.id === id) ? { kind: "place", id } : created.project.surfaces.some((surface) => surface.id === id) ? { kind: "surface", id } : { kind: "element", id });
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
    if (!session || !deleteCandidateIds.length) return;
    const ids = deleteCandidateIds;
    const project = (current: EditorSessionState["project"]) => ids.reduce((next, id) => next.places.some((place) => place.id === id) ? deletePlaceSubtree(next, id) : next, current);
    if (!transact("eraser:delete-places", project)) return;
    setDeleteCandidateIds([]);
    onSelection(undefined);
  }

  function correctPendingDraft(tolerance: number) {
    if (!pendingDraft || !session) return;
    const draft = pendingDraft; let completed: ReturnType<typeof finishCorrectedDraft> | undefined;
    const accepted = transact("draft:correct-gaps", (current) => {
      completed = finishCorrectedDraft(current, draft, tolerance, identity, { ...drawingNaming(locale, current), roomName: identity.createRoomName });
      return completed.result.state === "created" ? completed.result.project : current;
    });
    if (!accepted || !completed) return;
    const { corrected, analysis, result } = completed;
    if (result.state !== "created") { setPendingDraft(result.state === "incomplete" ? analysis.length ? { ...corrected, strokes: analysis } : undefined : corrected); return; }
    setPendingDraft(analysis.length ? { ...corrected, id: identity.createId(), strokes: analysis } : undefined); setRedoStrokes([]);
    const id = result.createdIds[0]; if (id) onSelection(result.project.places.some((place) => place.id === id) ? { kind: "place", id } : result.project.surfaces.some((surface) => surface.id === id) ? { kind: "surface", id } : { kind: "element", id });
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
    reset: resetDrawingState,
  };
}
