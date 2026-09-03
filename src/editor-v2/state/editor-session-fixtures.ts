import type { CanonicalWall } from "../geometry/geometry-types";
import { createPlace } from "../model/hierarchy-operations";
import { emptyProject, type EditorProject } from "../model/project-model";

export function squareWalls(role: CanonicalWall["role"] = "boundary"): CanonicalWall[] {
  return [
    { id: `${role}-north`, start: { x: 0, y: 0 }, end: { x: 10, y: 0 }, thickness: 0.3, role },
    { id: `${role}-east`, start: { x: 10, y: 0 }, end: { x: 10, y: 8 }, thickness: 0.3, role },
    { id: `${role}-south`, start: { x: 10, y: 8 }, end: { x: 0, y: 8 }, thickness: 0.3, role },
    { id: `${role}-west`, start: { x: 0, y: 8 }, end: { x: 0, y: 0 }, thickness: 0.3, role },
  ];
}

export function projectWithPlaces(): EditorProject {
  let project = emptyProject("project", "Project");
  project = createPlace(project, { id: "world", name: "World", kind: "world" });
  return createPlace(project, { id: "room", parentId: "world", name: "Room", kind: "location" });
}
