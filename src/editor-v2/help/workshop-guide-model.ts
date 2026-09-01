export type WorkshopGuideTopicId = "start" | "atlas" | "drawing" | "story" | "agent";

export type WorkshopGuideText = string | {
  parts: Array<{ text: string; emphasis?: "strong" | "em"; href?: string }>;
};

export type WorkshopGuideSubsection = {
  heading: string;
  paragraphs?: WorkshopGuideText[];
  bullets?: WorkshopGuideText[];
  steps?: WorkshopGuideText[];
};

type WorkshopGuideSection = {
  heading: string;
  paragraphs: WorkshopGuideText[];
  example?: string;
  bullets?: WorkshopGuideText[];
  steps?: WorkshopGuideText[];
  subsections?: WorkshopGuideSubsection[];
};

export type WorkshopGuideTopic = {
  id: WorkshopGuideTopicId;
  title: string;
  summary: string;
  sections: WorkshopGuideSection[];
};

export type WorkshopGuide = {
  title: string;
  introduction?: string;
  close: string;
  contents: string;
  search: string;
  searchResults: string;
  noSearchResults: string;
  topics: WorkshopGuideTopic[];
};

export const styled = (...parts: Array<string | { text: string; emphasis?: "strong" | "em"; href?: string }>): WorkshopGuideText => ({
  parts: parts.map((part) => typeof part === "string" ? { text: part } : part),
});
