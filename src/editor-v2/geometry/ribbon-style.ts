import type { DrawingElement } from "../model/project-model";
import { isFlowingWater } from "./ribbon-geometry";
import { roadAppearance } from "../roads/road-style";

export function ribbonWidthFor(subjectId: string) {
  return ({ "road.paved": 6, "road.dirt": 3, "road.path": 1.5, "road.sidewalk": 2, "terrain.river": 5, "terrain.stream": 2 }[subjectId] ?? 4);
}

export function ribbonAppearance(element: Pick<DrawingElement, "subjectId" | "appearance" | "layerId">) {
  if (isFlowingWater(element)) return { fillColor: element.appearance?.fillColor ?? (element.subjectId === "terrain.stream" ? "#5e9fc4" : "#3f82ad"), fillOpacity: element.appearance?.fillOpacity ?? .72 };
  return roadAppearance(element);
}
