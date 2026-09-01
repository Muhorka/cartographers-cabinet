import type { RegionShape } from "../model/project-model";
import { regionArea, unionRegionShapes } from "./region-constraints";

const AREA_EPSILON = 1e-7;

export type RegionUnionResult =
  | { state: "merged"; shape: RegionShape }
  | { state: "unchanged"; shape: RegionShape };

/**
 * Computes one real geometric union for a group of regions.
 *
 * A contained region is deliberately reported as `unchanged`: accepting that
 * result would silently swallow an object, which is especially confusing for
 * furniture and for named construction surfaces.  Disconnected regions are
 * valid and remain a compound shape in the result.
 */
export function unionCompatibleRegionShapes(shapes: readonly RegionShape[]): RegionUnionResult | undefined {
  if (!shapes.length) return undefined;
  const shape = unionRegionShapes(shapes);
  if (!shape) return undefined;
  const largestSource = Math.max(...shapes.map(regionArea));
  return regionArea(shape) <= largestSource + AREA_EPSILON
    ? { state: "unchanged", shape }
    : { state: "merged", shape };
}
