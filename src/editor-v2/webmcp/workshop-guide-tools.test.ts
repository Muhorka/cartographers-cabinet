import { describe, expect, it } from "vitest";
import { createWorkshopGuideTools } from "./workshop-guide-tools";

describe("Workshop guide WebMCP tool", () => {
  const tool = createWorkshopGuideTools()[0];

  it("is a dedicated read-only search tool", () => {
    expect(tool.name).toBe("search_workshop_guide");
    expect(tool.annotations?.readOnlyHint).toBe(true);
  });

  it("returns a few relevant chunks in the requested language", async () => {
    const result = await tool.execute({ query: "jak wrócić po błędzie", locale: "pl", limit: 3 }) as { structuredContent: { count: number; matches: Array<{ path: string[]; content: string }> } };
    expect(result.structuredContent.count).toBeGreaterThan(0);
    expect(result.structuredContent.count).toBeLessThanOrEqual(3);
    expect(result.structuredContent.matches.some(({ path }) => path.some((part) => part.includes("Cofnij")))).toBe(true);
    expect(result.structuredContent.matches.every(({ content }) => content.length <= 1600)).toBe(true);
  });

  it("rejects invalid requests", async () => {
    await expect(tool.execute({ query: "", locale: "pl" })).rejects.toThrow("query");
    await expect(tool.execute({ query: "agent", locale: "de" })).rejects.toThrow("locale");
    await expect(tool.execute({ query: "agent", locale: "en", limit: 8 })).rejects.toThrow("limit");
  });
});
