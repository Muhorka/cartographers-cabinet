import type { RoomFace } from "./geometry-types";
import { regionArea } from "./region-constraints";
import type { RegionShape } from "../model/project-model";

/** Returns the filled area of a map region; degenerate geometry has no area. */
export function mapRegionArea(shape: RegionShape): number | undefined {
  try { const area = regionArea(shape); return Number.isFinite(area) && area > 1e-7 ? area : undefined; } catch { return undefined; }
}

/** Uses the same hole-aware calculation as map regions for a derived room face. */
export function mapRoomArea(face: Pick<RoomFace, "outer" | "holes">): number | undefined {
  return mapRegionArea({ kind: "compound", polygons: [{ outer: face.outer, holes: face.holes }] });
}

export function formatMapArea(area: number | undefined, units: "metric" | "imperial") {
  if (area === undefined) return undefined;
  const converted = units === "imperial" ? area * 10.7639 : area;
  return `${converted.toFixed(area < 1 ? 1 : 0)} ${units === "imperial" ? "ft²" : "m²"}`;
}

export type MapLabelText = string | { name: string; area: string };

export function mapLabelWithArea(name: string, area: number | undefined, units: "metric" | "imperial", enabled: boolean): MapLabelText {
  const formatted = enabled ? formatMapArea(area, units) : undefined;
  return formatted ? { name, area: formatted } : name;
}
