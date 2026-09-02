import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { emptyProject } from "../model/project-model";
import { parseProjectFile } from "../persistence/project-file";
import { EditorSession } from "../state/editor-session";
import { isImmutableSnapshot } from "../state/immutable-snapshot";
import { allStoryObjectRefs } from "./project-adapter";
import { createProjectStoryObjectResolver, effectiveProjectStoryObject, projectStoryData } from "./project-effective";
import { emptyStoryData } from "./types";

describe("read-scoped project story resolution", () => {
  it("does not reuse domain results after a mutable project changes", () => {
    const project = emptyProject("mutable", "Mutable");
    project.places.push({ id: "first", name: "First", kind: "custom", transform: { x: 0, y: 0, rotation: 0 }, tags: [], access: [], properties: {} });
    project.story = { ...emptyStoryData(), objects: [{ ref: { kind: "place", id: "first" }, metadata: { tags: ["old"] } }] };

    const firstBatch = createProjectStoryObjectResolver(project);
    expect(firstBatch({ kind: "place", id: "first" })?.metadata.tags).toContain("old");

    project.places[0]!.name = "Changed";
    project.places.push({ id: "second", name: "Second", kind: "custom", transform: { x: 0, y: 0, rotation: 0 }, tags: [], access: [], properties: {} });
    project.story.objects[0]!.metadata.tags = ["new"];
    project.story.objects.push({ ref: { kind: "place", id: "second" }, metadata: {} });

    expect(allStoryObjectRefs(project)).toEqual(expect.arrayContaining([{ kind: "place", id: "second" }]));
    expect(projectStoryData(project).objects).toHaveLength(2);
    expect(effectiveProjectStoryObject(project, { kind: "place", id: "first" })).toMatchObject({ name: "Changed", metadata: { tags: ["new"] } });
    expect(createProjectStoryObjectResolver(project)({ kind: "place", id: "first" })?.metadata.tags).toContain("new");
  });

  it("resolves the complete representative demo in one bounded batch", async () => {
    const source = await readFile("public/examples/residence-of-the-silver-lindens.cartographer.json", "utf8");
    const imported = parseProjectFile(source).project;
    const session = new EditorSession(imported, { initialPlaceId: imported.places.find(({ parentId }) => !parentId)?.id });
    const project = session.getViewState().project;
    expect(isImmutableSnapshot(project)).toBe(true);
    expect(isImmutableSnapshot(project.story)).toBe(true);
    const refs = allStoryObjectRefs(project);
    const resolve = createProjectStoryObjectResolver(project);
    const started = performance.now();
    const objects = refs.map(resolve);
    const elapsed = performance.now() - started;

    expect(refs.length).toBeGreaterThan(700);
    expect(objects.every(Boolean)).toBe(true);
    expect(resolve(refs[0]!)).toBe(objects[0]);
    expect(elapsed).toBeLessThan(5_000);
  }, 10_000);
});
