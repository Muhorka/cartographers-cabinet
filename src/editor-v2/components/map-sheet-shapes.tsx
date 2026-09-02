import { useState, type KeyboardEvent, type MouseEvent as ReactMouseEvent } from "react";
import { RoadShape } from "./road-shape";
import { PathAnchorHandles } from "./path-anchor-handles";
import { bezierPathData } from "../geometry/bezier-geometry";
import { regionCorner, type ResizeCorner } from "../geometry/region-resize";
import { regionLabelLayout } from "../geometry/region-label-layout";
import type { LabelObstacle } from "../geometry/room-label-layout";
import type { DrawingElement, PlaceNode } from "../model/project-model";
import type { WorkLayerId } from "../toolbox/toolbox-model";
import { pointsPath, regionPath } from "./map-sheet-geometry";
import styles from "./map-sheet.module.css";
import { regionVertices } from "../geometry/region-vertex-edit";
import { MapSheetRegionLabel } from "./map-sheet-region-label";
import { mapLabelWithArea, mapRegionArea } from "../geometry/map-area";
import { defaultElementColor } from "../model/element-appearance";
import { noteDimensions } from "../geometry/note-geometry";
import { isRibbonElement } from "../geometry/ribbon-geometry";
import type { LabelLayoutPlan } from "../geometry/label-collision";

export function PlaceShape({ place, mode, prefix, transform, labelPlan, labelScope = "", selectionLayer, selectable = false, allowLockedSelection = false, viewportZoom = 1, resizeHandleSize = 5, showResizeHandles = false, selected, showArea = false, units = "metric", onSelect, onOpen }: { place: PlaceNode; mode: "active" | "child" | "context" | "descendant"; prefix: string; transform?: string; labelPlan?: LabelLayoutPlan; labelScope?: string; selectionLayer?: WorkLayerId; selectable?: boolean; allowLockedSelection?: boolean; viewportZoom?: number; resizeHandleSize?: number; showResizeHandles?: boolean; selected?: boolean; showArea?: boolean; units?: "metric" | "imperial"; onSelect?(additive?: boolean): void; onOpen?(): void }) {
  if (!place.boundary || place.visible === false) return null; const clipId = `${prefix}-place-${safeId(place.id)}`; const interactive = (allowLockedSelection || !place.locked) && Boolean(onSelect || onOpen);
  const showLabel = mode === "child" || mode === "descendant" || mode === "context" && place.kind === "room";
  const label = (showLabel ? labelPlan?.get(`place:${labelScope}:${place.id}`) as ReturnType<typeof regionLabelLayout> | undefined : undefined) ?? (showLabel ? regionLabelLayout(mapLabelWithArea(place.name, mapRegionArea(place.boundary), units, showArea), place.boundary, viewportZoom, place.kind === "location" || place.kind === "custom") : undefined);
  const corners: ResizeCorner[] = ["north-west", "north-east", "south-east", "south-west"];
  const vertices = regionVertices(place.boundary);
  return <g transform={transform} className={`${styles.place} ${styles[mode]} ${styles[`kind_${place.kind}`]}${selected ? ` ${styles.selected}` : ""}`} style={interactive ? undefined : { pointerEvents: "none" }} data-selectable={selectable ? "true" : undefined} data-selection-layer={selectable ? selectionLayer : undefined} data-selection-kind={selectable ? "place" : undefined} data-selection-id={selectable ? place.id : undefined} role={interactive ? "button" : undefined} tabIndex={interactive ? 0 : undefined} aria-label={interactive ? place.name : undefined} onClick={interactive ? (event) => { event.stopPropagation(); onSelect?.(additiveSelection(event)); } : undefined} onDoubleClick={interactive && onOpen ? (event) => { event.stopPropagation(); onOpen(); } : undefined} onKeyDown={interactive ? (event) => { if (event.key === "Enter" && onOpen) { event.preventDefault(); onOpen(); } else activateByKeyboard(event, onSelect); } : undefined}><defs><clipPath id={clipId}><path d={regionPath(place.boundary)} fillRule="evenodd"/></clipPath>{label?.kind === "boundary" && <path id={`${clipId}-label-path`} d={label.path}/>}</defs><path className={styles.placeRegion} style={appearanceStyle(place.appearance)} d={regionPath(place.boundary)} fillRule="evenodd"/>{showLabel && label && <MapSheetRegionLabel layout={label} clipId={clipId} pathId={`${clipId}-label-path`}/>} {showResizeHandles && (vertices.length ? vertices.map(({ polygonIndex, vertexIndex, point }) => <circle key={`${polygonIndex}:${vertexIndex}`} className={styles.resizeHandle} cx={point.x} cy={point.y} r={resizeHandleSize} data-region-polygon={polygonIndex} data-region-vertex={vertexIndex} data-place-id={place.id}/>) : corners.map((corner) => { const point = regionCorner(place.boundary!, corner); return <circle key={corner} className={styles.resizeHandle} cx={point.x} cy={point.y} r={resizeHandleSize} data-resize-corner={corner} data-place-id={place.id}/>; }))}<title>{place.name}</title></g>;
}

