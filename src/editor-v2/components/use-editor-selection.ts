"use client";
import { useMemo, useState } from "react";
import { updateNoteText } from "../drawing/note-text";
import type { KernelPoint } from "../geometry/geometry-types";
import { deleteSelection, mergeSelectedRooms, moveElementRegionVertex, moveSelection, moveWallEndpoint, resizeElementRegion, resizeTransitionFootprint, updateElementDetails, updateOpeningWidth, updateSelectionState, updateTransitionDetails, type EditableSelection, type SelectionOperationResult } from "../drawing/selection-operations";
import { movePlaceBoundaryVertex, resizePlaceBoundary } from "../drawing/place-boundary-operations";
import { deleteSelectionGroup, moveSelectionGroup } from "../drawing/group-selection-operations";
import type { EditorSession, EditorSessionState } from "../state/editor-session";
import type { WorkbenchCopy } from "../i18n/workbench-copy";
import type { EditorLocale } from "../i18n/workbench-copy";
import type { DrawingNoticeModel } from "./drawing-notice";
import type { DrawingElement, MapAppearance } from "../model/project-model";
import type { ResizeCorner } from "../geometry/region-resize";
import { duplicateSelectedElements, mergeSelectedElementRegions, transformSelectedElements, type ElementTransformationResult } from "../drawing/element-transformations";
import { duplicateSelectedPlaces, mergeSelectedPlaces, transformSelectedPlaces, type PlaceTransformationResult } from "../drawing/place-transformations";
import { duplicateSelectedRooms, transformSelectedRooms, type RoomTransformationResult } from "../drawing/room-transformations";
import { applyAffinePoint, relativePlaceMatrix } from "../geometry/affine-transform";
import { duplicateSelectedConstructionSurfaces, mergeSelectedConstructionSurfaces, moveConstructionSurfaceVertex, resizeConstructionSurface, transformSelectedConstructionSurfaces, updateConstructionSurface, type ConstructionSurfaceGroupResult } from "../drawing/construction-surface-operations";
import { joinFlowingWater, joinRoads, roadJoinNoticeKey } from "../roads/road-joining";
import { isFlowingWater } from "../geometry/ribbon-geometry";

