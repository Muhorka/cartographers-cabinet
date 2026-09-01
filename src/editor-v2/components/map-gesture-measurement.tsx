import { formatAngle, formatMeasurement, type PlanningUnit } from "../planning/planning-measurements";
import type { MapGestureDraft } from "./map-sheet-gesture";
import styles from "./map-gesture-measurement.module.css";

export type GestureMeasurementCopy = { width: string; height: string; length: string; angle: string };
const englishCopy: GestureMeasurementCopy = { width: "W", height: "H", length: "Length", angle: "Angle" };

function finalSegment(points: NonNullable<MapGestureDraft["points"]>) {
  if (points.length < 2) return undefined;
  const first = points.at(-2)!; const last = points.at(-1)!;
  return { length: Math.hypot(last.x - first.x, last.y - first.y), angle: Math.atan2(last.y - first.y, last.x - first.x) * 180 / Math.PI };
}

/** Compact, pointer-transparent measurements for the current unfinished gesture. */
export function MapGestureMeasurement({ draft, viewportZoom, unit, copy = englishCopy }: { draft?: MapGestureDraft; viewportZoom: number; unit: PlanningUnit; copy?: GestureMeasurementCopy }) {
  if (!draft?.points.length || draft.instrumentId === "erase" || draft.instrumentId === "polygon" || draft.instrumentId === "note" || draft.instrumentId === "place" || draft.instrumentId === "point") return null;
  const points = draft.hover ? [...draft.points, draft.hover] : draft.points; const first = points[0]; const last = points.at(-1)!; const dx = Math.abs(last.x - first.x); const dy = Math.abs(last.y - first.y);
  const lines = draft.instrumentId === "rectangle" || draft.instrumentId === "ellipse" ? [`${copy.width} ${formatMeasurement(dx, unit)}`, `${copy.height} ${formatMeasurement(dy, unit)}`] : draft.instrumentId === "circle" ? [`${copy.width} ${formatMeasurement(Math.hypot(last.x - first.x, last.y - first.y) * 2, unit)}`, `${copy.height} ${formatMeasurement(Math.hypot(last.x - first.x, last.y - first.y) * 2, unit)}`] : (() => { const segment = finalSegment(points); return segment ? [`${copy.length} ${formatMeasurement(segment.length, unit)}`, `${copy.angle} ${formatAngle(segment.angle)}`] : []; })();
  if (!lines.length) return null;
  const scale = Math.max(viewportZoom, .01); const x = last.x + 12 / scale; const y = last.y - 12 / scale; const width = Math.max(64, ...lines.map((line) => line.length * 6 + 10)) / scale;
  return <g className={styles.readout} style={{ pointerEvents: "none" }} transform={`translate(${x} ${y})`} data-gesture-measurement="true" aria-label={lines.join(", ")}><rect x={-5 / scale} y={-23 / scale} width={width} height={30 / scale} rx={2 / scale}/><text x="0" y={-11 / scale} fontSize={10 / scale}>{lines[0]}</text><text x="0" y={2 / scale} fontSize={10 / scale}>{lines[1]}</text></g>;
}
