import type { StoryLocale } from "../components/story-types";

export const worldDescriptionCopy = {
  pl: {
    title: "Opis świata",
    hint: "Zapisz najważniejsze założenia, realia i ton świata. Ten opis pomaga Tobie i agentowi zachować spójność podczas rozwijania miejsc, postaci i fabuły.",
    label: "Ogólny opis świata",
    placeholder: "Jak działa ten świat? Co go wyróżnia i o czym trzeba pamiętać…",
    saved: "Zmiany zapisują się automatycznie.",
  },
  en: {
    title: "World description",
    hint: "Record the world's key assumptions, realities and tone. This helps you and the agent stay consistent while developing places, characters and stories.",
    label: "General world description",
    placeholder: "How does this world work? What makes it distinct, and what should always be remembered…",
    saved: "Changes are saved automatically.",
  },
} satisfies Record<StoryLocale, Record<string, string>>;
