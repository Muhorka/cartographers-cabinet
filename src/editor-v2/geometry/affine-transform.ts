import { sampleBezier } from "./bezier-geometry";
import type { BezierNode, KernelPoint } from "./geometry-types";
import type { DrawingElement, EditorProject, PlaceNode, RegionShape } from "../model/project-model";

export type AffineMatrix = [number, number, number, number, number, number];
const IDENTITY: AffineMatrix = [1, 0, 0, 1, 0, 0];

function multiplyAffine(left: AffineMatrix, right: AffineMatrix): AffineMatrix {
  const [a, b, c, d, e, f] = left; const [g, h, i, j, k, l] = right;
  return [a * g + c * h, b * g + d * h, a * i + c * j, b * i + d * j, a * k + c * l + e, b * k + d * l + f];
}

function invertAffine([a, b, c, d, e, f]: AffineMatrix): AffineMatrix {
  const determinant = a * d - b * c;
  if (Math.abs(determinant) < 1e-12) return IDENTITY;
  return [d / determinant, -b / determinant, -c / determinant, a / determinant, (c * f - d * e) / determinant, (b * e - a * f) / determinant];
}

export function applyAffinePoint([a, b, c, d, e, f]: AffineMatrix, point: KernelPoint): KernelPoint {
  return { x: a * point.x + c * point.y + e, y: b * point.x + d * point.y + f };
}

function localMatrix(place: PlaceNode): AffineMatrix {
  const radians = place.transform.rotation * Math.PI / 180; const cosine = Math.cos(radians); const sine = Math.sin(radians);
  return [cosine, sine, -sine, cosine, place.transform.x, place.transform.y];
}

function placeWorldMatrix(project: EditorProject, id: string): AffineMatrix {
  const byId = new Map(project.places.map((place) => [place.id, place])); const lineage: PlaceNode[] = []; const visited = new Set<string>();
  let current = byId.get(id);
  while (current) {
    if (visited.has(current.id)) break;
    visited.add(current.id); lineage.unshift(current); current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  return lineage.reduce((matrix, place) => multiplyAffine(matrix, localMatrix(place)), IDENTITY);
}

export function relativePlaceMatrix(project: EditorProject, targetPlaceId: string, sourcePlaceId: string) {
  return multiplyAffine(invertAffine(placeWorldMatrix(project, targetPlaceId)), placeWorldMatrix(project, sourcePlaceId));
}

function transformNode(matrix: AffineMatrix, node: BezierNode): BezierNode {
  return {
    anchor: applyAffinePoint(matrix, node.anchor),
    inHandle: node.inHandle ? applyAffinePoint(matrix, node.inHandle) : undefined,
    outHandle: node.outHandle ? applyAffinePoint(matrix, node.outHandle) : undefined,
  };
}

export function transformRegion(matrix: AffineMatrix, shape: RegionShape): RegionShape {
  if (shape.kind === "compound") return { kind: "compound", polygons: shape.polygons.map(({ outer, holes }) => ({ outer: outer.map((point) => applyAffinePoint(matrix, point)), holes: holes.map((hole) => hole.map((point) => applyAffinePoint(matrix, point))) })) };
  const points = shape.kind === "bezier" ? sampleBezier(shape.nodes, true) : shape.kind === "polygon" ? shape.points : shape.kind === "rectangle"
    ? [{ x: shape.x, y: shape.y }, { x: shape.x + shape.width, y: shape.y }, { x: shape.x + shape.width, y: shape.y + shape.height }, { x: shape.x, y: shape.y + shape.height }]
    : Array.from({ length: 48 }, (_, index) => { const angle = index / 48 * Math.PI * 2; return shape.kind === "circle" ? { x: shape.cx + Math.cos(angle) * shape.radius, y: shape.cy + Math.sin(angle) * shape.radius } : { x: shape.cx + Math.cos(angle) * shape.rx, y: shape.cy + Math.sin(angle) * shape.ry }; });
  return { kind: "polygon", points: points.map((point) => applyAffinePoint(matrix, point)) };
}

export function transformDrawingGeometry(matrix: AffineMatrix, geometry: DrawingElement["geometry"]): DrawingElement["geometry"] {
  if (geometry.kind === "region") return { kind: "region", shape: transformRegion(matrix, geometry.shape) };
  if (geometry.kind === "path") return { ...geometry, points: geometry.points.map((point) => applyAffinePoint(matrix, point)) };
  if (geometry.kind === "bezier") return { ...geometry, nodes: geometry.nodes.map((node) => transformNode(matrix, node)) };
  if (geometry.kind === "note") {
    const delta = Math.atan2(matrix[1], matrix[0]) * 180 / Math.PI;
    return { ...geometry, at: applyAffinePoint(matrix, geometry.at), ...(Math.abs(delta) > 1e-10 || geometry.rotation !== undefined ? { rotation: (geometry.rotation ?? 0) + delta } : {}) };
  }
  return { ...geometry, at: applyAffinePoint(matrix, geometry.at) };
}
