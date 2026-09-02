import { storyActorGroups } from "../effective";
import { inspectorCopy } from "../i18n/inspector-copy";
import { storyRefKey, type StoryRelation } from "../types";
import type { StoryCopy, StoryDocumentLike, StoryRecord, StoryResolvedObject } from "./story-types";
import { ownershipDisplayGroups } from "./story-entry-connection-groups";
import styles from "./story-worldbook-flow.module.css";

/** Read-only inverse views of canonical assignments, never a second editable inventory. */
export function StoryEntryConnections({ entry, story, resolvedObjects, copy }: {
  entry: StoryRecord; story: StoryDocumentLike; resolvedObjects: StoryResolvedObject[]; copy: StoryCopy;
}) {
  const c = inspectorCopy[copy.locale === "pl" ? "pl" : "en"];
  const ownership = ownershipDisplayGroups(resolvedObjects, entry.id);
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
  const list = (items: StoryResolvedObject[], empty: string) => items.length ? <ul>{items.toSorted((left, right) => (left.name ?? left.ref.id).localeCompare(right.name ?? right.ref.id, copy.locale, { sensitivity: "base", numeric: true })).map(({ ref, name }) => <li key={storyRefKey(ref)}>{name ?? ref.id}</li>)}</ul> : <p className={styles.hint}>{empty}</p>;
  const relatedSorted = related.toSorted((left, right) => relationText(left).localeCompare(relationText(right), copy.locale, { sensitivity: "base", numeric: true }));
  const ownershipScopeCount = ownership.roots.length || ownership.structural.length;
  return <details className={styles.explanation}>
    <summary>{c.worldFacts}</summary>
    <div className={styles.connectionSections}><p className={styles.hint}>{c.derived}</p>
      <details><summary>{c.owns} ({ownershipScopeCount})</summary>{list(ownership.roots, c.noOwned)}
        {ownership.inherited.length > 0 && <details><summary>{c.includedByHierarchy} ({ownership.inherited.length})</summary>{list(ownership.inherited, c.noOwned)}</details>}
        {ownership.exceptions.length > 0 && <details><summary>{c.ownershipExceptions} ({ownership.exceptions.length})</summary>{list(ownership.exceptions, c.noOwned)}</details>}
        {ownership.structural.length > 0 && <details><summary>{c.structuralParts} ({ownership.structural.length})</summary>{list(ownership.structural, c.noOwned)}</details>}
      </details>
      <details><summary>{c.opens} ({doors.length})</summary>{list(doors, c.noDoors)}</details>
      <details><summary>{c.relations} ({related.length})</summary>{relatedSorted.length ? <ul>{relatedSorted.map((relation) => <li key={relation.id}>{relationText(relation)}{relation.description ? <small> — {relation.description}</small> : null}</li>)}</ul> : <p className={styles.hint}>{c.noRelations}</p>}</details>
    </div>
  </details>;
}
