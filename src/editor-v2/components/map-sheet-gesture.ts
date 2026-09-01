import type { BezierNode, KernelPoint } from "../geometry/geometry-types";
import type { InstrumentId } from "../toolbox/toolbox-model";
import type { SheetViewport } from "./map-sheet-geometry";
import { arcBezierNodes } from "../drawing/gesture-geometry";

export type MapGestureInstrument = Extract<InstrumentId, "place" | "pencil" | "pen" | "line" | "wall-run" | "rectangle" | "circle" | "ellipse" | "arc" | "polygon" | "point" | "note" | "erase">;
export type MapGesture = { instrumentId: MapGestureInstrument; points: KernelPoint[]; bezierNodes?: BezierNode[]; closed?: boolean; snapTolerance?: number; hitRadius?: number };
export type MapSheetInteraction = { enabled: boolean; instrumentId: InstrumentId };
export type MapGestureDraft = { instrumentId: MapGestureInstrument; points: KernelPoint[]; bezierNodes?: BezierNode[]; closed?: boolean; hover?: KernelPoint; pointerId?: number };

const gestureInstruments = new Set<InstrumentId>(["place", "pencil", "pen", "line", "wall-run", "rectangle", "circle", "ellipse", "arc", "polygon", "point", "note", "erase"]);
const continuous = new Set<MapGestureInstrument>(["pencil", "erase"]);

export function gestureInstrument(interaction?: MapSheetInteraction): MapGestureInstrument | undefined {
  return interaction?.enabled && gestureInstruments.has(interaction.instrumentId) ? interaction.instrumentId as MapGestureInstrument : undefined;
}

export function isContinuousGesture(instrumentId: MapGestureInstrument) { return continuous.has(instrumentId); }
export function isPolygonGesture(instrumentId: MapGestureInstrument): instrumentId is Extract<MapGestureInstrument, "polygon" | "wall-run" | "pen" | "arc"> { return instrumentId === "polygon" || instrumentId === "wall-run" || instrumentId === "pen" || instrumentId === "arc"; }

export function multiClickGesture(instrumentId: Extract<MapGestureInstrument, "polygon" | "wall-run" | "arc">, current: MapGestureDraft | undefined, point: KernelPoint, tolerance: number): { draft?: MapGestureDraft; gesture?: MapGesture } {
  const points = current?.instrumentId === instrumentId ? current.points : [];
  if (instrumentId === "arc") {
    const next = appendDistinct(points, point);
    return next.length >= 3
      ? { gesture: { instrumentId, points: next.slice(0, 3), bezierNodes: arcBezierNodes(next[0], next[1], next[2]), closed: false } }
      : { draft: { instrumentId, points: next } };
  }
  const closed = instrumentId === "polygon" ? polygonClosedByPoint(points, point, tolerance) : undefined;
  return closed ? { gesture: { instrumentId, points: closed, closed: true } } : { draft: { instrumentId, points: appendDistinct(points, point) } };
}

export function arcHoverGesture(draft: MapGestureDraft, point: KernelPoint): MapGestureDraft {
  const bezierNodes = draft.points.length >= 3 ? arcBezierNodes(draft.points[0], draft.points[1], draft.points[2]) : undefined;
  return { ...draft, bezierNodes, hover: point };
}

export function noteBoxFromPoints(points: KernelPoint[], text: string) {
  const first = points[0] ?? { x: 0, y: 0 }; const second = points[1] ?? { x: first.x + 12, y: first.y + 8 };
  return { kind: "note" as const, at: { x: Math.min(first.x, second.x), y: Math.min(first.y, second.y) }, text, width: Math.max(4, Math.abs(second.x - first.x)), height: Math.max(3, Math.abs(second.y - first.y)) };
}

type ClientBounds = { left: number; top: number; width: number; height: number };

export function clientPointToMap(point: KernelPoint, bounds: ClientBounds, sheetSize: { width: number; height: number }, viewport: SheetViewport): KernelPoint {
  const scale = Math.min(bounds.width / sheetSize.width, bounds.height / sheetSize.height) || 1;
  const offset = { x: bounds.left + (bounds.width - sheetSize.width * scale) / 2, y: bounds.top + (bounds.height - sheetSize.height * scale) / 2 };
  const sheet = { x: (point.x - offset.x) / scale, y: (point.y - offset.y) / scale };
  const centered = { x: sheet.x - sheetSize.width / 2, y: sheet.y - sheetSize.height / 2 };
  const radians = -viewport.rotation * Math.PI / 180; const cosine = Math.cos(radians); const sine = Math.sin(radians);
  return { x: viewport.center.x + (centered.x * cosine - centered.y * sine) / viewport.zoom, y: viewport.center.y + (centered.x * sine + centered.y * cosine) / viewport.zoom };
}

export function appendDistinct(points: KernelPoint[], point: KernelPoint, tolerance = 1e-6) {
  const previous = points.at(-1); return previous && Math.hypot(previous.x - point.x, previous.y - point.y) <= tolerance ? points : [...points, point];
}

function segmentIntersection(a: KernelPoint, b: KernelPoint, c: KernelPoint, d: KernelPoint) {
  const r = { x: b.x - a.x, y: b.y - a.y }; const s = { x: d.x - c.x, y: d.y - c.y };
  const cross = r.x * s.y - r.y * s.x; if (Math.abs(cross) < 1e-9) return undefined;
  const offset = { x: c.x - a.x, y: c.y - a.y };
  const alongFirst = (offset.x * s.y - offset.y * s.x) / cross; const alongSecond = (offset.x * r.y - offset.y * r.x) / cross;
  if (alongFirst < 0 || alongFirst > 1 || alongSecond < 0 || alongSecond > 1) return undefined;
  return { x: a.x + alongFirst * r.x, y: a.y + alongFirst * r.y };
}

export function polygonClosedByPoint(points: KernelPoint[], point: KernelPoint, tolerance: number) {
  if (points.length < 3) return undefined;
  if (Math.hypot(point.x - points[0].x, point.y - points[0].y) <= tolerance) return points;
  const start = points.at(-1)!;
  for (let index = 0; index < points.length - 2; index += 1) {
    const crossing = segmentIntersection(start, point, points[index], points[index + 1]);
    if (crossing) return [crossing, ...points.slice(index + 1)];
  }
  return undefined;
}

export function completedGesture(draft: MapGestureDraft): MapGesture | undefined {
  const points = draft.points.reduce((result, point) => appendDistinct(result, point), [] as KernelPoint[]);
  if (draft.instrumentId === "pen") return (draft.bezierNodes?.length ?? 0) >= 2 ? { instrumentId: "pen", points: draft.bezierNodes!.map(({ anchor }) => anchor), bezierNodes: draft.bezierNodes, closed: draft.closed ?? false } : undefined;
  if (draft.instrumentId === "arc") return points.length >= 3 ? { instrumentId: "arc", points, bezierNodes: draft.bezierNodes ?? arcBezierNodes(points[0], points[1], points[2]), closed: draft.closed ?? false } : undefined;
  const minimum = draft.instrumentId === "polygon" ? 3 : draft.instrumentId === "place" || draft.instrumentId === "point" ? 1 : 2;
  return points.length >= minimum ? { instrumentId: draft.instrumentId, points, ...(draft.closed === undefined ? {} : { closed: draft.closed }) } : undefined;
}
