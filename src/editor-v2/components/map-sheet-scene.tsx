import { memo, useMemo } from "react";
import { constructionNetwork } from "../construction/construction-network";
import type { EditorProject } from "../model/project-model";
import type { WorkLayerId } from "../toolbox/toolbox-model";
import { MapSheetConstruction } from "./map-sheet-construction";
import { MapSheetElements } from "./map-sheet-elements";
import { connectedTransitionsForView, constructionPlaceForView, matrixAttribute, relativePlaceMatrix, roomEditingScope, visiblePlaceGroups } from "./map-sheet-geometry";
import { PlaceShape } from "./map-sheet-shapes";
import { MapSheetSurfaces } from "./map-sheet-surfaces";
import type { MapSelection, MapSheetCopy } from "./map-sheet-types";
import { previewPlaceMatrix } from "./map-resize-preview";
import styles from "./map-sheet.module.css";

type MovePreview = { selection: MapSelection; delta: { x: number; y: number } };

type MapSheetSceneProps = {
  project: EditorProject;
  activePlaceId: string;
  prefix: string;
  copy: MapSheetCopy;
  layoutZoom: number;
  selected: Set<string>;
  movingIds: Set<string>;
  movingTransform?: string;
  movePreview?: MovePreview;
  openingWidthPreview?: { id: string; width: number };
  selectionEditing: boolean;
  selectionOnly: boolean;
  outlineEditing: boolean;
  selectionLayerId?: WorkLayerId;
  sketchVisible: boolean;
  sketchOpacity: number;
  activeGesture: boolean;
  noteEditing: boolean;
  onSelect?(selection: MapSelection, additive?: boolean): void;
  onOpenPlace?(placeId: string): void;
  onNoteTextChange?(id: string, text: string): void;
};

/**
 * The project drawing is deliberately isolated from the live viewport transform.
 * Pan and rotation can then update the outer SVG group without rebuilding every
 * room, label and object. Zoom supplies a deferred layoutZoom, so labels and
 * fixed-size handles settle at the exact final scale after the visual transform.
 */
