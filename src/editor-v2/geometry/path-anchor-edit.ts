import type { DrawingElement } from "../model/project-model";
import type { KernelPoint } from "./geometry-types";

export type EditablePath = Extract<DrawingElement["geometry"], { kind: "path" | "bezier" }>;

export function pathAnchors(geometry: EditablePath) {
  return geometry.kind === "path" ? geometry.points : geometry.nodes.map(({ anchor }) => anchor);
}

/** The same anchor motion for ink paths, curves and road centre lines. */
export function movePathAnchor(geometry: EditablePath, index: number, point: KernelPoint): EditablePath | undefined {
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y) || !Number.isInteger(index) || index < 0) return;
  if (geometry.kind === "path") return geometry.points[index] ? { ...geometry, points: geometry.points.map((old, i) => i === index ? point : old) } : undefined;
  const old = geometry.nodes[index]; if (!old) return;
  const dx = point.x - old.anchor.x; const dy = point.y - old.anchor.y;
  const shift = (handle?: KernelPoint) => handle ? { x: handle.x + dx, y: handle.y + dy } : undefined;
  return { ...geometry, nodes: geometry.nodes.map((node, i) => i === index ? { anchor: point, inHandle: shift(node.inHandle), outHandle: shift(node.outHandle) } : node) };
}
