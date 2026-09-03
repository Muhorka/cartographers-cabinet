import type { KeyboardEvent } from "react";
import type { ConstructionDocument } from "../construction/construction-document";
import type { KernelPoint, WallNetworkResult } from "../geometry/geometry-types";
import { roomLabelLayout } from "../geometry/room-label-layout";
import { mapLabelWithArea, mapRoomArea } from "../geometry/map-area";
import type { EditorProject, PlaceNode } from "../model/project-model";
import type { WorkLayerId } from "../toolbox/toolbox-model";
import { MapSheetFeatures } from "./map-sheet-features";
import { MapSheetRegionLabel } from "./map-sheet-region-label";
import { roomPath } from "./map-sheet-geometry";
import type { MapSelection, MapSheetCopy } from "./map-sheet";
import type { TransitionView } from "./map-sheet-geometry";
import styles from "./map-sheet.module.css";
import type { LabelLayoutPlan } from "../geometry/label-collision";
import { createProjectStoryLabelResolver } from "../story/object-display-name";
import { selectionKey } from "../drawing/selection-reference";
import { svgId } from "../geometry/svg-id";

type RoomScope = { wallIds?: ReadonlySet<string>; transitionIds?: ReadonlySet<string> };

export function MapSheetConstruction({ project, document, network, owner, prefix, copy, selectedIds, viewportZoom, roomView, roomScope, activeGesture, selectionEditing, selectionOnly = false, selectionLayerId, movingIds, moveDelta, openingWidthPreview, labelPlan, onSelect, onOpenPlace, contextTransitions = [] }: {
  project: EditorProject;
  document: ConstructionDocument;
  network: WallNetworkResult;
  owner?: PlaceNode;
  prefix: string;
  copy: MapSheetCopy;
  selectedIds: Set<string>;
  viewportZoom: number;
  roomView: boolean;
  roomScope: RoomScope;
  activeGesture: boolean;
  selectionEditing: boolean;
  selectionOnly?: boolean;
  selectionLayerId?: WorkLayerId;
  movingIds: ReadonlySet<string>;
  moveDelta?: KernelPoint;
  openingWidthPreview?: { id: string; width: number };
  labelPlan?: LabelLayoutPlan;
  onSelect?(selection: MapSelection, additive?: boolean): void;
  onOpenPlace?(placeId: string): void;
  contextTransitions?: readonly TransitionView[];
}) {
  const movedWallIds = new Set([...movingIds].filter((id) => document.walls.some((wall) => wall.id === id)));
  for (const room of document.rooms.filter(({ id }) => movingIds.has(id))) {
    for (const wallId of network.faces.find(({ id }) => id === room.faceId)?.wallIds ?? []) movedWallIds.add(wallId);
  }
  const translated = (moving: boolean) => moving && moveDelta ? `translate(${moveDelta.x} ${moveDelta.y})` : undefined;
  const storyLabel = createProjectStoryLabelResolver(project);

  return <g className={`${styles.construction}${roomView ? ` ${styles.roomViewConstruction}` : ""}`}>
    {!roomView && network.faces.map((face) => {
      const room = document.rooms.find(({ faceId }) => faceId === face.id); if (!room) return null;
      const roomPlace = project.places.find(({ id }) => id === room.id); if (room.visible === false || roomPlace?.visible === false) return null; const appearance = roomPlace?.appearance ?? owner?.appearance;
      const clipId = `${svgId(prefix)}-room-${svgId(room.id)}`; const canOpen = project.places.some(({ id }) => id === room.id);
      const selectable = !activeGesture && (selectionOnly || selectionEditing) && (selectionOnly || room.locked !== true && roomPlace?.locked !== true); const editable = selectionEditing && !activeGesture && room.locked !== true && roomPlace?.locked !== true; const interactive = !activeGesture && (!selectionEditing || editable || selectionOnly); const displayName = mapLabelWithArea(room.name, mapRoomArea(face), project.measureSettings.units, project.measureSettings.showRoomAreas); const label = (labelPlan?.get(`room:${owner?.id ?? ""}:${room.id}`) as ReturnType<typeof roomLabelLayout> | undefined) ?? roomLabelLayout(displayName, face, viewportZoom);
      const canNavigate = canOpen && !selectionEditing;
      const roomSelected = selectedIds.has(selectionKey({ kind: "room", id: room.id, scopeId: document.id }));
      return <g key={`${document.id}:${room.id}`} className={styles.roomTarget} style={interactive || canNavigate ? undefined : { pointerEvents: "none" }} transform={translated(movingIds.has(room.id))} data-selectable={selectable ? "true" : undefined} data-selection-layer={selectable ? "construction" : undefined} data-selection-kind={selectable ? "room" : undefined} data-selection-id={selectable ? room.id : undefined} data-selection-scope={selectable ? document.id : undefined} role={interactive || canNavigate ? "button" : undefined} tabIndex={interactive || canNavigate ? 0 : undefined} aria-label={interactive || canNavigate ? room.name : undefined} onClick={interactive ? (event) => { event.stopPropagation(); onSelect?.({ kind: "room", id: room.id, scopeId: document.id }, additiveSelection(event)); } : undefined} onDoubleClick={canNavigate && !activeGesture ? (event) => { event.stopPropagation(); onOpenPlace?.(room.id); } : undefined} onKeyDown={(event) => { if (event.key === "Enter" && canNavigate && !activeGesture) { event.preventDefault(); onOpenPlace?.(room.id); } else activateByKeyboard(event, () => { if (interactive) onSelect?.({ kind: "room", id: room.id, scopeId: document.id }); }); }}>
        <defs><clipPath id={clipId}><path d={roomPath(face)} fillRule="evenodd"/></clipPath></defs>
        <path d={roomPath(face)} fillRule="evenodd" style={appearance ? { fill: appearance.fillColor, fillOpacity: appearance.fillOpacity } : undefined} className={`${styles.room}${roomSelected ? ` ${styles.selected}` : ""}`}/>
        {roomSelected && <path d={roomPath(face)} fillRule="evenodd" className={styles.roomSelection} aria-hidden="true"/>}
        {label && <MapSheetRegionLabel layout={{ kind: "inside", ...label }} clipId={clipId} pathId={`${clipId}-label-path`} />}<title>{room.name}</title>
      </g>;
    })}
    {document.walls.filter((wall) => wall.visible !== false).map((wall) => {
      const wallInScope = !roomScope.wallIds || roomScope.wallIds.has(wall.id); const wallSelectable = !activeGesture && (selectionOnly || selectionEditing) && wallInScope && (selectionOnly || wall.locked !== true);
      const selected = selectedIds.has(selectionKey({ kind: "wall", id: wall.id, scopeId: document.id }));
      return <g key={`${document.id}:${wall.id}`} transform={translated(movedWallIds.has(wall.id))} className={`${selected ? styles.selectedWall : ""}${roomView && !wallSelectable ? ` ${styles.contextWall}` : ""}`}>
        <line className={`${styles.wall} ${styles[`wall_${wall.role}`]}`} data-wall-role={wall.role} x1={wall.start.x} y1={wall.start.y} x2={wall.end.x} y2={wall.end.y}/>
        <line className={styles.wallHit} x1={wall.start.x} y1={wall.start.y} x2={wall.end.x} y2={wall.end.y} data-selectable={wallSelectable ? "true" : undefined} data-selection-layer={wallSelectable ? "construction" : undefined} data-selection-kind={wallSelectable ? "wall" : undefined} data-selection-id={wallSelectable ? wall.id : undefined} data-selection-scope={wallSelectable ? document.id : undefined} role={wallSelectable ? "button" : undefined} tabIndex={wallSelectable ? 0 : undefined} aria-label={wallSelectable ? wall.id : undefined} onClick={wallSelectable ? (event) => { event.stopPropagation(); onSelect?.({ kind: "wall", id: wall.id, scopeId: document.id }, additiveSelection(event)); } : undefined} onKeyDown={wallSelectable ? (event) => activateByKeyboard(event, () => onSelect?.({ kind: "wall", id: wall.id, scopeId: document.id })) : undefined}/>
        {selectionEditing && selectionLayerId === "construction" && selected && <><circle className={styles.wallEndpoint} cx={wall.start.x} cy={wall.start.y} r={5 / viewportZoom} data-wall-endpoint="start" data-wall-id={wall.id} data-wall-scope={document.id}/><circle className={styles.wallEndpoint} cx={wall.end.x} cy={wall.end.y} r={5 / viewportZoom} data-wall-endpoint="end" data-wall-id={wall.id} data-wall-scope={document.id}/></>}
      </g>;
    })}
    <MapSheetFeatures document={document} prefix={prefix} selectedIds={selectedIds} copy={copy} storyLabel={storyLabel} viewportZoom={viewportZoom} selectionEnabled={(selectionOnly || selectionEditing) && !activeGesture} selectionOnly={selectionOnly} selectableOpeningWallIds={roomScope.wallIds} selectableTransitionIds={roomScope.transitionIds} movingIds={movingIds} movingWallIds={movedWallIds} moveDelta={moveDelta} openingWidthPreview={openingWidthPreview} onSelect={activeGesture ? undefined : onSelect} transitionOverrides={[...document.transitions.map((transition, index) => ({ transition, scopeId: document.id, index })), ...contextTransitions]}/>
  </g>;
}

function activateByKeyboard(event: KeyboardEvent<SVGGElement | SVGLineElement>, action?: () => void) { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.stopPropagation(); action?.(); } }
function additiveSelection(event: { ctrlKey: boolean; metaKey: boolean; shiftKey: boolean }) { return event.ctrlKey || event.metaKey || event.shiftKey; }
