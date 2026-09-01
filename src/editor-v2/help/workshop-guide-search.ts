import MiniSearch from "minisearch";
import type { WorkshopGuide, WorkshopGuideText, WorkshopGuideTopicId } from "./workshop-guide-model";

export type WorkshopGuideSearchHit = {
  topicId: WorkshopGuideTopicId;
  topicTitle: string;
  sectionIndex: number;
  sectionHeading: string;
  excerpt: string;
  score: number;
};

export type WorkshopGuideChunkHit = {
  topicId: WorkshopGuideTopicId;
  sectionIndex: number;
  subsectionIndex?: number;
  path: string[];
  content: string;
  score: number;
};

type SearchDocument = WorkshopGuideSearchHit & { id: string; body: string; searchTerms: string };
type ChunkDocument = Omit<WorkshopGuideChunkHit, "path" | "score"> & { id: string; topicTitle: string; sectionHeading: string; subsectionHeading?: string; body: string; searchTerms: string };

const concepts = [
  ["agent", "ai", "asystent", "assistant", "codex", "chatgpt", "webmcp", "model"],
  ["atlas", "hierarchia", "drzewo", "mapa", "map", "poziom", "level", "kondygnacja", "floor", "pietro", "storey", "arkusz", "sheet", "skala", "scale"],
  ["rysowac", "rysowanie", "rysuj", "draw", "drawing", "kreslenie", "piornik", "tool", "instrument", "przybor", "narzedzie", "warstwa", "layer"],
  ["opowiesc", "story", "fabula", "narracja", "narrative", "swiat", "world", "postac", "character"],
  ["trasa", "route", "sciezka", "path", "przejscie", "dojscie", "ruch", "movement"],
  ["cofnij", "cofniecie", "cofnac", "wrocic", "undo", "ponow", "redo", "wersja", "version", "checkpoint", "powrot", "restore", "recover", "backup", "kopia", "calka", "history", "historia", "blad", "bledzie", "error"],
  ["propozycja", "proposal", "wariant", "variant", "preview", "podglad", "accept", "przyjmij", "apply", "zastosuj"],
  ["prywatnosc", "privacy", "dane", "data", "lokalnie", "local", "cloudflare", "varera"],
  ["scenariusz", "scenario", "wydarzenie", "event", "krok", "step", "zmiana", "change"],
  ["intencja", "intention", "zamiar", "cel", "goal", "sprawdz", "check", "raport", "report"],
  ["soczewka", "lens", "filtr", "filter", "podswietl", "highlight", "wyszukaj", "search"],
  ["relacja", "relation", "relationship", "powiazanie", "connection", "wiez", "bond"],
  ["dostep", "access", "klucz", "key", "wlasciciel", "owner", "strefa", "zone", "permission", "uprawnienie"],
  ["drzwi", "door", "okno", "window", "sciana", "wall", "schody", "stairs", "winda", "lift", "elevator", "pomieszczenie", "room"],
  ["droga", "road", "rzeka", "river", "teren", "terrain", "granica", "boundary", "budynek", "building", "ogrod", "garden"],
] as const;

const stopWords = new Set(["a", "aby", "after", "albo", "and", "co", "czy", "do", "does", "dla", "dziala", "dzialac", "dzialaja", "for", "how", "i", "in", "is", "jak", "na", "of", "or", "the", "to", "w", "what", "with", "work", "works", "z"]);

function plain(value: WorkshopGuideText) {
  return typeof value === "string" ? value : value.parts.map(({ text }) => text).join("");
}

function normalize(value: string) {
  return value.replace(/[łŁ]/g, "l").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase();
}

function processTerm(term: string) {
  const normalized = normalize(term).replace(/[^a-z0-9]/g, "");
  return normalized.length > 1 && !stopWords.has(normalized) ? normalized : null;
}

function textFromSection(section: WorkshopGuide["topics"][number]["sections"][number]) {
  return [
    section.heading,
    ...section.paragraphs.map(plain),
    section.example ?? "",
    ...(section.bullets ?? []).map(plain),
    ...(section.steps ?? []).map(plain),
    ...(section.subsections ?? []).flatMap((subsection) => [
      subsection.heading,
      ...(subsection.paragraphs ?? []).map(plain),
      ...(subsection.bullets ?? []).map(plain),
      ...(subsection.steps ?? []).map(plain),
    ]),
  ].join(" ");
}

function semanticTerms(text: string) {
  const words = new Set(normalize(text).split(/[^a-z0-9]+/).filter(Boolean));
  return concepts.filter((aliases) => aliases.some((alias) => words.has(alias))).flat().join(" ");
}

