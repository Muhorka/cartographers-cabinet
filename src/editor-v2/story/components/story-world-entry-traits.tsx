import { effectiveWorldEntry } from "../world-entry-effective";
import { worldEntryTraitsCopy } from "../i18n/world-entry-traits-copy";
import { storyObjectOptions } from "./story-object-options";
import { StoryPropertyField } from "./story-property-field";
import type { StoryCopy, StoryDocumentLike, StoryRecord, StoryResolvedObject } from "./story-types";
import flow from "./story-worldbook-flow.module.css";
import styles from "./story-workbench.module.css";

function shown(value: unknown) {
  if (value === null) return "—";
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export function StoryWorldEntryTraits({ entry, story, copy, resolvedObjects, onChange }: {
  entry: StoryRecord; story: StoryDocumentLike; copy: StoryCopy; resolvedObjects: StoryResolvedObject[]; onChange(entry: StoryRecord): void;
}) {
  const locale = copy.locale === "pl" ? "pl" : "en"; const text = worldEntryTraitsCopy[locale];
  const effective = effectiveWorldEntry(story, entry.id); const own = entry.properties && typeof entry.properties === "object" ? entry.properties as StoryDocumentLike["world"][number]["properties"] : {};
  const objects = storyObjectOptions(story, resolvedObjects, "narrative");
  const names = new Map(story.world.map(({ id, name }) => [id, name]));
  const definitions = new Map(story.propertyDefinitions.map((definition) => [definition.id, definition]));
  const update = (propertyId: string, value: StoryDocumentLike["world"][number]["properties"][string]) => onChange({ ...entry, properties: { ...own, [propertyId]: value } });
  const removeOwn = (propertyId: string) => { const next = { ...own }; delete next[propertyId]; onChange({ ...entry, properties: next }); };
  return <details className={styles.subsection} open>
    <summary>{text.title}</summary>
    <p className={flow.hint}>{text.hint}</p>
    {!story.propertyDefinitions.length && <p className={flow.hint}>{text.noDefinitions}</p>}
    {story.propertyDefinitions.map((definition) => <div key={definition.id}>
      <StoryPropertyField definition={definition} value={own[definition.id]} objectOptions={objects} worldOptions={story.world} copy={copy} onChange={(value) => update(definition.id, value)}/>
      {Object.prototype.hasOwnProperty.call(own, definition.id) && effective?.inheritedFrom.length ? <button type="button" title={text.useInherited} onClick={() => removeOwn(definition.id)}>{text.useInherited}</button> : null}
    </div>)}
    {effective && Object.values(effective.propertySources).some(({ inherited, conflict }) => inherited && !conflict) && <section className={flow.explanation}>
      <h3>{text.inherited}</h3>
      <dl>{Object.values(effective.propertySources).filter(({ inherited, conflict }) => inherited && !conflict).map((property) => <div key={property.propertyId}><dt>{definitions.get(property.propertyId)?.name ?? property.propertyId}</dt><dd>{shown(property.value)} <small>{text.from} {property.sourceIds.map((id) => names.get(id) ?? id).join(", ")}</small></dd></div>)}</dl>
    </section>}
    {effective?.conflicts.length ? <section className={flow.explanation} role="status"><h3>{text.conflict}</h3>{effective.conflicts.map((conflict) => <p key={conflict.propertyId}><strong>{definitions.get(conflict.propertyId)?.name ?? conflict.propertyId}:</strong> {conflict.values.map(({ value, sourceIds }) => `${shown(value)} (${sourceIds.map((id) => names.get(id) ?? id).join(", ")})`).join(" / ")}</p>)}</section> : null}
  </details>;
}
