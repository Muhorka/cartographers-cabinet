import type { ReviewReason, ReviewStatus } from "../review/types";

const reasonsPl: Record<ReviewReason, string> = {
  "geometry-required": "Do sprawdzenia potrzebny jest obrys miejsca lub geometria kondygnacji. Dla pokoju wskaż punkt w układzie jego kondygnacji.",
  "intention-not-found": "Tej intencji nie ma już w projekcie.", "context-not-found": "Wybierz istniejący scenariusz i krok.",
  "route-not-found": "Wybrana trasa nie istnieje.", "query-required": "Wskaż zapisaną trasę z jawnym początkiem i końcem.", "ambiguous-query": "Wybierz trasę albo jawne zapytanie, nie oba naraz.",
  "unsupported-intention": "To założenie wymaga oceny autora.", "endpoint-mismatch": "Punkty tej trasy nie odpowiadają obiektom intencji.", "endpoint-unresolved": "Nie da się jednoznacznie powiązać punktów trasy z geometrią intencji.", "target-required": "Intencja osiągalności wymaga wskazania celu.",
  "access-allowed": "Reguły pozwalają na dostęp.", "access-denied": "Reguły nie pozwalają na dostęp.", "access-unknown": "Brakuje faktów potrzebnych do oceny dostępu.",
  "route-reachable": "Istnieje obliczona trasa między wskazanymi punktami.", "route-unreachable": "Nie znaleziono dostępnej trasy między wskazanymi punktami.", "route-unknown": "Brakujące fakty o dostępie nie pozwalają potwierdzić trasy.",
  "must-pass-satisfied": "Obliczona trasa przechodzi przez wymagane obiekty.", "must-pass-missed": "Obliczona trasa omija co najmniej jeden wymagany obiekt.", "must-pass-unresolved": "Wskaż obiekty przejścia o jednoznacznej geometrii.",
  "avoid-zone-satisfied": "Obliczona trasa omija wskazaną strefę.", "avoid-zone-crossed": "Obliczona trasa przecina wskazaną strefę.", "avoid-zone-unresolved": "Sprawdzenie wymaga strefy z geometrią we właściwym miejscu.",
  "calculation-failed": "Nie udało się zakończyć obliczenia.", "not-current": "Projekt lub kontekst się zmienił. Sprawdź ponownie.", "cancelled": "Sprawdzanie zostało anulowane.", "timed-out": "Obliczanie przekroczyło limit czasu. To nie dowód braku przejścia.",
};
const reasonsEn: Record<ReviewReason, string> = {
  "geometry-required": "The check needs authored place bounds or level geometry. For a room, specify the point in its level's coordinate system.",
  "intention-not-found": "This intention no longer exists.", "context-not-found": "Choose an existing scenario and step.",
  "route-not-found": "The selected route no longer exists.", "query-required": "Choose a saved route with explicit start and end points.", "ambiguous-query": "Choose either a saved route or an explicit query, not both.",
  "unsupported-intention": "This intention needs author review.", "endpoint-mismatch": "This route's endpoints do not match the intention's objects.", "endpoint-unresolved": "The route points cannot be matched unambiguously to the intention's geometry.", "target-required": "A reachability intention needs an explicit target.",
  "access-allowed": "The rules allow access.", "access-denied": "The rules do not allow access.", "access-unknown": "Access cannot be assessed without more facts.",
  "route-reachable": "A calculated route connects the specified points.", "route-unreachable": "No accessible route was found between the specified points.", "route-unknown": "Unresolved access facts prevent verification of the route.",
  "must-pass-satisfied": "The calculated route crosses the required objects.", "must-pass-missed": "The calculated route misses at least one required object.", "must-pass-unresolved": "Specify pass-through objects with resolvable geometry.",
  "avoid-zone-satisfied": "The calculated route avoids the specified zone.", "avoid-zone-crossed": "The calculated route intersects the specified zone.", "avoid-zone-unresolved": "The check needs a zone with geometry in the correct place.",
  "calculation-failed": "The calculation could not be completed.", "not-current": "The project or context changed. Check again.", "cancelled": "The check was cancelled.", "timed-out": "The calculation timed out. This is not evidence of an inaccessible route.",
};
const statusPl: Record<ReviewStatus, string> = { satisfied: "Spełniona", conditional: "Warunkowo", blocked: "Naruszona", unknown: "Brak danych", "needs-author-review": "Do oceny autora", cancelled: "Anulowano", timeout: "Limit czasu", stale: "Nieaktualne", error: "Błąd obliczenia" };
const statusEn: Record<ReviewStatus, string> = { satisfied: "Satisfied", conditional: "Conditional", blocked: "Not satisfied", unknown: "Missing facts", "needs-author-review": "Author review needed", cancelled: "Cancelled", timeout: "Timed out", stale: "Out of date", error: "Calculation error" };