function documents(guide: WorkshopGuide): SearchDocument[] {
  return guide.topics.flatMap((topic) => topic.sections.map((section, sectionIndex) => {
    const body = textFromSection(section); const excerptSource = plain(section.paragraphs[0] ?? topic.summary);
    return {
      id: `${topic.id}:${sectionIndex}`,
      topicId: topic.id,
      topicTitle: topic.title,
      sectionIndex,
      sectionHeading: section.heading,
      excerpt: excerptSource.length > 125 ? `${excerptSource.slice(0, 122).trimEnd()}…` : excerptSource,
      body: `${topic.summary} ${body}`,
      searchTerms: semanticTerms(`${topic.title} ${topic.summary} ${body}`),
      score: 0,
    };
  }));
}

function pack(pieces: string[], maximumCharacters = 1600) {
  const chunks: string[] = [];
  for (const piece of pieces.filter(Boolean)) {
    const current = chunks.at(-1);
    if (!current || current.length + piece.length + 2 > maximumCharacters) chunks.push(piece);
    else chunks[chunks.length - 1] = `${current}\n\n${piece}`;
  }
  return chunks;
}

function chunkDocuments(guide: WorkshopGuide): ChunkDocument[] {
  return guide.topics.flatMap((topic) => topic.sections.flatMap((section, sectionIndex) => {
    const basePieces = [
      ...section.paragraphs.map(plain), section.example ?? "",
      ...(section.bullets ?? []).map((value) => `• ${plain(value)}`),
      ...(section.steps ?? []).map((value, index) => `${index + 1}. ${plain(value)}`),
    ];
    const groups = [
      ...pack(basePieces).map((content, chunkIndex) => ({ content, chunkIndex, subsectionIndex: undefined, subsectionHeading: undefined })),
      ...(section.subsections ?? []).flatMap((subsection, subsectionIndex) => pack([
        ...(subsection.paragraphs ?? []).map(plain),
        ...(subsection.bullets ?? []).map((value) => `• ${plain(value)}`),
        ...(subsection.steps ?? []).map((value, index) => `${index + 1}. ${plain(value)}`),
      ]).map((content, chunkIndex) => ({ content, chunkIndex, subsectionIndex, subsectionHeading: subsection.heading }))),
    ];
    return groups.map(({ content, chunkIndex, subsectionIndex, subsectionHeading }) => {
      const searchable = `${topic.title} ${topic.summary} ${section.heading} ${subsectionHeading ?? ""} ${content}`;
      return {
        id: `${topic.id}:${sectionIndex}:${subsectionIndex ?? "base"}:${chunkIndex}`,
        topicId: topic.id, topicTitle: topic.title, sectionIndex, sectionHeading: section.heading,
        ...(subsectionIndex === undefined ? {} : { subsectionIndex, subsectionHeading }),
        content, body: `${topic.summary} ${content}`, searchTerms: semanticTerms(searchable),
      };
    });
  }));
}

function searchOptions() {
  return { boost: { sectionHeading: 5, topicTitle: 3, searchTerms: 2.5, body: 1 }, combineWith: "AND" as const, prefix: true, fuzzy: (term: string) => term.length >= 5 ? 0.2 : false };
}

export function createWorkshopGuideSearch(guide: WorkshopGuide) {
  const index = new MiniSearch<SearchDocument>({
    fields: ["topicTitle", "sectionHeading", "body", "searchTerms"],
    storeFields: ["topicId", "topicTitle", "sectionIndex", "sectionHeading", "excerpt"],
    processTerm,
    searchOptions: searchOptions(),
  });
  index.addAll(documents(guide));
  return (query: string, limit = 12): WorkshopGuideSearchHit[] => {
    if (normalize(query).trim().length < 2) return [];
    return index.search(query).slice(0, limit).map((result) => ({
      topicId: result.topicId as WorkshopGuideTopicId,
      topicTitle: String(result.topicTitle),
      sectionIndex: Number(result.sectionIndex),
      sectionHeading: String(result.sectionHeading),
      excerpt: String(result.excerpt),
      score: result.score,
    }));
  };
}

export function createWorkshopGuideChunkSearch(guide: WorkshopGuide) {
  const index = new MiniSearch<ChunkDocument>({
    fields: ["topicTitle", "sectionHeading", "subsectionHeading", "body", "searchTerms"],
    storeFields: ["topicId", "topicTitle", "sectionIndex", "sectionHeading", "subsectionIndex", "subsectionHeading", "content"],
    processTerm, searchOptions: searchOptions(),
  });
  index.addAll(chunkDocuments(guide));
  return (query: string, limit = 3): WorkshopGuideChunkHit[] => {
    if (normalize(query).trim().length < 2) return [];
    return index.search(query).slice(0, Math.min(5, Math.max(1, limit))).map((result) => ({
      topicId: result.topicId as WorkshopGuideTopicId,
      sectionIndex: Number(result.sectionIndex),
      ...(result.subsectionIndex === undefined ? {} : { subsectionIndex: Number(result.subsectionIndex) }),
      path: [String(result.topicTitle), String(result.sectionHeading), ...(result.subsectionHeading ? [String(result.subsectionHeading)] : [])],
      content: String(result.content), score: result.score,
    }));
  };
}
