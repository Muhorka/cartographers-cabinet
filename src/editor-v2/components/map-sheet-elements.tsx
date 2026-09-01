import type { EditorProject } from "../model/project-model";
import type { WorkLayerId } from "../toolbox/toolbox-model";
import { useMemo } from "react";
import { elementContextDepth, matrixAttribute, relativePlaceMatrix, surfaceContextDepth } from "./map-sheet-geometry";
import { ElementShape } from "./map-sheet-shapes";
import { RoadJunctionMarker } from "../roads/road-junction-marker";
import { constructionNetwork } from "../construction/construction-document";
import { mapLabelWithArea, mapRoomArea } from "../geometry/map-area";
import { labelObstacleForLayout, roomLabelLayout, type LabelObstacle } from "../geometry/room-label-layout";
import { labelObstaclesForShape } from "../geometry/region-label-layout";
import { applyAffinePoint } from "../geometry/affine-transform";

type ElementSelection = { kind: "element"; id: string };

export function MapSheetElements({ project, activePlaceId, terrain, prefix, selected, movingIds, movingTransform, selectionEditing, selectionOnly = false, selectionLayerId, sketchVisible, sketchOpacity, viewportZoom, showArea = false, units = "metric", onSelect, onNoteTextChange }: {
  project: EditorProject;
  activePlaceId: string;
  terrain: boolean;
  prefix: string;
  selected: Set<string>;
  movingIds: Set<string>;
  movingTransform?: string;
  selectionEditing: boolean;
  selectionOnly?: boolean;
  selectionLayerId?: WorkLayerId;
  sketchVisible: boolean;
  sketchOpacity: number;
  viewportZoom: number;
  showArea?: boolean;
  units?: "metric" | "imperial";
  onSelect?(selection: ElementSelection, additive?: boolean): void;
  onNoteTextChange?(id: string, text: string): void;
}) {
  const active = project.places.find(({ id }) => id === activePlaceId);
  const labelObstacles = useMemo(() => mapLabelObstacles(project, activePlaceId, active, terrain, viewportZoom, showArea, units), [project, activePlaceId, active, terrain, viewportZoom, showArea, units]);
  const roomChildren = useMemo(() => new Set(project.places.filter(({ parentId, kind }) => parentId === activePlaceId && kind === "room").map(({ id }) => id)), [project, activePlaceId]);
  const visible = project.elements.flatMap((element, index) => {
    const depth = elementContextDepth(project, activePlaceId, element);
    if (depth === undefined || !element.visible || element.layerId === "sketch" && !sketchVisible || (element.layerId === "terrain") !== terrain) return [];
    return [{ element, depth, index }];
  }).toSorted((first, second) => {
    const activeLayerOrder = Number(first.element.layerId === selectionLayerId) - Number(second.element.layerId === selectionLayerId);
    return activeLayerOrder || first.depth - second.depth || first.index - second.index;
  });
  const rendered = visible.map(({ element, depth }) => {
    const editableOwner = depth === 0 || active?.kind === "level" && roomChildren.has(element.belongsToId);
    const selectableOwner = selectionOnly ? depth !== undefined : editableOwner;
    const editable = editableOwner && selectionEditing && !element.locked;
    const selectable = selectableOwner && (selectionOnly || editable);
    const contextOpacity = depth < 0 ? .42 : .68;
    const ownerTransform = depth === 0 ? undefined : matrixAttribute(relativePlaceMatrix(project, activePlaceId, element.belongsToId));
    const elementObstacles = element.belongsToId === activePlaceId ? labelObstacles : transformLabelObstacles(relativePlaceMatrix(project, element.belongsToId, activePlaceId), labelObstacles);
    return <g key={element.id} transform={ownerTransform}><g transform={movingIds.has(element.id) ? movingTransform : undefined}><ElementShape element={element} opacity={element.layerId === "sketch" ? sketchOpacity : depth === 0 ? 1 : contextOpacity} prefix={prefix} viewportZoom={viewportZoom} pointRadius={5 / viewportZoom} resizeHandleSize={5 / viewportZoom} selectable={selectable} showResizeHandles={editable && selectionLayerId === element.layerId && selected.has(element.id)} selected={selected.has(element.id)} showArea={showArea} units={units} labelObstacles={elementObstacles} onNoteTextChange={editableOwner && !element.locked ? onNoteTextChange : undefined} onSelect={selectable ? (additive) => onSelect?.({ kind: "element", id: element.id }, additive) : undefined}/></g></g>;
  });
  const roads = new Map(project.elements.filter((element) => element.layerId === "roads").map((element) => [element.id, element]));
  const markers = terrain ? [] : (project.roadJunctions ?? []).flatMap((junction) => {
    const junctionRoads = junction.roadIds.map((id) => roads.get(id)); const ownerId = junctionRoads[0]?.belongsToId;
    if (!ownerId || junctionRoads.length < 2 || junctionRoads.some((road) => !road || road.belongsToId !== ownerId || !road.visible)) return [];
    const depth = elementContextDepth(project, activePlaceId, junctionRoads[0]!); if (depth === undefined) return [];
    return [<RoadJunctionMarker key={`junction:${junction.id}`} junction={junction} radius={5 / viewportZoom} opacity={depth < 0 ? .42 : .95} transform={depth === 0 ? undefined : matrixAttribute(relativePlaceMatrix(project, activePlaceId, ownerId))}/>];
  });
  return [...rendered, ...markers];
}

function mapLabelObstacles(project: EditorProject, activePlaceId: string, active: EditorProject["places"][number] | undefined, terrain: boolean, viewportZoom: number, showArea: boolean, units: "metric" | "imperial"): LabelObstacle[] {
  if (terrain) {
    const buildingObstacles = project.places.filter((place) => place.id !== activePlaceId && place.kind === "building" && place.boundary && place.visible !== false).flatMap((place) => transformLabelObstacles(relativePlaceMatrix(project, activePlaceId, place.id), labelObstaclesForShape(place.boundary!)));
    const surfaceObstacles = project.surfaces.filter((surface) => surface.visible && surfaceContextDepth(project, activePlaceId, surface) !== undefined).flatMap((surface) => transformLabelObstacles(relativePlaceMatrix(project, activePlaceId, surface.belongsToId), labelObstaclesForShape(surface.shape)));
    return [...buildingObstacles, ...surfaceObstacles];
  }
  const construction = active?.constructionId ? project.constructions.find(({ id }) => id === active.constructionId) : undefined;
  if (!construction) return [];
  const faces = constructionNetwork(construction.walls, construction.enclosure).faces;
  return construction.rooms.flatMap((room) => {
    const face = faces.find(({ id }) => id === room.faceId); if (!face || room.visible === false) return [];
    const layout = roomLabelLayout(mapLabelWithArea(room.name, mapRoomArea(face), units, showArea), face, viewportZoom);
    return layout ? [labelObstacleForLayout(layout)] : [];
  });
}

function transformLabelObstacles(matrix: ReturnType<typeof relativePlaceMatrix>, obstacles: readonly LabelObstacle[]): LabelObstacle[] {
  return obstacles.map(({ outer, holes }) => ({ outer: outer.map((point) => applyAffinePoint(matrix, point)), holes: holes?.map((hole) => hole.map((point) => applyAffinePoint(matrix, point))) }));
}
