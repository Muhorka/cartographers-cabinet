import type { WorkbenchCopy } from "../i18n/workbench-copy";
import type { EditorProject } from "../model/project-model";
import type { MapSelection } from "./map-sheet";
import { PlanningSelectionActions, type PlanningSelectionCopy } from "../planning/planning-selection-actions";
import { isFlowingWater, isRibbonElement } from "../geometry/ribbon-geometry";
import styles from "./selection-action-strip.module.css";
import type { ReactNode } from "react";

type Props = {
  rotationControl?: ReactNode;
  selections: MapSelection[];
  project: EditorProject;
  copy: WorkbenchCopy;
  onDelete(selections: MapSelection[]): void;
  onDuplicate(ids: string[]): void;
  onRotate(ids: string[], degrees: -90 | 90): void;
  onMirror(ids: string[], axis: "horizontal" | "vertical"): void;
  onMerge(ids: string[]): void;
  onJoinRoads?(ids: string[]): void;
  onDuplicateSurfaces(ids: string[]): void;
  onTransformSurfaces(ids: string[], transformation: { kind: "rotate"; degrees: -90 | 90 } | { kind: "mirror"; axis: "horizontal" | "vertical" }): void;
  onMergeSurfaces(ids: string[]): void;
  onMergeRooms(ids: string[]): void;
  onDuplicateRooms(ids: string[]): void;
  onTransformRooms(ids: string[], transformation: { kind: "rotate"; degrees: -90 | 90 } | { kind: "mirror"; axis: "horizontal" | "vertical" }): void;
  onDuplicatePlaces(ids: string[]): void;
  onTransformPlaces(ids: string[], transformation: { kind: "rotate"; degrees: -90 | 90 } | { kind: "mirror"; axis: "horizontal" | "vertical" }): void;
  onMergePlaces(ids: string[], mode: "outer-only" | "keep-partitions"): void;
  planningActions?: {
    onAlign(axis: "horizontal" | "vertical", edge: "start" | "center" | "end"): void;
    onDistribute(axis: "horizontal" | "vertical"): void;
    canAlign?: boolean;
    canDistribute?: boolean;
    copy?: PlanningSelectionCopy;
  };
};

