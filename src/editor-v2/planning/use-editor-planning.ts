"use client";

import { createElement, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { applyAffinePoint, relativePlaceMatrix } from "../geometry/affine-transform";
import { geometryFitsBoundary } from "../drawing/geometry-containment";
import { repairRegionShape } from "../geometry/region-constraints";
import { commitRoadEdit } from "../roads/road-editing";
import type { EditableSelection } from "../drawing/selection-operations";
import { selectionIsLocked } from "../drawing/selection-locks";
import type { BezierNode, KernelPoint } from "../geometry/geometry-types";
import type { EditorProject, DrawingElement, RegionShape } from "../model/project-model";
import type { EditorLocale } from "../i18n/workbench-copy";
import type { EditorSession, EditorSessionState } from "../state/editor-session";
import { planningInsertionTarget, setBezierNodeSmooth, type PlanningAxis, type AlignmentEdge } from "./planning-geometry";
import { boundsDimensions, geometryDimensions } from "./planning-measurements";
import { PlanningMeasurementReadout, type PlanningMeasurementCopy } from "./planning-measurement-readout";
import { PlanningSelectionActions, type PlanningSelectionCopy } from "./planning-selection-actions";
import { insertGeometryNodeAt, removeGeometryNode, splitPlanningElement, type PlanningGeometry } from "./planning-operations";
import { PlanningGeometryInspector, type PlanningGeometryInspectorCopy } from "./planning-geometry-inspector";
export { applyPlanningAlignment, planningSelectionFrames } from "./selection-alignment";
import { applyPlanningAlignment, planningSelectionFrames, type PlanningApplyResult } from "./selection-alignment";
type PlanningBlockReason = Exclude<PlanningApplyResult, { state: "applied" }>["reason"];
type NodeInsertionController = { active: boolean; previewAt(point: KernelPoint): KernelPoint | undefined; insertAt(point: KernelPoint): void; cancel(): void };

function planningCopy(locale: EditorLocale): PlanningSelectionCopy { return locale === "pl" ? { title: "Operacje ustawiania", alignStart: "Wyrównaj początek", alignCenter: "Wyrównaj środek", alignEnd: "Wyrównaj koniec", distribute: "Rozmieść równomiernie", horizontal: "Poziomo", vertical: "Pionowo" } : { title: "Planning alignment", alignStart: "Align start", alignCenter: "Align centre", alignEnd: "Align end", distribute: "Distribute evenly", horizontal: "Horizontal", vertical: "Vertical" }; }
function geometryCopy(locale: EditorLocale): PlanningGeometryInspectorCopy { return locale === "pl" ? { title: "Uchwyty kształtu", node: "Uchwyt", add: "Dodaj uchwyt", cancel: "Anuluj dodawanie", hint: "Kliknij linię, aby umieścić uchwyt. Escape anuluje.", remove: "Usuń uchwyt", smooth: "Wygładź", sharp: "Ostry", split: "Podziel w tym węźle", unsupported: "Ta geometria nie ma edytowalnych węzłów." } : { title: "Shape handles", node: "Handle", add: "Add handle", cancel: "Cancel insertion", hint: "Click the line to place a handle. Press Escape to cancel.", remove: "Remove handle", smooth: "Smooth", sharp: "Sharp", split: "Split at this node", unsupported: "This geometry has no editable nodes." }; }

type NodeGeometry = { kind: "region"; shape: Extract<RegionShape, { kind: "polygon" }> } | { kind: "path"; points: KernelPoint[]; closed: boolean } | { kind: "bezier"; nodes: BezierNode[]; closed: boolean };
type EditableNodeGeometry = { kind: "region"; geometry: Extract<NodeGeometry, { kind: "region" }>; update(next: NodeGeometry): EditorProject | undefined } | { kind: "path"; geometry: Extract<NodeGeometry, { kind: "path" }>; update(next: NodeGeometry): EditorProject | undefined } | { kind: "bezier"; geometry: Extract<NodeGeometry, { kind: "bezier" }>; update(next: NodeGeometry): EditorProject | undefined };

function safeRepairRegionShape(shape: RegionShape) {
  try { return repairRegionShape(shape); } catch { return undefined; }
}

function commitNodeGeometry(project: EditorProject, selection: EditableSelection, next: NodeGeometry): EditorProject | undefined {
  if (selection.kind === "element") {
    const element = project.elements.find(({ id }) => id === selection.id);
    if (!element) return undefined;
    if (element.layerId === "roads") return next.kind === "region" ? undefined : commitRoadEdit(project, { ...element, geometry: next });
    let geometry: DrawingElement["geometry"];
    if (next.kind === "region") { const shape = safeRepairRegionShape(next.shape); if (!shape) return undefined; geometry = { kind: "region", shape }; } else geometry = next;
    const owner = project.places.find(({ id }) => id === element.belongsToId);
    if (element.layerId === "equipment" && owner?.boundary && !geometryFitsBoundary(geometry, owner.boundary)) return undefined;
    return { ...project, elements: project.elements.map((candidate) => candidate.id === selection.id ? { ...candidate, geometry } : candidate) };
  }
  if (selection.kind === "surface") {
    const surface = project.surfaces.find(({ id }) => id === selection.id);
    if (!surface) return undefined;
    if (next.kind === "region") {
      const shape = safeRepairRegionShape(next.shape);
      return shape ? { ...project, surfaces: project.surfaces.map((candidate) => candidate.id === selection.id ? { ...candidate, shape } : candidate) } : undefined;
    }
    if (next.kind === "bezier") return { ...project, surfaces: project.surfaces.map((candidate) => candidate.id === selection.id ? { ...candidate, shape: { kind: "bezier" as const, nodes: next.nodes, closed: true as const } } : candidate) };
    return undefined;
  }
  return undefined;
}

function editableGeometry(project: EditorProject, selection: EditableSelection): EditableNodeGeometry | undefined {
  if (selection.kind === "element") {
    const element = project.elements.find(({ id }) => id === selection.id); if (!element) return undefined;
    const geometry = element.geometry;
    if (geometry?.kind === "region" && geometry.shape.kind === "polygon") return { kind: "region", geometry: { kind: "region", shape: geometry.shape }, update: (next) => commitNodeGeometry(project, selection, next) };
    if (geometry?.kind === "path") return { kind: "path", geometry, update: (next) => commitNodeGeometry(project, selection, next) };
    if (geometry?.kind === "bezier") return { kind: "bezier", geometry, update: (next) => commitNodeGeometry(project, selection, next) };
  }
  if (selection.kind === "surface") {
    const surface = project.surfaces.find(({ id }) => id === selection.id);
    if (surface) {
      const shape = surface.shape;
      if (shape.kind === "polygon") return { kind: "region", geometry: { kind: "region", shape }, update: (next) => commitNodeGeometry(project, selection, next) };
      if (shape.kind === "bezier") return { kind: "bezier", geometry: { kind: "bezier", nodes: shape.nodes, closed: shape.closed }, update: (next) => commitNodeGeometry(project, selection, next) };
    }
  }
  return undefined;
}

function asNodeGeometry(value: PlanningGeometry | undefined): NodeGeometry | undefined {
  if (!value) return undefined;
  if (value.kind === "region" && value.shape.kind === "polygon") return { kind: "region", shape: value.shape };
  if (value.kind === "path" || value.kind === "bezier") return value;
  return undefined;
}

export function useEditorPlanning({ session, snapshot, selections, locale, refresh, onSplit }: { session?: EditorSession; snapshot?: EditorSessionState; selections: EditableSelection[]; locale: EditorLocale; refresh(): void; onSplit?(): void }) {
  const frames = useMemo(() => snapshot?.activePlaceId ? planningSelectionFrames(snapshot.project, snapshot.activePlaceId, selections) : [], [selections, snapshot]);
  const copy = planningCopy(locale); const nodeCopy = geometryCopy(locale); const [selectedNode, setSelectedNode] = useState(0); const [notice, setNotice] = useState<string>(); const [insertionSelectionKey, setInsertionSelectionKey] = useState<string>(); const identity = { createId: () => crypto.randomUUID(), createRoomName: (index: number) => locale === "pl" ? `Pomieszczenie ${index}` : `Room ${index}` };
  const measurementCopy: PlanningMeasurementCopy = locale === "pl" ? { width: "Szerokość", height: "Wysokość", area: "Pole", angle: "Kąt", live: "Na żywo" } : { width: "Width", height: "Height", area: "Area", angle: "Angle", live: "Live" };
  const blockedMessage = (reason: PlanningBlockReason) => locale === "pl" ? ({ locked: "Zaznaczenie jest zablokowane.", unsupported: "Ta kombinacja obiektów nie jest obsługiwana.", "outside-outline": "Zmiana wyszłaby poza dozwolony obrys.", collision: "Zmiana koliduje z istniejącą geometrią." }[reason]) : ({ locked: "The selection is locked.", unsupported: "This selection is not supported.", "outside-outline": "The change would leave the allowed outline.", collision: "The change collides with existing geometry." }[reason]);
  const apply = (mode: Parameters<typeof applyPlanningAlignment>[3]) => { if (!session || !snapshot?.activePlaceId) return; const result = applyPlanningAlignment(snapshot.project, snapshot.activePlaceId, selections, mode, snapshot.boundaryEditing, identity); if (result.state !== "applied") { setNotice(blockedMessage(result.reason)); return; } setNotice(undefined); if (session.executeTransaction({ id: `planning:${mode.kind}:${mode.axis}:${mode.kind === "align" ? mode.edge : "even"}`, apply: () => result.project }).changed) refresh(); };
  const selectedGeometry = snapshot && selections.length === 1 ? editableGeometry(snapshot.project, selections[0]) : undefined;
  const dimensions = selectedGeometry?.kind === "region" ? geometryDimensions(selectedGeometry.geometry.shape) : frames.length === 1 ? boundsDimensions(frames[0].bounds) : undefined;
  const nodeCount = selectedGeometry?.kind === "region" ? selectedGeometry.geometry.shape.points.length : selectedGeometry?.kind === "path" ? selectedGeometry.geometry.points.length : selectedGeometry?.geometry.nodes.length ?? 0; const index = Math.min(selectedNode, Math.max(0, nodeCount - 1));
  const editGeometry = (change: (geometry: NodeGeometry) => NodeGeometry | undefined, transactionId: string): boolean => { if (!session || !snapshot || !selectedGeometry || !selections[0]) return false; if (selectionIsLocked(snapshot.project, selections[0])) { setNotice(locale === "pl" ? "Zaznaczenie jest zablokowane." : "The selection is locked."); return false; } const nextGeometry = change(selectedGeometry.geometry); if (!nextGeometry) { setNotice(locale === "pl" ? "Nie można wykonać tej zmiany geometrii." : "This geometry change is not valid."); return false; } const nextProject = selectedGeometry.update(nextGeometry); if (!nextProject) { setNotice(locale === "pl" ? "Zmiana narusza obrys właściciela lub poprawność geometrii." : "The change would leave the owner outline or make invalid geometry."); return false; } setNotice(undefined); const result = session.executeTransaction({ id: transactionId, apply: () => nextProject }); if (!result.changed) return false; refresh(); return true; };
  const selectedElement = selections[0]?.kind === "element" ? snapshot?.project.elements.find(({ id }) => id === selections[0]?.id) : undefined;
  const selectionKey = selections.length === 1 ? `${selections[0].kind}:${selections[0].id}` : "";
  const activeLayerId = snapshot?.toolbox.activeLayerId;
  const activeInstrumentId = activeLayerId ? snapshot?.toolbox.byLayer[activeLayerId]?.instrumentId : undefined;
  const planningContextKey = `${snapshot?.activePlaceId ?? ""}:${activeLayerId ?? ""}:${activeInstrumentId ?? ""}:${snapshot?.boundaryEditing ? "boundary" : "normal"}`;
  const insertionContextReady = Boolean(snapshot?.activePlaceId && activeLayerId && activeInstrumentId);
  const insertionKey = `${selectionKey}:${planningContextKey}`;
  const insertionActive = insertionContextReady && insertionSelectionKey === insertionKey && selectionKey.length > 0;
  const onInsertNode = () => { if (!selectedGeometry || !insertionContextReady) return; setInsertionSelectionKey((current) => current === insertionKey ? undefined : insertionKey); };
  const selectedSourcePlaceId = selectedElement?.belongsToId ?? (selections[0]?.kind === "surface" ? snapshot?.project.surfaces.find(({ id }) => id === selections[0]?.id)?.belongsToId : undefined);
  const toSourcePoint = (point: KernelPoint) => snapshot?.activePlaceId && selectedSourcePlaceId ? applyAffinePoint(relativePlaceMatrix(snapshot.project, selectedSourcePlaceId, snapshot.activePlaceId), point) : point;
  const toActivePoint = (point: KernelPoint) => snapshot?.activePlaceId && selectedSourcePlaceId ? applyAffinePoint(relativePlaceMatrix(snapshot.project, snapshot.activePlaceId, selectedSourcePlaceId), point) : point;
  const nodeInsertion: NodeInsertionController = { active: insertionActive, previewAt: (point) => { if (!insertionActive || !selectedGeometry || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return undefined; const target = planningInsertionTarget(selectedGeometry.geometry, toSourcePoint(point)); return target && target.ratio > 1e-6 && target.ratio < 1 - 1e-6 ? toActivePoint(target.point) : undefined; }, insertAt: (point) => { if (!insertionActive || !selectedGeometry || !session || !snapshot || !selections[0] || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return; const sourcePoint = toSourcePoint(point); const target = planningInsertionTarget(selectedGeometry.geometry, sourcePoint); if (!target || target.ratio <= 1e-6 || target.ratio >= 1 - 1e-6) return; const changed = asNodeGeometry(insertGeometryNodeAt(selectedGeometry.geometry, sourcePoint)); if (editGeometry(() => changed, `planning:insert-node-at:${selections[0].id}`)) setSelectedNode(target.segmentIndex + 1); }, cancel: () => setInsertionSelectionKey(undefined) };
  const onRemoveNode = () => { if (!selectedGeometry) return; const changed = asNodeGeometry(removeGeometryNode(selectedGeometry.geometry, 0, index)); editGeometry(() => changed, `planning:remove-node:${selections[0].id}`); };
  const onToggleSmooth = selectedGeometry?.kind === "bezier" ? () => { const node = selectedGeometry.geometry.nodes[index]; const changed = setBezierNodeSmooth(selectedGeometry.geometry.nodes, index, !(node.inHandle && node.outHandle), selectedGeometry.geometry.closed); editGeometry(() => changed ? { ...selectedGeometry.geometry, nodes: changed } : undefined, `planning:smooth-node:${selections[0].id}:${index}`); } : undefined;
  const canSplitPath = (selectedGeometry?.kind === "path" || selectedGeometry?.kind === "bezier") && Boolean(selectedElement) && index > 0 && index < nodeCount - 1 && !selectedGeometry.geometry.closed;
  const splitPath = canSplitPath ? () => { if (!session || !snapshot || !selectedElement || !selections[0]) return; if (selectionIsLocked(snapshot.project, selections[0])) { setNotice(locale === "pl" ? "Zaznaczenie jest zablokowane." : "The selection is locked."); return; } const pieces = splitPlanningElement(selectedElement, index, identity.createId, `${selectedElement.name} ${locale === "pl" ? "(część 2)" : "(part 2)"}`); if (!pieces) { setNotice(locale === "pl" ? "Nie można podzielić tej geometrii w tym węźle." : "The geometry cannot be split at this node."); return; } const next = { ...snapshot.project, elements: snapshot.project.elements.flatMap((element) => element.id === selectedElement.id ? pieces : [element]) }; setNotice(undefined); if (session.executeTransaction({ id: `planning:split-path:${selectedElement.id}:${index}`, apply: () => next }).changed) refresh(); } : undefined;
  const geometryInspector = selectedGeometry && nodeCount > 0 ? createElement(PlanningGeometryInspector, { kind: selectedGeometry.kind, nodeCount, selectedNode: index, smooth: selectedGeometry.kind === "bezier" ? Boolean(selectedGeometry.geometry.nodes[index]?.inHandle && selectedGeometry.geometry.nodes[index]?.outHandle) : undefined, insertionActive, onSelectNode: setSelectedNode, onInsert: onInsertNode, onCancelInsert: nodeInsertion.cancel, onRemove: onRemoveNode, onToggleSmooth, onSplit: onSplit ?? splitPath, copy: nodeCopy, disabled: !session || !snapshot || selectionIsLocked(snapshot.project, selections[0]) }) : undefined;
  const readout: ReactNode = dimensions ? createElement(PlanningMeasurementReadout, { dimensions, unit: snapshot?.project.measureSettings.units ?? "metric", copy: measurementCopy }) : undefined; const warning: ReactNode = notice ? createElement("p", { role: "status" }, notice) : undefined; const inspector: ReactNode = readout || geometryInspector || warning ? createElement("div", null, readout, geometryInspector, warning) : undefined;
  const planningActions = { canAlign: frames.length > 1, canDistribute: frames.length > 2, onAlign: (axis: PlanningAxis, edge: AlignmentEdge) => apply({ kind: "align", axis, edge }), onDistribute: (axis: PlanningAxis) => apply({ kind: "distribute", axis }), copy };
  const planningActionsView = createElement(PlanningSelectionActions, { count: frames.length, canAlign: planningActions.canAlign, canDistribute: planningActions.canDistribute, onAlign: planningActions.onAlign, onDistribute: planningActions.onDistribute, copy });
  return { planningActions, planningActionsView, inspector, geometryInspector, nodeInsertion, notice, frames, canAlign: frames.length > 1, canDistribute: frames.length > 2 };
}
