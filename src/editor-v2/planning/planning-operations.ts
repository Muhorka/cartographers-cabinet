import type { BezierNode, KernelPoint } from "../geometry/geometry-types";
import { assessRegionConstraint } from "../geometry/region-constraints";
import { ribbonShape, ribbonStationAt, splitRibbonWidthProfile } from "../geometry/ribbon-geometry";
import type { DrawingElement, RegionShape } from "../model/project-model";
import { alignmentDeltas, distributionDeltas, insertBezierNode, insertBezierNodeAt, insertRegionVertex, planningInsertionTarget, removeRegionVertex, splitPathAt, splitPolygonByLine, type AlignmentEdge, type PlanningAxis, type PlanningGeometry, type PlanningItem } from "./planning-geometry";
export type { PlanningGeometry } from "./planning-geometry";


/** Applies a computed translation map to a caller-owned item list. */
function applyPlanningDeltas<T extends PlanningItem>(items: T[], deltas: Record<string, KernelPoint>, move: (item: T, delta: KernelPoint) => T): T[] {
  return items.map((item) => move(item, deltas[item.id] ?? { x: 0, y: 0 }));
}

export function alignPlanningItems<T extends PlanningItem>(items: T[], axis: PlanningAxis, edge: AlignmentEdge, move: (item: T, delta: KernelPoint) => T) {
  return applyPlanningDeltas(items, alignmentDeltas(items, axis, edge), move);
}

export function distributePlanningItems<T extends PlanningItem>(items: T[], axis: PlanningAxis, move: (item: T, delta: KernelPoint) => T) {
  return applyPlanningDeltas(items, distributionDeltas(items, axis), move);
}

/** A single safe entry point for node insertion, keeping unsupported primitives unchanged. */
export function insertGeometryNode(geometry: PlanningGeometry, target: { near?: KernelPoint; segmentIndex?: number }): PlanningGeometry | undefined {
  if (geometry.kind === "region" && target.near) { const shape = insertRegionVertex(geometry.shape, target.near); return shape ? { ...geometry, shape } : undefined; }
  if (geometry.kind === "bezier" && target.segmentIndex !== undefined) { const nodes = insertBezierNode(geometry.nodes, target.segmentIndex, geometry.closed); return nodes ? { ...geometry, nodes } : undefined; }
  if (geometry.kind === "path" && target.segmentIndex !== undefined) {
    const index = target.segmentIndex; const next = geometry.closed ? (index + 1) % geometry.points.length : index + 1;
    if (index < 0 || index >= geometry.points.length || next === index || (!geometry.closed && next >= geometry.points.length)) return undefined;
    const first = geometry.points[index]; const second = geometry.points[next]; const midpoint = { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 };
    return { ...geometry, points: next === 0 ? [...geometry.points, midpoint] : [...geometry.points.slice(0, next), midpoint, ...geometry.points.slice(next)] };
  }
  return undefined;
}

/** Inserts a node at the nearest point to a click, keeping the original path/curve shape. */
export function insertGeometryNodeAt(geometry: PlanningGeometry, near: KernelPoint): PlanningGeometry | undefined {
  const target = planningInsertionTarget(geometry, near);
  if (!target || target.ratio <= 1e-6 || target.ratio >= 1 - 1e-6) return undefined;
  if (geometry.kind === "region") { const shape = insertRegionVertex(geometry.shape, target.point); return shape ? { ...geometry, shape } : undefined; }
  if (geometry.kind === "path") {
    const nextIndex = (target.segmentIndex + 1) % geometry.points.length;
    return { ...geometry, points: nextIndex === 0 ? [...geometry.points, target.point] : [...geometry.points.slice(0, nextIndex), target.point, ...geometry.points.slice(nextIndex)] };
  }
  const nodes = insertBezierNodeAt(geometry.nodes, target.segmentIndex, target.ratio, geometry.closed);
  return nodes ? { ...geometry, nodes } : undefined;
}

export function removeGeometryNode(geometry: PlanningGeometry, polygonIndex: number, vertexIndex: number): PlanningGeometry | undefined {
  if (geometry.kind === "region") { const shape = removeRegionVertex(geometry.shape, polygonIndex, vertexIndex); return shape ? { ...geometry, shape } : undefined; }
  if (geometry.kind === "bezier" && geometry.nodes.length > 2 && geometry.nodes[vertexIndex]) return { ...geometry, nodes: geometry.nodes.filter((_, index) => index !== vertexIndex) };
  if (geometry.kind === "path" && geometry.points.length > 2 && geometry.points[vertexIndex]) return { ...geometry, points: geometry.points.filter((_, index) => index !== vertexIndex) };
  return undefined;
}

