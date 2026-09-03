import { describe, expect, it } from "vitest";
import { EditorSession } from "../state/editor-session";
import { emptyProject, type EditorProject } from "../model/project-model";
import { emptyStoryData, type StoryData } from "./types";
import { readScenarioEffects } from "./scenario-effects";
import { removeScenarioEffect, reorderScenarioStep, replaceProjectScenarios, replaceScenario, updateScenarioStep } from "./scenario-commands";
import { applyStoryCommand } from "./operations";
import { applyProjectStoryMetadata } from "./project-commands";

const placeRef = { kind: "place" as const, id: "place" };
const roomRef = { kind: "room" as const, id: "room", scopeId: "plan" };
const access = { allow: ["friends"], deny: ["foes"], permission: "restricted" as const, physicalState: "closed" as const, lock: "none" as const, keyIds: ["key"], guardIds: ["guard"], secretKnowledge: ["secret"], hidden: true, knownBy: ["friends"] };

function fixture(): EditorProject {
  const story: StoryData = { ...emptyStoryData(), world: [{ id: "friends", kind: "access-group", name: "Friends", tags: [], properties: {} }, { id: "foes", kind: "access-group", name: "Foes", tags: [], properties: {} }, { id: "key", kind: "key", name: "Key", tags: [], properties: {} }, { id: "guard", kind: "character", name: "Guard", tags: [], properties: {} }, { id: "secret", kind: "character", name: "Secret", tags: [], properties: {} }], objects: [{ ref: placeRef, metadata: { narrativeDescription: "Base description", owners: ["base-owner"], tags: ["base-tag"], access: { ...access, allow: [], deny: [], keyIds: [], guardIds: [], secretKnowledge: [] }, properties: { mood: "base", empty: "before" } } }, { ref: roomRef, metadata: { properties: { mood: "room-base" } } }], scenarios: [{ id: "scene", name: "Scene", patches: [{ id: "whole", target: placeRef, title: "After", description: "", metadata: { owners: ["scenario-owner"], tags: [], access }, properties: { mood: "scenario", empty: "" } }], steps: [{ id: "step-a", name: "First", patches: [{ id: "step", target: placeRef, properties: { mood: "step" } }] }, { id: "step-b", name: "Second", patches: [] }] }, { id: "other", name: "Other", patches: [], steps: [] }] };
  return { ...emptyProject("p", "Synthetic"), places: [{ id: "place", name: "Place", description: "Base description", kind: "custom", transform: { x: 0, y: 0, rotation: 0 }, tags: [], access: [], properties: {} }, { id: "level", name: "Level", kind: "level", constructionId: "plan", transform: { x: 0, y: 0, rotation: 0 }, tags: [], access: [], properties: {} }, { id: "room", name: "Room", parentId: "level", kind: "room", transform: { x: 0, y: 0, rotation: 0 }, tags: [], access: [], properties: {} }], constructions: [{ id: "plan", revision: 0, walls: [], rooms: [{ id: "room", faceId: "face", name: "Room", tags: [], access: [], properties: {} }], openings: [], transitions: [] }], story };
}

