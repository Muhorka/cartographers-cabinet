import type { StoryCollection, StoryCopy } from "../components/story-types";

type EntryCopy = { add: string; create: string; name: string; hint: string };
const pl: Partial<Record<StoryCollection, EntryCopy>> = {
  characters: { add: "Dodaj postać", create: "Utwórz postać", name: "Imię lub nazwa postaci", hint: "Opisz osoby występujące w Twoim świecie. To wpisy w księdze, nie nowe obiekty na mapie." },
  factions: { add: "Dodaj frakcję", create: "Utwórz frakcję", name: "Nazwa frakcji", hint: "Ród, gildia, stronnictwo lub inna organizacja. Postacie przypiszesz do niej w ich kartach." },
  accessGroups: { add: "Dodaj grupę osób", create: "Utwórz grupę osób", name: "Nazwa grupy osób", hint: "Grupy osób łączą postacie według wspólnej roli społecznej, zawodowej lub funkcyjnej, np. Goście, Służba albo Straż. Możesz używać ich w regułach dostępu dla wielu postaci naraz." },
  keys: { add: "Dodaj klucz", create: "Utwórz klucz", name: "Nazwa klucza", hint: "Na przykład klucz do archiwum. W karcie postaci wskaż, kto go ma, a przy drzwiach — jaki klucz je otwiera." },
  objectGroups: { add: "Dodaj grupę obiektów", create: "Utwórz grupę obiektów", name: "Nazwa grupy obiektów", hint: "Połącz istniejące miejsca, np. pokoje w apartament. Nie zmienia to ich miejsca w drzewie projektu." },
  zones: { add: "Dodaj strefę", create: "Utwórz strefę", name: "Nazwa strefy", hint: "Oznacz miejsca objęte wspólną strefą, np. kwarantanną. Jedno miejsce może należeć do kilku stref." },
  propertyDefinitions: { add: "Dodaj cechę", create: "Utwórz cechę", name: "Nazwa cechy", hint: "Na przykład „Jasne”, „Romantyczne” lub „Liczba łóżek”. Tę samą cechę przypiszesz obiektom na mapie i wybierzesz w soczewkach." },
  relations: { add: "Dodaj relację", create: "Utwórz relację", name: "Nazwa relacji", hint: "Zapisz powiązania w świecie, np. kto odwiedza dane miejsce lub go strzeże. Pomagają porządkować opowieść; agent może je odczytać jako kontekst. Sama relacja nie nadaje dostępu, nie ujawnia ukrytego przejścia, nie zmienia właściciela ani nie uruchamia działań postaci." },
  scenarios: { add: "Dodaj scenariusz", create: "Utwórz scenariusz", name: "Nazwa scenariusza", hint: "Przygotuj sytuację, np. nocne zamknięcie pałacu, i sprawdź jej wpływ na świat oraz trasy. Dodane skutki zmieniają właściwości lub dostęp podczas wyświetlania scenariusza, bez zmiany reguł bazowych i geometrii. Sam opis wydarzenia niczego nie zmienia." },
  intentions: { add: "Dodaj intencję autora", create: "Utwórz intencję", name: "Co chcesz osiągnąć?", hint: "Zapisz założenie do sprawdzenia, np. czy postać może dotrzeć do skarbca. Wybierz rodzaj celu i powiązane obiekty, a potem uruchom sprawdzenie w warsztacie scenariusza lub poproś o nie agenta. Zapis nie wymusza założenia; intencje niestandardowe oceniasz samodzielnie." },
};
const en: Partial<Record<StoryCollection, EntryCopy>> = {
  characters: { add: "Add character", create: "Create character", name: "Character name", hint: "Describe people in your world. These are book entries, not new objects on the map." },
  factions: { add: "Add faction", create: "Create faction", name: "Faction name", hint: "A house, guild or other organization. Assign characters to it on their own cards." },
  accessGroups: { add: "Add people group", create: "Create people group", name: "People group name", hint: "People groups connect characters by a shared social, professional or functional role, such as Guests, Servants or Guards. Use them in access rules for several characters at once." },
  keys: { add: "Add key", create: "Create key", name: "Key name", hint: "For example an archive key. Assign its holders on their cards, and the required key on a door." },
  objectGroups: { add: "Add object group", create: "Create object group", name: "Object group name", hint: "Link existing places, such as rooms forming an apartment. Their project hierarchy stays unchanged." },
  zones: { add: "Add zone", create: "Create zone", name: "Zone name", hint: "Mark places in a shared zone, such as quarantine. A place may belong to several zones." },
  propertyDefinitions: { add: "Add trait", create: "Create trait", name: "Trait name", hint: "For example Bright, Romantic or Bed count. Assign this same trait to map objects and select it in lenses." },
  relations: { add: "Add relation", create: "Create relation", name: "Relation name", hint: "Record connections in your world, such as who visits or guards a place. They help organize the story; your agent can read them as context. A relation alone does not grant access, reveal a hidden passage, change ownership or trigger character actions." },
  scenarios: { add: "Add scenario", create: "Create scenario", name: "Scenario name", hint: "Set up a situation, such as closing the palace at night, and check its impact on the world and routes. Added effects change properties or access while viewing the scenario, without changing base rules or geometry. The event description alone changes nothing." },
  intentions: { add: "Add author intention", create: "Create intention", name: "What should happen?", hint: "Record a requirement to check, such as whether a character can reach the vault. Choose a goal type and linked objects, then run a check in the scenario workshop or ask your agent to do it. Saving does not enforce it; custom intentions need your own review." },
};

export function worldbookEntryCopy(collection: StoryCollection, copy: StoryCopy): EntryCopy {
  return (copy.locale === "pl" ? pl : en)[collection] ?? { add: copy.add, create: copy.add, name: copy.name, hint: "" };
}

