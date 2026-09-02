import type { StoryLocale } from "../components/story-types";

export const worldDescriptionCopy = {
  pl: {
    title: "Opis świata",
    hint: "Zapisz najważniejsze założenia, realia i ton świata. To wspólny punkt odniesienia przy rozwijaniu miejsc, postaci i fabuły — także dla połączonego agenta.",
    label: "Ogólny opis świata",
    placeholder: "Jak działa ten świat? Co go wyróżnia i o czym trzeba pamiętać…",
    saved: "Zmiany zapisują się automatycznie.",
  },
  en: {
    title: "World description",
    hint: "Record the world's key assumptions, realities, and tone. This provides a shared point of reference when developing places, characters, and the story, including for the connected agent.",
    label: "General world description",
    placeholder: "How does this world work? What makes it distinct, and what should always be remembered…",
    saved: "Changes are saved automatically.",
  },
} satisfies Record<StoryLocale, Record<string, string>>;
