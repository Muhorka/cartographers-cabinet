import type { KernelPoint } from "../../geometry/geometry-types";
import { sampleBezier } from "../../geometry/bezier-geometry";
import { ribbonShape } from "../../geometry/ribbon-geometry";
import type { DrawingElement, EditorProject, RegionShape } from "../../model/project-model";
import { insidePoint } from "./geometry";
import { isWaterTerrainElement } from "./outdoor";

/** The endpoint data consumed by the route planner and persisted in a route query. */
export type StoryRouteEndpoint = { placeId: string; point: KernelPoint };

export type StoryRouteEndpointOption = {
  id: string;
  kind: "place" | "terrain";
  name: string;
  placeId: string;
  point: KernelPoint;
  elementId?: string;
  /** Water has no safe implicit endpoint; the user must pick a concrete point. */
  requiresPoint?: boolean;
};

function midpoint(points: readonly KernelPoint[]): KernelPoint | undefined {
  if (!points.length) return undefined;
  if (points.length === 1) return points[0];
  const lengths = points.slice(1).map((point, index) => Math.hypot(point.x - points[index]!.x, point.y - points[index]!.y));
  const total = lengths.reduce((sum, length) => sum + length, 0);
  if (!total) return points[0];
  let distance = total / 2;
  for (let index = 0; index < lengths.length; index += 1) {
    const length = lengths[index]!;
    if (distance <= length) {
      const start = points[index]!;
      const end = points[index + 1]!;
      const ratio = length ? distance / length : 0;
      return { x: start.x + (end.x - start.x) * ratio, y: start.y + (end.y - start.y) * ratio };
    }
    distance -= length;
  }
  return points.at(-1);
}

function terrainPoint(element: DrawingElement): KernelPoint | undefined {
  const geometry = element.geometry;
  if (geometry.kind === "region") return insidePoint(geometry.shape);
  if (geometry.kind === "point" || geometry.kind === "note") return geometry.at;
  // Flowing water is represented by a ribbon. The centre-line point keeps the
  // endpoint on the water while the planner still treats the ribbon as a
  // water obstacle and therefore requires an explicit bridge to cross it.
  if (geometry.kind === "path" || geometry.kind === "bezier") {
    const shape: RegionShape | undefined = geometry.kind === "path" && geometry.closed && geometry.points.length >= 3
      ? { kind: "polygon", points: geometry.points }
      : geometry.kind === "bezier" && geometry.closed && geometry.nodes.length >= 3
        ? { kind: "polygon", points: sampleBezier(geometry.nodes, true) }
        : ribbonShape(element);
    if (shape) return insidePoint(shape);
    return midpoint(geometry.kind === "path" ? geometry.points : sampleBezier(geometry.nodes, geometry.closed));
  }
  return undefined;
}

function samePoint(left: KernelPoint, right: KernelPoint) {
  return Math.abs(left.x - right.x) <= 1e-7 && Math.abs(left.y - right.y) <= 1e-7;
}

function endpointOwnerPath(project: EditorProject, option: StoryRouteEndpointOption) {
  const path: string[] = [];
  const seen = new Set<string>();
  let ownerId = option.kind === "place" ? project.places.find(({ id }) => id === option.placeId)?.parentId : option.placeId;
  while (ownerId && !seen.has(ownerId)) {
    seen.add(ownerId);
    const owner = project.places.find(({ id }) => id === ownerId);
    if (!owner) break;
    path.push(owner.name);
    ownerId = owner.parentId;
  }
  return path;
}

function disambiguateEndpointNames(project: EditorProject, options: StoryRouteEndpointOption[]) {
  const repeated = new Map<string, StoryRouteEndpointOption[]>();
  for (const option of options) repeated.set(option.name, [...(repeated.get(option.name) ?? []), option]);
  for (const group of repeated.values()) {
    if (group.length < 2) continue;
    const paths = group.map((option) => endpointOwnerPath(project, option));
    const maxDepth = Math.max(...paths.map((path) => path.length), 0);
    let depth = 1;
    for (; depth <= maxDepth; depth += 1) {
      const suffixes = paths.map((path) => path.slice(0, depth).join(" — "));
      if (suffixes.every(Boolean) && new Set(suffixes).size === group.length) break;
    }
    if (depth <= maxDepth) {
      group.forEach((option, index) => { option.name = `${option.name} — ${paths[index]!.slice(0, depth).join(" — ")}`; });
    } else {
      group.forEach((option, index) => {
        const context = paths[index]!.join(" — ");
        option.name = `${option.name}${context ? ` — ${context}` : ""} · ${index + 1}`;
      });
    }
  }
}

/**
 * Lists ordinary places and authored terrain objects as route endpoint choices.
 * Terrain remains owned by its existing place; the route model consequently
 * stays backwards-compatible and receives only the owner's local point.
 */
export function storyRouteEndpointOptions(project: EditorProject): StoryRouteEndpointOption[] {
  const places = project.places
    .filter(({ kind }) => kind !== "building")
    // Keep ordinary place option values equal to the historical place IDs;
    // callers and saved-route tooling have always treated those as stable UI
    // values. Terrain options use their own namespace below.
    .map((place) => ({ id: place.id, kind: "place" as const, name: place.name, placeId: place.id, point: insidePoint(place.boundary) }));
  const terrain = project.elements.flatMap((element) => {
    if (element.layerId !== "terrain") return [];
    const owner = project.places.find(({ id, kind }) => id === element.belongsToId && kind !== "building");
    const point = owner && terrainPoint(element);
    if (!owner || !point) return [];
    return [{ id: `terrain:${element.id}`, kind: "terrain" as const, name: element.name, placeId: owner.id, point, elementId: element.id, ...(isWaterTerrainElement(element) ? { requiresPoint: true } : {}) }];
  });
  const options = [...places, ...terrain];
  disambiguateEndpointNames(project, options);
  return options;
}

export function endpointForOption(option: StoryRouteEndpointOption): StoryRouteEndpoint {
  return { placeId: option.placeId, point: option.point };
}

/** Finds the UI choice represented by a persisted or edited endpoint. */
export function endpointOptionId(options: readonly StoryRouteEndpointOption[], endpoint: StoryRouteEndpoint) {
  // Prefer the ordinary place choice when its default point is unchanged. This
  // keeps old saved routes and the initial panel state visually stable.
  return options.find((option) => option.kind === "place" && option.placeId === endpoint.placeId && samePoint(option.point, endpoint.point))?.id
    ?? options.find((option) => option.placeId === endpoint.placeId && samePoint(option.point, endpoint.point))?.id
    ?? options.find((option) => option.kind === "place" && option.placeId === endpoint.placeId)?.id
    ?? "";
}
