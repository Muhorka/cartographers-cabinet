import { describe, expect, it } from "vitest";
import { workshopGuide } from "./workshop-guide-content";
import { createWorkshopGuideChunkSearch, createWorkshopGuideSearch } from "./workshop-guide-search";

describe("workshop guide search", () => {
  const searchPl = createWorkshopGuideSearch(workshopGuide.pl);
  const searchEn = createWorkshopGuideSearch(workshopGuide.en);

  it("finds exact terms, terms without Polish marks and controlled typos", () => {
    expect(searchPl("drzwi").some(({ topicId }) => topicId === "drawing")).toBe(true);
    expect(searchPl("pietro").some(({ topicId }) => topicId === "atlas")).toBe(true);
    expect(searchPl("inspektro").some(({ sectionHeading }) => sectionHeading.includes("Inspektor"))).toBe(true);
    expect(searchPl("beziera").some(({ topicId }) => topicId === "drawing")).toBe(true);
  });

  it("uses domain concepts for natural questions", () => {
    expect(searchPl("AI")[0]?.topicId).toBe("agent");
    expect(searchPl("jak wrócić po błędzie").some(({ sectionHeading }) => sectionHeading.includes("Cofnij"))).toBe(true);
    expect(searchEn("recover after error").some(({ sectionHeading }) => sectionHeading.includes("Undo"))).toBe(true);
  });

  it("ranks headings and keeps locale-specific documents", () => {
    expect(searchPl("Prywatność")[0]?.sectionHeading).toBe("Prywatność");
    expect(searchEn("Privacy")[0]?.sectionHeading).toBe("Privacy");
    expect(searchPl("Privacy")[0]?.sectionHeading).not.toBe("Privacy");
  });

  it("returns no results for an empty query", () => {
    expect(searchPl(" ")).toEqual([]);
  });

  it("retrieves bounded, structured chunks for an agent", () => {
    const chunks = createWorkshopGuideChunkSearch(workshopGuide.pl)("jak działają propozycje agenta", 3);
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks.length).toBeLessThanOrEqual(3);
    expect(chunks[0].path[0]).toBe("Praca z własnym agentem");
    expect(chunks.some(({ content }) => content.toLocaleLowerCase().includes("propozyc"))).toBe(true);
    expect(chunks.every(({ content }) => content.length <= 1600)).toBe(true);
  });
});
