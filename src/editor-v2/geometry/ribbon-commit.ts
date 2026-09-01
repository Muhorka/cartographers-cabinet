import { isFlowingWater, isRoad } from "./ribbon-geometry";
import type { DrawingElement, EditorProject } from "../model/project-model";
import { commitRoadEdit } from "../roads/road-editing";

/** Commits ribbon geometry with road routing only for actual roads. */
export function commitRibbonEdit(project: EditorProject, candidate: DrawingElement) {
  if (isRoad(candidate)) return commitRoadEdit(project, candidate);
  if (!isFlowingWater(candidate)) return;
  return { ...project, elements: project.elements.map((element) => element.id === candidate.id ? candidate : element) };
}
