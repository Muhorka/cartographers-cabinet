import { proposalCopy } from "../i18n/proposal-copy";
import { storyCopy } from "../i18n/story-copy";

/** UI wording only: preserve the report's original codes and coverage semantics. */
export function formatProposalCoverageReason(code: string, locale: "pl" | "en"): string {
  const c = proposalCopy[locale]; const labels = storyCopy[locale];
  switch (code) {
    case "ambiguous-story-records": return c.coverageAmbiguous;
    case "scenario-structure": return c.coverageStructure;
    case "non-story-project-data": return c.coverageProject;
    case "story.version": return c.coverageVersion;
  }
  const collections = {
    world: labels.worldbook, propertyDefinitions: labels.propertyDefinitions, objects: labels.objects,
    memberships: labels.memberships, groups: labels.objectGroups, zones: labels.zones, lenses: labels.lenses,
    scenarios: labels.scenarios, relations: labels.relations, intentions: labels.intentions,
    evidence: c.coverageEvidence, routes: labels.routes,
  };
  const key = code.startsWith("story.") ? code.slice(6) : "";
  return Object.hasOwn(collections, key) ? c.coverageCollection(collections[key as keyof typeof collections]) : c.coverageUnknown;
}
