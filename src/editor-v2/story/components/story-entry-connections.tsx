import { storyActorGroups } from "../effective";
import { inspectorCopy } from "../i18n/inspector-copy";
import { storyRefKey, type StoryRelation } from "../types";
import type { StoryCopy, StoryDocumentLike, StoryRecord, StoryResolvedObject } from "./story-types";
import styles from "./story-worldbook-flow.module.css";

/** Read-only inverse views of canonical assignments, never a second editable inventory. */
export function StoryEntryConnections({ entry, story, resolvedObjects, copy }: {
  entry: StoryRecord; story: StoryDocumentLike; resolvedObjects: StoryResolvedObject[]; copy: StoryCopy;
}) {
  const c = inspectorCopy[copy.locale === "pl" ? "pl" : "en"];
  const owned = resolvedObjects.filter(({ metadata }) => metadata?.owners?.includes(entry.id));
  const structural = owned.filter(({ ref }) => ["wall", "opening", "transition"].includes(ref.kind));
  const direct = owned.filter(({ ref }) => !["wall", "opening", "transition"].includes(ref.kind));
  const principals = storyActorGroups(story, entry.id);
  const keys = new Set(story.memberships.filter(({ subjectId, kind }) => kind === "holds-key" && principals.has(subjectId)).map(({ groupId }) => groupId));
  const doors = resolvedObjects.filter(({ ref, metadata }) => ref.kind === "opening" && metadata?.access?.keyIds.some((id) => keys.has(id)));
  const names = new Map<string, string>([
    ...story.world.map(({ id, name }) => [`entryId:${id}`, name] as const),
    ...resolvedObjects.map(({ ref, name, metadata }) => [storyRefKey(ref), name ?? metadata?.narrativeLabel ?? ref.id] as const),
  ]);
  const related = story.relations.filter((relation) => !["owns", "knows", "guards"].includes(relation.kind) && [relation.from, relation.to].some((endpoint) => "entryId" in endpoint && principals.has(endpoint.entryId)));
  const relationText = (relation: StoryRelation) => {
    const endpointName = (endpoint: StoryRelation["from"]) => "entryId" in endpoint ? names.get(`entryId:${endpoint.entryId}`) ?? endpoint.entryId : names.get(storyRefKey(endpoint)) ?? endpoint.id;
    return endpointName(relation.from) + " — " + (copy[relation.kind] ?? relation.kind) + " → " + endpointName(relation.to) + (relation.label ? " · " + relation.label : "");
  };
  const list = (items: StoryResolvedObject[], empty: string) => items.length ? <ul>{items.map(({ ref, name }) => <li key={storyRefKey(ref)}>{name ?? ref.id}</li>)}</ul> : <p className={styles.hint}>{empty}</p>;
  return <section className={styles.explanation}><h3>{c.worldFacts}</h3><p className={styles.hint}>{c.derived}</p>
    <h3>{c.owns}</h3>{list(direct, c.noOwned)}{structural.length > 0 && <details><summary>{c.structuralParts} ({structural.length})</summary>{list(structural, c.noOwned)}</details>}
    <h3>{c.opens}</h3>{list(doors, c.noDoors)}
    <h3>{c.relations}</h3>{related.length ? <ul>{related.map((relation) => <li key={relation.id}>{relationText(relation)}{relation.description ? <small> — {relation.description}</small> : null}</li>)}</ul> : <p className={styles.hint}>{c.noRelations}</p>}
  </section>;
}
