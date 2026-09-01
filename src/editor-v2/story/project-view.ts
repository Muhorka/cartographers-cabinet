import type { EditorProject } from "../model/project-model";
import { allStoryObjectRefs, resolveStoryObject } from "./project-adapter";
import { effectiveProjectStoryObject, projectStoryData } from "./project-effective";
import { sameStoryRef, type StoryData, type StoryObjectRef, type StoryTextPatch, type StoryViewContext } from "./types";

type TextOverride = { name?: string; description?: string };

function canonicalizePatch(project: EditorProject, story: StoryData, patch: StoryTextPatch): StoryTextPatch {
  const target = resolveStoryObject(project, story, patch.target)?.ref ?? patch.target;
  return target === patch.target ? patch : { ...patch, target };
}

function displayStory(project: EditorProject): StoryData {
  const story = projectStoryData(project);
  return {
    ...story,
    scenarios: story.scenarios.map((scenario) => ({
      ...scenario,
      patches: scenario.patches.map((patch) => canonicalizePatch(project, story, patch)),
      steps: scenario.steps.map((step) => ({ ...step, patches: step.patches.map((patch) => canonicalizePatch(project, story, patch)) })),
    })),
  };
}

function textOverride(project: EditorProject, story: StoryData, ref: StoryObjectRef, context: StoryViewContext): TextOverride {
  if (!context.scenarioId) return {};
  const object = effectiveProjectStoryObject({ ...project, story }, ref, context); const patches = object?.storyView?.patches.filter((patch) => sameStoryRef(patch.target, ref)) ?? [];
  const title = [...patches].reverse().find((patch) => patch.title !== undefined)?.title;
  const description = [...patches].reverse().find((patch) => patch.description !== undefined)?.description;
  return { ...(title !== undefined ? { name: title } : {}), ...(description !== undefined ? { description } : {}) };
}

function applyText<T extends { name: string; description?: string }>(value: T, override: TextOverride): T {
  return { ...value, ...(override.name !== undefined ? { name: override.name } : {}), ...(override.description !== undefined ? { description: override.description } : {}) };
}

/**
 * Creates a display-only project for Story scenario/step text. It never writes
 * story data or geometry; editing and route calculations must keep using the
 * canonical project passed by the caller.
 */
export function displayProject(project: EditorProject, context: StoryViewContext = {}): EditorProject {
  if (!context.scenarioId) return project;
  const story = displayStory(project); const display: EditorProject = { ...project, story, places: [...project.places], elements: [...project.elements], surfaces: [...project.surfaces], constructions: project.constructions.map((document) => ({ ...document, rooms: [...document.rooms] })) };
  for (const ref of allStoryObjectRefs(project)) {
    const override = textOverride(project, story, ref, context); if (override.name === undefined && override.description === undefined) continue;
    if (ref.kind === "place") display.places = display.places.map((place) => place.id === ref.id ? applyText(place, override) : place);
    if (ref.kind === "room") {
      display.places = display.places.map((place) => place.id === ref.id && (place.kind === "room" || place.kind === "standalone-room") ? applyText(place, override) : place);
      display.constructions = display.constructions.map((document) => document.id === ref.scopeId ? { ...document, rooms: document.rooms.map((room) => room.id === ref.id ? applyText(room, override) : room) } : document);
    }
    if (ref.kind === "element") display.elements = display.elements.map((element) => element.id === ref.id ? applyText(element, override) : element);
    if (ref.kind === "surface") display.surfaces = display.surfaces.map((surface) => surface.id === ref.id ? applyText(surface, override) : surface);
  }
  return display;
}
