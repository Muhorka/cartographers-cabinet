import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { storyCopy } from "../i18n/story-copy";
import { emptyStoryData, type StoryData } from "../types";
import { StoryWorldEntryTraits } from "./story-world-entry-traits";

describe("StoryWorldEntryTraits", () => {
  it("distinguishes own, inherited and conflicting group traits", () => {
    const story: StoryData = { ...emptyStoryData(),
      propertyDefinitions: [{ id: "rank", name: "Ranga", type: "text" as const }, { id: "colour", name: "Barwa", type: "text" as const }],
      world: [
        { id: "anna", kind: "character" as const, name: "Anna", tags: [], properties: { rank: "dowódczyni" } },
        { id: "east", kind: "access-group" as const, name: "Wschodnia straż", tags: [], properties: { rank: "strażnik", colour: "czerwona" } },
        { id: "west", kind: "faction" as const, name: "Zachodni ród", tags: [], properties: { colour: "niebieska" } },
      ],
      memberships: [
        { subjectId: "anna", groupId: "east", kind: "member-of" as const, source: "manual" as const },
        { subjectId: "anna", groupId: "west", kind: "member-of" as const, source: "manual" as const },
      ],
    };
    const entry = { ...story.world[0], membershipGroupIds: ["east", "west"] };
    const html = renderToStaticMarkup(<StoryWorldEntryTraits entry={entry} story={story} copy={storyCopy.pl} resolvedObjects={[]} onChange={() => undefined}/>);
    expect(html).toContain("Cechy własne i dziedziczone");
    expect(html).toContain("dowódczyni");
    expect(html).toContain("Sprzeczne wartości dziedziczone");
    expect(html).toContain("czerwona");
    expect(html).toContain("niebieska");
  });
});
