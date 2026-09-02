import type { StoryLocale } from "../components/story-types";

export const worldEntryTraitsCopy = {
  pl: {
    title: "Cechy własne i dziedziczone",
    hint: "Zobacz cechy przypisane bezpośrednio do wpisu oraz te przejęte z jego grup i frakcji. Własna wartość zastępuje wartość odziedziczoną.",
    noDefinitions: "Najpierw dodaj cechy w Słowniku cech.",
    inherited: "Dziedziczone",
    from: "z",
    conflict: "Sprzeczne wartości dziedziczone",
    useInherited: "Usuń własną wartość i użyj dziedziczonej",
  },
  en: {
    title: "Own and inherited traits",
    hint: "See the traits assigned directly to this entry and those inherited from its groups and factions. A value set directly on the entry overrides an inherited value.",
    noDefinitions: "Add traits to the Trait dictionary first.",
    inherited: "Inherited",
    from: "from",
    conflict: "Conflicting inherited values",
    useInherited: "Remove the own value and use the inherited one",
  },
} satisfies Record<StoryLocale, Record<string, string>>;
