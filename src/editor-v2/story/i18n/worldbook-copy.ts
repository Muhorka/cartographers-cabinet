import type { StoryCollection, StoryCopy } from "../components/story-types";

type EntryCopy = { add: string; create: string; name: string; hint: string };
const pl: Partial<Record<StoryCollection, EntryCopy>> = {
  characters: { add: "Dodaj postać", create: "Utwórz postać", name: "Imię lub nazwa postaci", hint: "Twórz karty postaci występujących w świecie. Możesz opisać ich cechy, przynależność, klucze, relacje i inne informacje używane później w Opowieści." },
  factions: { add: "Dodaj frakcję", create: "Utwórz frakcję", name: "Nazwa frakcji", hint: "Twórz rody, gildie, organizacje i inne stronnictwa. Postacie mogą do nich należeć i dziedziczyć część ich wspólnych cech." },
  accessGroups: { add: "Dodaj grupę osób", create: "Utwórz grupę osób", name: "Nazwa grupy osób", hint: "Łącz postacie według wspólnej roli, np. Goście, Służba albo Straż. Dzięki temu możesz jednym ustawieniem określić cechy lub dostęp dla wielu postaci naraz." },
  keys: { add: "Dodaj klucz", create: "Utwórz klucz", name: "Nazwa klucza", hint: "Twórz klucze używane w całym świecie. Wskaż, kto je posiada, a przy drzwiach wybierz, które z nich dany klucz otwiera." },
  objectGroups: { add: "Dodaj grupę obiektów", create: "Utwórz grupę obiektów", name: "Nazwa grupy obiektów", hint: "Połącz istniejące miejsca, np. pokoje w apartament. Nie zmienia to ich miejsca w drzewie projektu." },
  zones: { add: "Dodaj strefę", create: "Utwórz strefę", name: "Nazwa strefy", hint: "Oznacz miejsca objęte wspólną strefą, np. kwarantanną. Jedno miejsce może należeć do kilku stref." },
  propertyDefinitions: { add: "Dodaj cechę", create: "Utwórz cechę", name: "Nazwa cechy", hint: "Zdefiniuj własne cechy używane w projekcie — np. „Jasne”, „Romantyczne” albo „Liczba łóżek”. Potem przypisuj je miejscom, obiektom i wpisom świata oraz wykorzystuj w soczewkach." },
  relations: { add: "Dodaj relację", create: "Utwórz relację", name: "Nazwa relacji", hint: "Zapisuj związki między postaciami, organizacjami, miejscami i obiektami — np. kto kogo zna, czego używa, czego strzeże albo co odwiedza. Relacje pomagają opisywać świat i dają agentowi dodatkowy kontekst. Dostęp, własność oraz wiedzę o ukrytym przejściu ustawiasz przy właściwym obiekcie." },
  scenarios: { add: "Dodaj scenariusz", create: "Utwórz scenariusz", name: "Nazwa scenariusza", hint: "Zapisz sytuację, w której świat działa inaczej niż zwykle — np. nocne zamknięcie budynku albo alarm. Możesz zmienić dostęp i inne właściwości tylko na czas całego scenariusza lub wybranego kroku, bez naruszania stanu podstawowego." },
  intentions: { add: "Dodaj intencję autora", create: "Utwórz intencję", name: "Co chcesz osiągnąć?", hint: "Zapisz założenie, które chcesz później sprawdzić w swoim świecie — np. że wejście dla gości powinno prowadzić do sali bez przechodzenia przez część prywatną albo że wybrana grupa powinna mieć dostęp do zaplecza. Gabinet może później sprawdzić takie założenie na podstawie danych projektu. Intencje niestandardowe pozostają do Twojej oceny." },
};
const en: Partial<Record<StoryCollection, EntryCopy>> = {
  characters: { add: "Add character", create: "Create character", name: "Character name", hint: "Create profiles for characters who appear in the world. You can describe their traits, affiliations, keys, relations, and other information used later in the Story." },
  factions: { add: "Add faction", create: "Create faction", name: "Faction name", hint: "Create houses, guilds, organizations, and other factions. Characters can belong to them and inherit some of their shared traits." },
  accessGroups: { add: "Add people group", create: "Create people group", name: "People group name", hint: "Group characters by a shared role, such as Guests, Servants, or Guards. This lets you define traits or access for many characters with a single setting." },
  keys: { add: "Add key", create: "Create key", name: "Key name", hint: "Create keys used throughout the world. Specify who holds each key, then choose which doors it opens." },
  objectGroups: { add: "Add object group", create: "Create object group", name: "Object group name", hint: "Link existing places, such as rooms forming an apartment. Their project hierarchy stays unchanged." },
  zones: { add: "Add zone", create: "Create zone", name: "Zone name", hint: "Mark places in a shared zone, such as quarantine. A place may belong to several zones." },
  propertyDefinitions: { add: "Add trait", create: "Create trait", name: "Trait name", hint: "Define custom traits used in the project, such as ‘Bright’, ‘Romantic’, or ‘Number of beds’. Then assign them to places, objects, and world entries, and use them in lenses." },
  relations: { add: "Add relation", create: "Create relation", name: "Relation name", hint: "Record connections between characters, organizations, places, and objects, such as who knows whom, uses, guards, or visits something. Relations help describe the world and give the agent more context. Set access, ownership, and knowledge of hidden passages on the relevant object." },
  scenarios: { add: "Add scenario", create: "Create scenario", name: "Scenario name", hint: "Record a situation in which the world works differently than usual, such as a building being locked at night or an alarm. You can change access and other properties for an entire scenario or a selected step without altering the base state." },
  intentions: { add: "Add author intention", create: "Create intention", name: "What should happen?", hint: "Record an assumption you want to check later in your world, such as whether the guest entrance should lead to the hall without passing through a private area, or whether a selected group should have access to the back rooms. The Cabinet can later check such assumptions against the project data. Custom intentions remain for you to assess." },
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
    relationHint: "Wybierz podmiot i cel relacji, a następnie określ, co je łączy. Możesz dodać własną nazwę, opis i źródło tej informacji. Relacja „zna” opisuje znajomość; wiedzę o tajnym przejściu ustawiasz przy przejściu.", intentionHint: "Zapisz, co w Twoim świecie powinno być możliwe, wymagane albo unikane, i wskaż dane potrzebne do późniejszego sprawdzenia tego założenia.",
    optionalDescription: "Opis (opcjonalny)", descriptionPlaceholder: "Kim jest, jak wygląda, co warto o nim wiedzieć…", descriptionHint: "Możesz uwzględnić tutaj wszystkie ważne informacje o postaci, frakcji lub grupie.",
    savedEntries: "Zapisane wpisy", noEntries: "Nie ma jeszcze wpisów w tej kategorii.", editHint: "Edytuj wpis", deleteEntry: "Usuń wpis", selectExisting: "Wybierasz spośród zapisanych wpisów. Niczego nie musisz wpisywać ponownie.",
    groups: "Do jakich grup należy „{name}”?", groupsHint: "Wskaż grupy i frakcje, do których należy ta postać lub organizacja. Przynależność może wpływać na dziedziczone cechy i zasady dostępu.",
    keys: "Posiadane klucze", keysHint: "Wskaż klucze posiadane przez tę postać, organizację lub grupę. Gabinet może później uwzględnić je podczas sprawdzania dostępu i wyznaczania tras.",
    noGroups: "Nie ma jeszcze frakcji ani grup osób. Dodaj je w odpowiedniej kategorii księgi, a potem wybierz tutaj.",
    noKeys: "Nie ma jeszcze kluczy. Dodaj je w kategorii Klucze, a potem wybierz tutaj.",
    keyHolders: "Kto ma ten klucz?", noHolders: "Jeszcze nikomu go nie przypisano.", keyHoldersHint: "Posiadaczy klucza przypisujesz w kartach postaci, frakcji lub grup. Otwórz odpowiedni wpis w Księdze świata i wybierz ten klucz w sekcji „Posiadane klucze”.",
    members: "Które obiekty należą do „{name}”?", membersHint: "Zaznacz istniejące obiekty mapy. Wybór nie tworzy kopii ani nie przesuwa obiektów.",
    noObjects: "Na mapie nie ma jeszcze obiektów do wybrania.", groupProperties: "Wspólne właściwości (opcjonalne)", groupPropertiesHint: "Te właściwości obejmą członków grupy. Własne ustawienia obiektów zachowują pierwszeństwo.",
    zoneDetails: "Szczegóły przynależności do strefy (opcjonalne)", steps: "Kroki scenariusza (opcjonalne)",
  },
  en: {
    chooseEntry: "Click an entry in the list to edit it.", editing: "Editing", newEntry: "New entry",
    autoSave: "Changes save automatically. Use Undo to revert them.", optional: "Description and links are optional. Add them later or ask your agent for help.",
    creationHint: "Only a name is required. Add other details later.", relationHint: "Choose the subject and target of the relation, then define what connects them. You can add your own name, description, and source for this information. A ‘knows’ relation describes familiarity; knowledge of a secret passage is set on the passage itself.", intentionHint: "Record what should be possible, required, or avoided in your world, and identify the data needed to check this assumption later.",
    optionalDescription: "Description (optional)", descriptionPlaceholder: "Who they are, their appearance, useful details…", descriptionHint: "Include any important information about this character, faction, or group here.",
    savedEntries: "Saved entries", noEntries: "No entries in this category yet.", editHint: "Edit entry", deleteEntry: "Delete entry", selectExisting: "Choose from saved entries. You do not need to enter their names again.",
    groups: "Which groups does “{name}” belong to?", groupsHint: "Choose the groups and factions this character or organization belongs to. Membership can affect inherited traits and access rules.",
    keys: "Keys held", keysHint: "Choose the keys held by this character, organization, or group. The Cabinet can then take them into account when checking access and planning routes.",
    noGroups: "No factions or people groups yet. Add them in the matching book category, then select them here.", noKeys: "No keys yet. Add them in Keys, then select them here.",
    keyHolders: "Who holds this key?", noHolders: "This key has not been assigned yet.", keyHoldersHint: "Assign key holders on character, faction, or group profiles. Open the relevant entry in the World book and select this key in the ‘Keys held’ section.",
    members: "Which objects belong to “{name}”?", membersHint: "Select existing map objects. This does not copy or move them.", noObjects: "There are no map objects to choose yet.",
    groupProperties: "Shared properties (optional)", groupPropertiesHint: "These properties apply to group members. An object's own settings take precedence.",
    zoneDetails: "Zone membership details (optional)", steps: "Scenario steps (optional)",
  },
};
export function worldbookHelp(copy: StoryCopy) { return worldbookCommonCopy[copy.locale === "pl" ? "pl" : "en"]; }