export const MapSheetScene = memo(function MapSheetScene({ project, activePlaceId, prefix, copy, layoutZoom, selected, movingIds, movingTransform, movePreview, openingWidthPreview, selectionEditing, selectionOnly, outlineEditing, selectionLayerId, sketchVisible, sketchOpacity, activeGesture, noteEditing, onSelect, onOpenPlace, onNoteTextChange }: MapSheetSceneProps) {
  const groups = useMemo(() => visiblePlaceGroups(project, activePlaceId), [project, activePlaceId]);
  const constructionOwner = constructionPlaceForView(project, activePlaceId);
  const roomView = groups.active?.kind === "room";
  const activeConstruction = project.constructions.find(({ id }) => id === constructionOwner?.constructionId);
  const contextTransitions = useMemo(() => constructionOwner ? connectedTransitionsForView(project, constructionOwner.id, activeConstruction?.id) : [], [activeConstruction?.id, constructionOwner, project]);
  const network = useMemo(() => activeConstruction ? constructionNetwork(activeConstruction.walls, activeConstruction.enclosure) : undefined, [activeConstruction]);
  const roomScope = useMemo(() => roomView ? roomEditingScope(groups.active, activeConstruction, network) : {}, [activeConstruction, groups.active, network, roomView]);
  const showArea = project.measureSettings.showRoomAreas;
  const units = project.measureSettings.units;
  const placeTransform = (placeId: string) => matrixAttribute(previewPlaceMatrix(project, activePlaceId, placeId, movingIds.has(placeId) ? movePreview?.delta : undefined));

  return <>
    <g className={styles.contextTerrain}><MapSheetElements onNoteTextChange={selectionEditing || noteEditing ? onNoteTextChange : undefined} showArea={showArea} units={units} project={project} activePlaceId={activePlaceId} terrain prefix={prefix} selected={selected} movingIds={movingIds} movingTransform={movingTransform} selectionEditing={selectionEditing} selectionOnly={selectionOnly} selectionLayerId={selectionLayerId} sketchVisible={sketchVisible} sketchOpacity={sketchOpacity} viewportZoom={layoutZoom} onSelect={activeGesture ? undefined : onSelect}/></g>
    <g className={styles.context} aria-hidden="true">{groups.context.filter(({ kind }) => kind !== "level").map((place) => <PlaceShape showArea={showArea} units={units} key={place.id} place={place} transform={matrixAttribute(relativePlaceMatrix(project, activePlaceId, place.id))} mode="context" prefix={prefix} viewportZoom={layoutZoom}/>)}</g>
    {groups.active?.boundary && <PlaceShape showArea={showArea} units={units} place={groups.active} mode="active" prefix={prefix} viewportZoom={layoutZoom} selectable={selectionEditing && outlineEditing || selectionOnly} allowLockedSelection={selectionOnly} resizeHandleSize={5 / layoutZoom} showResizeHandles={outlineEditing && !activeConstruction} selected={selected.has(groups.active.id)} onSelect={activeGesture || selectionEditing && !outlineEditing ? undefined : (additive) => onSelect?.({ kind: "place", id: groups.active!.id }, additive)}/>}
    <g>{groups.children.filter(({ kind }) => kind !== "room" && !(groups.active?.kind === "building" && kind === "level")).map((place) => {
      const layer = place.kind === "building" ? "buildings" : "boundaries";
      const selectable = selectionEditing || selectionOnly;
      return <PlaceShape showArea={showArea} units={units} key={place.id} place={place} transform={placeTransform(place.id)} mode="child" prefix={prefix} selectionLayer={layer} selectable={selectable} allowLockedSelection={selectionOnly} viewportZoom={layoutZoom} resizeHandleSize={5 / layoutZoom} showResizeHandles={outlineEditing && selectionEditing && selected.has(place.id)} selected={selected.has(place.id)} onSelect={activeGesture ? undefined : (additive) => onSelect?.({ kind: "place", id: place.id }, additive)} onOpen={activeGesture || selectionEditing || selectionOnly ? undefined : () => onOpenPlace?.(place.id)}/>;
    })}</g>
    <g className={styles.descendants} aria-hidden="true">{groups.descendants.map((place) => <PlaceShape showArea={showArea} units={units} key={place.id} place={place} transform={matrixAttribute(relativePlaceMatrix(project, activePlaceId, place.id))} mode="descendant" prefix={prefix} viewportZoom={layoutZoom}/>)}</g>
    <MapSheetSurfaces showArea={showArea} units={units} project={project} activePlaceId={activePlaceId} prefix={prefix} selected={selected} movingIds={movingIds} movingTransform={movingTransform} selectionEditing={selectionEditing && selectionLayerId === "construction"} selectionOnly={selectionOnly} viewportZoom={layoutZoom} onSelect={(id, additive) => onSelect?.({ kind: "surface", id }, additive)}/>
    {network && activeConstruction && <MapSheetConstruction project={project} document={activeConstruction} network={network} owner={constructionOwner} prefix={prefix} copy={copy} selectedIds={selected} viewportZoom={layoutZoom} roomView={roomView} roomScope={roomScope} activeGesture={activeGesture} selectionEditing={selectionEditing} selectionOnly={selectionOnly} selectionLayerId={selectionLayerId} movingIds={movingIds} moveDelta={movePreview?.delta} openingWidthPreview={openingWidthPreview} onSelect={onSelect} onOpenPlace={onOpenPlace} contextTransitions={contextTransitions}/>} 
    <MapSheetElements onNoteTextChange={selectionEditing || noteEditing ? onNoteTextChange : undefined} showArea={showArea} units={units} project={project} activePlaceId={activePlaceId} terrain={false} prefix={prefix} selected={selected} movingIds={movingIds} movingTransform={movingTransform} selectionEditing={selectionEditing} selectionOnly={selectionOnly} selectionLayerId={selectionLayerId} sketchVisible={sketchVisible} sketchOpacity={sketchOpacity} viewportZoom={layoutZoom} onSelect={activeGesture ? undefined : onSelect}/>
  </>;
});
