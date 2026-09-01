"use client";

import type { StoryCollection, StoryCopy, StoryRecord, StoryTab } from "./story-types";
import styles from "./story-workbench.module.css";

type StoryLeftBookProps = { copy: StoryCopy; tab: StoryTab; activeCollection: StoryCollection; items: Array<[StoryCollection, string, StoryRecord[]]>; onCollection(id: StoryCollection): void };
export function StoryLeftBook({ copy, tab, activeCollection, items, onCollection }: StoryLeftBookProps) {
  return <aside className={styles.storyNav}><h2>{tab === "atlas" ? copy.atlas : tab === "worldbook" ? copy.worldbook : copy.lenses}</h2>{tab !== "lenses" && items.map(([id, label, values]) => <button key={id} type="button" className={activeCollection === id ? styles.isActive : undefined} onClick={() => onCollection(id)}>{label}<span>{values.length}</span></button>)}<p className={styles.navHint}>{copy.mandatoryHint}</p></aside>;
}
