import type { KernelPoint } from "../geometry/geometry-types";
import type { RegionShape } from "../model/project-model";
import { regionArea } from "../geometry/region-constraints";
import { regionBounds, type PlanningBounds } from "./planning-geometry";

export type PlanningUnit = "metric" | "imperial";
function metresPerUnit(unit: PlanningUnit) { return unit === "metric" ? 1 : .3048; }

export function distanceBetween(first: KernelPoint, second: KernelPoint) { return Math.hypot(second.x - first.x, second.y - first.y); }
export function angleBetween(first: KernelPoint, second: KernelPoint) { return Math.atan2(second.y - first.y, second.x - first.x) * 180 / Math.PI; }

export type GeometryDimensions = { width: number; height: number; area?: number; angle?: number };

export function geometryDimensions(shape: RegionShape, angle?: number): GeometryDimensions | undefined {
  const bounds = regionBounds(shape); if (!bounds) return undefined;
  const value: GeometryDimensions = { width: Math.max(0, bounds.maxX - bounds.minX), height: Math.max(0, bounds.maxY - bounds.minY), angle };
  if (shape.kind !== "bezier") { try { value.area = regionArea(shape); } catch { value.area = undefined; } }
  return value;
}

export function formatMeasurement(valueInMetres: number, unit: PlanningUnit, precision = 2) {
  const value = valueInMetres / metresPerUnit(unit); const rounded = Math.abs(value) < 10 ** -precision / 2 ? 0 : Number(value.toFixed(precision)); return `${rounded} ${unit === "metric" ? "m" : "ft"}`;
}

export function formatAreaMeasurement(valueInSquareMetres: number, unit: PlanningUnit, precision = 2) {
  const value = valueInSquareMetres / metresPerUnit(unit) ** 2; const rounded = Math.abs(value) < 10 ** -precision / 2 ? 0 : Number(value.toFixed(precision)); return `${rounded} ${unit === "metric" ? "m²" : "ft²"}`;
}

export function formatAngle(degrees: number, precision = 1) { return `${Number(degrees.toFixed(precision))}°`; }

export function boundsDimensions(bounds: PlanningBounds) { return { width: Math.max(0, bounds.maxX - bounds.minX), height: Math.max(0, bounds.maxY - bounds.minY) }; }
