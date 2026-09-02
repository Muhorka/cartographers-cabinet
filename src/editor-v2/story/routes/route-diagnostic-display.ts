import { workbenchCopy } from "../../i18n/workbench-copy";
import type { EditorProject } from "../../model/project-model";
import { createProjectStoryDisplayNameResolver } from "../object-display-name";
import { allStoryObjectRefs } from "../project-adapter";
import { createProjectStoryObjectResolver } from "../project-effective";
import type { StoryViewContext } from "../types";

type Locale = "pl" | "en";

export type RouteDiagnosticFormatter = {
  /** Returns undefined for an unknown or ambiguously scoped raw id. */
  displayName(id: string): string | undefined;
  /** Formats only diagnostics emitted by the route planner/access resolver. */
  format(text: string): string;
};

function addCandidate(candidates: Map<string, Set<string>>, id: string, name: string | undefined) {
  const clean = name?.trim();
  if (!id || !clean) return;
  const names = candidates.get(id) ?? new Set<string>(); names.add(clean); candidates.set(id, names);
}

function diagnosticNames(project: EditorProject, locale: Locale, context: StoryViewContext) {
  const candidates = new Map<string, Set<string>>(); const resolve = createProjectStoryObjectResolver(project, context);
  const copy = workbenchCopy[locale].objectList;
  const displayNames = createProjectStoryDisplayNameResolver(project, copy);
  for (const ref of allStoryObjectRefs(project)) {
    const object = resolve(ref); if (!object) continue;
    addCandidate(candidates, ref.id, displayNames.base(object));
  }
  for (const construction of project.constructions) for (const room of construction.rooms) {
    const object = resolve({ kind: "room", id: room.id, scopeId: construction.id });
    addCandidate(candidates, room.faceId, object ? displayNames.base(object) : room.name);
  }
  return new Map([...candidates].flatMap(([id, names]) => names.size === 1 ? [[id, [...names][0]!] as const] : []));
}

const accessReason = {
  en: {
    "object-not-found": "Object not found.", nobody: "Nobody is allowed to enter.", "explicit-deny": "Access is explicitly denied.",
    hidden: "The passage is hidden from this traveller.", owner: "Owner access applies.", "actor-required": "Choose a character or group.",
    allowed: "Access is allowed.", "not-allowed": "Access is not allowed.",
  },
  pl: {
    "object-not-found": "Nie znaleziono obiektu.", nobody: "Nikt nie ma dostępu.", "explicit-deny": "Obowiązuje jawny zakaz dostępu.",
    hidden: "To przejście jest ukryte przed podróżującym.", owner: "Obowiązuje dostęp właściciela.", "actor-required": "Wybierz postać lub grupę.",
    allowed: "Dostęp jest dozwolony.", "not-allowed": "Dostęp nie jest dozwolony.",
  },
} satisfies Record<Locale, Record<string, string>>;
type AccessReasonCode = keyof typeof accessReason.en;

