import { storyRefKey, type StoryLensExpression, type StoryLensPredicate, type StoryObjectRef, type StoryPropertyDefinition, type StoryPropertyValue } from "../types";
import type { StoryCopy, StoryDocumentLike, StoryResolvedObject } from "./story-types";
import { legacyStoryGroups } from "../migration";
import styles from "./story-workbench.module.css";
import { storyEntityOptions, storyEntityValue, type StoryEntityOption } from "./story-entity-choices";

export const predicateKinds = ["owner", "access", "property", "zone", "object", "tag"] as const;
export type PredicateKind = typeof predicateKinds[number];
type Choice = { id: string; name: string };
type ObjectChoice = Choice & { ref: StoryObjectRef };
const actorKinds = new Set(["character", "faction", "access-group"]);

export function ExpressionRules({ expression, copy, story, objects, onRemove, path = [] }: { expression: StoryLensExpression; copy: StoryCopy; story: StoryDocumentLike; objects: ObjectChoice[]; onRemove(path: number[]): void; path?: number[] }) {
  if (expression.kind === "predicate") return <div className={styles.predicateRow}><span>{predicateExplanation(expression.predicate, copy, story, objects)}</span><button type="button" onClick={() => onRemove(path)}>{copy.remove}</button></div>;
  const children = expression.kind === "not" ? [expression.item] : expression.items;
  const groupLabel = expression.kind === "not" ? lensUi(copy).exclude : copy[expression.kind];
  return <div className={styles.expressionGroup} data-expression-kind={expression.kind}><span className={styles.expressionKind}>{groupLabel}</span><div className={styles.expressionChildren}>{children.map((item, index) => <ExpressionRules key={`${path.join("-")}-${index}`} expression={item} copy={copy} story={story} objects={objects} onRemove={onRemove} path={[...path, index]} />)}</div></div>;
}

export function predicateChoices(story: StoryDocumentLike, kind: PredicateKind, objects: ObjectChoice[], resolved: readonly StoryResolvedObject[] = []): Choice[] {
  if (kind === "owner" || kind === "access") return story.world.filter(({ kind: entryKind }) => actorKinds.has(entryKind)).map(({ id, name }) => ({ id, name }));
  if (kind === "property") return story.propertyDefinitions.map(({ id, name }) => ({ id, name }));
  if (kind === "zone") return story.zones.map(({ id, name }) => ({ id, name }));
  if (kind === "object") return objects;
  if (kind === "tag") return legacyTags(story, resolved).map((tag) => ({ id: tag, name: tag }));
  return [];
}

function legacyTags(story: StoryDocumentLike, resolved: readonly StoryResolvedObject[]): string[] {
  const tags = new Set<string>();
  for (const object of story.objects) for (const tag of object.metadata.tags ?? []) tags.add(tag);
  for (const object of resolved) for (const tag of object.metadata?.tags ?? []) tags.add(tag);
  return [...tags].sort((a, b) => a.localeCompare(b));
}

