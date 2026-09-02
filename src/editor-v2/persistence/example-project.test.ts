import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { resolveStoryObject } from "../story/project-adapter";
import { storyRouteRevision } from "../story/routes/revision";
import type { StoryObjectRef } from "../story/types";
import { loadExampleProject } from "./example-project";
import { parseProjectFile } from "./project-file";

const source = fs.readFileSync(path.join(process.cwd(), "public/examples/residence-of-the-silver-lindens.cartographer.json"), "utf8");

function authoredRefs(project: ReturnType<typeof parseProjectFile>["project"]): StoryObjectRef[] {
  const story = project.story;
  return [
    ...story.objects.map(({ ref }) => ref),
    ...story.zones.flatMap(({ members }) => members.map(({ ref }) => ref)),
    ...story.scenarios.flatMap(({ patches, steps }) => [...patches, ...steps.flatMap((step) => step.patches)].map(({ target }) => target)),
    ...story.relations.flatMap(({ from, to }) => [from, to].filter((value): value is StoryObjectRef => "kind" in value)),
    ...story.intentions.flatMap(({ subject, target, through }) => [subject, ...(target ? [target] : []), ...(through ?? [])]),
    ...story.evidence.flatMap(({ refs }) => refs),
    ...story.routes.flatMap(({ query }) => [{ kind: "place" as const, id: query.from.placeId }, { kind: "place" as const, id: query.to.placeId }]),
  ];
}

describe("Silver Lindens example project", () => {
  it("is a valid English project with a compact representative Story layer", () => {
    const { project } = parseProjectFile(source);
    expect(project.name).toBe("Residence of the Silver Lindens — Example Project");
    expect(project.story.world.filter(({ kind }) => kind === "character").length).toBeGreaterThanOrEqual(4);
    expect(project.story.world.filter(({ kind }) => kind === "faction")).toHaveLength(0);
    expect(project.story.world.filter(({ kind }) => kind === "access-group").length).toBeGreaterThanOrEqual(4);
    expect(project.story.lenses.length).toBeGreaterThanOrEqual(3); expect(project.story.scenarios.length).toBeGreaterThanOrEqual(2); expect(project.story.intentions.length).toBeGreaterThanOrEqual(3);
    expect(project.story.routes).toHaveLength(1); expect(project.story.routes[0]!.result.status).toBe("ready"); expect(project.story.routes[0]!.sourceRevision).toBe(storyRouteRevision(project));
    expect(source).not.toMatch(/[ąćęłńóśźż]/i); expect(source).not.toMatch(/Rueve|Severyn/);
    for (const ref of authoredRefs(project)) expect(resolveStoryObject(project, project.story, ref), JSON.stringify(ref)).toBeDefined();
  });

  it("loads a fresh local copy without mutating the checked-in template", async () => {
    const original = parseProjectFile(source).project;
    const loaded = await loadExampleProject("fresh-project-id", async () => new Response(source));
    expect(loaded.id).toBe("fresh-project-id"); expect(loaded.name).toBe(original.name); expect(original.id).not.toBe(loaded.id);
    expect(loaded.story.routes[0]!.sourceRevision).toBe(storyRouteRevision(loaded)); expect(loaded.story.routes[0]!.result.sourceRevision).toBe(storyRouteRevision(loaded));
    loaded.places[0]!.name = "Changed locally";
    expect(parseProjectFile(source).project.places[0]!.name).not.toBe("Changed locally");
  });

  it("does not mark a stale template route as current while cloning", async () => {
    const envelope = JSON.parse(source); envelope.project.story.routes[0].sourceRevision = "stale"; envelope.project.story.routes[0].result.sourceRevision = "stale";
    const loaded = await loadExampleProject("stale-copy", async () => new Response(JSON.stringify(envelope)));
    expect(loaded.story.routes[0]!.sourceRevision).toBe("stale"); expect(loaded.story.routes[0]!.sourceRevision).not.toBe(storyRouteRevision(loaded));
  });
});