export function SelectionActionStrip(props: Props) {
  if (!props.selections.length) return null;
  const elementIds = props.selections.filter(({ kind }) => kind === "element").map(({ id }) => id);
  const roomIds = props.selections.filter(({ kind }) => kind === "room").map(({ id }) => id);
  const placeIds = props.selections.filter(({ kind }) => kind === "place").map(({ id }) => id);
  const surfaceIds = props.selections.filter(({ kind }) => kind === "surface").map(({ id }) => id);
  const allElements = elementIds.length === props.selections.length;
  const allRooms = roomIds.length > 0 && roomIds.length === props.selections.length;
  const allPlaces = placeIds.length === props.selections.length;
  const allSurfaces = surfaceIds.length > 0 && surfaceIds.length === props.selections.length;
  const elements = props.project.elements.filter(({ id }) => elementIds.includes(id)); const first = elements[0];
  const onJoinRoads = props.onJoinRoads;
  const places = placeIds.flatMap((id) => props.project.places.find((place) => place.id === id) ?? []); const firstPlace = places[0];
  const canMerge = elements.length > 1 && elements.every((element) => element.geometry.kind === "region" && element.belongsToId === first?.belongsToId && element.layerId === first.layerId && element.subjectId === first.subjectId);
  const canJoinRoads = elements.length === 2 && allElements && elements.every((element) => isRibbonElement(element) && (element.geometry.kind === "path" || element.geometry.kind === "bezier") && !element.geometry.closed && element.belongsToId === first?.belongsToId) && (elements.every((element) => element.layerId === "roads") || elements.every(isFlowingWater));
  const canTransformPlaces = allPlaces && places.length > 0 && places.every(({ kind, parentId }) => parentId && parentId === firstPlace?.parentId && !["world", "level", "room"].includes(kind));
  const canMergePlaces = canTransformPlaces && places.length > 1 && places.every(({ kind, boundary }) => kind === firstPlace?.kind && boundary);
  const surfaces = props.project.surfaces.filter(({ id }) => surfaceIds.includes(id)); const firstSurface = surfaces[0]; const canMergeSurfaces = allSurfaces && surfaces.length > 1 && surfaces.every(({ kind, belongsToId }) => kind === firstSurface?.kind && belongsToId === firstSurface?.belongsToId);
  const canDelete = props.selections.every(({ kind }) => kind !== "place");
  return <section className={styles.strip} aria-label={props.copy.selectionActions.title}>
    <strong>{props.copy.selectedCount(props.selections.length)}</strong>
    {props.rotationControl}
    {props.planningActions && <PlanningSelectionActions
      count={props.selections.length}
      canAlign={props.planningActions.canAlign}
      canDistribute={props.planningActions.canDistribute}
      onAlign={props.planningActions.onAlign}
      onDistribute={props.planningActions.onDistribute}
      copy={props.planningActions.copy}
    />}
    {allElements && <Action icon="copy" label={props.copy.selectionActions.duplicate} onClick={() => props.onDuplicate(elementIds)}/>}
    {!props.rotationControl && allElements && <Action icon="left" label={props.copy.selectionActions.rotateLeft} onClick={() => props.onRotate(elementIds, -90)}/>}
    {!props.rotationControl && allElements && <Action icon="right" label={props.copy.selectionActions.rotateRight} onClick={() => props.onRotate(elementIds, 90)}/>}
    {allElements && <Action icon="mirrorX" label={props.copy.selectionActions.mirrorHorizontal} onClick={() => props.onMirror(elementIds, "horizontal")}/>}
    {allElements && <Action icon="mirrorY" label={props.copy.selectionActions.mirrorVertical} onClick={() => props.onMirror(elementIds, "vertical")}/>}
    {canMerge && <Action icon="merge" label={props.copy.selectionActions.merge} onClick={() => props.onMerge(elementIds)}/>}
    {canJoinRoads && onJoinRoads && <Action icon="merge" label={props.copy.selectionActions.merge} onClick={() => onJoinRoads(elementIds)}/>}
    {allSurfaces && <Action icon="copy" label={props.copy.selectionActions.duplicate} onClick={() => props.onDuplicateSurfaces(surfaceIds)}/>}
    {!props.rotationControl && allSurfaces && <Action icon="left" label={props.copy.selectionActions.rotateLeft} onClick={() => props.onTransformSurfaces(surfaceIds, { kind: "rotate", degrees: -90 })}/>}
    {!props.rotationControl && allSurfaces && <Action icon="right" label={props.copy.selectionActions.rotateRight} onClick={() => props.onTransformSurfaces(surfaceIds, { kind: "rotate", degrees: 90 })}/>}
    {allSurfaces && <Action icon="mirrorX" label={props.copy.selectionActions.mirrorHorizontal} onClick={() => props.onTransformSurfaces(surfaceIds, { kind: "mirror", axis: "horizontal" })}/>}
    {allSurfaces && <Action icon="mirrorY" label={props.copy.selectionActions.mirrorVertical} onClick={() => props.onTransformSurfaces(surfaceIds, { kind: "mirror", axis: "vertical" })}/>}
    {canMergeSurfaces && <Action icon="merge" label={props.copy.selectionActions.merge} onClick={() => props.onMergeSurfaces(surfaceIds)}/>}
    {allRooms && <Action icon="copy" label={props.copy.selectionActions.duplicate} onClick={() => props.onDuplicateRooms(roomIds)}/>}
    {!props.rotationControl && allRooms && <Action icon="left" label={props.copy.selectionActions.rotateLeft} onClick={() => props.onTransformRooms(roomIds, { kind: "rotate", degrees: -90 })}/>}
    {!props.rotationControl && allRooms && <Action icon="right" label={props.copy.selectionActions.rotateRight} onClick={() => props.onTransformRooms(roomIds, { kind: "rotate", degrees: 90 })}/>}
    {allRooms && <Action icon="mirrorX" label={props.copy.selectionActions.mirrorHorizontal} onClick={() => props.onTransformRooms(roomIds, { kind: "mirror", axis: "horizontal" })}/>}
    {allRooms && <Action icon="mirrorY" label={props.copy.selectionActions.mirrorVertical} onClick={() => props.onTransformRooms(roomIds, { kind: "mirror", axis: "vertical" })}/>}
    {allRooms && roomIds.length > 1 && <Action icon="merge" label={props.copy.selectionActions.mergeRooms} onClick={() => props.onMergeRooms(roomIds)}/>}
    {canTransformPlaces && <Action icon="copy" label={props.copy.selectionActions.duplicate} onClick={() => props.onDuplicatePlaces(placeIds)}/>}
    {!props.rotationControl && canTransformPlaces && <Action icon="left" label={props.copy.selectionActions.rotateLeft} onClick={() => props.onTransformPlaces(placeIds, { kind: "rotate", degrees: -90 })}/>}
    {!props.rotationControl && canTransformPlaces && <Action icon="right" label={props.copy.selectionActions.rotateRight} onClick={() => props.onTransformPlaces(placeIds, { kind: "rotate", degrees: 90 })}/>}
    {canTransformPlaces && <Action icon="mirrorX" label={props.copy.selectionActions.mirrorHorizontal} onClick={() => props.onTransformPlaces(placeIds, { kind: "mirror", axis: "horizontal" })}/>}
    {canTransformPlaces && <Action icon="mirrorY" label={props.copy.selectionActions.mirrorVertical} onClick={() => props.onTransformPlaces(placeIds, { kind: "mirror", axis: "vertical" })}/>}
    {canMergePlaces && firstPlace?.kind !== "building" && <Action icon="merge" label={props.copy.selectionActions.merge} onClick={() => props.onMergePlaces(placeIds, "outer-only")}/>}
    {canMergePlaces && firstPlace?.kind === "building" && <><Action icon="merge" label={props.copy.overlapDecision.outerOnly} onClick={() => props.onMergePlaces(placeIds, "outer-only")}/><Action icon="merge" label={props.copy.overlapDecision.keepPartitions} onClick={() => props.onMergePlaces(placeIds, "keep-partitions")}/></>}
    {canDelete && <Action icon="delete" label={props.copy.delete} destructive onClick={() => props.onDelete(props.selections)}/>}
  </section>;
}

