import { describe, expect, it, vi } from "vitest";
import { createStarterProject } from "../model/starter-project";
import { EditorSession } from "../state/editor-session";
import { openWorkbenchPlace } from "./workbench-place-navigation";

function harness() {
  const project = createStarterProject("project", "Project", "pl"); const building = project.places.find(({ kind }) => kind === "building")!; const level = project.places.find(({ kind }) => kind === "level")!;
  const session = new EditorSession(project, { initialPlaceId: level.id });
  const actions = { inspect: vi.fn(), expand: vi.fn(), clearSelection: vi.fn(), setViewport: vi.fn(), refresh: vi.fn() };
  return { project, building, level, session, actions };
}

describe("workbench place navigation", () => {
  it("changes inspection without reopening or moving an already displayed level", () => {
    const { building, level, session, actions } = harness(); const open = vi.spyOn(session, "openPlace");
    expect(openWorkbenchPlace(session, building.id, actions)).toBe(true);
    expect(open).not.toHaveBeenCalled(); expect(actions.inspect).toHaveBeenCalledWith({ projectId: "project", placeId: building.id });
    expect(actions.clearSelection).toHaveBeenCalledOnce(); expect(actions.setViewport).not.toHaveBeenCalled(); expect(actions.refresh).not.toHaveBeenCalled();
    expect(session.getViewState().activePlaceId).toBe(level.id);
  });

  it("does not change inspection when session navigation is blocked", () => {
    const { project, session, actions } = harness(); const world = project.places.find(({ kind }) => kind === "world")!;
    session.setPendingStructuralTransaction({ id: "pending", constructionId: "construction", beforeRevision: 0 });
    expect(openWorkbenchPlace(session, world.id, actions)).toBe(false);
    expect(actions.inspect).not.toHaveBeenCalled(); expect(actions.clearSelection).not.toHaveBeenCalled(); expect(actions.setViewport).not.toHaveBeenCalled();
  });
});
