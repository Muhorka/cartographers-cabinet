import type { StoryCopy } from "../components/story-types";

export type IntentionCopy = {
  goal: string;
  kind: string;
  subject: string;
  destination: string;
  through: string;
  avoidZone: string;
  actor: string;
  text: string;
  authorStatus: string;
  authorStatusHint: string;
  authorDraft: string;
  authorAccepted: string;
  authorRejected: string;
  none: string;
  current: string;
  missing: string;
  whatNeeded: string;
  objectNeeded: string;
  actorNeeded: string;
  noObjects: string;
  noZones: string;
  noActors: string;
  textHint: string;
  customHint: string;
  validationNote: string;
};

const en: IntentionCopy = {
  goal: "What do you want to describe?",
  kind: "Goal type",
  subject: "Which map object does this concern?",
  destination: "Where should it lead?",
  through: "Which objects must the route pass through?",
  avoidZone: "Which zone should it avoid?",
  actor: "Who is allowed or denied?",
  text: "Author's description",
  authorStatus: "Author status",
  authorStatusHint: "This records your editorial decision. It is not a route or access check result.",
  authorDraft: "Draft",
  authorAccepted: "Accepted by author",
  authorRejected: "Rejected by author",
  none: "Choose…",
  current: "Current source",
  missing: "This saved reference is not in the current catalogue.",
  whatNeeded: "What is needed",
  objectNeeded: "Choose an existing map object from the list to restore a checkable reference.",
  actorNeeded: "Choose a character, faction, or people group. Keys do not grant permission by themselves.",
  noObjects: "No map objects are available.",
  noZones: "No authored zones are available.",
  noActors: "No characters, factions, or people groups are available.",
  textHint: "Keep this as the author's wording; a review result is recorded elsewhere.",
  customHint: "A custom intention is descriptive only and is not presented as proven.",
  validationNote: "No check is run here. A route or access review needs complete references and explicit endpoints.",
};

const pl: IntentionCopy = {
  goal: "Co chcesz opisać?",
  kind: "Rodzaj celu",
  subject: "Którego obiektu na mapie to dotyczy?",
  destination: "Dokąd ma prowadzić?",
  through: "Przez jakie obiekty ma prowadzić trasa?",
  avoidZone: "Jakiej strefy ma unikać?",
  actor: "Kogo wpuszczać lub nie wpuszczać?",
  text: "Opis autora",
  authorStatus: "Status autora",
  authorStatusHint: "To Twoja decyzja redakcyjna, a nie wynik sprawdzenia trasy ani dostępu.",
  authorDraft: "Szkic",
  authorAccepted: "Zaakceptowana przez autora",
  authorRejected: "Odrzucona przez autora",
  none: "Wybierz…",
  current: "Bieżące źródło",
  missing: "Ten zapisany odnośnik nie jest w bieżącym katalogu.",
  whatNeeded: "Czego potrzeba",
  objectNeeded: "Wybierz istniejący obiekt mapy z listy, aby odtworzyć sprawdzalne powiązanie.",
  actorNeeded: "Wybierz postać, frakcję albo grupę osób. Sam klucz nie nadaje uprawnienia.",
  noObjects: "Brak dostępnych obiektów mapy.",
  noZones: "Brak zapisanych stref.",
  noActors: "Brak postaci, frakcji i grup osób.",
  textHint: "Zachowaj tu słowa autora; wynik sprawdzenia jest zapisywany osobno.",
  customHint: "Intencja niestandardowa jest tylko opisem i nie jest przedstawiana jako dowiedziona.",
  validationNote: "Tutaj nic nie jest sprawdzane. Przegląd trasy lub dostępu wymaga pełnych odnośników i jawnych punktów końcowych.",
};

export function intentionCopy(copy: StoryCopy): IntentionCopy {
  return copy.locale === "pl" ? pl : en;
}