type Icon = "copy" | "left" | "right" | "mirrorX" | "mirrorY" | "merge" | "delete";
function Action({ icon, label, destructive, onClick }: { icon: Icon; label: string; destructive?: boolean; onClick(): void }) {
  return <button type="button" className={destructive ? styles.destructive : undefined} title={label} onClick={onClick}><Glyph icon={icon}/><span>{label}</span></button>;
}

function Glyph({ icon }: { icon: Icon }) {
  const path = icon === "copy" ? <><rect x="5" y="3" width="8" height="8"/><path d="M3 6v7h7"/></> : icon === "left" ? <><path d="M5 5H2l3-3"/><path d="M3 5a5 5 0 1 0 2-2"/></> : icon === "right" ? <><path d="M11 5h3l-3-3"/><path d="M13 5a5 5 0 1 1-2-2"/></> : icon === "mirrorX" ? <><path d="M8 2v12" strokeDasharray="2 2"/><path d="m6 4-4 4 4 4m4-8 4 4-4 4"/></> : icon === "mirrorY" ? <><path d="M2 8h12" strokeDasharray="2 2"/><path d="m4 6 4-4 4 4m-8 4 4 4 4-4"/></> : icon === "merge" ? <><path d="M2 5h5v6H2zM9 5h5v6H9z"/><path d="M6 8h4"/></> : <><path d="M4 5h8l-1 9H5L4 5Z"/><path d="M3 5h10M6 5V2h4v3"/></>;
  return <svg viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round">{path}</svg>;
}
