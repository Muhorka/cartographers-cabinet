import type { DrawingElement } from "../model/project-model";
import { ribbonEdges, ribbonShape, ribbonWidth } from "../geometry/ribbon-geometry";
import { ribbonAppearance } from "../geometry/ribbon-style";
import { regionPath } from "./map-sheet-geometry";
import styles from "./map-sheet.module.css";
import { PathAnchorHandles } from "./path-anchor-handles";
import { mapLabelWithArea, mapRegionArea } from "../geometry/map-area";
import { regionLabelLayout } from "../geometry/region-label-layout";
import { MapSheetRegionLabel } from "./map-sheet-region-label";

export function RoadShape({ element, prefix, zoom, handles, selected, showArea = false, units = "metric" }: { element: DrawingElement; prefix: string; zoom: number; handles: boolean; selected: boolean; showArea?: boolean; units?: "metric" | "imperial" }) {
  const shape = ribbonShape(element); if (!shape) return null;
  const path = regionPath(shape); const filter = `${prefix}-road-${element.id.replaceAll(/[^a-zA-Z0-9_-]/g, "-")}`;
  const width = ribbonWidth(element); const { fillColor: color, fillOpacity } = ribbonAppearance(element);
  const edges = ribbonEdges(element); const stride = Math.max(1, Math.ceil(edges.length / 12));
  const clipId = `${filter}-clip`; const label = regionLabelLayout(mapLabelWithArea(element.name, mapRegionArea(shape), units, showArea), shape, zoom);
  return <>
    <defs><filter id={filter} x="-20%" y="-20%" width="140%" height="140%" colorInterpolationFilters="sRGB"><feGaussianBlur stdDeviation={width * .045}/></filter><clipPath id={clipId}><path d={path} fillRule="evenodd"/></clipPath>{label?.kind === "boundary" && <path id={`${clipId}-label-path`} d={label.path}/>}</defs>
    <g opacity={fillOpacity} pointerEvents="none"><path d={path} fill={color} fillRule="evenodd" filter={`url(#${filter})`}/><path d={path} fill={color} fillOpacity={.15} fillRule="evenodd"/></g>
    {label && <MapSheetRegionLabel layout={label} clipId={clipId} pathId={`${clipId}-label-path`}/>}
    <path d={path} fill="transparent" fillRule="evenodd" stroke={selected ? "#a64e3c" : "none"} strokeWidth={1.2 / zoom} pointerEvents="all"/>
    {handles && edges.map((edge, index) => index % stride && index !== edges.length - 1 ? null : [edge.left, edge.right].map((point, side) => <circle key={`${index}:${side}`} className={styles.resizeHandle} cx={point.x} cy={point.y} r={4 / zoom} data-region-polygon={side + 1} data-region-vertex={index} data-element-id={element.id}/>))}
    {handles && (element.geometry.kind === "path" || element.geometry.kind === "bezier") && <PathAnchorHandles geometry={element.geometry} elementId={element.id} zoom={zoom}/>}
    <title>{element.name}</title>
  </>;
}
