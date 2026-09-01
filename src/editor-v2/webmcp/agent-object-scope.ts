import type { EditorProject } from "../model/project-model";
import type { AgentObjectRef } from "./agent-command-types";
import { inspectProjectObject } from "./project-read-model";

/** Resolve scope once at the boundary; never silently choose the first same-named wall. */
export function agentObjectScope(project: EditorProject, activePlaceId: string, refs: AgentObjectRef[]) {
  const scopes = new Set<string>();
  for (const ref of refs) {
    const ownerId = ref.scopeId && project.places.find(({ constructionId }) => constructionId === ref.scopeId)?.id;
    const matches = inspectProjectObject(project, { ...ref, scopeId: ownerId ?? ref.scopeId });
    if (!matches.length) throw new Error(`Object does not exist in the specified scope: ${ref.type}:${ref.id}`);
    if (matches.length > 1) throw new Error(`Ambiguous object: provide scopeId for ${ref.type}:${ref.id}`);
    if (["room", "wall", "opening", "transition"].includes(ref.type) && matches[0].ref.scopeId) scopes.add(matches[0].ref.scopeId!);
  }
  if (scopes.size > 1) throw new Error("Use one batch step per construction scope; the complete batch remains one undoable task.");
  const ownerId = [...scopes][0];
  const active = project.places.find(({ id }) => id === activePlaceId);
  return ownerId && ownerId !== activePlaceId && active?.parentId !== ownerId ? ownerId : activePlaceId;
}