describe("scenario effects", () => {
  it("reports all authored fields against base and preserves empty authored values", () => {
    const effect = readScenarioEffects(fixture(), "scene")[0]!;
    expect(effect.target).toEqual(placeRef); expect(effect.missing).toBe(false); expect(effect.objectName).toBe("After");
    expect(effect.fields.map(({ key }) => key)).toEqual(expect.arrayContaining(["narrativeLabel", "narrativeDescription", "owners", "tags", "access.allow", "access.deny", "access.permission", "access.physicalState", "access.lock", "access.keyIds", "access.guardIds", "access.secretKnowledge", "access.hidden", "access.knownBy", "property:mood", "property:empty"]));
    expect(effect.fields.find(({ key }) => key === "narrativeDescription")).toMatchObject({ before: "Base description", after: "", authored: "", changed: true });
    expect(effect.fields.find(({ key }) => key === "property:empty")).toMatchObject({ before: "before", after: "", authored: "", changed: true });
  });

  it("uses scenario as the step baseline and canonicalizes scoped rooms", () => {
    const project = fixture(); project.story.scenarios[0]!.steps[0]!.patches.push({ id: "room-step", target: { kind: "room", id: "room" }, properties: { mood: "room-step" } });
    const step = readScenarioEffects(project, "scene", "step-a");
    expect(step.find(({ patchId }) => patchId === "step")?.fields).toContainEqual(expect.objectContaining({ key: "property:mood", before: "scenario", after: "step", authored: "step" }));
    expect(step.find(({ patchId }) => patchId === "room-step")).toMatchObject({ target: roomRef, objectName: "Room", missing: false });
  });

  it("keeps missing targets visible and removes only the requested container patch", () => {
    const project = fixture(); project.story.scenarios[0]!.patches.push({ id: "missing", target: { kind: "place", id: "gone" }, properties: { mood: "lost" } }); project.story.scenarios[0]!.steps[0]!.patches.push({ id: "whole", target: placeRef, properties: { mood: "shadow" } });
    expect(readScenarioEffects(project, "scene").find(({ patchId }) => patchId === "missing")).toMatchObject({ missing: true, objectName: "place::gone" });
    const next = removeScenarioEffect(project, "scene", "whole", "step-a");
    expect(next.story.scenarios[0]!.patches.some(({ id }) => id === "whole")).toBe(true); expect(next.story.scenarios[0]!.steps[0]!.patches.some(({ id }) => id === "whole")).toBe(false);
    expect(removeScenarioEffect(project, "scene", "missing").story.scenarios[0]!.patches.some(({ id }) => id === "missing")).toBe(false);
  });

  it("rejects locked removal, supports step reorder and validates scope", () => {
    const locked = fixture(); locked.places[0]!.locked = true;
    expect(() => removeScenarioEffect(locked, "scene", "whole")).toThrow(/locked/);
    expect(() => removeScenarioEffect(fixture(), "scene", "whole", "step-b")).toThrow(/container/);
    const moved = reorderScenarioStep(fixture(), "scene", "step-b", -1); expect(moved.story.scenarios[0]!.steps.map(({ id }) => id)).toEqual(["step-b", "step-a"]);
    const renamed = updateScenarioStep(moved, "scene", { kind: "update", stepId: "step-b", changes: { name: "Renamed" } }); expect(renamed.story.scenarios[0]!.steps[0]!.name).toBe("Renamed");
  });

  it("allows whole-scenario metadata and step reorder when a locked effect is unchanged", () => {
    const project = fixture(); project.places[0]!.locked = true;
    delete project.story.scenarios[0]!.patches[0]!.metadata!.access!.lock;
    const current = project.story.scenarios[0]!;
    const next = replaceScenario(project, { ...current, name: "Renamed scene", steps: [current.steps[1]!, current.steps[0]!] });
    expect(next.story.scenarios[0]!.name).toBe("Renamed scene");
    expect(next.story.scenarios[0]!.steps.map(({ id }) => id)).toEqual(["step-b", "step-a"]);
    expect(project.story.scenarios[0]!.name).toBe("Scene");
  });

  it("rejects changed or removed effects on locked objects", () => {
    const project = fixture(); project.places[0]!.locked = true;
    const current = project.story.scenarios[0]!;
    expect(() => replaceScenario(project, { ...current, patches: current.patches.map((patch) => ({ ...patch, description: "Changed" })) })).toThrow(/locked/);
    expect(() => replaceScenario(project, { ...current, patches: [] })).toThrow(/locked/);
    expect(() => replaceScenario(project, { ...current, steps: current.steps.filter(({ id }) => id !== "step-a") })).toThrow(/locked/);
  });

  it("rejects new or changed effects whose targets are missing", () => {
    const project = fixture();
    const current = project.story.scenarios[0]!;
    const missing = { id: "missing", target: { kind: "place" as const, id: "gone" }, properties: { mood: "lost" } };
    expect(() => replaceScenario(project, { ...current, patches: [...current.patches, missing] })).toThrow(/does not exist/);
    project.story.scenarios[0]!.patches.push(missing);
    expect(() => replaceScenario(project, { ...project.story.scenarios[0]!, patches: project.story.scenarios[0]!.patches.map((patch) => patch.id === "missing" ? { ...patch, properties: { mood: "changed" } } : patch) })).toThrow(/does not exist/);
  });

  it("rejects duplicate step and patch ids instead of removing several records", () => {
    const project = fixture();
    const current = project.story.scenarios[0]!;
    expect(() => replaceScenario(project, { ...current, steps: [...current.steps, { ...current.steps[0]!, id: "step-a" }] })).toThrow(/duplicate step/);
    expect(() => replaceScenario(project, { ...current, patches: [...current.patches, { ...current.patches[0]!, id: "whole" }] })).toThrow(/duplicate patch/);
    project.story.scenarios[0]!.patches.push({ ...current.patches[0]!, id: "whole" });
    expect(() => removeScenarioEffect(project, "scene", "whole")).toThrow(/ambiguous/);
  });

  it("applies a construction-room lock to its mirrored place", () => {
    const project = fixture(); project.constructions[0]!.rooms[0]!.locked = true;
    const current = project.story.scenarios[0]!;
    const roomPatch = { id: "room-effect", target: roomRef, properties: { mood: "room" } };
    project.story.scenarios[0]!.patches.push(roomPatch);
    expect(readScenarioEffects(project, "scene").find(({ patchId }) => patchId === roomPatch.id)?.locked).toBe(true);
    expect(() => replaceScenario(project, { ...current, patches: current.patches.map((patch) => patch.id === roomPatch.id ? { ...patch, properties: { mood: "changed" } } : patch) })).toThrow(/locked/);
    expect(() => applyProjectStoryMetadata(project, { refs: [roomRef], metadata: { tags: ["locked"] }, action: "add" })).toThrow(/locked/);
  });

  it("does not confuse same-id rooms across constructions", () => {
    const project = fixture(); project.constructions.push({ id: "other", revision: 0, walls: [], rooms: [{ id: "room", faceId: "face", name: "Other room", tags: [], access: [], properties: {}, locked: false }], openings: [], transitions: [] });
    const current = project.story.scenarios[0]!;
    const scoped = { id: "other-room", target: { kind: "room" as const, id: "room", scopeId: "other" }, properties: { mood: "other" } };
    const next = replaceScenario(project, { ...current, patches: [...current.patches, scoped] });
    expect(next.story.scenarios[0]!.patches.at(-1)).toEqual(scoped);
    project.constructions[1]!.rooms[0]!.locked = true;
    expect(() => replaceScenario(project, { ...next.story.scenarios[0]!, patches: next.story.scenarios[0]!.patches.map((patch) => patch.id === "other-room" ? { ...patch, properties: { mood: "changed" } } : patch) })).toThrow(/locked/);
    const ambiguous = { ...current, patches: [...current.patches, { ...scoped, id: "ambiguous", target: { kind: "room" as const, id: "room" }, properties: { mood: "ambiguous" } }] };
    expect(() => replaceScenario(project, ambiguous)).toThrow(/ambiguous/);
  });

  it("keeps scenario removal in one session transaction and undo restores it", () => {
    const project = fixture(); const session = new EditorSession(project); const before = session.getState().project;
    expect(session.executeTransaction({ id: "remove-scenario-effect", apply: (current) => removeScenarioEffect(current, "scene", "whole") }).changed).toBe(true);
    expect(session.getState().project.story.scenarios[0]!.patches).toHaveLength(0); expect(session.undo().changed).toBe(true); expect(session.getState().project.story).toEqual(before.story);
  });

  it("accepts Immer drafts at Story command boundaries in a real structural session", () => {
    const project = fixture();
    const session = new EditorSession(project);
    const result = session.executeTransaction({
      id: "replace-story-scenarios-command",
      isolation: "structural",
      apply: (current) => ({
        ...current,
        story: applyStoryCommand(current.story, {
          kind: "replace",
          collection: "scenarios",
          items: current.story.scenarios.filter(({ id }) => id !== "other"),
        }).story,
      }),
    });
    expect(result).toMatchObject({ code: "committed", changed: true });
    expect(session.getViewState().project.story.scenarios.map(({ id }) => id)).toEqual(["scene"]);
  });

  it("accepts Immer drafts at scenario replacement boundaries in a real structural session", () => {
    const project = fixture();
    const session = new EditorSession(project);
    const result = session.executeTransaction({
      id: "replace-project-scenarios",
      isolation: "structural",
      apply: (current) => replaceProjectScenarios(current, current.story.scenarios.filter(({ id }) => id !== "other")),
    });
    expect(result).toMatchObject({ code: "committed", changed: true });
    expect(session.getViewState().project.story.scenarios.map(({ id }) => id)).toEqual(["scene"]);
  });
});
