"use client";
import { useCallback, useDeferredValue, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent as ReactMouseEvent, type PointerEvent } from "react";
import type { KernelPoint } from "../geometry/geometry-types"; import type { ResizeCorner } from "../geometry/region-resize"; import type { WorkLayerId } from "../toolbox/toolbox-model";
import { MapGesturePreview } from "./map-gesture-preview";
import { appendDistinct, arcHoverGesture, clientPointToMap, completedGesture, gestureInstrument, isContinuousGesture, isPolygonGesture, multiClickGesture, type MapGesture, type MapGestureDraft } from "./map-sheet-gesture";
import { constructionPlaceForView, fitViewportToRegion, panViewport, pointsPath, viewportRegion, zoomViewport } from "./map-sheet-geometry";
import styles from "./map-sheet.module.css"; import { Compass } from "./map-sheet-shapes";
import { clientPointToSheet, marqueeRect, selectionsInMarquee, type MarqueeDraft } from "./map-sheet-marquee";
import { useTouchViewport } from "./use-touch-viewport"; import { placeToOpenAbove } from "../model/navigation-fallback";
import { MapSheetTracing } from "./map-sheet-tracing"; import { useDrawingKeyboardConfirmation } from "./use-drawing-keyboard-confirmation"; import { preferredSelectable } from "./map-selection-target";
import { previewRegionResize, previewRegionVertex, previewWallEndpoint } from "./map-resize-preview"; import { MapGrid } from "./map-grid";
import type { MapSelection, MapSheetProps } from "./map-sheet-types";
import { compassRotationAt } from "./map-compass-rotation"; import { useMapNodeInsertion } from "./use-map-node-insertion";
import { SelectionRotationHandle } from "./selection-rotation-handle";
import { captureMapPoint, capturePointPointer } from "./map-point-picker";
import { fallbackMeasurementCopy, ViewMeasureControls } from "./view-measure-controls";
import { MapSheetScene } from "./map-sheet-scene";
import { quantizedLabelLayoutZoom } from "../geometry/label-layout-zoom";
export type { MapSelection, MapSheetCopy } from "./map-sheet-types";
const emptySelectedIds: string[] = []; const emptyDraftStrokes: KernelPoint[][] = [];
export function MapSheet({ pointPicker, storyOverlay, rotationControl, project, activePlaceId, viewport, copy, selectedIds = emptySelectedIds, draftStrokes = emptyDraftStrokes, gestureDraft, sheetSize = { width: 1000, height: 700 }, interaction, selectionEditing = false, selectionOnly = false, outlineEditing = false, selectionMode = "direct", selectionLayerId, sketchVisible = true, sketchOpacity = .75, eraserSize = 10, gapClosingEnabled = false, gapClosingTolerance = 14, tracingProject, tracingOpacity = .4, onSelect, onSelectMany, onOpenPlace, onClearSelection, onDeleteSelected, onCancelDrawing, onViewportChange, onGesture, onGestureDraftChange, onMeasureSettingsChange, onNoteTextChange, onMoveSelection, onMoveWallEndpoint, onResizeOpening, onResizeTransition, onResizeElement, onResizeSurface, onResizePlace, onMoveElementVertex, onMoveSurfaceVertex, onMovePlaceVertex, nodeInsertion }: MapSheetProps) {
  const prefix = useId().replaceAll(":", ""); const canvasRef = useRef<SVGSVGElement>(null); const drag = useRef<{ point: { x: number; y: number }; pointerId: number } | undefined>(undefined);
  const insertion = useMapNodeInsertion(nodeInsertion, viewport, sheetSize);
  const moving = useRef<{ selection: MapSelection; start: KernelPoint; pointerId: number } | undefined>(undefined); const movingEndpoint = useRef<{ wallId: string; endpoint: "start" | "end"; pointerId: number } | undefined>(undefined); const resizingOpening = useRef<{ openingId: string; pointerId: number } | undefined>(undefined);
  const rotating = useRef<{ pointerId: number } | undefined>(undefined); const resizing = useRef<{ kind: "element" | "surface" | "place" | "transition"; id: string; corner: ResizeCorner; pointerId: number } | undefined>(undefined); const movingVertex = useRef<{ kind: "element" | "surface" | "place"; id: string; polygonIndex: number; vertexIndex: number; pointerId: number } | undefined>(undefined);
  const suppressSelectionClick = useRef(false); const marquee = useRef<MarqueeDraft | undefined>(undefined); const [marqueePreview, setMarqueePreview] = useState<MarqueeDraft>();
  const [movePreview, setMovePreview] = useState<{ selection: MapSelection; delta: KernelPoint }>(); const [openingWidthPreview, setOpeningWidthPreview] = useState<{ id: string; width: number }>(); const [resizeProjectPreview, setResizeProjectPreview] = useState<typeof project>(); const [renderedGestureDraft, setRenderedGestureDraft] = useState<MapGestureDraft | undefined>(gestureDraft);
  const visibleGestureDraft = onGestureDraftChange ? gestureDraft : renderedGestureDraft;
  const gestureDraftRef = useRef<MapGestureDraft | undefined>(visibleGestureDraft); const activeGesture = gestureInstrument(interaction);
  const sourceSelection = selectionEditing || selectionOnly;
  const lastPenClick = useRef<{ point: KernelPoint; time: number } | undefined>(undefined);
  const displayedProject = resizeProjectPreview ?? project; const activePlace = displayedProject.places.find(({ id }) => id === activePlaceId); const selected = useMemo(() => new Set(selectedIds), [selectedIds]);
  const movingIds = useMemo(() => new Set(movePreview ? selected.has(movePreview.selection.id) ? selectedIds : [movePreview.selection.id] : []), [movePreview, selected, selectedIds]);
  const constructionOwner = constructionPlaceForView(displayedProject, activePlaceId);
  const activeConstruction = displayedProject.constructions.find(({ id }) => id === constructionOwner?.constructionId);
  const broaderPlaceId = placeToOpenAbove(project, activePlaceId);
  const mapTransform = `translate(${sheetSize.width / 2} ${sheetSize.height / 2}) rotate(${viewport.rotation}) scale(${viewport.zoom}) translate(${-viewport.center.x} ${-viewport.center.y})`;
  const layoutZoom = useDeferredValue(viewport.zoom);
  const labelLayoutZoom = useDeferredValue(quantizedLabelLayoutZoom(viewport.zoom));
  const stableOnSelect = useStableEvent(onSelect); const stableOnOpenPlace = useStableEvent(onOpenPlace); const stableOnNoteTextChange = useStableEvent(onNoteTextChange); const stableOnViewportChange = useStableEvent(onViewportChange);
  const viewportNavigationEnabled = Boolean(onViewportChange);
  const viewportRef = useRef(viewport);
  useEffect(() => { viewportRef.current = viewport; }, [viewport]);
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas || !viewportNavigationEnabled) return;
    const onWheel = (event: globalThis.WheelEvent) => {
      event.preventDefault(); const bounds = canvas.getBoundingClientRect();
      const anchor = { x: (event.clientX - bounds.left) / bounds.width * sheetSize.width, y: (event.clientY - bounds.top) / bounds.height * sheetSize.height };
      const next = zoomViewport(viewportRef.current, Math.exp(-event.deltaY * 0.0015), anchor, { x: sheetSize.width / 2, y: sheetSize.height / 2 });
      viewportRef.current = next; stableOnViewportChange(next);
    };
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
  }, [sheetSize.height, sheetSize.width, stableOnViewportChange, viewportNavigationEnabled]);
  const touchNavigation = useTouchViewport({ viewport, sheetSize, onChange: onViewportChange, onGestureStart: () => { drag.current = undefined; moving.current = undefined; setMovePreview(undefined); movingEndpoint.current = undefined; resizingOpening.current = undefined; setOpeningWidthPreview(undefined); resizing.current = undefined; setResizeProjectPreview(undefined); movingVertex.current = undefined; rotating.current = undefined; marquee.current = undefined; setMarqueePreview(undefined); showGesture(); } });
  function mapPoint(event: { clientX: number; clientY: number; currentTarget: SVGSVGElement }) { const point = clientPointToMap({ x: event.clientX, y: event.clientY }, event.currentTarget.getBoundingClientRect(), sheetSize, viewport); const spacing = project.measureSettings.gridSpacingMeters; return activeGesture !== "erase" && project.measureSettings.snapToGrid && spacing > 0 ? { x: Math.round(point.x / spacing) * spacing, y: Math.round(point.y / spacing) * spacing } : point; }
  function rawMapPoint(event: { clientX: number; clientY: number; currentTarget: SVGSVGElement }) { return clientPointToMap({ x: event.clientX, y: event.clientY }, event.currentTarget.getBoundingClientRect(), sheetSize, viewport); }
  function openingWidthAt(openingId: string, point: KernelPoint) { const opening = activeConstruction?.openings.find(({ id }) => id === openingId); const wall = activeConstruction?.walls.find(({ id }) => id === opening?.wallId); if (!opening || !wall) return; const dx = wall.end.x - wall.start.x; const dy = wall.end.y - wall.start.y; const length = Math.hypot(dx, dy); const center = { x: wall.start.x + dx * opening.position, y: wall.start.y + dy * opening.position }; return Math.max(.2, 2 * (length ? Math.abs((point.x - center.x) * dx / length + (point.y - center.y) * dy / length) : opening.width / 2)); }
  const rotationAt = (event: { clientX: number; clientY: number; currentTarget: SVGSVGElement }) => compassRotationAt(event, sheetSize);
  useEffect(() => { gestureDraftRef.current = visibleGestureDraft; }, [visibleGestureDraft]);
  useDrawingKeyboardConfirmation(activeGesture, () => finishPen(false), finishMultiClick);
  function showGesture(next?: MapGestureDraft) { gestureDraftRef.current = next; setRenderedGestureDraft(next); onGestureDraftChange?.(next); }
  function emitGesture(gesture: MapGesture) { onGesture?.({ ...gesture, snapTolerance: (gapClosingEnabled ? gapClosingTolerance : 2.5) / viewport.zoom, hitRadius: eraserSize / viewport.zoom }); }
  function finishPen(closed = false) { const current = gestureDraftRef.current;
    const nodes = current?.instrumentId === "pen" ? current.bezierNodes ?? [] : [];
    if (nodes.length < 2) return;
    showGesture(); lastPenClick.current = undefined;
    emitGesture({ instrumentId: "pen", points: nodes.map(({ anchor }) => anchor), bezierNodes: nodes, closed });
  }
  function beginPan(event: PointerEvent<SVGSVGElement>) {
    if (touchNavigation.begin(event)) return;
    const openingHandle = (event.target as Element).closest<SVGElement>("[data-opening-resize]");
    if (selectionEditing && openingHandle?.dataset.openingResize) {
      resizingOpening.current = { openingId: openingHandle.dataset.openingResize, pointerId: event.pointerId };
      const opening = activeConstruction?.openings.find(({ id }) => id === openingHandle.dataset.openingResize); if (opening) setOpeningWidthPreview({ id: opening.id, width: opening.width });
      event.currentTarget.setPointerCapture(event.pointerId); return;
    }
    if ((event.target as Element).closest("[data-viewport-dial]")) {
      rotating.current = { pointerId: event.pointerId }; event.currentTarget.setPointerCapture(event.pointerId);
      onViewportChange?.({ ...viewport, rotation: rotationAt(event) }); return;
    }
    const resizeHandle = (event.target as Element).closest<SVGElement>("[data-resize-corner]");
    const resizeId = resizeHandle?.dataset.elementId ?? resizeHandle?.dataset.surfaceId ?? resizeHandle?.dataset.placeId ?? resizeHandle?.dataset.transitionId;
    if (resizeHandle && (selectionEditing || outlineEditing) && resizeId && resizeHandle.dataset.resizeCorner) {
      const kind = resizeHandle.dataset.placeId ? "place" : resizeHandle.dataset.surfaceId ? "surface" : resizeHandle.dataset.transitionId ? "transition" : "element"; resizing.current = { kind, id: resizeId, corner: resizeHandle.dataset.resizeCorner as ResizeCorner, pointerId: event.pointerId };
      onSelect?.({ kind, id: resizeId }); event.currentTarget.setPointerCapture(event.pointerId); return;
    }
    const vertexHandle = (event.target as Element).closest<SVGElement>("[data-region-vertex]"); const vertexId = vertexHandle?.dataset.elementId ?? vertexHandle?.dataset.surfaceId ?? vertexHandle?.dataset.placeId;
    if (vertexHandle && (selectionEditing || outlineEditing) && vertexId) {
      const kind = vertexHandle.dataset.placeId ? "place" : vertexHandle.dataset.surfaceId ? "surface" : "element"; movingVertex.current = { kind, id: vertexId, polygonIndex: Number(vertexHandle.dataset.regionPolygon), vertexIndex: Number(vertexHandle.dataset.regionVertex), pointerId: event.pointerId };
      onSelect?.({ kind, id: vertexId }); event.currentTarget.setPointerCapture(event.pointerId); return;
    }
    if (selectionEditing && selectionMode === "marquee") {
      const client = { x: event.clientX, y: event.clientY }; const sheet = clientPointToSheet(client, event.currentTarget.getBoundingClientRect(), sheetSize);
      const next = { pointerId: event.pointerId, clientStart: client, clientEnd: client, sheetStart: sheet, sheetEnd: sheet }; marquee.current = next; setMarqueePreview(next); event.currentTarget.setPointerCapture(event.pointerId); return;
    }
    if (activeGesture && !movingVertex.current && !movingEndpoint.current && !resizing.current && !resizingOpening.current && !moving.current) {
      event.currentTarget.focus({ preventScroll: true });
      const point = mapPoint(event);
      if (activeGesture === "pen") {
        const current = gestureDraftRef.current?.instrumentId === "pen" ? gestureDraftRef.current : undefined; const nodes = current?.bezierNodes ?? []; const tolerance = 10 / viewport.zoom;
        const first = nodes[0]?.anchor; if (nodes.length >= 2 && first && Math.hypot(point.x - first.x, point.y - first.y) <= tolerance) { finishPen(true); return; }
        const previous = lastPenClick.current; if (nodes.length >= 2 && previous && event.timeStamp - previous.time <= 450 && Math.hypot(point.x - previous.point.x, point.y - previous.point.y) <= tolerance) { finishPen(false); return; }
        const bezierNodes = [...nodes, { anchor: point }]; showGesture({ instrumentId: "pen", points: bezierNodes.map(({ anchor }) => anchor), bezierNodes, pointerId: event.pointerId }); event.currentTarget.setPointerCapture(event.pointerId); return;
      }
      if (isPolygonGesture(activeGesture)) {
        const next = multiClickGesture(activeGesture, gestureDraftRef.current, point, 10 / viewport.zoom);
        showGesture(next.draft); if (next.gesture) emitGesture(next.gesture); return;
      }
      showGesture({ instrumentId: activeGesture, points: [point], pointerId: event.pointerId }); event.currentTarget.setPointerCapture(event.pointerId); return;
    }
    const endpoint = (event.target as Element).closest<SVGElement>("[data-wall-endpoint]");
    if (selectionEditing && endpoint?.dataset.wallId && (endpoint.dataset.wallEndpoint === "start" || endpoint.dataset.wallEndpoint === "end")) {
      movingEndpoint.current = { wallId: endpoint.dataset.wallId, endpoint: endpoint.dataset.wallEndpoint, pointerId: event.pointerId };
      onSelect?.({ kind: "wall", id: endpoint.dataset.wallId }); event.currentTarget.setPointerCapture(event.pointerId); return;
    }
    const additive = event.ctrlKey || event.metaKey || event.shiftKey;
    const selectable = preferredSelectable({ event, selectionEditing: sourceSelection, selectionLayerId, selected, additive });
    if (selectable) {
      const kind = selectable.dataset.selectionKind as MapSelection["kind"] | undefined; const id = selectable.dataset.selectionId;
      const layerId = selectable.dataset.selectionLayer as WorkLayerId | undefined;
      if (sourceSelection && layerId && kind && id) {
        const selection = { kind, id };
        onSelect?.(selection, additive ? true : undefined);
        if (selectionEditing && !additive) { moving.current = { selection, start: rawMapPoint(event), pointerId: event.pointerId }; setMovePreview({ selection, delta: { x: 0, y: 0 } }); event.currentTarget.setPointerCapture(event.pointerId); }
      }
      return;
    }
    drag.current = { point: { x: event.clientX, y: event.clientY }, pointerId: event.pointerId }; event.currentTarget.setPointerCapture(event.pointerId); onClearSelection?.();
  }
  function continuePan(event: PointerEvent<SVGSVGElement>) {
    if (touchNavigation.move(event)) return;
    if (rotating.current?.pointerId === event.pointerId) { onViewportChange?.({ ...viewport, rotation: rotationAt(event) }); return; }
    if (marquee.current?.pointerId === event.pointerId) { const next = { ...marquee.current, clientEnd: { x: event.clientX, y: event.clientY }, sheetEnd: clientPointToSheet({ x: event.clientX, y: event.clientY }, event.currentTarget.getBoundingClientRect(), sheetSize) }; marquee.current = next; setMarqueePreview(next); return; }
    if (activeGesture && !movingVertex.current && !movingEndpoint.current && !resizing.current && !resizingOpening.current && !moving.current) {
      const current = gestureDraftRef.current; if (!current || current.instrumentId !== activeGesture) return; const point = mapPoint(event);
      if (activeGesture === "pen" && current.pointerId === event.pointerId && current.bezierNodes?.length) {
        const last = current.bezierNodes.at(-1)!; const dx = point.x - last.anchor.x; const dy = point.y - last.anchor.y; const node = Math.hypot(dx, dy) > .8 / viewport.zoom ? { ...last, inHandle: { x: last.anchor.x - dx, y: last.anchor.y - dy }, outHandle: point } : last; const bezierNodes = [...current.bezierNodes.slice(0, -1), node]; showGesture({ ...current, points: bezierNodes.map(({ anchor }) => anchor), bezierNodes, hover: point }); return;
      }
      if (activeGesture === "arc") {
        showGesture(arcHoverGesture(current, point)); return;
      }
      if (isPolygonGesture(activeGesture)) showGesture({ ...current, hover: point });
      else if (current.pointerId === event.pointerId) showGesture({ ...current, points: isContinuousGesture(activeGesture) ? appendDistinct(current.points, point) : [current.points[0], point] });
      return;
    }
    if (moving.current?.pointerId === event.pointerId) { const point = rawMapPoint(event); setMovePreview({ selection: moving.current.selection, delta: { x: point.x - moving.current.start.x, y: point.y - moving.current.start.y } }); return; }
    if (resizingOpening.current?.pointerId === event.pointerId) { const width = openingWidthAt(resizingOpening.current.openingId, rawMapPoint(event)); if (width) setOpeningWidthPreview({ id: resizingOpening.current.openingId, width }); return; }
    if (resizing.current?.pointerId === event.pointerId) { setResizeProjectPreview(previewRegionResize(project, activePlaceId, resizing.current, rawMapPoint(event))); return; }
    if (movingVertex.current?.pointerId === event.pointerId) { setResizeProjectPreview(previewRegionVertex(project, activePlaceId, movingVertex.current, rawMapPoint(event))); return; }
    if (movingEndpoint.current?.pointerId === event.pointerId) { setResizeProjectPreview(previewWallEndpoint(project, movingEndpoint.current.wallId, movingEndpoint.current.endpoint, rawMapPoint(event))); return; }
    if (!drag.current || drag.current.pointerId !== event.pointerId || !onViewportChange) return;
    const delta = { x: event.clientX - drag.current.point.x, y: event.clientY - drag.current.point.y }; drag.current.point = { x: event.clientX, y: event.clientY };
    onViewportChange(panViewport(viewport, delta));
  }
  function finishPan(event: PointerEvent<SVGSVGElement>) {
    if (touchNavigation.end(event)) return;
    if (rotating.current?.pointerId === event.pointerId) { rotating.current = undefined; return; }
    if (marquee.current?.pointerId === event.pointerId) { const current = marquee.current; marquee.current = undefined; setMarqueePreview(undefined); onSelectMany?.(selectionsInMarquee(event.currentTarget, current.clientStart, { x: event.clientX, y: event.clientY }, selectionLayerId)); return; }
    if (resizingOpening.current?.pointerId === event.pointerId) {
      const current = resizingOpening.current; resizingOpening.current = undefined; const width = openingWidthAt(current.openingId, rawMapPoint(event)); setOpeningWidthPreview(undefined); if (width) onResizeOpening?.(current.openingId, width);
      return;
    }
    if (resizing.current?.pointerId === event.pointerId) { const current = resizing.current; resizing.current = undefined; setResizeProjectPreview(undefined); const point = mapPoint(event); if (current.kind === "place") onResizePlace?.(current.id, current.corner, point); else if (current.kind === "surface") onResizeSurface?.(current.id, current.corner, point); else if (current.kind === "transition") onResizeTransition?.(current.id, current.corner, point); else onResizeElement?.(current.id, current.corner, point); return; }
    if (movingVertex.current?.pointerId === event.pointerId) { const current = movingVertex.current; movingVertex.current = undefined; setResizeProjectPreview(undefined); const point = mapPoint(event); if (current.kind === "place") onMovePlaceVertex?.(current.id, current.polygonIndex, current.vertexIndex, point); else if (current.kind === "surface") onMoveSurfaceVertex?.(current.id, current.polygonIndex, current.vertexIndex, point); else onMoveElementVertex?.(current.id, current.polygonIndex, current.vertexIndex, point); return; }
    if (activeGesture === "pen") {
      const current = gestureDraftRef.current; if (!current || current.pointerId !== event.pointerId) return; const point = mapPoint(event); lastPenClick.current = { point, time: event.timeStamp }; showGesture({ ...current, pointerId: undefined, hover: undefined }); return;
    }
    if (activeGesture && !isPolygonGesture(activeGesture)) {
      const current = gestureDraftRef.current; if (!current || current.pointerId !== event.pointerId) return; const final = { ...current, points: isContinuousGesture(activeGesture) ? appendDistinct(current.points, mapPoint(event)) : [current.points[0], mapPoint(event)], pointerId: undefined };
      const completed = completedGesture(final); if (completed) emitGesture(completed); showGesture(); return;
    }
    if (movingEndpoint.current?.pointerId === event.pointerId) {
      const current = movingEndpoint.current; movingEndpoint.current = undefined; setResizeProjectPreview(undefined);
      onMoveWallEndpoint?.(current.wallId, current.endpoint, mapPoint(event)); return;
    }
    if (moving.current?.pointerId === event.pointerId) {
      const start = moving.current.start; const selection = moving.current.selection; const end = mapPoint(event); moving.current = undefined;
      const delta = { x: end.x - start.x, y: end.y - start.y }; setMovePreview(undefined); if (Math.hypot(delta.x, delta.y) > .08) { suppressSelectionClick.current = true; onMoveSelection?.(selection, delta); }
      return;
    }
    if (drag.current?.pointerId === event.pointerId) drag.current = undefined;
  }
  function cancelPointer(event: PointerEvent<SVGSVGElement>) { if (touchNavigation.end(event)) return; if (movingVertex.current || movingEndpoint.current) { movingVertex.current = undefined; movingEndpoint.current = undefined; setResizeProjectPreview(undefined); return; } if (resizingOpening.current?.pointerId === event.pointerId) { resizingOpening.current = undefined; setOpeningWidthPreview(undefined); return; } if (resizing.current?.pointerId === event.pointerId) { resizing.current = undefined; setResizeProjectPreview(undefined); return; } if (moving.current?.pointerId === event.pointerId) { moving.current = undefined; setMovePreview(undefined); return; } if (marquee.current?.pointerId === event.pointerId) { marquee.current = undefined; setMarqueePreview(undefined); return; } if (activeGesture === "pen") { showGesture(); lastPenClick.current = undefined; } else if (activeGesture && !isPolygonGesture(activeGesture)) showGesture(); else finishPan(event); }
  function finishMultiClick() { const current = gestureDraftRef.current; if (!current || !isPolygonGesture(current.instrumentId)) return; const completed = completedGesture(current); if (completed) emitGesture(completed); showGesture(); }
  function suppressDrawingSelection(event: ReactMouseEvent<SVGSVGElement>) { if ((event.target as Element).closest("[data-note-editor]")) return; if (suppressSelectionClick.current) { suppressSelectionClick.current = false; event.preventDefault(); event.stopPropagation(); return; } if (activeGesture || sourceSelection) { event.preventDefault(); event.stopPropagation(); } }
  function keyNavigation(event: KeyboardEvent<SVGSVGElement>) {
    if (pointPicker && event.key === "Escape") { event.preventDefault(); pointPicker.cancel(); return; }
    if (activeGesture && event.key === "Escape") { event.preventDefault(); showGesture(); onCancelDrawing?.(); return; }
    if (activeGesture === "pen" && event.key === "Enter") { event.preventDefault(); finishPen(false); return; }
    if (activeGesture && isPolygonGesture(activeGesture) && event.key === "Enter") { event.preventDefault(); finishMultiClick(); return; }
    if (selectionEditing && selectedIds.length && (event.key === "Delete" || event.key === "Backspace")) { event.preventDefault(); onDeleteSelected?.(); return; }
    if (!onViewportChange) return; const step = event.shiftKey ? 80 : 24;
    const delta = event.key === "ArrowLeft" ? { x: step, y: 0 } : event.key === "ArrowRight" ? { x: -step, y: 0 } : event.key === "ArrowUp" ? { x: 0, y: step } : event.key === "ArrowDown" ? { x: 0, y: -step } : undefined;
    if (delta) { event.preventDefault(); onViewportChange(panViewport(viewport, delta)); }
    else if (event.key === "+" || event.key === "=") { event.preventDefault(); onViewportChange(zoomViewport(viewport, 1.2, { x: sheetSize.width / 2, y: sheetSize.height / 2 }, { x: sheetSize.width / 2, y: sheetSize.height / 2 })); }
    else if (event.key === "-") { event.preventDefault(); onViewportChange(zoomViewport(viewport, 1 / 1.2, { x: sheetSize.width / 2, y: sheetSize.height / 2 }, { x: sheetSize.width / 2, y: sheetSize.height / 2 })); }
  }
  const movingTransform = movePreview ? `translate(${movePreview.delta.x} ${movePreview.delta.y})` : undefined;
  return <div className={styles.sheet} data-drawing={activeGesture || nodeInsertion?.active ? "true" : undefined}>
    {broaderPlaceId && <button type="button" className={styles.backControl} title={copy.back} aria-label={copy.back} onClick={() => onOpenPlace?.(broaderPlaceId)}>←</button>}
    <svg ref={canvasRef} {...insertion.handlers} className={styles.canvas} style={activeGesture || pointPicker ? { cursor: "crosshair" } : undefined} viewBox={`0 0 ${sheetSize.width} ${sheetSize.height}`} role="img" aria-label={copy.ariaLabel} tabIndex={0} onPointerDownCapture={(event) => { if (!capturePointPointer(event, pointPicker)) insertion.handlers.onPointerDownCapture(event); }} onClickCapture={(event) => { if (captureMapPoint(event, pointPicker, viewport, sheetSize)) return; insertion.handlers.onClickCapture(event); if (!nodeInsertion?.active) suppressDrawingSelection(event); }} onContextMenu={(event) => { if (pointPicker) { event.preventDefault(); pointPicker.cancel(); return; } if (!activeGesture) return; event.preventDefault(); showGesture(); lastPenClick.current = undefined; onCancelDrawing?.(); }} onDoubleClick={() => activeGesture && isPolygonGesture(activeGesture) && finishMultiClick()} onPointerDown={beginPan} onPointerMove={continuePan} onPointerUp={finishPan} onPointerCancel={cancelPointer} onKeyDown={keyNavigation}>
      <defs><filter id={`${prefix}-ink`}><feTurbulence baseFrequency="0.025" numOctaves="2" seed="17" result="noise"/><feDisplacementMap in="SourceGraphic" in2="noise" scale="0.7"/></filter></defs>
      <g transform={mapTransform}>
        <MapGrid prefix={prefix} settings={project.measureSettings} viewport={viewport} sheetSize={sheetSize}/>
        <MapSheetScene project={displayedProject} activePlaceId={activePlaceId} prefix={prefix} copy={copy} layoutZoom={layoutZoom} labelLayoutZoom={labelLayoutZoom} selected={selected} movingIds={movingIds} movingTransform={movingTransform} movePreview={movePreview} openingWidthPreview={openingWidthPreview} selectionEditing={selectionEditing} selectionOnly={selectionOnly} outlineEditing={outlineEditing} selectionLayerId={selectionLayerId} sketchVisible={sketchVisible} sketchOpacity={sketchOpacity} activeGesture={Boolean(activeGesture)} noteEditing={activeGesture === "note"} onSelect={onSelect ? stableOnSelect : undefined} onOpenPlace={onOpenPlace ? stableOnOpenPlace : undefined} onNoteTextChange={onNoteTextChange ? stableOnNoteTextChange : undefined}/>
        {storyOverlay}
        {tracingProject && <MapSheetTracing project={tracingProject} activePlaceId={activePlaceId} prefix={`${prefix}-tracing`} copy={copy} viewportZoom={layoutZoom} labelLayoutZoom={labelLayoutZoom} opacity={tracingOpacity}/>}
        {draftStrokes.length > 0 && <g className={styles.pendingDraft} aria-hidden="true">{draftStrokes.map((points, index) => <path key={index} d={pointsPath(points, false)}/>)}</g>}
        <MapGesturePreview draft={visibleGestureDraft?.instrumentId === activeGesture ? visibleGestureDraft : undefined} viewportZoom={viewport.zoom} eraserSize={eraserSize} pencilSmoothing={displayedProject.measureSettings.pencilSmoothing} unit={displayedProject.measureSettings.units} measurementCopy={copy.measurements?.metric === "metry" ? { width: "Szer.", height: "Wys.", length: "Długość", angle: "Kąt" } : undefined}/>
        {insertion.marker}{selectionEditing && rotationControl && <SelectionRotationHandle control={rotationControl} viewport={viewport} sheetSize={sheetSize}/>}
        {!activePlace && <text className={styles.empty} x={viewport.center.x} y={viewport.center.y}>{copy.empty}</text>}
      </g>
      {marqueePreview && <rect className={styles.marquee} {...marqueeRect(marqueePreview.sheetStart, marqueePreview.sheetEnd)}/>}
      <Compass x={58} y={sheetSize.height - 58} rotation={viewport.rotation} label={copy.compass} northMark={copy.northMark ?? copy.compass.slice(0, 1)}/>
    </svg>
    <div className={styles.viewControls} aria-label={copy.resetView}>
      <button type="button" title={copy.zoomIn} aria-label={copy.zoomIn} onClick={() => onViewportChange?.(zoomViewport(viewport, 1.25, { x: sheetSize.width / 2, y: sheetSize.height / 2 }, { x: sheetSize.width / 2, y: sheetSize.height / 2 }))}>+</button>
      <button type="button" title={copy.zoomOut} aria-label={copy.zoomOut} onClick={() => onViewportChange?.(zoomViewport(viewport, .8, { x: sheetSize.width / 2, y: sheetSize.height / 2 }, { x: sheetSize.width / 2, y: sheetSize.height / 2 }))}>−</button>
      <button type="button" title={copy.resetView} aria-label={copy.resetView} onClick={() => onViewportChange?.(fitViewportToRegion(viewportRegion(project, activePlaceId), sheetSize))}>⌂</button>
    </div>
    <ViewMeasureControls settings={project.measureSettings} copy={copy.measurements ?? fallbackMeasurementCopy} onChange={onMeasureSettingsChange}/>
  </div>;
}

function useStableEvent<Arguments extends unknown[]>(handler: ((...args: Arguments) => void) | undefined) {
  const handlerRef = useRef(handler);
  useEffect(() => { handlerRef.current = handler; }, [handler]);
  return useCallback((...args: Arguments) => handlerRef.current?.(...args), []);
}
