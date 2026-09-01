"use client";

import { useState } from "react";
import type { StoryZone } from "../types";
import { zoneCopy } from "../i18n/zone-copy";
import styles from "./story-zone-list.module.css";

export function StoryZoneList({ zones, selectedId, selectionCount, omittedCount = 0, locale, onSelect, onCreate }: {
  zones: StoryZone[]; selectedId?: string; selectionCount: number; omittedCount?: number; locale: "pl" | "en";
  onSelect(id: string): void; onCreate(name: string): boolean;
}) {
  const c = zoneCopy[locale]; const [creating, setCreating] = useState(false); const [name, setName] = useState("");
  return <section className={styles.list} aria-label={c.title}>
    <p className={styles.description}>{c.description}</p>
    {!zones.length && <p>{c.empty}</p>}
    {zones.map((zone) => <button type="button" key={zone.id} aria-pressed={selectedId === zone.id} onClick={() => onSelect(zone.id)}>
      <span className={styles.swatch} style={{ backgroundColor: zone.color ?? "#9a6a9d" }} aria-hidden="true"/>
      <span className={styles.zoneName}>{zone.name}</span><small>{zone.members.length}</small>
    </button>)}
    {!creating ? <button className={styles.create} type="button" onClick={() => setCreating(true)}>{selectionCount ? c.fromSelection : c.create}</button> :
      <form onSubmit={(event) => { event.preventDefault(); if (name.trim() && onCreate(name.trim())) { setName(""); setCreating(false); } }}>
        <label>{c.name}<input required value={name} onChange={(event) => setName(event.currentTarget.value)}/></label>
        <p>{selectionCount ? `${c.selection}: ${selectionCount}` : c.noSelection}</p>
        {omittedCount > 0 && <p>{c.noWalls}</p>}
        <div className={styles.actions}><button className={styles.primary} type="submit" disabled={!name.trim()}>{c.save}</button><button type="button" onClick={() => setCreating(false)}>{c.cancel}</button></div>
      </form>}
  </section>;
}
