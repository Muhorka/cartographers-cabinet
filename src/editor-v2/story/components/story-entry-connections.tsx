import { storyActorGroups } from "../effective";
import { inspectorCopy } from "../i18n/inspector-copy";
import { storyRefKey } from "../types";
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
  const list = (items: StoryResolvedObject[], empty: string) => items.length ? <ul>{items.map(({ ref, name }) => <li key={storyRefKey(ref)}>{name ?? ref.id}</li>)}</ul> : <p className={styles.hint}>{empty}</p>;
  return <section className={styles.explanation}><h3>{c.worldFacts}</h3><p className={styles.hint}>{c.derived}</p>
    <h3>{c.owns}</h3>{list(direct, c.noOwned)}{structural.length > 0 && <details><summary>{c.structuralParts} ({structural.length})</summary>{list(structural, c.noOwned)}</details>}
    <h3>{c.opens}</h3>{list(doors, c.noDoors)}
  </section>;
}
