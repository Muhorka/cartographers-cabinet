import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createPlace } from "../model/hierarchy-operations";
import { emptyProject } from "../model/project-model";
import { parseProjectFile } from "../persistence/project-file";
import { EditorSession } from "../state/editor-session";
import { immutableSnapshot, isImmutableSnapshot } from "../state/immutable-snapshot";
import { migrateStoryData } from "./migration";
import { allStoryObjectRefs } from "./project-adapter";
import { projectStoryData } from "./project-effective";
import { emptyStoryData, type StoryWorldEntry } from "./types";

const character = (id: string): StoryWorldEntry => ({ id, kind: "character", name: id, tags: [], properties: {} });
const demoSource = fs.readFileSync(path.join(process.cwd(), "public/examples/residence-of-the-silver-lindens.cartographer.json"), "utf8");

function projectFixture() {
  return createPlace(emptyProject("project", "Project"), { id: "world", name: "World", kind: "world" });
}

describe("Story cache safety", () => {
  it("keeps migration fresh for mutable Story data", () => {
    const source = emptyStoryData();
    const first = migrateStoryData(source);
    source.world.push(character("source-change"));
    const second = migrateStoryData(source);
    expect(second).not.toBe(first);
    expect(second.world.map(({ id }) => id)).toEqual(["source-change"]);
    expect(first.world).toEqual([]);

    first.world.push(character("result-change"));
    expect(migrateStoryData(source).world.map(({ id }) => id)).toEqual(["source-change"]);
  });

  it("memoizes and freezes migration only for marked snapshots", () => {
    const source = immutableSnapshot(emptyStoryData());
    const first = migrateStoryData(source);
    expect(migrateStoryData(source)).toBe(first);
    expect(isImmutableSnapshot(first)).toBe(true);
    expect(isImmutableSnapshot(first.world)).toBe(true);
    expect(() => { first.world.push(character("blocked")); }).toThrow();
  });

  it("keeps the object catalogue fresh for mutable projects", () => {
    const project = projectFixture();
    const first = allStoryObjectRefs(project);
    first.push({ kind: "place", id: "result-change" });
    project.places.push({
      id: "source-change", name: "Source change", kind: "custom",
      transform: { x: 0, y: 0, rotation: 0 }, tags: [], access: [], properties: {},
    });

    const second = allStoryObjectRefs(project);
    expect(second).not.toBe(first);
    expect(second).toContainEqual({ kind: "place", id: "source-change" });
    expect(second).not.toContainEqual({ kind: "place", id: "result-change" });
  });

  it("memoizes and freezes the object catalogue only for marked projects", () => {
    const project = immutableSnapshot(projectFixture());
    const first = allStoryObjectRefs(project);
    expect(allStoryObjectRefs(project)).toBe(first);
    expect(isImmutableSnapshot(first)).toBe(true);
    expect(isImmutableSnapshot(first[0])).toBe(true);
    expect(() => { first.push({ kind: "place", id: "blocked" }); }).toThrow();
  });

  it("keeps project Story normalization fresh for mutable projects", () => {
    const project = projectFixture();
    const first = projectStoryData(project);
    project.story.world.push(character("source-change"));
    const second = projectStoryData(project);
    expect(second).not.toBe(first);
    expect(second.world.map(({ id }) => id)).toEqual(["source-change"]);
    expect(first.world).toEqual([]);

    first.world.push(character("result-change"));
    expect(projectStoryData(project).world.map(({ id }) => id)).toEqual(["source-change"]);
  });

  it("memoizes and freezes project Story only for marked projects", () => {
    const project = immutableSnapshot(projectFixture());
    const first = projectStoryData(project);
    expect(projectStoryData(project)).toBe(first);
    expect(isImmutableSnapshot(first)).toBe(true);
    expect(isImmutableSnapshot(first.objects)).toBe(true);
    expect(() => { first.world.push(character("blocked")); }).toThrow();
  });

  it("reuses the real demo catalogue and normalized Story in an editor snapshot", () => {
    const project = new EditorSession(parseProjectFile(demoSource).project).getViewState().project;
    const story = projectStoryData(project);
    const refs = allStoryObjectRefs(project);
    expect(projectStoryData(project)).toBe(story);
    expect(allStoryObjectRefs(project)).toBe(refs);
    expect(isImmutableSnapshot(story)).toBe(true);
    expect(isImmutableSnapshot(refs)).toBe(true);
    expect(refs.length).toBeGreaterThan(500);
  });
});
