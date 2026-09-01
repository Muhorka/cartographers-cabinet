import { pointsPath } from "./map-sheet-geometry";
import type { MapGestureDraft } from "./map-sheet-gesture";
import styles from "./map-gesture-preview.module.css";
import { bezierPathData } from "../geometry/bezier-geometry";
import { arcBezierNodes } from "../drawing/gesture-geometry";
import { MapGestureMeasurement, type GestureMeasurementCopy } from "./map-gesture-measurement";
import { smoothPencilPoints } from "../geometry/pencil-smoothing";

export function MapGesturePreview({ draft, viewportZoom, eraserSize, pencilSmoothing = .25, unit = "metric", measurementCopy }: { draft?: MapGestureDraft; viewportZoom: number; eraserSize: number; pencilSmoothing?: number; unit?: "metric" | "imperial"; measurementCopy?: GestureMeasurementCopy }) {
  if (!draft?.points.length) return null; const rawPoints = draft.hover ? [...draft.points, draft.hover] : draft.points; const points = draft.instrumentId === "pencil" ? smoothPencilPoints(rawPoints, pencilSmoothing) : rawPoints; const first = points[0]; const last = points.at(-1) ?? first;
  const markerRadius = 2.4 / viewportZoom;
  if (draft.instrumentId === "erase") return <g className={`${styles.preview} ${styles.erase}`} aria-hidden="true"><path style={{ strokeWidth: eraserSize * 2 }} d={pointsPath(points, false)}/><circle className={styles.eraserTip} cx={last.x} cy={last.y} r={eraserSize / viewportZoom}/><MapGestureMeasurement draft={draft} viewportZoom={viewportZoom} unit={unit} copy={measurementCopy}/></g>;
  if (draft.instrumentId === "pen" && draft.bezierNodes?.length) return <g className={`${styles.preview} ${styles.pen}`}><path d={bezierPathData(draft.bezierNodes, draft.closed)}/>{draft.bezierNodes.map((node, index) => <g key={index}>{node.inHandle && <><line x1={node.anchor.x} y1={node.anchor.y} x2={node.inHandle.x} y2={node.inHandle.y}/><circle className={styles.handle} cx={node.inHandle.x} cy={node.inHandle.y} r={1.8 / viewportZoom}/></>}{node.outHandle && <><line x1={node.anchor.x} y1={node.anchor.y} x2={node.outHandle.x} y2={node.outHandle.y}/><circle className={styles.handle} cx={node.outHandle.x} cy={node.outHandle.y} r={1.8 / viewportZoom}/></>}<circle className={styles.node} cx={node.anchor.x} cy={node.anchor.y} r={2.6 / viewportZoom}/></g>)}<MapGestureMeasurement draft={draft} viewportZoom={viewportZoom} unit={unit} copy={measurementCopy}/></g>;
  if (draft.instrumentId === "arc" && points.length >= 3) {
    const nodes = draft.bezierNodes ?? arcBezierNodes(points[0], points[1], points[2]);
    return <g className={`${styles.preview} ${styles.pen}`}><path d={bezierPathData(nodes, false)}/>{points.slice(0, 3).map((point, index) => <circle key={index} className={styles.node} cx={point.x} cy={point.y} r={markerRadius}/>)}<MapGestureMeasurement draft={draft} viewportZoom={viewportZoom} unit={unit} copy={measurementCopy}/></g>;
  }
  if (draft.instrumentId === "rectangle") return <g className={styles.preview}><rect x={Math.min(first.x, last.x)} y={Math.min(first.y, last.y)} width={Math.abs(last.x - first.x)} height={Math.abs(last.y - first.y)}/><MapGestureMeasurement draft={draft} viewportZoom={viewportZoom} unit={unit} copy={measurementCopy}/></g>;
  if (draft.instrumentId === "ellipse") return <g className={styles.preview}><ellipse cx={(first.x + last.x) / 2} cy={(first.y + last.y) / 2} rx={Math.abs(last.x - first.x) / 2} ry={Math.abs(last.y - first.y) / 2}/><MapGestureMeasurement draft={draft} viewportZoom={viewportZoom} unit={unit} copy={measurementCopy}/></g>;
  if (draft.instrumentId === "circle") { const radius = Math.hypot(last.x - first.x, last.y - first.y); return <g className={styles.preview}><circle cx={first.x} cy={first.y} r={radius}/><MapGestureMeasurement draft={draft} viewportZoom={viewportZoom} unit={unit} copy={measurementCopy}/></g>; }
  const className = `${styles.preview}${draft.instrumentId === "polygon" ? ` ${styles.polygon}` : ""}`;
  const markers = draft.instrumentId === "pencil" ? [first, last] : points;
  return <g className={className}><path style={{ fill: draft.closed ? undefined : "none" }} d={pointsPath(points, draft.closed ?? false)}/>{markers.map((point, index) => <circle key={index} className={styles.node} cx={point.x} cy={point.y} r={markerRadius}/>)}<MapGestureMeasurement draft={draft} viewportZoom={viewportZoom} unit={unit} copy={measurementCopy}/></g>;
}
