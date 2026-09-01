import { expect, it } from "vitest";
import { formatProposalCoverageReason } from "./coverage-format";

it.each(["pl", "en"] as const)("explains every current coverage reason and safely handles unknown codes (%s)", (locale) => {
  const collections = ["world", "propertyDefinitions", "objects", "memberships", "groups", "zones", "lenses", "scenarios", "relations", "intentions", "evidence", "routes"];
  for (const code of [...collections.map((key) => `story.${key}`), "story.version", "scenario-structure", "non-story-project-data", "ambiguous-story-records"]) {
    const message = formatProposalCoverageReason(code, locale);
    expect(message).not.toContain(code);
    expect(message).not.toBe(formatProposalCoverageReason("new-reason", locale));
  }
  expect(formatProposalCoverageReason("ambiguous-story-records", locale)).toContain(locale === "pl" ? "Raport nie obejmuje wszystkich zmian" : "does not cover all changes");
  for (const code of ["new-reason", "story.future", "story.toString", "story.__proto__"]) {
    expect(formatProposalCoverageReason(code, locale)).toContain(locale === "pl" ? "Nie rozpoznano przyczyny" : "not recognized");
  }
});