export function propertyControl(definition: StoryPropertyDefinition | undefined, value: string | string[], setValue: (value: string | string[]) => void, story: StoryDocumentLike, copy: StoryCopy, objects: ObjectChoice[] = []) {
  if (!definition) return <p className={styles.explanation}>{copy.noItems}</p>;
  const options = definition.options ?? [];
  if (definition.type === "boolean") return <label className={styles.field}><span>{copy.value}</span><select value={value as string} onChange={(event) => setValue(event.currentTarget.value)}><option value="">{copy.neutral}</option><option value="true">{copy.locale === "pl" ? "Tak" : "Yes"}</option><option value="false">{copy.locale === "pl" ? "Nie" : "No"}</option></select></label>;
  if (definition.type === "single" && options.length) return <label className={styles.field}><span>{copy.value}</span><select value={value as string} onChange={(event) => setValue(event.currentTarget.value)}><option value="">{copy.neutral}</option>{options.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>;
  if (definition.type === "multi" && options.length) return <MultiChoiceList options={options} value={value} setValue={setValue} copy={copy} />;
  if (definition.type === "entity") { const options = storyEntityOptions(story.world, objects); return <label className={styles.field}><span>{copy.value}</span><select value={value as string} onChange={(event) => setValue(event.currentTarget.value)}><option value="">{copy.neutral}</option>{options.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}</select></label>; }
  return <label className={styles.field}><span>{copy.value}{definition.unit ? ` (${definition.unit})` : ""}</span><input type={definition.type === "number" || definition.type === "unit" ? "number" : "text"} value={value as string} onChange={(event) => setValue(event.currentTarget.value)} placeholder={copy.value} /></label>;
}

function MultiChoiceList({ options, value, setValue, copy }: { options: string[]; value: string | string[]; setValue: (value: string | string[]) => void; copy: StoryCopy }) {
  const selected = Array.isArray(value) ? value : [];
  return <div className={styles.subsection} role="group" aria-label={copy.value}>{options.map((option) => <label className={styles.field} key={option}><input type="checkbox" checked={selected.includes(option)} onChange={(event) => setValue(event.currentTarget.checked ? [...selected, option] : selected.filter((item) => item !== option))} /><span>{option}</span></label>)}</div>;
}

export function propertyValue(definition: StoryPropertyDefinition | undefined, raw: string | string[], entityOptions: readonly StoryEntityOption[] = []): StoryPropertyValue | undefined {
  if (!definition || (typeof raw === "string" && !raw.trim()) || (Array.isArray(raw) && !raw.length)) return undefined;
  if (definition.type === "number" || definition.type === "unit") { const value = Number(raw); return Number.isFinite(value) ? value : undefined; }
  if (definition.type === "boolean") return raw === "true" ? true : raw === "false" ? false : undefined;
  if (definition.type === "multi") return Array.isArray(raw) ? raw : [raw];
  if (definition.type === "entity") return entityOptions.length ? storyEntityValue(String(raw), entityOptions) : { entityId: String(raw) };
  return Array.isArray(raw) ? raw[0] ?? "" : raw;
}

export function predicateLabel(kind: PredicateKind, copy: StoryCopy, ui: Record<string, string>) {
  if (kind === "owner") return ui.belongs;
  if (kind === "access") return ui.available;
  if (kind === "property") return ui.hasTrait;
  if (kind === "tag") return ui.legacyTag;
  return copy[kind === "object" ? "objects" : kind];
}

function predicateExplanation(predicate: StoryLensPredicate, copy: StoryCopy, story: StoryDocumentLike, objects: ObjectChoice[]) {
  const name = (items: Array<{ id: string; name: string }>, id: string) => items.find((item) => item.id === id)?.name ?? id;
  if (predicate.kind === "tag") return `${copy.tag}: ${predicate.value}`;
  if (predicate.kind === "property") return `${copy.property}: ${name(story.propertyDefinitions, predicate.propertyId)} = ${Array.isArray(predicate.equals) ? predicate.equals.join(", ") : String(predicate.equals)}`;
  if (predicate.kind === "access") return `${copy.access}: ${name(story.world, predicate.entryId)} (${predicate.state === "allowed" ? copy.allow : copy.deny})`;
  if (predicate.kind === "owner") return `${copy.owner}: ${name(story.world, predicate.entryId)}`;
  if (predicate.kind === "group") {
    const zone = story.zones.find(({ id, legacyGroupId }) => id === predicate.groupId || legacyGroupId === predicate.groupId);
    const legacy = legacyStoryGroups(story).find(({ id }) => id === predicate.groupId);
    return `${copy.zone}: ${zone?.name ?? legacy?.name ?? name(story.groups, predicate.groupId)}`;
  }
  if (predicate.kind === "zone") return `${copy.zone}: ${name(story.zones, predicate.zoneId)}`;
  return `${copy.objects}: ${objects.find(({ ref }) => storyRefKey(ref) === storyRefKey(predicate.ref))?.name ?? predicate.ref.id}`;
}

export function explanationFor(expression: unknown, copy: StoryCopy, story: StoryDocumentLike, objects: ObjectChoice[]): string {
  const value = expression as StoryLensExpression | undefined;
  if (!value) return copy.noLens;
  if (value.kind === "predicate") return predicateExplanation(value.predicate, copy, story, objects);
  const children = value.kind === "not" ? [value.item] : value.items;
  return children.length ? `${copy[value.kind]}: (${children.map((item) => explanationFor(item, copy, story, objects)).join(" · ")})` : copy.noLens;
}

export function lensUi(copy: StoryCopy): Record<string, string> {
  return copy.locale === "pl" ? {
    saved: "Zapisane soczewki", question: "Co chcesz zobaczyć?", builder: "Nowy filtr", builderHint: "Określ, jakie obiekty chcesz teraz wyróżnić na mapie. Możesz od razu podejrzeć wynik albo zapisać go jako soczewkę do ponownego użycia.", newLens: "Nowa soczewka", showOnMap: "Pokaż na mapie", show: "Pokaż", hide: "Ukryj", active: "Aktywna", filterType: "Filtr", belongs: "Należy do", available: "Dostępne dla", hasTrait: "Ma cechę", legacyTag: "Stary tag", accessState: "Rodzaj dostępu", choose: "Wybierz wpis", autoName: "Nazwa soczewki", editName: "Nazwa", create: "Zapisz soczewkę", saveChanges: "Zapisz zmiany", savedStatus: "Zapisano zmiany.", cancel: "Anuluj", edit: "Edytuj", deleteLens: "Usuń soczewkę", clearAll: "Wyłącz wszystko", color: "Kolor podświetlenia", exclude: "Wyklucz te wyniki", conditions: "Warunki filtra", conditionsHint: "Wybierz, czy obiekt ma spełniać wszystkie podane warunki, czy wystarczy dowolny z nich.", noConditions: "Dodaj co najmniej jeden warunek.", previewActive: "Pokazano tymczasowy filtr; zapisane soczewki pozostały bez zmian.", advanced: "Warunki filtra", chooseLens: "Zbuduj filtr po prawej albo wybierz Edytuj przy zapisanej soczewce.", nameHint: "np. Miejsca Anny", temporaryName: "Filtr tymczasowy", intro: "Pokaż na mapie obiekty spełniające wybrane warunki — np. należące do danej postaci, dostępne dla grupy albo posiadające określoną cechę. Soczewki zmieniają tylko sposób oglądania mapy, więc możesz swobodnie włączać kilka naraz.", note: "Wypróbuj filtr od razu na mapie bez zapisywania go. Jeśli chcesz wracać do tego widoku później, zapisz go jako soczewkę."
  } : {
    saved: "Saved lenses", question: "What do you want to see?", builder: "New filter", builderHint: "Define which objects you want to highlight on the map. You can preview the result immediately or save it as a lens to use again.", newLens: "New lens", showOnMap: "Show on map", show: "Show", hide: "Hide", active: "Active", filterType: "Filter", belongs: "Belongs to", available: "Available to", hasTrait: "Has trait", legacyTag: "Legacy tag", accessState: "Access kind", choose: "Choose an entry", autoName: "Lens name", editName: "Name", create: "Save lens", saveChanges: "Save changes", savedStatus: "Changes saved.", cancel: "Cancel", edit: "Edit", deleteLens: "Delete lens", clearAll: "Turn off all", color: "Highlight color", exclude: "Exclude these results", conditions: "Filter conditions", conditionsHint: "Choose whether an object must meet all the listed conditions or whether any one of them is enough.", noConditions: "Add at least one condition.", previewActive: "A temporary filter is shown; saved lenses stayed unchanged.", advanced: "Filter conditions", chooseLens: "Build a filter on the right or choose Edit beside a saved lens.", nameHint: "e.g. Anna's places", temporaryName: "Temporary filter", intro: "Show objects on the map that match selected conditions, such as objects owned by a particular character, available to a group, or bearing a particular trait. Lenses only change how you view the map, so you can freely activate several at once.", note: "Try the filter on the map immediately without saving it. If you want to return to this view later, save it as a lens."
  };
}
