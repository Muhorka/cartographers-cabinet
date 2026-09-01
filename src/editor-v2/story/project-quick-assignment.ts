import type { EditorProject } from "../model/project-model";
import { applyProjectStoryMetadata } from "./project-commands";
import { projectStoryData } from "./project-effective";
import type { StoryPropertyDefinition, StoryViewContext, StoryObjectRef } from "./types";

type QuickAssignmentKind = "character" | "faction" | "boolean-property";
export type QuickAssignmentInput = { refs: readonly StoryObjectRef[]; kind: QuickAssignmentKind; name: string; target: "base" | "scenario"; context?: StoryViewContext };

function reject(message: string): never { throw new Error(`Story quick assignment rejected: ${message}`); }
function normalizedName(name: string) { const value = name.trim(); if (!value) reject("name must not be blank"); return value.toLocaleLowerCase(); }
function createId(project: EditorProject, story: ReturnType<typeof projectStoryData>) {
  const used = new Set([...project.places.map(({ id }) => id), ...project.elements.map(({ id }) => id), ...story.world.map(({ id }) => id), ...story.propertyDefinitions.map(({ id }) => id)]);
  let id = crypto.randomUUID(); while (used.has(id)) id = crypto.randomUUID(); return id;
}
/** Atomically creates or reuses a named Story entry and assigns it to all refs. */
export function createAndAssignStoryEntry(project: EditorProject, input: QuickAssignmentInput): EditorProject {
  if (!input.refs.length) reject("at least one map reference is required");
  const name = input.name.trim(); const key = normalizedName(name); const story = projectStoryData(project);
  const matches = input.kind === "boolean-property" ? story.propertyDefinitions.filter(({ type, name: candidate }) => type === "boolean" && candidate.trim().toLocaleLowerCase() === key) : story.world.filter(({ kind, name: candidate }) => kind === input.kind && candidate.trim().toLocaleLowerCase() === key);
  if (matches.length > 1) reject(`name is ambiguous for ${input.kind}`);
  const existing = matches[0]; const id = existing?.id ?? createId(project, story);
  const createdStory = existing ? story : input.kind === "boolean-property" ? { ...story, propertyDefinitions: [...story.propertyDefinitions, { id, name, type: "boolean" } satisfies StoryPropertyDefinition] } : { ...story, world: [...story.world, { id, kind: input.kind, name, tags: [], properties: {} }] };
  const candidate = existing ? project : { ...project, story: createdStory };
  const metadata = input.kind === "boolean-property" ? { properties: { [id]: true } } : { owners: [id] };
  return applyProjectStoryMetadata(candidate, { refs: input.refs, metadata, action: input.kind === "boolean-property" ? "replace" : "add", target: input.target, context: input.context });
}
