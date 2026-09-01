import type { EditorProject } from "../../model/project-model";
import { zoneMatchesProject } from "../project-adapter";
import { zoneCopy } from "../i18n/zone-copy";
import type { StoryObjectRef } from "../types";
import styles from "./story-zone-list.module.css";

/** Read-only inverse relationship, derived from the same membership as lenses/routes. */
export function StoryZoneMemberships({ project, refs, locale, onSelect }: {
  project: EditorProject; refs: StoryObjectRef[]; locale: "pl" | "en"; onSelect(id: string): void;
}) {
  const memberships = project.story.zones.flatMap((zone) => {
    const count = refs.filter((ref) => zoneMatchesProject(project, project.story, zone.id, ref).matches).length;
    return count ? [{ zone, count }] : [];
  });
  if (!memberships.length) return null;
  return <section className={styles.list} aria-label={zoneCopy[locale].membership}>
    <strong>{zoneCopy[locale].membership}</strong>
    {memberships.map(({ zone, count }) => <button key={zone.id} type="button" onClick={() => onSelect(zone.id)}>{zone.name}{refs.length > 1 && <small>{count}/{refs.length}</small>}</button>)}
  </section>;
}
