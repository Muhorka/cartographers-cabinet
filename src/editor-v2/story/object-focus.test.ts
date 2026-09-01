import { describe, expect, it, vi } from "vitest";
import { createStarterProject } from "../model/starter-project";
import { createStoryObjectFocus, storyObjectLocation } from "./object-focus";

function fixture() {
  const project = createStarterProject("focus", "Synthetic navigation", "en");
  const level = project.places.find(({ kind }) => kind === "level")!;
  const plan = project.constructions.find(({ id }) => id === level.constructionId)!;
  plan.openings = [{ id: "door", kind: "door", wallId: plan.walls[0].id, position: .5, width: 1 }];
  return { project, level, plan };
}

describe("shared Story object navigation", () => {
  it("locates a scoped room, wall and opening on their construction sheet", () => {
    const { project, level, plan } = fixture();
    for (const ref of [{ kind: "room" as const, id: plan.rooms[0].id }, { kind: "wall" as const, id: plan.walls[0].id }, { kind: "opening" as const, id: "door" }]) {
      expect(storyObjectLocation(project, { ...ref, scopeId: plan.id })).toMatchObject({ placeId: level.id, selection: ref });
    }
  });

  it("opens the exact sheet when room ids are reused on another floor", () => {
    const { project, level, plan } = fixture();
    const otherPlan = { ...structuredClone(plan), id: "other-plan" };
    const otherLevel = { ...structuredClone(level), id: "other-level", constructionId: otherPlan.id };
    project.constructions.push(otherPlan); project.places.push(otherLevel);
    expect(storyObjectLocation(project, { kind: "room", id: plan.rooms[0].id })).toBeUndefined();
    expect(storyObjectLocation(project, { kind: "room", id: plan.rooms[0].id, scopeId: otherPlan.id })).toMatchObject({ placeId: otherLevel.id });
  });

  it("focuses without modifying authored state and rejects missing or mixed-sheet requests", () => {
    const { project, level, plan } = fixture(); const before = JSON.stringify(project);
    const open = vi.fn(); const select = vi.fn(); const focus = createStoryObjectFocus(() => ({ project }), open, select);
    const door = { kind: "opening" as const, id: "door", scopeId: plan.id };
    expect(focus([door, door])).toBe(true);
    expect(open).toHaveBeenCalledWith(level.id); expect(select).toHaveBeenLastCalledWith([{ kind: "opening", id: "door" }]);
    open.mockClear(); select.mockClear();
    expect(focus([{ ...door, scopeId: "missing" }])).toBe(false);
    expect(focus([door, { kind: "place", id: "focus:world" }])).toBe(false);
    expect(open).not.toHaveBeenCalled(); expect(select).not.toHaveBeenCalled(); expect(JSON.stringify(project)).toBe(before);
  });
});
