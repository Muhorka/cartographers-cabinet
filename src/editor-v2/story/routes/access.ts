import { createProjectStoryObjectResolver, projectStoryData } from "../project-effective";
import { storyAccessForMetadata, storyActorGroups } from "../effective";
import { defaultStoryAccessPolicy, type StoryObjectRef } from "../types";
import type { EditorProject } from "../../model/project-model";
import type { StoryAccessContext, StoryAccessDecision } from "./types";

const refKinds = { place: "place", room: "room", opening: "opening", transition: "transition", road: "element" } as const;

/** Uses authored narrative access; editor visibility/lock flags are deliberately ignored. */
export function createStoryAccessDecisionResolver(project: EditorProject, context: StoryAccessContext) {
  const story = projectStoryData(project); const resolveObject = createProjectStoryObjectResolver(project, context, story);
  const identities = context.actorId ? storyActorGroups(story, context.actorId) : new Set<string>();
  const keys = new Set<string>(); const knowledge = new Set<string>();
  for (const membership of story.memberships) if (identities.has(membership.subjectId)) {
    if (membership.kind === "holds-key") keys.add(membership.groupId);
    if (membership.kind === "knows") knowledge.add(membership.groupId);
  }
  return (entity: { kind: keyof typeof refKinds; id: string; scopeId?: string }): StoryAccessDecision => {
    const ref: StoryObjectRef = { kind: refKinds[entity.kind], id: entity.id, ...(entity.scopeId ? { scopeId: entity.scopeId } : {}) };
    const object = resolveObject(ref);
    if (!object) return context.actorId ? { allowed: false, unknown: true, reason: `${entity.id}: object-not-found.` } : true;
    const access = { ...defaultStoryAccessPolicy(), ...(object.metadata.access ?? {}) };
    if (!context.actorId) {
      const conditions: string[] = [];
      if (access.permission === "restricted") conditions.push(`Confirm who is allowed to use ${entity.id}.`);
      if (access.permission === "nobody") conditions.push(`The authored Nobody rule for ${entity.id} must be resolved.`);
      if (access.hidden) conditions.push(`The traveller must know about hidden passage ${entity.id}.`);
      if (access.lock === "sealed") conditions.push(`A way to unseal ${entity.id} is required.`);
      else if (access.lock === "locked") conditions.push(access.keyIds.length ? `A key for ${entity.id} is required.` : `A way to unlock ${entity.id} is required.`);
      if (access.physicalState === "closed") conditions.push(`Open ${entity.id}.`);
      if (access.guardIds.length) conditions.push(`A guard rule for ${entity.id} must be satisfied.`);
      return conditions.length ? { allowed: true, conditions: [...new Set(conditions)] } : true;
    }
    const result = storyAccessForMetadata(story, object.metadata, context.actorId);
    if (!result.allowed) return { allowed: false, unknown: result.unknown, reason: `${entity.id}: ${result.reason}.` };
    const conditions: string[] = []; const hasKey = access.keyIds.some((id) => keys.has(id));
    if (access.lock === "sealed") return { allowed: false, unknown: true, reason: `${entity.id} is sealed.` };
    if (access.lock !== "none" && !hasKey) return { allowed: false, unknown: true, reason: `A key is required for ${entity.id}.` };
    if (!result.physicalOpen || access.physicalState === "closed") {
      if (access.lock === "locked" && hasKey) conditions.push(`Unlock and open ${entity.id}.`);
      else conditions.push(`Open ${entity.id}.`);
    }
    if (access.guardIds.length) conditions.push(`A guard rule for ${entity.id} must be satisfied.`);
    if (access.knownBy === undefined && access.secretKnowledge.length && !access.secretKnowledge.some((id) => identities.has(id) || knowledge.has(id))) return { allowed: false, unknown: true, reason: `Secret knowledge for ${entity.id} is missing.` };
    return conditions.length ? { allowed: true, conditions } : true;
  };
}

export function storyAccessDecision(project: EditorProject, entity: { kind: keyof typeof refKinds; id: string; scopeId?: string }, context: StoryAccessContext): StoryAccessDecision {
  return createStoryAccessDecisionResolver(project, context)(entity);
}
