import { describe, expect, it } from "vitest";
import { createPlace } from "../model/hierarchy-operations";
import { emptyProject } from "../model/project-model";
import { inspectorFocus, orderedBuildingLevels, placeOpenIntent, reconcileInspectorFocus } from "./workbench-inspector-focus";

function hierarchy(projectId = "project") {
  let project = createPlace(emptyProject(projectId, "Project"), { id: "world", name: "World", kind: "world" });
  project = createPlace(project, { id: "building", parentId: "world", name: "House", kind: "building" });
  project = createPlace(project, { id: "upper", parentId: "building", name: "Upper", kind: "level", order: 2 });
  project = createPlace(project, { id: "ground", parentId: "building", name: "Ground", kind: "level", order: 0 });
  return createPlace(project, { id: "room", parentId: "upper", name: "Room", kind: "room" });
}

describe("workbench inspector focus", () => {
  it("opens a deterministic first level while keeping the building inspected", () => {
    const project = hierarchy();
    expect(orderedBuildingLevels(project, "building").map(({ id }) => id)).toEqual(["ground", "upper"]);
    expect(placeOpenIntent(project, "building", "world")).toEqual({ displayedPlaceId: "ground", inspectedPlaceId: "building" });
  });

  it("keeps the currently displayed level of the requested building", () => {
    const project = hierarchy();
    expect(placeOpenIntent(project, "building", "upper")).toEqual({ displayedPlaceId: "upper", inspectedPlaceId: "building" });
    expect(placeOpenIntent(project, "building", "room")).toEqual({ displayedPlaceId: "upper", inspectedPlaceId: "building" });
    expect(placeOpenIntent(project, "ground", "upper")).toEqual({ displayedPlaceId: "ground", inspectedPlaceId: "ground" });
  });

  it("preserves a live focus, falls back after deletion and never crosses projects", () => {
    const project = hierarchy(); const focus = inspectorFocus(project, "building")!;
    expect(reconcileInspectorFocus(focus, project, "ground")).toBe(focus);
    const withoutBuilding = { ...project, places: project.places.filter(({ id }) => id !== "building") };
    expect(reconcileInspectorFocus(focus, withoutBuilding, "ground")).toEqual({ projectId: "project", placeId: "ground" });
    const other = hierarchy("other");
    expect(reconcileInspectorFocus(focus, other, "upper")).toEqual({ projectId: "other", placeId: "upper" });
  });
});
