import { memo, useMemo } from "react";
import { constructionNetwork } from "../construction/construction-network";
import type { EditorProject } from "../model/project-model";
import type { WorkLayerId } from "../toolbox/toolbox-model";
import { MapSheetConstruction } from "./map-sheet-construction";
import { MapSheetElements } from "./map-sheet-elements";
import { connectedTransitionsForView, constructionPlaceForView, elementContextDepth, matrixAttribute, relativePlaceMatrix, roomEditingScope, surfaceContextDepth, visiblePlaceGroups } from "./map-sheet-geometry";
import { PlaceShape } from "./map-sheet-shapes";
import { MapSheetSurfaces } from "./map-sheet-surfaces";
import type { MapSelection, MapSheetCopy } from "./map-sheet-types";
import { previewPlaceMatrix } from "./map-resize-preview";
import styles from "./map-sheet.module.css";
import { createLabelLayoutPlan, type LabelCollisionEntry, type LabelLayoutPlan } from "../geometry/label-collision";
import { regionLabelLayout, labelObstaclesForShape } from "../geometry/region-label-layout";
import { roomLabelLayout, type LabelObstacle } from "../geometry/room-label-layout";
import { mapLabelWithArea, mapRegionArea, mapRoomArea } from "../geometry/map-area";
import { ribbonShape, isRibbonElement } from "../geometry/ribbon-geometry";
import { mapLabelObstacles } from "./map-sheet-elements";
import { applyAffinePoint, type AffineMatrix } from "../geometry/affine-transform";
import { createContainedRegionObstacleIndex, type RegionLabelObstacleSource } from "../geometry/contained-region-label-obstacles";
import { selectionKey } from "../drawing/selection-reference";

type MovePreview = { selection: MapSelection; delta: { x: number; y: number } };