export function useEditorSelection({ session, snapshot, copy, locale, refresh, onSelection, onSelections }: {
  session?: EditorSession;
  snapshot?: EditorSessionState;
  copy: WorkbenchCopy;
  locale: EditorLocale;
  refresh(): void;
  onSelection(selection?: EditableSelection): void;
  onSelections(selections: EditableSelection[]): void;
}) {
  const [review, setReview] = useState<{ project: EditorSessionState["project"]; effects: string[] }>();
  const [blocked, setBlocked] = useState<keyof WorkbenchCopy["editingStatus"]["blocked"]>();
  const identity = useMemo(() => ({ createId: () => crypto.randomUUID(), createRoomName: (index: number) => locale === "pl" ? `Pomieszczenie ${index}` : `Room ${index}` }), [locale]);

  function finish(result: SelectionOperationResult, transactionId: string, applyReviewImmediately = false) {
    setBlocked(undefined);
    if (result.state === "blocked") { setBlocked(result.reason); return; }
    if (result.state === "review-required" && !applyReviewImmediately) { setReview({ project: result.accept(), effects: result.effects }); return; }
    const project = result.state === "review-required" ? result.accept() : result.project;
    session?.executeTransaction({ id: transactionId, apply: () => project }); refresh();
  }

  function finishElements(result: ElementTransformationResult, transactionId: string) {
    setBlocked(undefined);
    if (result.state === "blocked") { setBlocked(result.reason === "outside-outline" ? "outside-outline" : "unsupported"); return; }
    session?.executeTransaction({ id: transactionId, apply: () => result.project });
    onSelections(result.selectedIds.map((id) => ({ kind: "element", id }))); refresh();
  }

  function finishPlaces(result: PlaceTransformationResult, transactionId: string) {
    setBlocked(undefined);
    if (result.state === "blocked") { setBlocked(result.reason === "outside-outline" ? "outside-outline" : "unsupported"); return; }
    session?.executeTransaction({ id: transactionId, apply: () => result.project }); onSelections(result.selectedIds.map((id) => ({ kind: "place", id }))); refresh();
  }

  function finishRooms(result: RoomTransformationResult, transactionId: string) {
    setBlocked(undefined);
    if (result.state === "blocked") { setBlocked(result.reason === "outside-outline" ? "outside-outline" : result.reason === "locked-outline" ? "locked-outline" : "unsupported"); return; }
    session?.executeTransaction({ id: transactionId, apply: () => result.project });
    onSelections(result.selectedIds.map((id) => ({ kind: "room", id }))); refresh();
  }

  function finishSurfaces(result: ConstructionSurfaceGroupResult, transactionId: string) {
    setBlocked(undefined);
    if (result.state === "blocked") { setBlocked(result.reason === "locked-outline" ? "locked-outline" : "unsupported"); return; }
    session?.executeTransaction({ id: transactionId, apply: () => result.project }); onSelections(result.selectedIds.map((id) => ({ kind: "surface", id }))); refresh();
  }

  function move(selection: EditableSelection, delta: KernelPoint) {
    if (!snapshot) return;
    finish(moveSelection(snapshot.project, { activePlaceId: snapshot.activePlaceId ?? "", selection, delta, boundaryEditing: snapshot.boundaryEditing }, identity), `move:${selection.kind}:${selection.id}`, true);
  }

  function moveMany(selections: EditableSelection[], delta: KernelPoint) {
    if (!snapshot) return;
    finish(moveSelectionGroup(snapshot.project, { activePlaceId: snapshot.activePlaceId ?? "", selections, delta, boundaryEditing: snapshot.boundaryEditing }, identity), `move:group:${selections.map(({ id }) => id).join(":")}`, true);
  }

  function moveEndpoint(wallId: string, endpoint: "start" | "end", point: KernelPoint) {
    if (!snapshot) return;
    finish(moveWallEndpoint(snapshot.project, { activePlaceId: snapshot.activePlaceId ?? "", wallId, endpoint, point, boundaryEditing: snapshot.boundaryEditing }, identity), `move:wall-endpoint:${wallId}:${endpoint}`, true);
  }

  function remove(selection: EditableSelection) {
    if (!snapshot) return;
    finish(deleteSelection(snapshot.project, { activePlaceId: snapshot.activePlaceId ?? "", selection, boundaryEditing: snapshot.boundaryEditing }, identity), `delete:${selection.kind}:${selection.id}`);
    if (selection.kind !== "wall") onSelection(undefined);
  }

  function removeMany(selections: EditableSelection[]) {
    if (!snapshot) return;
    finish(deleteSelectionGroup(snapshot.project, { activePlaceId: snapshot.activePlaceId ?? "", selections, boundaryEditing: snapshot.boundaryEditing }, identity), `delete:group:${selections.map(({ id }) => id).join(":")}`);
    onSelection(undefined);
  }

  function editElement(id: string, details: { widthMeters?: number; name?: string; description?: string; tags?: string[]; belongsToId?: string; appearance?: MapAppearance; properties?: Record<string, string | number | boolean | null>; geometry?: DrawingElement["geometry"]; visible?: boolean; locked?: boolean }) {
    if (!session) return;
    session.executeTransaction({ id: `details:element:${id}`, apply: (project) => updateElementDetails(project, id, details) }); refresh();
  }

  function editNoteText(id: string, text: string) {
    if (!session) return; session.executeTransaction({ id: `note:${id}`, apply: (project) => updateNoteText(project, id, text) }); refresh();
  }

  function editSelectionState(selection: EditableSelection, details: { visible?: boolean; locked?: boolean }) {
    if (!session) return; session.executeTransaction({ id: `state:${selection.kind}:${selection.id}`, apply: (project) => updateSelectionState(project, selection, details) }); refresh();
  }

  function resizeOpening(id: string, width: number) {
    if (!snapshot?.activePlaceId) return;
    finish(updateOpeningWidth(snapshot.project, snapshot.activePlaceId, id, width), `resize:opening:${id}`);
  }

  function resizeTransition(id: string, corner: ResizeCorner, point: KernelPoint) {
    if (!snapshot) return; finish(resizeTransitionFootprint(snapshot.project, id, corner, point), `resize:transition:${id}`);
  }

  function editTransition(id: string, details: Parameters<typeof updateTransitionDetails>[2]) {
    if (!snapshot) return; finish(updateTransitionDetails(snapshot.project, id, details), `details:transition:${id}`);
  }

  function resizeElement(id: string, corner: ResizeCorner, point: KernelPoint) {
    if (!snapshot) return; const element = snapshot.project.elements.find((candidate) => candidate.id === id); if (!element) return;
    const local = snapshot.activePlaceId ? applyAffinePoint(relativePlaceMatrix(snapshot.project, element.belongsToId, snapshot.activePlaceId), point) : point;
    finish(resizeElementRegion(snapshot.project, id, corner, local), `resize:element:${id}`);
  }

  function resizePlace(id: string, corner: ResizeCorner, point: KernelPoint) {
    if (!snapshot) return;
    const local = snapshot.activePlaceId ? applyAffinePoint(relativePlaceMatrix(snapshot.project, id, snapshot.activePlaceId), point) : point;
    finish(resizePlaceBoundary(snapshot.project, id, corner, local), `resize:place:${id}`);
  }

  function resizeSurface(id: string, corner: ResizeCorner, point: KernelPoint) {
    if (!snapshot) return;
    const surface = snapshot.project.surfaces.find((candidate) => candidate.id === id); if (!surface) return;
    const local = snapshot.activePlaceId ? applyAffinePoint(relativePlaceMatrix(snapshot.project, surface.belongsToId, snapshot.activePlaceId), point) : point;
    finish(resizeConstructionSurface(snapshot.project, id, corner, local), `resize:surface:${id}`);
  }

  function movePlaceVertex(id: string, polygonIndex: number, vertexIndex: number, point: KernelPoint) {
    if (!snapshot) return; const local = snapshot.activePlaceId ? applyAffinePoint(relativePlaceMatrix(snapshot.project, id, snapshot.activePlaceId), point) : point;
    finish(movePlaceBoundaryVertex(snapshot.project, id, polygonIndex, vertexIndex, local), `vertex:place:${id}:${polygonIndex}:${vertexIndex}`);
  }

  function moveElementVertex(id: string, polygonIndex: number, vertexIndex: number, point: KernelPoint) {
    if (!snapshot) return; const element = snapshot.project.elements.find((candidate) => candidate.id === id); if (!element) return;
    const local = snapshot.activePlaceId ? applyAffinePoint(relativePlaceMatrix(snapshot.project, element.belongsToId, snapshot.activePlaceId), point) : point;
    finish(moveElementRegionVertex(snapshot.project, id, polygonIndex, vertexIndex, local), `vertex:element:${id}:${polygonIndex}:${vertexIndex}`);
  }

  function moveSurfaceVertex(id: string, polygonIndex: number, vertexIndex: number, point: KernelPoint) {
    if (!snapshot) return; const surface = snapshot.project.surfaces.find((candidate) => candidate.id === id); if (!surface) return;
    const local = snapshot.activePlaceId ? applyAffinePoint(relativePlaceMatrix(snapshot.project, surface.belongsToId, snapshot.activePlaceId), point) : point;
    finish(moveConstructionSurfaceVertex(snapshot.project, id, polygonIndex, vertexIndex, local), `vertex:surface:${id}:${polygonIndex}:${vertexIndex}`);
  }

  function editSurface(id: string, details: Parameters<typeof updateConstructionSurface>[2]) {
    if (!snapshot) return; const project = updateConstructionSurface(snapshot.project, id, details);
    session?.executeTransaction({ id: `details:surface:${id}`, apply: () => project }); refresh();
  }

  function duplicateElements(ids: string[]) {
    if (!snapshot) return;
    finishElements(duplicateSelectedElements(snapshot.project, ids, identity.createId, (name) => locale === "pl" ? `${name} — kopia` : `${name} — copy`), `duplicate:elements:${ids.join(":")}`);
  }

  function rotateElements(ids: string[], degrees: -90 | 90) {
    if (!snapshot) return;
    finishElements(transformSelectedElements(snapshot.project, ids, { kind: "rotate", degrees }), `rotate:elements:${degrees}:${ids.join(":")}`);
  }

  function mirrorElements(ids: string[], axis: "horizontal" | "vertical") {
    if (!snapshot) return;
    finishElements(transformSelectedElements(snapshot.project, ids, { kind: "mirror", axis }), `mirror:elements:${axis}:${ids.join(":")}`);
  }

  function mergeElements(ids: string[]) {
    if (!snapshot) return;
    finishElements(mergeSelectedElementRegions(snapshot.project, ids), `merge:elements:${ids.join(":")}`);
  }

  function joinSelectedRoads(ids: string[]) {
    if (!snapshot || !session) return;
    setBlocked(undefined);
    const selected = ids.map((id) => snapshot.project.elements.find((element) => element.id === id));
    const result = selected.length === 2 && selected.every((element): element is DrawingElement => Boolean(element) && isFlowingWater(element!))
      ? joinFlowingWater(snapshot.project, ids)
      : joinRoads(snapshot.project, ids, identity);
    if (result.state === "blocked") {
      setBlocked(roadJoinNoticeKey(result.reason)); return;
    }
    const transaction = session.executeTransaction({ id: `join:${result.state === "joined" && selected.every((element) => element && isFlowingWater(element)) ? "flowing-water" : "roads"}:${ids.join(":")}`, apply: () => result.project });
    if (!transaction.changed) { setBlocked(transaction.code === "road-obstacle" ? "road-obstacle" : "transaction-failed"); return; }
    onSelections(result.state === "joined" ? [{ kind: "element", id: result.survivorId }] : ids.map((id) => ({ kind: "element", id })));
    refresh();
  }

  function duplicateSurfaces(ids: string[]) {
    if (!snapshot) return; finishSurfaces(duplicateSelectedConstructionSurfaces(snapshot.project, ids, identity.createId, (name) => locale === "pl" ? `${name} — kopia` : `${name} — copy`), `duplicate:surfaces:${ids.join(":")}`);
  }

  function transformSurfaces(ids: string[], transformation: { kind: "rotate"; degrees: -90 | 90 } | { kind: "mirror"; axis: "horizontal" | "vertical" }) {
    if (!snapshot) return; finishSurfaces(transformSelectedConstructionSurfaces(snapshot.project, ids, transformation), `transform:surfaces:${ids.join(":")}`);
  }

  function mergeSurfaces(ids: string[]) {
    if (!snapshot) return; finishSurfaces(mergeSelectedConstructionSurfaces(snapshot.project, ids), `merge:surfaces:${ids.join(":")}`);
  }

  function mergeRooms(ids: string[]) {
    if (!snapshot?.activePlaceId) return;
    finish(mergeSelectedRooms(snapshot.project, snapshot.activePlaceId, ids, identity), `merge:rooms:${ids.join(":")}`);
  }

  function duplicateRooms(ids: string[]) {
    if (!snapshot?.activePlaceId) return;
    finishRooms(duplicateSelectedRooms(snapshot.project, snapshot.activePlaceId, ids, identity), `duplicate:rooms:${ids.join(":")}`);
  }

  function transformRooms(ids: string[], transformation: { kind: "rotate"; degrees: -90 | 90 } | { kind: "mirror"; axis: "horizontal" | "vertical" }) {
    if (!snapshot?.activePlaceId) return;
    finishRooms(transformSelectedRooms(snapshot.project, snapshot.activePlaceId, ids, transformation, snapshot.boundaryEditing, identity), `transform:rooms:${ids.join(":")}`);
  }

  function duplicatePlaces(ids: string[]) {
    if (!snapshot) return;
    finishPlaces(duplicateSelectedPlaces(snapshot.project, ids, identity, (name) => locale === "pl" ? `${name} — kopia` : `${name} — copy`), `duplicate:places:${ids.join(":")}`);
  }

  function transformPlaces(ids: string[], transformation: { kind: "rotate"; degrees: -90 | 90 } | { kind: "mirror"; axis: "horizontal" | "vertical" }) {
    if (!snapshot) return; finishPlaces(transformSelectedPlaces(snapshot.project, ids, transformation), `transform:places:${ids.join(":")}`);
  }

  function mergePlaces(ids: string[], mode: "outer-only" | "keep-partitions") {
    if (!snapshot) return; finishPlaces(mergeSelectedPlaces(snapshot.project, ids, mode, identity), `merge:places:${mode}:${ids.join(":")}`);
  }

  function acceptReview() {
    if (!review || !session) return;
    session.executeTransaction({ id: "selection:reviewed-change", apply: () => review.project }); setReview(undefined); refresh();
  }

  let notice: DrawingNoticeModel | undefined;
  if (review) notice = { message: copy.editingStatus.reviewQuestion, tone: "warning", actions: [
    { id: "apply", label: copy.editingStatus.apply, primary: true, onClick: acceptReview },
    { id: "cancel", label: copy.editingStatus.cancel, onClick: () => setReview(undefined) },
  ] };
  else if (blocked) notice = { message: copy.editingStatus.blocked[blocked], tone: "warning", actions: [
    { id: "close", label: copy.close, onClick: () => setBlocked(undefined) },
  ] };

  return { move, moveMany, moveEndpoint, resizeElement, resizeSurface, resizePlace, resizeTransition, movePlaceVertex, moveElementVertex, moveSurfaceVertex, remove, removeMany, editElement, editNoteText, editSelectionState, editSurface, editTransition, resizeOpening, duplicateElements, rotateElements, mirrorElements, mergeElements, joinSelectedRoads, duplicateSurfaces, transformSurfaces, mergeSurfaces, mergeRooms, mergePlaces, duplicateRooms, transformRooms, duplicatePlaces, transformPlaces, notice, reset: () => { setReview(undefined); setBlocked(undefined); } };
}
