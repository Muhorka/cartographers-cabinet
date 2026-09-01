import { eraserRegionShapes } from "../geometry/eraser-geometry";
import { ribbonShape } from "../geometry/ribbon-geometry";
import { isRibbonElement } from "../geometry/ribbon-geometry";
import { regionArea, subtractRegionShape } from "../geometry/region-constraints";
import type { KernelPoint } from "../geometry/geometry-types";
import type { DrawingElement, RegionShape } from "../model/project-model";

/** Persists the exact UI eraser field as a mask while keeping the editable
 * centerline and width profile canonical. */
export function eraseRibbon(element: DrawingElement, eraser: readonly KernelPoint[], radius: number): DrawingElement[] {
  if (!isRibbonElement(element) || element.locked || (element.geometry.kind !== "path" && element.geometry.kind !== "bezier")) return [element];
  const masks = eraserRegionShapes(eraser, radius); if (!masks.length) return [element];
  const before = ribbonShape(element); if (!before) return [element];
  let after: RegionShape | undefined = before;
  for (const mask of masks) after = after ? subtractRegionShape(after, mask) : undefined;
  if (!after || regionArea(after) <= 1e-7) return [];
  if (regionArea(after) >= regionArea(before) - 1e-7) return [element];
  return [{ ...element, ribbonCutouts: [...(element.ribbonCutouts ?? []), ...masks] }];
}
