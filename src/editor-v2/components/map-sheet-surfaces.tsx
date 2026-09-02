import type { KeyboardEvent } from "react";
import { regionLabelLayout } from "../geometry/region-label-layout";
import { regionCorner, type ResizeCorner } from "../geometry/region-resize";
import { regionVertices } from "../geometry/region-vertex-edit";
import type { EditorProject } from "../model/project-model";
import { matrixAttribute, regionPath, relativePlaceMatrix, surfaceContextDepth } from "./map-sheet-geometry";
import styles from "./map-sheet.module.css";
import type { LabelLayoutPlan } from "../geometry/label-collision";
import { MapSheetRegionLabel } from "./map-sheet-region-label";
import { mapLabelWithArea, mapRegionArea } from "../geometry/map-area";

export function MapSheetSurfaces({ project, activePlaceId, prefix, selected, movingIds, movingTransform, selectionEditing, selectionOnly = false, viewportZoom, showArea = false, units = "metric", labelPlan, onSelect }: {
  project: EditorProject;
  activePlaceId: string;
  prefix: string;
  selected: Set<string>;
  movingIds: Set<string>;
  movingTransform?: string;
  selectionEditing: boolean;
  selectionOnly?: boolean;
  viewportZoom: number;
  showArea?: boolean;
  units?: "metric" | "imperial";
  labelPlan?: LabelLayoutPlan;
  onSelect?(id: string, additive?: boolean): void;
}) {
  const visible = project.surfaces.flatMap((surface, index) => {
    const depth = surfaceContextDepth(project, activePlaceId, surface);
    return depth === undefined || !surface.visible ? [] : [{ surface, depth, index }];
  }).toSorted((first, second) => first.depth - second.depth || first.index - second.index);
  return visible.map(({ surface, depth }) => {
    const editable = depth === 0 && selectionEditing; const selectable = depth !== undefined && (selectionOnly || editable); const isSelected = selected.has(surface.id);
    const ownerTransform = depth === 0 ? undefined : matrixAttribute(relativePlaceMatrix(project, activePlaceId, surface.belongsToId));
    const clipId = `${prefix}-surface-${safeId(surface.id)}`; const label = (labelPlan?.get(`surface:${surface.belongsToId}:${surface.id}`) as ReturnType<typeof regionLabelLayout> | undefined) ?? regionLabelLayout(mapLabelWithArea(surface.name, mapRegionArea(surface.shape), units, showArea), surface.shape, viewportZoom, false);
    const vertices = regionVertices(surface.shape); const corners: ResizeCorner[] = ["north-west", "north-east", "south-east", "south-west"];
    return <g key={surface.id} transform={ownerTransform}><g transform={movingIds.has(surface.id) ? movingTransform : undefined} className={`${styles.surface}${isSelected ? ` ${styles.selected}` : ""}`} style={{ opacity: depth === 0 ? 1 : depth < 0 ? .44 : .68, pointerEvents: selectable ? undefined : "none" }} data-selectable={selectable ? "true" : undefined} data-selection-layer={selectable ? "construction" : undefined} data-selection-kind={selectable ? "surface" : undefined} data-selection-id={selectable ? surface.id : undefined} role={selectable ? "button" : undefined} tabIndex={selectable ? 0 : undefined} aria-label={selectable ? surface.name : undefined} onClick={selectable ? (event) => { event.stopPropagation(); onSelect?.(surface.id, additive(event)); } : undefined} onKeyDown={selectable ? (event) => activate(event, () => onSelect?.(surface.id)) : undefined}>
      <defs><clipPath id={clipId}><path d={regionPath(surface.shape)} fillRule="evenodd"/></clipPath>{label?.kind === "boundary" && <path id={`${clipId}-label-path`} d={label.path}/>}</defs>
      <path className={styles.surfaceRegion} style={{ fill: surface.appearance?.fillColor, fillOpacity: surface.appearance?.fillOpacity }} d={regionPath(surface.shape)} fillRule="evenodd"/>
      {label && <MapSheetRegionLabel layout={label} clipId={clipId} pathId={`${clipId}-label-path`}/>}
      {editable && isSelected && (vertices.length ? vertices.map(({ polygonIndex, vertexIndex, point }) => <circle key={`${polygonIndex}:${vertexIndex}`} className={styles.resizeHandle} cx={point.x} cy={point.y} r={5 / viewportZoom} data-region-polygon={polygonIndex} data-region-vertex={vertexIndex} data-surface-id={surface.id}/>) : corners.map((corner) => { const point = regionCorner(surface.shape, corner); return <circle key={corner} className={styles.resizeHandle} cx={point.x} cy={point.y} r={5 / viewportZoom} data-resize-corner={corner} data-surface-id={surface.id}/>; }))}
      <title>{surface.name}</title>
    </g></g>;
  });
}

function safeId(id: string) { return id.replaceAll(/[^a-zA-Z0-9_-]/g, "-"); }
function additive(event: { ctrlKey: boolean; metaKey: boolean; shiftKey: boolean }) { return event.ctrlKey || event.metaKey || event.shiftKey; }
function activate(event: KeyboardEvent<SVGGElement>, action: () => void) { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.stopPropagation(); action(); } }