export function ElementShape({ element, prefix, viewportZoom, pointRadius, resizeHandleSize, opacity, selectable, showResizeHandles, selected, showArea = false, units = "metric", labelObstacles, labelPlan, onSelect, onNoteTextChange }: { element: DrawingElement; prefix: string; viewportZoom: number; pointRadius: number; resizeHandleSize: number; opacity: number; selectable: boolean; showResizeHandles: boolean; selected: boolean; showArea?: boolean; units?: "metric" | "imperial"; labelObstacles?: readonly LabelObstacle[]; labelPlan?: LabelLayoutPlan; onSelect?(additive?: boolean): void; onNoteTextChange?(id: string, text: string): void }) {
  const className = `${styles.element} ${styles[`layer_${element.layerId}`]} ${subjectClass(element.subjectId)}${selected ? ` ${styles.selected}` : ""}`; const interactive = Boolean(onSelect || onNoteTextChange); const defaultColor = defaultElementColor(element.subjectId, element.layerId === "terrain" ? "#829664" : "#9f805b");
  const common = { "data-selectable": selectable ? "true" : undefined, "data-selection-layer": selectable ? element.layerId : undefined, "data-selection-kind": selectable ? "element" : undefined, "data-selection-id": selectable ? element.id : undefined, role: interactive ? "button" : undefined, tabIndex: interactive ? 0 : undefined, "aria-label": interactive ? element.name : undefined, onClick: interactive ? (event: ReactMouseEvent<SVGGElement>) => { event.stopPropagation(); onSelect?.(additiveSelection(event)); } : undefined, onKeyDown: interactive ? (event: KeyboardEvent<SVGGElement>) => activateByKeyboard(event, onSelect) : undefined };
  if (isRibbonElement(element)) return <g className={className} style={{ opacity, pointerEvents: interactive ? undefined : "none" }} {...common}><RoadShape element={element} prefix={prefix} zoom={viewportZoom} handles={showResizeHandles} selected={selected} showArea={showArea} units={units} labelObstacles={labelObstacles} labelPlan={labelPlan}/></g>;
  if (element.geometry.kind === "region") { const shape = element.geometry.shape; const clipId = `${prefix}-element-${safeId(element.id)}`; const label = (labelPlan?.get(`element:${element.belongsToId}:${element.id}`) as ReturnType<typeof regionLabelLayout> | undefined) ?? regionLabelLayout(mapLabelWithArea(element.name, mapRegionArea(shape), units, showArea), shape, viewportZoom, element.layerId === "terrain", { obstacles: labelObstacles }); const corners: ResizeCorner[] = ["north-west", "north-east", "south-east", "south-west"]; const vertices = regionVertices(shape); return <g className={className} style={{ opacity, color: defaultColor, pointerEvents: interactive ? undefined : "none" }} {...common}><defs><clipPath id={clipId}><path d={regionPath(shape)} fillRule="evenodd"/></clipPath>{label?.kind === "boundary" && <path id={`${clipId}-label-path`} d={label.path}/>}</defs><path className={styles.elementRegion} style={appearanceStyle(elementAppearance(element))} d={regionPath(shape)} fillRule="evenodd"/>{label && <MapSheetRegionLabel layout={label} clipId={clipId} pathId={`${clipId}-label-path`}/>} {showResizeHandles && (vertices.length ? vertices.map(({ polygonIndex, vertexIndex, point }) => <circle key={`${polygonIndex}:${vertexIndex}`} className={styles.resizeHandle} cx={point.x} cy={point.y} r={resizeHandleSize} data-region-polygon={polygonIndex} data-region-vertex={vertexIndex} data-element-id={element.id}/>) : corners.map((corner) => { const point = regionCorner(shape, corner); return <circle key={corner} className={styles.resizeHandle} cx={point.x} cy={point.y} r={resizeHandleSize} data-resize-corner={corner} data-element-id={element.id}/>; }))}<title>{element.name}</title></g>; }
  const passiveStyle = { opacity, color: defaultColor, pointerEvents: interactive ? undefined : "none" } as const;
  if (element.geometry.kind === "path") return <g className={className} style={passiveStyle} {...common}><path className={styles.elementPath} style={element.layerId === "sketch" ? { filter: `url(#${prefix}-ink)` } : undefined} d={pointsPath(element.geometry.points, element.geometry.closed)}/>{showResizeHandles && <PathAnchorHandles geometry={element.geometry} elementId={element.id} zoom={viewportZoom}/>}<title>{element.name}</title></g>;
  if (element.geometry.kind === "bezier") return <g className={className} style={passiveStyle} {...common}><path className={styles.elementPath} style={element.layerId === "sketch" ? { filter: `url(#${prefix}-ink)` } : undefined} d={bezierPathData(element.geometry.nodes, element.geometry.closed)}/>{showResizeHandles && <PathAnchorHandles geometry={element.geometry} elementId={element.id} zoom={viewportZoom}/>}<title>{element.name}</title></g>;
  if (element.geometry.kind === "note") {
    const { width, height } = noteDimensions(element.geometry);
    const fontSize = Math.max(1, Number(element.properties.fontSize ?? Math.min(14, Math.max(7, height * .22)))) / viewportZoom;
    const lineHeight = fontSize * 1.25;
    const lines = wrapNoteText(element.geometry.text, width, fontSize);
    const maxLines = Math.max(1, Math.floor((height - fontSize * .35) / lineHeight));
    const visibleLines = lines.length > maxLines ? [...lines.slice(0, maxLines - 1), `${lines[maxLines - 1]}…`] : lines;
    const corners: ResizeCorner[] = ["north-west", "north-east", "south-east", "south-west"];
    const box = { x: element.geometry.at.x, y: element.geometry.at.y, width, height };
    const transform = element.geometry.rotation ? `rotate(${element.geometry.rotation} ${box.x} ${box.y})` : undefined;
    return <g className={className} style={passiveStyle} {...common} transform={transform}><rect className={styles.noteBox} x={box.x} y={box.y} width={box.width} height={box.height} rx={1.5 / viewportZoom}/><InlineNoteText text={element.geometry.text} lines={visibleLines} x={box.x + fontSize * .45} y={box.y + fontSize} width={box.width} height={box.height} fontSize={fontSize} lineHeight={lineHeight} onChange={onNoteTextChange ? (text) => onNoteTextChange(element.id, text) : undefined}/>{showResizeHandles && corners.map((corner) => { const point = noteCorner(box, corner); return <circle key={corner} className={styles.resizeHandle} cx={point.x} cy={point.y} r={resizeHandleSize} data-resize-corner={corner} data-element-id={element.id}/>; })}<title>{element.name}</title></g>;
  }
  const markerRadius = Math.max(2, Math.min(20, Number(element.properties.markerSize ?? pointRadius * viewportZoom))) / viewportZoom;
  return <g className={className} style={passiveStyle} {...common}><circle className={styles.point} style={appearanceStyle(elementAppearance(element))} cx={element.geometry.at.x} cy={element.geometry.at.y} r={markerRadius}/><title>{element.name}</title></g>;
}

