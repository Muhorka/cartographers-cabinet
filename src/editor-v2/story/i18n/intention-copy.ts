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
  authorStatusHint: "Record your own editorial decision about this assumption. The result of an automatic check is stored separately.",
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
  textHint: "Describe in your own words what you want to achieve or check. The Cabinet keeps this description independently of any later check results.",
  customHint: "Use this for an assumption the Cabinet cannot check automatically. You can record a question or condition and assess it yourself.",
  validationNote: "Check whether the intention includes all the information needed for a later review, such as a specified target, zone, or required points. Run the actual check separately.",
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
  authorStatusHint: "Oznacz własną decyzję redakcyjną dotyczącą tego założenia. Wynik automatycznego sprawdzenia jest przechowywany osobno.",
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
  textHint: "Zapisz własnymi słowami, co chcesz osiągnąć lub sprawdzić. Gabinet zachowa ten opis niezależnie od późniejszych wyników kontroli.",
  customHint: "Użyj jej dla założenia, którego Gabinet nie potrafi sprawdzić automatycznie. Zapiszesz pytanie lub warunek, a jego ocenę pozostawisz sobie.",
  validationNote: "Sprawdź, czy intencja ma wszystkie informacje potrzebne do późniejszej kontroli — np. wskazany cel, strefę lub wymagane punkty. Właściwe sprawdzenie wykonujesz osobno.",
};

export function intentionCopy(copy: StoryCopy): IntentionCopy {
  return copy.locale === "pl" ? pl : en;
}
