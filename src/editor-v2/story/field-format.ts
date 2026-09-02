import type { EditorProject } from "../model/project-model";
import { effectiveProjectStoryObject } from "./project-effective";
import { storyObjectDisplayName } from "./object-display-name";
import { workbenchCopy } from "../i18n/workbench-copy";
import { scenarioCopy, type ScenarioCopy } from "./i18n/scenario-copy";
import { storyRefKey, type StoryObjectRef, type StoryViewContext } from "./types";

type StoryLocale = "pl" | "en";

const ACCESS_LABELS = {
  pl: { allow: "Kto może wejść", deny: "Kto nie może wejść", permission: "Prawo wstępu", physicalState: "Stan przejścia", lock: "Zabezpieczenie", keyIds: "Klucze", guardIds: "Strażnicy", secretKnowledge: "Starszy warunek wiedzy", hidden: "Ukryte przejście", knownBy: "Kto zna przejście" },
  en: { allow: "Who may enter", deny: "Who is denied", permission: "Permission", physicalState: "Passage state", lock: "Security", keyIds: "Keys", guardIds: "Guards", secretKnowledge: "Legacy knowledge condition", hidden: "Hidden passage", knownBy: "Who knows the passage" },
} as const;

const ENUM_LABELS = {
  pl: { permission: { open: "Każdy", restricted: "Wybrane osoby i grupy osób" }, physicalState: { open: "Otwarte", closed: "Zamknięte" }, lock: { none: "Bez zamka", locked: "Zamknięte na klucz", sealed: "Zapieczętowane" } },
  en: { permission: { open: "Everyone", restricted: "Selected characters and people groups" }, physicalState: { open: "Open", closed: "Closed" }, lock: { none: "No lock", locked: "Locked with a key", sealed: "Sealed" } },
} as const;

function worldName(project: EditorProject, id: string) {
  return project.story.world.find(({ id: candidate }) => candidate === id)?.name ?? id;
}

function enumValue(value: unknown, key: string, locale: StoryLocale, copy: ScenarioCopy) {
  if (value === "") return copy.emptyText;
  if (typeof value === "boolean") return value ? (locale === "pl" ? "Tak" : "Yes") : (locale === "pl" ? "Nie" : "No");
  if (!key.startsWith("access.")) return undefined;
  const field = key.slice("access.".length) as keyof typeof ENUM_LABELS.pl;
  const labels = ENUM_LABELS[locale][field];
  return labels && typeof value === "string" && value in labels ? labels[value as keyof typeof labels] : undefined;
}

function resolvesStrings(key: string) {
  return key === "owners" || key.startsWith("access.");
}

/** Returns a localized display name for an object in the supplied story view. */
export function storyFieldObjectName(project: EditorProject, ref: StoryObjectRef, context: StoryViewContext, locale: StoryLocale): string {
  return resolvedStoryFieldObjectName(project, ref, effectiveProjectStoryObject(project, ref, context), locale);
}

/** Formats an already resolved object without repeating narrative resolution. */
export function resolvedStoryFieldObjectName(project: EditorProject, ref: StoryObjectRef, object: ReturnType<typeof effectiveProjectStoryObject>, locale: StoryLocale): string {
  return object ? storyObjectDisplayName(project, object, workbenchCopy[locale].objectList) : storyRefKey(ref);
}

function formatValue(project: EditorProject, value: unknown, copy: ScenarioCopy, key: string, locale: StoryLocale): string {
  if (value === undefined) return copy.unsetValue;
  if (value === null) return copy.emptyText;
  if (Array.isArray(value)) return value.length ? value.map((item) => formatValue(project, item, copy, key, locale)).join(", ") : copy.emptyValue;
  if (typeof value === "object") {
    if ("entityId" in value && typeof value.entityId === "string") return worldName(project, value.entityId);
    if ("kind" in value && "id" in value && typeof value.kind === "string" && typeof value.id === "string") return storyFieldObjectName(project, value as StoryObjectRef, {}, locale);
    return JSON.stringify(value);
  }
  const localized = enumValue(value, key, locale, copy);
  if (localized !== undefined) return localized;
  return resolvesStrings(key) && typeof value === "string" ? worldName(project, value) : String(value);
}

/** Returns the localized label for one story metadata or property field. */
export function storyFieldLabel(project: EditorProject, key: string, locale: StoryLocale): string {
  const labels = locale === "pl" ? { narrativeLabel: "Nazwa fabularna", narrativeDescription: "Opis fabularny", owners: "Właściciele", tags: "Tagi" } : { narrativeLabel: "Narrative name", narrativeDescription: "Narrative description", owners: "Owners", tags: "Tags" };
  if (key.startsWith("access.")) return ACCESS_LABELS[locale][key.slice("access.".length) as keyof typeof ACCESS_LABELS.pl] ?? key;
  if (key.startsWith("property:")) return `${locale === "pl" ? "Cecha" : "Trait"}: ${project.story.propertyDefinitions.find(({ id }) => id === key.slice("property:".length))?.name ?? key.slice("property:".length)}`;
  return labels[key as keyof typeof labels] ?? key;
}

/** Returns a localized value while resolving world and canonical object references. */
export function formatStoryFieldValue(project: EditorProject, value: unknown, key: string, locale: StoryLocale, copy: ScenarioCopy = scenarioCopy[locale]): string {
  return formatValue(project, value, copy, key, locale);
}
