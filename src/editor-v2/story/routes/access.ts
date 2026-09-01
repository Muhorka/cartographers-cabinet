import { projectStoryAccess, effectiveProjectStoryObject } from "../project-effective";
import { storyActorGroups } from "../effective";
import { defaultStoryAccessPolicy, type StoryObjectRef } from "../types";
import type { EditorProject } from "../../model/project-model";
import type { StoryAccessContext, StoryAccessDecision } from "./types";

const refKinds = { place: "place", room: "room", opening: "opening", transition: "transition", road: "element" } as const;

/** Uses authored narrative access; editor visibility/lock flags are deliberately ignored. */
export function storyAccessDecision(project: EditorProject, entity: { kind: keyof typeof refKinds; id: string; scopeId?: string }, context: StoryAccessContext): StoryAccessDecision {
  const ref: StoryObjectRef = { kind: refKinds[entity.kind], id: entity.id, ...(entity.scopeId ? { scopeId: entity.scopeId } : {}) };
  const object = effectiveProjectStoryObject(project, ref, context);
  const result = projectStoryAccess(project, ref, context.actorId, context);
  if (!object) return { allowed: false, unknown: true, reason: `${entity.id}: object-not-found.` };
  const access = { ...defaultStoryAccessPolicy(), ...(object.metadata.access ?? {}) };
  if (!result.allowed) return { allowed: false, unknown: result.unknown, reason: `${entity.id}: ${result.reason}.` };
  const conditions: string[] = [];
  const keys = new Set<string>(); const knowledge = new Set<string>(); const identities = context.actorId ? storyActorGroups(project.story, context.actorId) : new Set<string>();
  for (const membership of project.story.memberships) if (identities.has(membership.subjectId)) { if (membership.kind === "holds-key") keys.add(membership.groupId); if (membership.kind === "knows") knowledge.add(membership.groupId); }
  const hasKey = access.keyIds.some((id) => keys.has(id));
  if (access.lock !== "none" && !hasKey) return { allowed: false, unknown: true, reason: `A key is required for ${entity.id}.` };
  if (!result.physicalOpen || access.physicalState === "closed") {
    if (access.lock !== "none" && hasKey) conditions.push(`Unlock and open ${entity.id}.`);
    else return { allowed: false, unknown: true, reason: `${entity.id} is physically closed.` };
  }
  if (access.guardIds.length) conditions.push(`A guard rule for ${entity.id} must be satisfied.`);
  if (access.secretKnowledge.length && !access.secretKnowledge.some((id) => knowledge.has(id))) return { allowed: false, unknown: true, reason: `Secret knowledge for ${entity.id} is missing.` };
  return conditions.length ? { allowed: true, conditions } : true;
}
