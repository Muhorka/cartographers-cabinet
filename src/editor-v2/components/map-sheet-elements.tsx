import type { EditorProject } from "../model/project-model";
import type { WorkLayerId } from "../toolbox/toolbox-model";
import { useMemo } from "react";
import { elementContextDepth, matrixAttribute, relativePlaceMatrix, surfaceContextDepth } from "./map-sheet-geometry";
import { ElementShape } from "./map-sheet-shapes";
import { RoadJunctionMarker } from "../roads/road-junction-marker";
import { type LabelObstacle } from "../geometry/room-label-layout";
import { labelObstaclesForShape } from "../geometry/region-label-layout";
import { applyAffinePoint } from "../geometry/affine-transform";
import type { LabelLayoutPlan } from "../geometry/label-collision";
import { selectionKey } from "../drawing/selection-reference";

type ElementSelection = { kind: "element"; id: string };
const emptyAgentFocus = new Set<string>();

export function MapSheetElements({ project, activePlaceId, terrain, prefix, selected, agentFocused = emptyAgentFocus, movingIds, movingTransform, selectionEditing, selectionOnly = false, selectionLayerId, sketchVisible, sketchOpacity, viewportZoom, showArea = false, units = "metric", labelPlan, onSelect, onNoteTextChange }: {
  project: EditorProject;
  activePlaceId: string;
  terrain: boolean;
  prefix: string;
  selected: Set<string>;
  agentFocused?: Set<string>;
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
  labelPlan?: LabelLayoutPlan;
  onSelect?(selection: ElementSelection, additive?: boolean): void;
  onNoteTextChange?(id: string, text: string): void;
}) {
  const active = project.places.find(({ id }) => id === activePlaceId);
  const labelObstacles = useMemo(() => mapLabelObstacles(project, activePlaceId, active, terrain), [project, activePlaceId, active, terrain]);
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
    const selectedKey = selectionKey({ kind: "element", id: element.id });
    return <g key={selectedKey} transform={ownerTransform}><g transform={movingIds.has(element.id) ? movingTransform : undefined}><ElementShape element={element} opacity={element.layerId === "sketch" ? sketchOpacity : depth === 0 ? 1 : contextOpacity} prefix={prefix} viewportZoom={viewportZoom} pointRadius={5 / viewportZoom} resizeHandleSize={5 / viewportZoom} selectable={selectable} showResizeHandles={editable && selectionLayerId === element.layerId && selected.has(selectedKey)} selected={selected.has(selectedKey)} agentFocused={agentFocused.has(selectedKey)} showArea={showArea} units={units} labelObstacles={elementObstacles} labelPlan={labelPlan} onNoteTextChange={editableOwner && !element.locked ? onNoteTextChange : undefined} onSelect={selectable ? (additive) => onSelect?.({ kind: "element", id: element.id }, additive) : undefined}/></g></g>;
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

export function mapLabelObstacles(project: EditorProject, activePlaceId: string, active: EditorProject["places"][number] | undefined, terrain: boolean): LabelObstacle[] {
  if (terrain) {
    const buildingObstacles = project.places.filter((place) => place.id !== activePlaceId && place.kind === "building" && place.boundary && place.visible !== false).flatMap((place) => transformLabelObstacles(relativePlaceMatrix(project, activePlaceId, place.id), labelObstaclesForShape(place.boundary!)));
    const surfaceObstacles = project.surfaces.filter((surface) => surface.visible && surfaceContextDepth(project, activePlaceId, surface) !== undefined).flatMap((surface) => transformLabelObstacles(relativePlaceMatrix(project, activePlaceId, surface.belongsToId), labelObstaclesForShape(surface.shape)));
    return [...buildingObstacles, ...surfaceObstacles];
  }
  return [];
}

function transformLabelObstacles(matrix: ReturnType<typeof relativePlaceMatrix>, obstacles: readonly LabelObstacle[]): LabelObstacle[] {
  return obstacles.map(({ outer, holes }) => ({ outer: outer.map((point) => applyAffinePoint(matrix, point)), holes: holes?.map((hole) => hole.map((point) => applyAffinePoint(matrix, point))) }));
}