const worldbookCommonCopy = {
  pl: {
    chooseEntry: "Kliknij wpis na liście, aby go edytować.", editing: "Edytujesz", newEntry: "Nowy wpis",
    autoSave: "Zmiany zapisują się automatycznie. Możesz je cofnąć przyciskiem Cofnij.",
    optional: "Opis i powiązania są opcjonalne. Możesz uzupełnić je później lub poprosić agenta o pomoc.",
    creationHint: "Wystarczy nazwa. Pozostałe szczegóły dodasz później.",
    relationHint: "Wybierz, kto lub co jest podmiotem i wobec kogo lub czego zachodzi relacja. Nazwa, opis i źródło są opcjonalne. Relacja „zna” jest opisowa i nie ujawnia ukrytego przejścia.", intentionHint: "Opisz zamysł i wybierz obiekt, którego dotyczy.",
    optionalDescription: "Opis (opcjonalny)", descriptionPlaceholder: "Kim jest, jak wygląda, co warto o nim wiedzieć…",
    savedEntries: "Zapisane wpisy", noEntries: "Nie ma jeszcze wpisów w tej kategorii.", editHint: "Edytuj wpis", deleteEntry: "Usuń wpis", selectExisting: "Wybierasz spośród zapisanych wpisów. Niczego nie musisz wpisywać ponownie.",
    groups: "Do jakich grup należy „{name}”?", groupsHint: "Wybierz frakcje lub grupy osób, np. Straż albo Goście. To przynależność tej postaci lub organizacji, nie miejsca na mapie.",
    keys: "Jakie klucze ma „{name}”?", keysHint: "Zaznacz posiadane klucze. Trasy mogą je uwzględnić przy przechodzeniu przez zamknięte drzwi.",
    knowledge: "O kim lub o czym wie „{name}”?", knowledgeHint: "Wybierz znane postacie, frakcje lub inne wpisy księgi. To wiedza ogólna: nie daje prawa wstępu ani automatycznie nie ujawnia ukrytego przejścia. Znajomość przejścia ustawiasz na jego karcie.",
    noGroups: "Nie ma jeszcze frakcji ani grup osób. Dodaj je w odpowiedniej kategorii księgi, a potem wybierz tutaj.",
    noKeys: "Nie ma jeszcze kluczy. Dodaj je w kategorii Klucze, a potem wybierz tutaj.",
    noKnowledge: "Nie ma jeszcze innych wpisów. Możesz zostawić tę sekcję pustą.",
    keyHolders: "Kto ma ten klucz?", noHolders: "Jeszcze nikomu go nie przypisano.", keyHoldersHint: "Aby przydzielić klucz, otwórz kartę postaci lub organizacji i rozwiń jej sekcję posiadanych kluczy.",
    members: "Które obiekty należą do „{name}”?", membersHint: "Zaznacz istniejące obiekty mapy. Wybór nie tworzy kopii ani nie przesuwa obiektów.",
    noObjects: "Na mapie nie ma jeszcze obiektów do wybrania.", groupProperties: "Wspólne właściwości (opcjonalne)", groupPropertiesHint: "Te właściwości obejmą członków grupy. Własne ustawienia obiektów zachowują pierwszeństwo.",
    zoneDetails: "Szczegóły przynależności do strefy (opcjonalne)", steps: "Kroki scenariusza (opcjonalne)",
  },
  en: {
    chooseEntry: "Click an entry in the list to edit it.", editing: "Editing", newEntry: "New entry",
    autoSave: "Changes save automatically. Use Undo to revert them.", optional: "Description and links are optional. Add them later or ask your agent for help.",
    creationHint: "Only a name is required. Add other details later.", relationHint: "Choose who or what is involved on each side. A name, description and source are optional. A ‘knows’ relation is descriptive and does not reveal a hidden passage.", intentionHint: "Describe your intent and select its subject.",
    optionalDescription: "Description (optional)", descriptionPlaceholder: "Who they are, their appearance, useful details…",
    savedEntries: "Saved entries", noEntries: "No entries in this category yet.", editHint: "Edit entry", deleteEntry: "Delete entry", selectExisting: "Choose from saved entries. You do not need to enter their names again.",
    groups: "Which groups does “{name}” belong to?", groupsHint: "Choose factions or people groups, such as Guards or Guests. This is membership of the person or organization, not a map location.",
    keys: "Which keys does “{name}” hold?", keysHint: "Select the keys they possess. Routes can use these when assessing locked doors.",
    knowledge: "Who or what does “{name}” know about?", knowledgeHint: "Choose known people, factions or other book entries. This is general knowledge: it grants no access and does not automatically reveal a hidden passage. Passage knowledge is set on that passage.",
    noGroups: "No factions or people groups yet. Add them in the matching book category, then select them here.", noKeys: "No keys yet. Add them in Keys, then select them here.", noKnowledge: "No other entries yet. You can leave this section empty.",
    keyHolders: "Who holds this key?", noHolders: "This key has not been assigned yet.", keyHoldersHint: "To assign this key, open a character or organization card and expand its held keys section.",
    members: "Which objects belong to “{name}”?", membersHint: "Select existing map objects. This does not copy or move them.", noObjects: "There are no map objects to choose yet.",
    groupProperties: "Shared properties (optional)", groupPropertiesHint: "These properties apply to group members. An object's own settings take precedence.",
    zoneDetails: "Zone membership details (optional)", steps: "Scenario steps (optional)",
  },
};
export function worldbookHelp(copy: StoryCopy) { return worldbookCommonCopy[copy.locale === "pl" ? "pl" : "en"]; }