export const reviewCopy = {
  pl: {
    title: "Sprawdź założenia sceny", intro: "Sprawdź istniejące intencje dla wskazanych obiektów. Wynik nie zmienia zamysłu autora ani danych projektu.",
    actor: "Postać, frakcja lub grupa osób", defaultActor: "Według intencji lub trasy", route: "Trasa do sprawdzenia", noRoute: "Bez trasy — tylko reguły dostępu", requestRoute: "Przygotuj trasę", openRoute: "Otwórz trasę", all: "Intencje z całego projektu", scope: "Intencje w zakresie", empty: "Brak intencji dla tego zakresu. Dodaj intencję albo zmień zaznaczenie.",
    scenario: "Scenariusz", base: "Dane bazowe", step: "Krok", check: "Sprawdź założenia", running: "Sprawdzanie…", cancel: "Anuluj", stale: "Dane, zaznaczenie lub kontekst się zmieniły. Wynik jest nieaktualny — sprawdź ponownie.", cancelled: "Sprawdzanie anulowane. Nie zapisano wyniku jako faktu.", error: "Sprawdzanie nie zostało ukończone.", coverage: "Sprawdzono", of: "z", limited: "Raport obejmuje tylko część zakresu. Zawęź zaznaczenie, aby sprawdzić pozostałe intencje.",
    reasons: reasonsPl, statuses: statusPl, author: { accepted: "Zaakceptowana przez autora", draft: "Szkic intencji", rejected: "Odrzucona przez autora" },
    proof: { permission: "Ocena prawa dostępu. Nie potwierdza fizycznego przejścia.", "single-route": "Dotyczy tylko tej obliczonej trasy. Nie dowodzi, że wszystkie możliwe trasy spełniają założenie.", author: "Wymaga interpretacji autora." },
    conditions: "Warunki", missing: "Brakujące fakty", sources: "Fakty i źródła", local: "Notatki autora", conflicts: "Sprzeczne wartości", source: "Źródło", focus: "Pokaż obiekt", distance: "Długość trasy", sourceLimit: "Lista źródeł została ograniczona; pełne dane pozostają w projekcie.", physicalOpen: "Fizycznie otwarte", physicalClosed: "Fizycznie zamknięte", diagnostic: "Szczegóły obliczenia", freshRoute: "Trasa zostanie przeliczona w tym kontekście; zapisany wynik nie jest używany jako dowód.",
    showCalculated: "Pokaż obliczoną trasę", allow: "Dostęp dla", deny: "Zakaz dla", keys: "Wymagane klucze",
    provenance: { base: "Baza", local: "Wpis obiektu", native: "Dane obiektu", scenario: "Scenariusz", step: "Krok scenariusza", parent: "Miejsce nadrzędne", group: "Grupa obiektów", effective: "Wartość wynikowa" },
  },
  en: {
    title: "Check scene intentions", intro: "Check existing author intentions for the specified objects. Results do not change author intent or project data.",
    actor: "Character, faction or people group", defaultActor: "From intention or route", route: "Route to check", noRoute: "No route — access rules only", requestRoute: "Prepare a route", openRoute: "Open route", all: "Intentions from across the project", scope: "Intentions in scope", empty: "No intentions in this scope. Add an intention or change the selection.",
    scenario: "Scenario", base: "Base facts", step: "Step", check: "Check intentions", running: "Checking…", cancel: "Cancel", stale: "The data, selection or context changed. This result is out of date — check again.", cancelled: "Check cancelled. No result was saved as a fact.", error: "The check did not complete.", coverage: "Checked", of: "of", limited: "This report covers only part of the scope. Narrow the selection to check the remaining intentions.",
    reasons: reasonsEn, statuses: statusEn, author: { accepted: "Accepted by author", draft: "Draft intention", rejected: "Rejected by author" },
    proof: { permission: "Checks permission only. Does not prove physical passage.", "single-route": "Applies only to this calculated route. It does not prove that every possible route satisfies the intention.", author: "Requires author interpretation." },
    conditions: "Conditions", missing: "Missing facts", sources: "Facts and sources", local: "Author notes", conflicts: "Conflicting values", source: "Source", focus: "Show object", distance: "Route length", sourceLimit: "The source list was limited; full records remain in the project.", physicalOpen: "Physically open", physicalClosed: "Physically closed", diagnostic: "Calculation details", freshRoute: "The route will be recalculated in this context; its saved result is not used as evidence.",
    showCalculated: "Show calculated route", allow: "Allowed identities", deny: "Denied identities", keys: "Required keys",
    provenance: { base: "Base", local: "Object record", native: "Object data", scenario: "Scenario", step: "Scenario step", parent: "Parent place", group: "Object group", effective: "Effective value" },
  },
};

/** The geometry/access engine supplies diagnostics, not authored prose. Translate its known messages. */
export function reviewDiagnostic(text: string, locale: "pl" | "en", name: (id: string) => string) {
  if (locale === "en") return text;
  const plain: Record<string, string> = { "actor-required": "Wskaż postać, frakcję lub grupę osób.", "object-not-found": "Nie znaleziono obiektu.", "explicit-deny": "Jawny zakaz dostępu.", "not-allowed": "Brak pozwolenia.", allowed: "Dostęp dozwolony.", owner: "Dostęp właściciela." };
  if (plain[text]) return plain[text];
  const patterns: Array<[RegExp, (id: string) => string]> = [
    [/^Unlock and open (.+)\.$/, (id) => `Odblokuj i otwórz: ${name(id)}.`],
    [/^A key is required for (.+)\.$/, (id) => `Potrzebny jest klucz: ${name(id)}.`],
    [/^A guard rule for (.+) must be satisfied\.$/, (id) => `Spełnij warunek straży: ${name(id)}.`],
    [/^Secret knowledge for (.+) is missing\.$/, (id) => `Brakuje wiedzy o sekrecie: ${name(id)}.`],
    [/^(.+) is physically closed\.$/, (id) => `Fizycznie zamknięte: ${name(id)}.`],
  ];
  for (const [pattern, format] of patterns) { const match = text.match(pattern); if (match) return format(match[1]!); }
  const reason = text.match(/^(.+): (actor-required|object-not-found|explicit-deny|not-allowed)\.$/);
  return reason ? `${name(reason[1]!)}: ${plain[reason[2]!]}` : text;
}
