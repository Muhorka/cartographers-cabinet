import { describe, expect, it } from "vitest";
import { createPlace, deletePlaceSubtree } from "./hierarchy-operations";
import { emptyProject } from "./project-model";
import { placeToOpenAbove, placeToOpenAfterDeletion } from "./navigation-fallback";

function projectWithLevels() {
  let project = createPlace(emptyProject("project", "Project"), { id: "world", name: "World", kind: "world" });
  project = createPlace(project, { id: "building", parentId: "world", name: "House", kind: "building" });
  project = createPlace(project, { id: "ground", parentId: "building", name: "Ground", kind: "level" });
  return createPlace(project, { id: "first", parentId: "building", name: "First", kind: "level" });
}

describe("navigation after deleting a place", () => {
  it("returns from a single-level plan directly to the map containing its building", () => {
    let project = projectWithLevels(); project = deletePlaceSubtree(project, "first");
    expect(placeToOpenAbove(project, "ground")).toBe("world");
  });

  it("returns from one of several levels to the building level chooser", () => {
    expect(placeToOpenAbove(projectWithLevels(), "first")).toBe("building");
  });

  it("returns from a room to its floor plan", () => {
    let project = projectWithLevels(); project = createPlace(project, { id: "room", parentId: "ground", name: "Room", kind: "room" });
    expect(placeToOpenAbove(project, "room")).toBe("ground");
  });

  it("opens a sibling level when the active level is deleted", () => {
    const before = projectWithLevels(); const after = deletePlaceSubtree(before, "first");
    expect(placeToOpenAfterDeletion(before, after, "first", "first")).toBe("ground");
  });

  it("keeps the current map when a different place is deleted", () => {
    const before = projectWithLevels(); const after = deletePlaceSubtree(before, "first");
    expect(placeToOpenAfterDeletion(before, after, "first", "world")).toBe("world");
  });

  it("opens the containing place when its last relevant child disappears", () => {
    let before = projectWithLevels(); before = deletePlaceSubtree(before, "ground");
    const after = deletePlaceSubtree(before, "first");
    expect(placeToOpenAfterDeletion(before, after, "first", "first")).toBe("building");
  });
});
