import { workshopGuide } from "../help/workshop-guide-content";
import { createWorkshopGuideChunkSearch } from "../help/workshop-guide-search";

const search = {
  pl: createWorkshopGuideChunkSearch(workshopGuide.pl),
  en: createWorkshopGuideChunkSearch(workshopGuide.en),
};

const response = <T,>(value: T) => ({ content: [{ type: "text", text: JSON.stringify(value) }], structuredContent: value });

export function createWorkshopGuideTools(): WebMcpTool[] {
  return [{
    name: "search_workshop_guide",
    title: "Search the Workshop guide",
    description: "Find concise Polish or English guide sections about using the Cartographer's Cabinet. Read-only; use for concepts, workflows, and user guidance, not project facts.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string" },
        locale: { type: "string", enum: ["pl", "en"] },
        limit: { type: "integer", minimum: 1, maximum: 5 },
      },
      required: ["query", "locale"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
    execute: async (input) => {
      if (typeof input.query !== "string" || !input.query.trim()) throw new TypeError("query must be a non-empty string");
      if (input.locale !== "pl" && input.locale !== "en") throw new TypeError("locale must be pl or en");
      if (input.limit !== undefined && (!Number.isInteger(input.limit) || (input.limit as number) < 1 || (input.limit as number) > 5)) throw new TypeError("limit must be an integer from 1 to 5");
      const matches = search[input.locale](input.query, input.limit as number | undefined);
      return response({ query: input.query, locale: input.locale, count: matches.length, matches });
    },
  }];
}