function routeDiagnostic(text: string, locale: Locale, displayName: (id: string) => string | undefined) {
  const rawName = (id: string) => displayName(id) ?? id;
  const named = (id: string) => locale === "pl" ? `„${rawName(id)}”` : rawName(id);
  const resultReason = text.match(/^(.+): (object-not-found|nobody|explicit-deny|hidden|owner|actor-required|allowed|not-allowed)\.$/);
  if (resultReason) return `${rawName(resultReason[1]!)}: ${accessReason[locale][resultReason[2]! as AccessReasonCode]}`;

  let match = text.match(/^Room (.+) is not available\.$/);
  if (match) return locale === "pl" ? `Pomieszczenie ${named(match[1]!)} nie jest dostępne.` : `Room ${named(match[1]!)} is not available.`;
  match = text.match(/^Place (.+) is not available\.$/);
  if (match) return locale === "pl" ? `Miejsce ${named(match[1]!)} nie jest dostępne.` : `Place ${named(match[1]!)} is not available.`;
  match = text.match(/^Opening (.+) is not available\.$/);
  if (match) return locale === "pl" ? `Przejście ${named(match[1]!)} nie jest dostępne.` : `Opening ${named(match[1]!)} is not available.`;
  match = text.match(/^Transition (.+) is not available\.$/);
  if (match) return locale === "pl" ? `Połączenie kondygnacji ${named(match[1]!)} nie jest dostępne.` : `Transition ${named(match[1]!)} is not available.`;

  match = text.match(/^Opening (.+) is narrower than the requested ([0-9.]+) m route\.$/);
  if (match) return locale === "pl" ? `Przejście ${named(match[1]!)} jest węższe niż wymagane ${match[2]} m.` : `Opening ${named(match[1]!)} is narrower than the requested ${match[2]} m route.`;
  match = text.match(/^Opening (.+) has no ([0-9.]+) m clear portal in face (.+)\.$/);
  if (match) return locale === "pl" ? `Przejście ${named(match[1]!)} nie ma prześwitu ${match[2]} m w pomieszczeniu ${named(match[3]!)}.` : `Opening ${named(match[1]!)} has no ${match[2]} m clear portal in face ${named(match[3]!)}.`;
  match = text.match(/^Vehicle profile cannot use transition (.+)\.$/);
  if (match) return locale === "pl" ? `Profil pojazdu nie może użyć połączenia ${named(match[1]!)}.` : `Vehicle profile cannot use transition ${named(match[1]!)}.`;
  match = text.match(/^Transition (.+) has no valid landing on (.+)\.$/);
  if (match) return locale === "pl" ? `Połączenie ${named(match[1]!)} nie ma prawidłowego podestu na poziomie ${named(match[2]!)}.` : `Transition ${named(match[1]!)} has no valid landing on ${named(match[2]!)}.`;
  match = text.match(/^Transition (.+) does not have a connected landing on (.+)\.$/);
  if (match) return locale === "pl" ? `Połączenie ${named(match[1]!)} nie ma połączonego podestu na poziomie ${named(match[2]!)}.` : `Transition ${named(match[1]!)} does not have a connected landing on ${named(match[2]!)}.`;
  match = text.match(/^No path with ([0-9.]+) m clearance was found between the requested endpoints\.$/);
  if (match) return locale === "pl" ? `Nie znaleziono przejścia o szerokości ${match[1]} m między wskazanymi punktami.` : text;

  match = text.match(/^Confirm who is allowed to use (.+)\.$/);
  if (match) return locale === "pl" ? `Ustal, kto może skorzystać z obiektu ${named(match[1]!)}.` : `Confirm who is allowed to use ${named(match[1]!)}.`;
  match = text.match(/^The authored Nobody rule for (.+) must be resolved\.$/);
  if (match) return locale === "pl" ? `Rozstrzygnij zapisaną regułę „Nikt” dla obiektu ${named(match[1]!)}.` : `The authored Nobody rule for ${named(match[1]!)} must be resolved.`;
  match = text.match(/^The traveller must know about hidden passage (.+)\.$/);
  if (match) return locale === "pl" ? `Podróżujący musi wiedzieć o ukrytym przejściu ${named(match[1]!)}.` : `The traveller must know about hidden passage ${named(match[1]!)}.`;
  match = text.match(/^A way to unseal (.+) is required\.$/);
  if (match) return locale === "pl" ? `Potrzebny jest sposób na odpieczętowanie obiektu ${named(match[1]!)}.` : `A way to unseal ${named(match[1]!)} is required.`;
  match = text.match(/^A key for (.+) is required\.$/);
  if (match) return locale === "pl" ? `Potrzebny jest klucz do obiektu ${named(match[1]!)}.` : `A key for ${named(match[1]!)} is required.`;
  match = text.match(/^A way to unlock (.+) is required\.$/);
  if (match) return locale === "pl" ? `Potrzebny jest sposób na odblokowanie obiektu ${named(match[1]!)}.` : `A way to unlock ${named(match[1]!)} is required.`;
  match = text.match(/^Open (.+)\.$/);
  if (match) return locale === "pl" ? `Otwórz ${named(match[1]!)}.` : `Open ${named(match[1]!)}.`;
  match = text.match(/^A guard rule for (.+) must be satisfied\.$/);
  if (match) return locale === "pl" ? `Spełnij warunek straży dla obiektu ${named(match[1]!)}.` : `A guard rule for ${named(match[1]!)} must be satisfied.`;
  match = text.match(/^(.+) is sealed\.$/);
  if (match) return locale === "pl" ? `Zapieczętowane: ${named(match[1]!)}.` : `${named(match[1]!)} is sealed.`;
  match = text.match(/^A key is required for (.+)\.$/);
  if (match) return locale === "pl" ? `Potrzebny jest klucz do obiektu ${named(match[1]!)}.` : `A key is required for ${named(match[1]!)}.`;
  match = text.match(/^Unlock and open (.+)\.$/);
  if (match) return locale === "pl" ? `Odblokuj i otwórz ${named(match[1]!)}.` : `Unlock and open ${named(match[1]!)}.`;
  match = text.match(/^Secret knowledge for (.+) is missing\.$/);
  if (match) return locale === "pl" ? `Brakuje wiedzy o sekrecie związanym z obiektem ${named(match[1]!)}.` : `Secret knowledge for ${named(match[1]!)} is missing.`;
  return text;
}

/** Creates one context-aware, localized formatter for a route-result batch. */
export function createRouteDiagnosticFormatter(project: EditorProject, locale: Locale, context: StoryViewContext = {}): RouteDiagnosticFormatter {
  const names = diagnosticNames(project, locale, context); const displayName = (id: string) => names.get(id);
  return { displayName, format: (text: string) => routeDiagnostic(text, locale, displayName) };
}
