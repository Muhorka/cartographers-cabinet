import type { InstrumentId } from "../toolbox/toolbox-model";
import type { KernelPoint } from "../geometry/geometry-types";
import type { RegionShape } from "../model/project-model";

import type { BezierNode } from "../geometry/geometry-types";

const TAU = Math.PI * 2;

function positiveAngle(value: number) { return (value % TAU + TAU) % TAU; }

function arcPoint(center: KernelPoint, radius: number, angle: number): KernelPoint {
  return { x: center.x + Math.cos(angle) * radius, y: center.y + Math.sin(angle) * radius };
}

/**
 * Converts three user points (start, bend, end) into ordinary cubic Bézier
 * nodes. The bend is retained as a real anchor, so the result remains easy to
 * edit with the normal path tools and can be sampled by the existing region,
 * wall and eraser pipelines.
 */
export function arcBezierNodes(start: KernelPoint, bend: KernelPoint, end: KernelPoint): BezierNode[] {
  const determinant = 2 * (start.x * (bend.y - end.y) + bend.x * (end.y - start.y) + end.x * (start.y - bend.y));
  if (Math.abs(determinant) < 1e-8) {
    // Collinear clicks still produce a useful, ordinary Bézier path rather
    // than silently dropping the gesture.
    return [
      { anchor: start, outHandle: { x: start.x + (bend.x - start.x) * 2 / 3, y: start.y + (bend.y - start.y) * 2 / 3 } },
      { anchor: end, inHandle: { x: end.x + (bend.x - end.x) * 2 / 3, y: end.y + (bend.y - end.y) * 2 / 3 } },
    ];
  }
  const a2 = start.x * start.x + start.y * start.y;
  const b2 = bend.x * bend.x + bend.y * bend.y;
  const c2 = end.x * end.x + end.y * end.y;
  const center = {
    x: (a2 * (bend.y - end.y) + b2 * (end.y - start.y) + c2 * (start.y - bend.y)) / determinant,
    y: (a2 * (end.x - bend.x) + b2 * (start.x - end.x) + c2 * (bend.x - start.x)) / determinant,
  };
  const radius = Math.hypot(start.x - center.x, start.y - center.y);
  const orientation = (bend.x - start.x) * (end.y - start.y) - (bend.y - start.y) * (end.x - start.x) >= 0 ? 1 : -1;
  const startAngle = Math.atan2(start.y - center.y, start.x - center.x);
  const bendAngle = Math.atan2(bend.y - center.y, bend.x - center.x);
  const endAngle = Math.atan2(end.y - center.y, end.x - center.x);
  const firstSweep = orientation > 0 ? positiveAngle(bendAngle - startAngle) : -positiveAngle(startAngle - bendAngle);
  const secondSweep = orientation > 0 ? positiveAngle(endAngle - bendAngle) : -positiveAngle(bendAngle - endAngle);
  const anchors = [start, bend, end];
  const sweeps = [firstSweep, secondSweep];
  const nodes: BezierNode[] = [{ anchor: start }];
  let angle = startAngle;
  for (let segment = 0; segment < 2; segment += 1) {
    const sweep = sweeps[segment];
    const count = Math.max(1, Math.ceil(Math.abs(sweep) / (Math.PI / 2)));
    const step = sweep / count;
    for (let index = 0; index < count; index += 1) {
      const nextAngle = angle + step;
      const from = nodes.at(-1)!;
      const to = segment === 0 && index === count - 1 ? anchors[1] : segment === 1 && index === count - 1 ? anchors[2] : arcPoint(center, radius, nextAngle);
      const handleLength = 4 / 3 * Math.tan(Math.abs(step) / 4) * radius;
      const tangentFrom = { x: -Math.sin(angle) * orientation, y: Math.cos(angle) * orientation };
      const tangentTo = { x: -Math.sin(nextAngle) * orientation, y: Math.cos(nextAngle) * orientation };
      from.outHandle = { x: from.anchor.x + tangentFrom.x * handleLength, y: from.anchor.y + tangentFrom.y * handleLength };
      nodes.push({ anchor: to, inHandle: { x: to.x - tangentTo.x * handleLength, y: to.y - tangentTo.y * handleLength } });
      angle = nextAngle;
    }
  }
  return nodes;
}

export function regionFromGesture(instrument: InstrumentId, points: KernelPoint[]): RegionShape | undefined {
  const first = points[0]; const last = points.at(-1); if (!first || !last) return undefined;
  if (instrument === "rectangle") return { kind: "rectangle", x: Math.min(first.x, last.x), y: Math.min(first.y, last.y), width: Math.abs(last.x - first.x), height: Math.abs(last.y - first.y) };
  if (instrument === "circle") return { kind: "circle", cx: first.x, cy: first.y, radius: Math.hypot(last.x - first.x, last.y - first.y) };
  if (instrument === "ellipse") return { kind: "ellipse", cx: (first.x + last.x) / 2, cy: (first.y + last.y) / 2, rx: Math.abs(last.x - first.x) / 2, ry: Math.abs(last.y - first.y) / 2 };
  if (instrument === "polygon" && points.length >= 3) return { kind: "polygon", points };
  return undefined;
}

export function gestureSegments(idPrefix: string, points: KernelPoint[], role: "wall" | "partition") {
  return points.slice(0, -1).filter((start, index) => start.x !== points[index + 1].x || start.y !== points[index + 1].y).map((start, index) => ({ id: `${idPrefix}:${index + 1}`, start, end: points[index + 1], thickness: role === "wall" ? .45 : .22, role }));
}
