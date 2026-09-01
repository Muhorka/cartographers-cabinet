import type { StoryLocale } from "../components/story-types";

export const worldEntryTraitsCopy = {
  pl: {
    title: "Cechy własne i dziedziczone",
    hint: "Wpis zachowuje własne cechy, a dodatkowo otrzymuje cechy grup i frakcji, do których należy. Własna wartość ma pierwszeństwo.",
    noDefinitions: "Najpierw dodaj cechy w Słowniku cech.",
    inherited: "Dziedziczone",
    from: "z",
    conflict: "Sprzeczne wartości dziedziczone",
    useInherited: "Usuń własną wartość i użyj dziedziczonej",
  },
  en: {
    title: "Own and inherited traits",
    hint: "An entry keeps its own traits and also receives traits from its groups and factions. Its own value takes precedence.",
    noDefinitions: "Add traits to the Trait dictionary first.",
    inherited: "Inherited",
    from: "from",
    conflict: "Conflicting inherited values",
    useInherited: "Remove the own value and use the inherited one",
  },
} satisfies Record<StoryLocale, Record<string, string>>;