function InlineNoteText({ text, lines, x, y, width, height, fontSize, lineHeight, onChange }: { text: string; lines: string[]; x: number; y: number; width: number; height: number; fontSize: number; lineHeight: number; onChange?: (text: string) => void }) {
  const [editing, setEditing] = useState(false);
  if (editing && onChange) return <foreignObject data-note-editor="true" x={x - fontSize * .45} y={y - fontSize} width={width} height={height} onPointerDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()}><textarea autoFocus value={text} onChange={(event) => onChange(event.currentTarget.value)} onBlur={() => setEditing(false)} onKeyDown={(event) => event.stopPropagation()} style={{ width: "100%", height: "100%", boxSizing: "border-box", resize: "none", border: "1px solid #806b47", background: "#f4e8bd", color: "#514b41", font: `${fontSize}px Georgia, serif`, padding: `${fontSize * .35}px` }}/></foreignObject>;
  return <text data-note-editor="true" className={styles.note} x={x} y={y} style={{ fontSize }} onClick={onChange ? (event) => { event.stopPropagation(); setEditing(true); } : undefined} onPointerDown={onChange ? (event) => event.stopPropagation() : undefined}>{lines.map((line, index) => <tspan key={index} x={x} dy={index ? lineHeight : 0}>{line || " "}</tspan>)}</text>;
}