function copyBezierNode(node: BezierNode): BezierNode {
  return { anchor: { ...node.anchor }, ...(node.inHandle ? { inHandle: { ...node.inHandle } } : {}), ...(node.outHandle ? { outHandle: { ...node.outHandle } } : {}) };
}

/** Splits an open path or Bezier at an explicitly selected interior anchor. */
export function splitPathGeometry(geometry: PlanningGeometry, vertexIndex: number): [PlanningGeometry, PlanningGeometry] | undefined {
  if (geometry.kind === "region" || geometry.closed) return undefined;
  if (geometry.kind === "path") {
    const split = splitPathAt(geometry.points, vertexIndex); return split ? [{ ...geometry, points: split[0], closed: false }, { ...geometry, points: split[1], closed: false }] : undefined;
  }
  if (geometry.kind !== "bezier" || geometry.nodes.length < 3 || vertexIndex <= 0 || vertexIndex >= geometry.nodes.length - 1) return undefined;
  const firstNodes = geometry.nodes.slice(0, vertexIndex + 1).map(copyBezierNode);
  const secondNodes = geometry.nodes.slice(vertexIndex).map(copyBezierNode);
  const firstLast = firstNodes.at(-1)!; firstNodes[firstNodes.length - 1] = { ...firstLast, outHandle: undefined };
  secondNodes[0] = { ...secondNodes[0], inHandle: undefined };
  return [{ ...geometry, nodes: firstNodes, closed: false }, { ...geometry, nodes: secondNodes, closed: false }];
}

function clipRibbonCutouts(cutouts: readonly RegionShape[], ribbon: DrawingElement) {
  const band = ribbonShape({ ...ribbon, ribbonCutouts: undefined });
  if (!band) return undefined;
  return cutouts.flatMap((cutout) => {
    const result = assessRegionConstraint(cutout, band);
    return result.state === "inside" ? [cutout] : result.state === "clip-available" ? result.shapes : [];
  });
}

/** Creates the two elements for an open path/Bezier split, preserving road ribbon metadata. */
export function splitPlanningElement(element: DrawingElement, vertexIndex: number, createId: () => string, partName: string): [DrawingElement, DrawingElement] | undefined {
  if (element.geometry.kind !== "path" && element.geometry.kind !== "bezier") return undefined;
  const split = splitPathGeometry(element.geometry, vertexIndex);
  if (!split) return undefined;
  const firstGeometry = split[0].kind === "path" || split[0].kind === "bezier" ? split[0] : undefined;
  const secondGeometry = split[1].kind === "path" || split[1].kind === "bezier" ? split[1] : undefined;
  if (!firstGeometry || !secondGeometry) return undefined;
  if (element.layerId !== "roads") return [{ ...element, geometry: firstGeometry }, { ...element, id: createId(), name: partName, geometry: secondGeometry }];

  const splitT = ribbonStationAt(element, vertexIndex);
  if (splitT === undefined) return undefined;
  const [firstProfile, secondProfile] = splitRibbonWidthProfile(element, splitT);
  if (element.widthProfile && (!firstProfile || !secondProfile)) return undefined;
  const firstRibbon = { ...element, geometry: firstGeometry, widthProfile: firstProfile, ribbonCutouts: undefined };
  const secondRibbon = { ...element, geometry: secondGeometry, widthProfile: secondProfile, ribbonCutouts: undefined };
  const firstCutouts = element.ribbonCutouts ? clipRibbonCutouts(element.ribbonCutouts, firstRibbon) : undefined;
  const secondCutouts = element.ribbonCutouts ? clipRibbonCutouts(element.ribbonCutouts, secondRibbon) : undefined;
  if (element.ribbonCutouts && (!firstCutouts || !secondCutouts)) return undefined;
  const roadMetadata = (profile: typeof firstProfile, cutouts: RegionShape[] | undefined) => ({ ...(element.widthProfile ? { widthProfile: profile } : {}), ...(element.ribbonCutouts ? { ribbonCutouts: cutouts } : {}) });
  return [
    { ...element, geometry: firstGeometry, ...roadMetadata(firstProfile, firstCutouts) },
    { ...element, id: createId(), name: partName, geometry: secondGeometry, ...roadMetadata(secondProfile, secondCutouts) },
  ];
}

export function splitRegionGeometry(shape: RegionShape, lineStart: KernelPoint, lineEnd: KernelPoint): [RegionShape, RegionShape] | undefined {
  if (shape.kind !== "polygon") return undefined;
  const split = splitPolygonByLine(shape.points, lineStart, lineEnd); return split ? [{ kind: "polygon", points: split[0] }, { kind: "polygon", points: split[1] }] : undefined;
}
