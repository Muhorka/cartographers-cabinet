import type { StoryData } from "./types";

type StoryMembership = StoryData["memberships"][number];

/** Factions and people groups are the only containers in the membership graph. */
export function isPeopleGroup(story: StoryData, id: string) {
  const entry = story.world.find((candidate) => candidate.id === id);
  return entry?.kind === "faction" || entry?.kind === "access-group";
}

/**
 * Old saves could contain member-of links whose target was never entered in the
 * world book. Keep those links effective while reporting them as dangling, but
 * never treat a resolved non-group entry (for example a key or character) as a
 * group. New edit operations validate the stricter rule below.
 */
export function isCompatiblePeopleGroupTarget(story: StoryData, id: string) {
  return !story.world.some((candidate) => candidate.id === id) || isPeopleGroup(story, id);
}

/** Existing files stay readable; callers use this to reject or diagnose new malformed links. */
export function memberOfSemanticIssue(story: StoryData, membership: StoryMembership): string | undefined {
  if (membership.kind !== "member-of") return undefined;
  return isPeopleGroup(story, membership.groupId)
    ? undefined
    : `Membership ${membership.subjectId} -> ${membership.groupId} must identify a faction or people group.`;
}

export function invalidMemberOfIds(story: StoryData) {
  return new Map(story.memberships.flatMap((membership) => {
    const issue = memberOfSemanticIssue(story, membership);
    return issue ? [[JSON.stringify([membership.subjectId, membership.groupId, membership.kind]), issue] as const] : [];
  }));
}