export function Compass({ x, y, rotation, label, northMark }: { x: number; y: number; rotation: number; label: string; northMark: string }) {
  return <g transform={`translate(${x} ${y})`} aria-label={label} aria-valuemin={-180} aria-valuemax={180} aria-valuenow={Math.round(rotation)} role="slider" data-viewport-dial="true"><g className={styles.compass} style={{ transformBox: "fill-box", transformOrigin: "center" }}><title>{label}</title><circle r="42"/><circle className={styles.compassRing} r="35"/><g className={styles.needle} transform={`rotate(${rotation})`}><path d="M0-31 7 3 0-2-7 3Z"/><path d="M0 31 6-2 0 3-6-2Z"/></g><circle className={styles.compassPin} r="3"/><text y="-22">{northMark}</text></g></g>;
}

function activateByKeyboard(event: KeyboardEvent<SVGGElement>, action?: () => void) { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.stopPropagation(); action?.(); } }
function safeId(id: string) { return id.replaceAll(/[^a-zA-Z0-9_-]/g, "-"); }
function subjectClass(subjectId: string) { const subject = subjectId.split(".").at(-1)?.replaceAll(/[^a-zA-Z0-9_-]/g, "-") ?? "default"; return styles[`subject_${subject}`] ?? ""; }
function appearanceStyle(appearance?: { fillColor?: string; fillOpacity?: number }) { return appearance ? { fill: appearance.fillColor, fillOpacity: appearance.fillOpacity } : undefined; }
function elementAppearance(element: DrawingElement) { return element.appearance ?? { fillColor: defaultElementColor(element.subjectId, element.layerId === "terrain" ? "#829664" : "#9f805b") }; }
function additiveSelection(event: { ctrlKey: boolean; metaKey: boolean; shiftKey: boolean }) { return event.ctrlKey || event.metaKey || event.shiftKey; }
function noteCorner(box: { x: number; y: number; width: number; height: number }, corner: ResizeCorner) { return { x: box.x + (corner.includes("east") ? box.width : 0), y: box.y + (corner.includes("south") ? box.height : 0) }; }
export function wrapNoteText(text: string, width: number, fontSize: number) {
  const capacity = Math.max(1, Math.floor(width / Math.max(1, fontSize * .58)));
  return text.split(/\r?\n/).flatMap((paragraph) => {
    if (!paragraph) return [""];
    const words = paragraph.split(/\s+/); const lines: string[] = []; let line = "";
    for (const rawWord of words) {
      const chunks = rawWord.match(new RegExp(`.{1,${capacity}}`, "g")) ?? [rawWord];
      for (const word of chunks) {
      if (!line) { line = word; continue; }
      if (line.length + 1 + word.length <= capacity) line += ` ${word}`;
      else { lines.push(line); line = word; }
      }
    }
    if (line) lines.push(line); return lines;
  });
}
