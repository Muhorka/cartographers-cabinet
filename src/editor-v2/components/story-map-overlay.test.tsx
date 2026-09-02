import { renderToStaticMarkup } from "react-dom/server";
import { readFile } from "node:fs/promises";
import { expect, it } from "vitest";
import { StoryMapOverlay } from "./story-map-overlay";
import { createProjectAtScale } from "../model/starter-project";
import { parseProjectFile } from "../persistence/project-file";
import { EditorSession } from "../state/editor-session";
import { allStoryObjectRefs } from "../story/project-adapter";
import { createProjectLensEvaluator, evaluateProjectLens } from "../story/evaluation";
import type { StoryLens, StoryObjectRef } from "../story/types";

const red: StoryLens = { id: "red", name: "Places", color: "#aa3322", expression: { kind: "all", items: [] } };
const blue: StoryLens = { ...red, id: "blue", color: "#2244aa" };

it("canonicalizes legacy room references identically for saved and temporary conditions", () => {
  const project = createProjectAtScale("legacy-lens", "Synthetic room", "en", "location");
  project.places[0].kind = "standalone-room";
  const ref: StoryObjectRef = { kind: "place", id: project.places[0].id };
  const lens: StoryLens = { ...red, expression: { kind: "predicate", predicate: { kind: "object", ref } } };
  project.story.lenses = [lens];
  const evaluate = createProjectLensEvaluator(project, project.story);
  expect(evaluate(lens, ref).match).toBe(true);
  expect(evaluate({ ...lens, id: "temporary-lens" }, ref).match).toBe(true);
  expect(evaluateProjectLens(project, project.story, lens.id, ref)?.match).toBe(true);
});

it("interleaves matching colors without hiding geometry or growing a selection halo", () => {
  const project = createProjectAtScale("overlay", "Synthetic place", "en", "location");
  project.story.lenses = [red, blue]; const before = structuredClone(project);
  const html = renderToStaticMarkup(<svg><StoryMapOverlay project={project} activePlaceId={project.places[0].id} zoom={10} context={{}} lensView={{ activeLensIds: ["red", "blue"] }}/></svg>);
  const host = document.createElement("div"); host.innerHTML = html;
  const paths = [...host.querySelectorAll("path")];
  expect(paths).toHaveLength(2);
  expect(paths.map((path) => path.getAttribute("stroke"))).toEqual([red.color, blue.color]);
  expect(paths.every((path) => path.getAttribute("fill") === "none" && path.getAttribute("stroke-width") === "2.5")).toBe(true);
  expect(paths.map((path) => path.getAttribute("stroke-dashoffset"))).toEqual(["0", "-6"]);
  expect(host.querySelector("g")?.getAttribute("pointer-events")).toBe("none");
  expect(project).toEqual(before);
});

it("renders an unsaved preview using the same evaluator for places, terrain and platforms", () => {
  const project = createProjectAtScale("preview", "Synthetic place", "en", "location");
  const place = project.places[0]; const shape = { kind: "rectangle" as const, x: 1, y: 1, width: 4, height: 3 };
  project.elements.push({ id: "forest", belongsToId: place.id, name: "Forest", layerId: "terrain", subjectId: "terrain.forest", geometry: { kind: "region", shape }, visible: true, locked: false, tags: [], access: [], properties: {} });
  project.surfaces.push({ id: "platform", belongsToId: place.id, name: "Stage", kind: "stage", shape, attachment: "free", elevation: 0, visible: true, locked: false, tags: [], access: [], properties: {} });
  project.story.lenses = [red]; const before = structuredClone(project);
  const evaluate = createProjectLensEvaluator(project, project.story);
  const refs: StoryObjectRef[] = [{ kind: "place", id: place.id }, { kind: "element", id: "forest" }, { kind: "surface", id: "platform" }];
  for (const ref of refs) expect(evaluate(red, ref)).toEqual(evaluateProjectLens(project, project.story, "red", ref));
  const html = renderToStaticMarkup(<svg><StoryMapOverlay project={project} activePlaceId={place.id} zoom={10} context={{}} lensView={{ previewLens: blue }}/></svg>);
  const host = document.createElement("div"); host.innerHTML = html;
  expect(host.querySelectorAll('path[stroke="#2244aa"]')).toHaveLength(3);
  expect(project).toEqual(before); expect(project.story.lenses).toHaveLength(1);
});

it("evaluates saved and temporary lenses across the public Silver Lindens object set", async () => {
  const source = await readFile("public/examples/residence-of-the-silver-lindens.cartographer.json", "utf8");
  const imported = parseProjectFile(source).project;
  const session = new EditorSession(imported, { initialPlaceId: imported.places.find(({ parentId }) => !parentId)?.id });
  const project = session.getViewState().project;
  const refs = allStoryObjectRefs(project); const saved = project.story.lenses; const preview: StoryLens = { ...saved[0]!, id: "temporary-preview" };
  const before = structuredClone(project); const evaluate = createProjectLensEvaluator(project, project.story);
  const savedMatches = saved.map((lens) => refs.filter((ref) => evaluate(lens, ref).match).length);
  const previewMatches = refs.filter((ref) => evaluate(preview, ref).match).length;

  expect(refs.length).toBeGreaterThan(700);
  expect(savedMatches.every((count) => count > 0)).toBe(true);
  expect(previewMatches).toBe(savedMatches[0]);
  expect(project).toEqual(before);
});
