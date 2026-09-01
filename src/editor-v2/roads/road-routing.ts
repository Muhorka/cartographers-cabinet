import type { KernelPoint } from "../geometry/geometry-types";
import type { DrawingElement, EditorProject, RegionShape } from "../model/project-model";
import { assessPathConstraint } from "../geometry/path-constraints";
import { assessRegionConstraint, shapePolygons } from "../geometry/region-constraints";
import { ribbonPoints, ribbonShape, ribbonWidth } from "../geometry/ribbon-geometry";
import { expandRoadObstacle, roadObstacles } from "./road-obstacles";

const distance = (a: KernelPoint, b: KernelPoint) => Math.hypot(a.x - b.x, a.y - b.y);
function clear(a: KernelPoint, b: KernelPoint, obstacles: RegionShape[]) {
  return distance(a, b) < 1e-7 || obstacles.every((shape) => assessPathConstraint([a, b], shape).state === "outside");
}
/** Visibility graph uses buffered building geometry, including rotated outlines;
 * boundaries, terrain and bridges are not obstacles. No geometry is deleted. */
function detour(start: KernelPoint, end: KernelPoint, obstacles: RegionShape[]): KernelPoint[] | undefined {
  if (clear(start, end, obstacles)) return [start, end];
  const corners = obstacles.flatMap((shape) => shapePolygons(expandRoadObstacle(shape, .02)).flatMap(({ outer, holes }) => [outer, ...holes].flat()));
  if (corners.length > 350) return;
  const nodes = [start, end, ...corners]; const cost = nodes.map(() => Infinity); cost[0] = 0;
  const previous = nodes.map(() => -1); const visited = new Set<number>();
  while (visited.size < nodes.length) {
    let current = -1;
    for (let i = 0; i < nodes.length; i++) if (!visited.has(i) && (current < 0 || cost[i] < cost[current])) current = i;
    if (current < 0 || !Number.isFinite(cost[current])) return;
    if (current === 1) { const result = [end]; while (previous[current] !== -1) { current = previous[current]; result.unshift(nodes[current]); } return result; }
    visited.add(current);
    for (let next = 0; next < nodes.length; next++) {
      if (visited.has(next)) continue;
      const candidate = cost[current] + distance(nodes[current], nodes[next]);
      if (candidate < cost[next] && clear(nodes[current], nodes[next], obstacles)) { cost[next] = candidate; previous[next] = current; }
    }
  }
}
export function roadFitsBuildings(project: EditorProject, element: DrawingElement) {
  if (element.layerId !== "roads") return true;
  const shape = ribbonShape(element); if (!shape) return false;
  return roadObstacles(project, element.belongsToId).every((obstacle) => assessRegionConstraint(shape, obstacle).state === "outside");
}
export function routeRoad(project: EditorProject, element: DrawingElement): DrawingElement | undefined {
  if (roadFitsBuildings(project, element)) return element;
  const half = Math.max(ribbonWidth(element) / 2, ...(element.widthProfile ?? []).flatMap(({ left, right }) => [left, right]));
  const obstacles = roadObstacles(project, element.belongsToId).map((shape) => expandRoadObstacle(shape, half * 1.5 + .1));
  const points = ribbonPoints(element);
  // Discard interior samples only for routing; the endpoints retain user intent.
  const available = points.filter((point, index) => index === 0 || index === points.length - 1 || clear(point, { x: point.x + 1e-5, y: point.y }, obstacles));
  const routed: KernelPoint[] = [];
  for (let i = 1; i < available.length; i++) {
    const part = detour(available[i - 1], available[i], obstacles); if (!part) return;
    routed.push(...(routed.length ? part.slice(1) : part));
  }
  const next: DrawingElement = { ...element, geometry: { kind: "path", points: routed, closed: false } };
  return routed.length >= 2 && roadFitsBuildings(project, next) ? next : undefined;
}
