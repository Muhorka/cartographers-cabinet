import type { MapGestureCommandInput, MapGestureCommandResult } from "../drawing/map-gesture-command";
import type { EditorProject } from "../model/project-model";
import { routeRoad } from "./road-routing";
import { applyRibbonGesture } from "../drawing/ribbon-gesture";
import { isRoad } from "../geometry/ribbon-geometry";

export function applyRoadGesture(project: EditorProject, input: MapGestureCommandInput, id: string, name: string): MapGestureCommandResult {
  const result = applyRibbonGesture(project, input, id, name);
  if (result.state !== "applied" || !result.selection) return result;
  const candidate = result.project.elements.find(({ id: elementId }) => elementId === id);
  if (!candidate || !isRoad(candidate)) return { state: "nothing", project };
  const road = routeRoad(project, candidate);
  if (!road) return { state: "blocked", project, reason: "road-obstacle" };
  return { state: "applied", project: { ...project, elements: [...project.elements, road] }, selection: { kind: "element", id } };
}