type MapSheetSceneProps = {
  project: EditorProject;
  activePlaceId: string;
  prefix: string;
  copy: MapSheetCopy;
  layoutZoom: number;
  labelLayoutZoom: number;
  selected: Set<string>;
  agentFocused: Set<string>;
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
 * room, label and object. Fixed-size controls follow a deferred exact zoom,
 * while expensive label placement advances through stable scale intervals.
 */
export const MapSheetScene = memo(function MapSheetScene({ project, activePlaceId, prefix, copy, layoutZoom, labelLayoutZoom, selected, agentFocused, movingIds, movingTransform, movePreview, openingWidthPreview, selectionEditing, selectionOnly, outlineEditing, selectionLayerId, sketchVisible, sketchOpacity, activeGesture, noteEditing, onSelect, onOpenPlace, onNoteTextChange }: MapSheetSceneProps) {
  const groups = useMemo(() => visiblePlaceGroups(project, activePlaceId), [project, activePlaceId]);
  const constructionOwner = constructionPlaceForView(project, activePlaceId);
  const roomView = groups.active?.kind === "room";
  const activeConstruction = project.constructions.find(({ id }) => id === constructionOwner?.constructionId);
  const contextTransitions = useMemo(() => constructionOwner ? connectedTransitionsForView(project, constructionOwner.id, activeConstruction?.id) : [], [activeConstruction?.id, constructionOwner, project]);
  const network = useMemo(() => activeConstruction ? constructionNetwork(activeConstruction.walls, activeConstruction.enclosure) : undefined, [activeConstruction]);
  const roomScope = useMemo(() => roomView ? roomEditingScope(groups.active, activeConstruction, network) : {}, [activeConstruction, groups.active, network, roomView]);
  const showArea = project.measureSettings.showRoomAreas;
  const units = project.measureSettings.units;
  const labelPlan = useMemo(() => createSceneLabelPlan(project, activePlaceId, groups, activeConstruction, network, constructionOwner, labelLayoutZoom, showArea, units, sketchVisible, movingIds, movePreview?.delta), [activeConstruction, activePlaceId, constructionOwner, groups, labelLayoutZoom, movingIds, movePreview?.delta, network, project, showArea, sketchVisible, units]);
  const placeTransform = (placeId: string) => matrixAttribute(previewPlaceMatrix(project, activePlaceId, placeId, movingIds.has(placeId) ? movePreview?.delta : undefined));

  return <>
    <g className={styles.contextTerrain}><MapSheetElements onNoteTextChange={selectionEditing || noteEditing ? onNoteTextChange : undefined} showArea={showArea} units={units} project={project} activePlaceId={activePlaceId} terrain prefix={prefix} selected={selected} agentFocused={agentFocused} movingIds={movingIds} movingTransform={movingTransform} selectionEditing={selectionEditing} selectionOnly={selectionOnly} selectionLayerId={selectionLayerId} sketchVisible={sketchVisible} sketchOpacity={sketchOpacity} viewportZoom={layoutZoom} labelPlan={labelPlan} onSelect={activeGesture ? undefined : onSelect}/></g>
    <g className={styles.context} aria-hidden="true">{groups.context.filter(({ kind }) => kind !== "level").map((place) => <PlaceShape showArea={showArea} units={units} key={place.id} place={place} transform={matrixAttribute(relativePlaceMatrix(project, activePlaceId, place.id))} labelScope={activePlaceId} labelPlan={labelPlan} mode="context" prefix={prefix} viewportZoom={layoutZoom}/>)}</g>
    {groups.active?.boundary && <PlaceShape showArea={showArea} units={units} place={groups.active} mode="active" prefix={prefix} viewportZoom={layoutZoom} selectable={selectionEditing && outlineEditing || selectionOnly} allowLockedSelection={selectionOnly} resizeHandleSize={5 / layoutZoom} showResizeHandles={outlineEditing && !activeConstruction} selected={selected.has(selectionKey({ kind: "place", id: groups.active.id }))} agentFocused={agentFocused.has(selectionKey({ kind: "place", id: groups.active.id }))} onSelect={activeGesture || selectionEditing && !outlineEditing ? undefined : (additive) => onSelect?.({ kind: "place", id: groups.active!.id }, additive)}/>}
    <g>{groups.children.filter(({ kind }) => kind !== "room" && !(groups.active?.kind === "building" && kind === "level")).map((place) => {
      const layer = place.kind === "building" ? "buildings" : "boundaries";
      const selectable = selectionEditing || selectionOnly;
      const key = selectionKey({ kind: "place", id: place.id });
      return <PlaceShape showArea={showArea} units={units} key={key} place={place} transform={placeTransform(place.id)} labelScope={activePlaceId} labelPlan={labelPlan} mode="child" prefix={prefix} selectionLayer={layer} selectable={selectable} allowLockedSelection={selectionOnly} viewportZoom={layoutZoom} resizeHandleSize={5 / layoutZoom} showResizeHandles={outlineEditing && selectionEditing && selected.has(key)} selected={selected.has(key)} agentFocused={agentFocused.has(key)} onSelect={activeGesture ? undefined : (additive) => onSelect?.({ kind: "place", id: place.id }, additive)} onOpen={activeGesture || selectionEditing || selectionOnly ? undefined : () => onOpenPlace?.(place.id)}/>;
    })}</g>
    <g className={styles.descendants} aria-hidden="true">{groups.descendants.map((place) => <PlaceShape showArea={showArea} units={units} key={place.id} place={place} transform={matrixAttribute(relativePlaceMatrix(project, activePlaceId, place.id))} labelScope={activePlaceId} labelPlan={labelPlan} mode="descendant" prefix={prefix} viewportZoom={layoutZoom}/>)}</g>
    <MapSheetSurfaces showArea={showArea} units={units} project={project} activePlaceId={activePlaceId} prefix={prefix} selected={selected} agentFocused={agentFocused} movingIds={movingIds} movingTransform={movingTransform} selectionEditing={selectionEditing && selectionLayerId === "construction"} selectionOnly={selectionOnly} viewportZoom={layoutZoom} labelPlan={labelPlan} onSelect={onSelect}/>
    {network && activeConstruction && <MapSheetConstruction project={project} document={activeConstruction} network={network} owner={constructionOwner} prefix={prefix} copy={copy} selectedIds={selected} agentFocusedIds={agentFocused} viewportZoom={layoutZoom} roomView={roomView} roomScope={roomScope} activeGesture={activeGesture} selectionEditing={selectionEditing} selectionOnly={selectionOnly} selectionLayerId={selectionLayerId} movingIds={movingIds} moveDelta={movePreview?.delta} openingWidthPreview={openingWidthPreview} labelPlan={labelPlan} onSelect={onSelect} onOpenPlace={onOpenPlace} contextTransitions={contextTransitions}/>}
    <MapSheetElements onNoteTextChange={selectionEditing || noteEditing ? onNoteTextChange : undefined} showArea={showArea} units={units} project={project} activePlaceId={activePlaceId} terrain={false} prefix={prefix} selected={selected} agentFocused={agentFocused} movingIds={movingIds} movingTransform={movingTransform} selectionEditing={selectionEditing} selectionOnly={selectionOnly} selectionLayerId={selectionLayerId} sketchVisible={sketchVisible} sketchOpacity={sketchOpacity} viewportZoom={layoutZoom} labelPlan={labelPlan} onSelect={activeGesture ? undefined : onSelect}/>
  </>;
});

type SceneGroups = ReturnType<typeof visiblePlaceGroups>;

export function createSceneLabelPlan(project: EditorProject, activePlaceId: string, groups: SceneGroups, activeConstruction: typeof project.constructions[number] | undefined, network: ReturnType<typeof constructionNetwork> | undefined, constructionOwner: typeof project.places[number] | undefined, zoom: number, showArea: boolean, units: "metric" | "imperial", sketchVisible: boolean, movingIds: ReadonlySet<string>, moveDelta?: { x: number; y: number }): LabelLayoutPlan {
  const entries: LabelCollisionEntry[] = [];
  addElements(true);
  groups.context.filter(({ kind }) => kind !== "level").forEach((place) => addPlace(place, place.kind === "room"));
  groups.children.filter(({ kind }) => kind !== "room" && !(groups.active?.kind === "building" && kind === "level")).forEach((place) => addPlace(place, true));
  groups.descendants.forEach((place) => addPlace(place, true));
  const surfaces = project.surfaces.flatMap((surface, index) => { const depth = surfaceContextDepth(project, activePlaceId, surface); return depth === undefined || !surface.visible ? [] : [{ surface, depth, index }]; }).toSorted((first, second) => first.depth - second.depth || first.index - second.index);
  for (const { surface } of surfaces) {
    const matrix = translatedMatrix(relativePlaceMatrix(project, activePlaceId, surface.belongsToId), movingIds.has(surface.id) ? moveDelta : undefined);
    addRegion(`surface:${surface.belongsToId}:${surface.id}`, surface.name, surface.shape, matrix, false);
  }
  if (activeConstruction && network && groups.active?.kind !== "room") for (const face of network.faces) {
    const room = activeConstruction.rooms.find(({ faceId }) => faceId === face.id); const roomPlace = room && project.places.find(({ id }) => id === room.id);
    if (!room || room.visible === false || roomPlace?.visible === false) continue;
    const matrix = translatedMatrix(relativePlaceMatrix(project, activePlaceId, constructionOwner?.id ?? activePlaceId), movingIds.has(room.id) ? moveDelta : undefined);
    entries.push({ key: `room:${constructionOwner?.id ?? ""}:${room.id}`, matrix, bounds: face, layout: (obstacles) => roomLabelLayout(mapLabelWithArea(room.name, mapRoomArea(face), units, showArea), face, zoom, { obstacles }) });
  }
  addElements(false);
  return createLabelLayoutPlan(entries);

  function addPlace(place: SceneGroups["children"][number], showLabel: boolean) {
    if (!showLabel || !place.boundary || place.visible === false) return;
    const matrix = movingIds.has(place.id) ? previewPlaceMatrix(project, activePlaceId, place.id, moveDelta) : relativePlaceMatrix(project, activePlaceId, place.id);
    addRegion(`place:${activePlaceId}:${place.id}`, place.name, place.boundary, matrix, place.kind === "location" || place.kind === "custom");
  }

  function addElements(terrain: boolean) {
    const active = project.places.find(({ id }) => id === activePlaceId);
    const staticObstacles = mapLabelObstacles(project, activePlaceId, active, terrain);
    const visible = project.elements.flatMap((element, index) => {
      const depth = elementContextDepth(project, activePlaceId, element);
      if (depth === undefined || !element.visible || element.layerId === "sketch" && !sketchVisible || (element.layerId === "terrain") !== terrain) return [];
      return [{ element, depth, index }];
    }).toSorted((first, second) => {
      return first.depth - second.depth || first.index - second.index;
    });
    const regionSources: RegionLabelObstacleSource[] = visible.flatMap(({ element }) => element.geometry.kind === "region" ? [{ id: element.id, ownerId: element.belongsToId, shape: element.geometry.shape, translation: movingIds.has(element.id) ? moveDelta : undefined }] : []);
    const regionObstacleIndex = createContainedRegionObstacleIndex(regionSources);
    for (const { element } of visible) {
      const baseMatrix = relativePlaceMatrix(project, activePlaceId, element.belongsToId);
      const matrix = translatedMatrix(baseMatrix, movingIds.has(element.id) ? moveDelta : undefined);
      const ownerObstacles = element.belongsToId === activePlaceId ? staticObstacles : transformObstacles(relativePlaceMatrix(project, element.belongsToId, activePlaceId), staticObstacles);
      const shape = element.geometry.kind === "region" ? element.geometry.shape : isRibbonElement(element) ? ribbonShape(element) : undefined;
      if (!shape) continue;
      const containedObstacles = element.geometry.kind === "region" ? regionObstacleIndex.forTarget({ id: element.id, ownerId: element.belongsToId, shape, translation: movingIds.has(element.id) ? moveDelta : undefined }) : [];
      addRegion(`element:${element.belongsToId}:${element.id}`, element.name, shape, matrix, terrain, [...ownerObstacles, ...containedObstacles]);
    }
  }

  function addRegion(key: string, name: string, shape: Parameters<typeof labelObstaclesForShape>[0], matrix: AffineMatrix, boundaryFallback: boolean, localObstacles: readonly LabelObstacle[] = []) {
    entries.push({ key, matrix, bounds: mergedBounds(shape), localObstacles, layout: (obstacles) => regionLabelLayout(mapLabelWithArea(name, mapRegionArea(shape), units, showArea), shape, zoom, boundaryFallback, { obstacles }) });
  }
}

function translatedMatrix(matrix: AffineMatrix, delta?: { x: number; y: number }): AffineMatrix {
  if (!delta) return matrix;
  return [matrix[0], matrix[1], matrix[2], matrix[3], matrix[4] + matrix[0] * delta.x + matrix[2] * delta.y, matrix[5] + matrix[1] * delta.x + matrix[3] * delta.y];
}

function transformObstacles(matrix: AffineMatrix, obstacles: readonly LabelObstacle[]): LabelObstacle[] {
  return obstacles.map(({ outer, holes }) => ({ outer: outer.map((point) => applyAffinePoint(matrix, point)), holes: holes?.map((ring) => ring.map((point) => applyAffinePoint(matrix, point))) }));
}

function mergedBounds(shape: Parameters<typeof labelObstaclesForShape>[0]): LabelObstacle {
  const polygons = labelObstaclesForShape(shape);
  return { outer: polygons.flatMap(({ outer }) => outer) };
}
