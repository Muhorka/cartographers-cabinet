"use client";
import { useMemo, useState } from "react";
import type { MapSelection } from "./map-sheet";
import type { EditorProject } from "../model/project-model";
import styles from "./sheet-object-list.module.css";
import { filterSheetObjectGroups, sheetObjectGroups, type SheetObjectItem } from "./sheet-object-catalogue";

export type SheetObjectListCopy = {
  title: string;
  places: string;
  terrain: string;
  roads?: string;
  equipment: string;
  surfaces?: string;
  sketch: string;
  rooms: string;
  walls: string;
  features: string;
  empty: string;
  noResults: string;
  search: string;
  show: string;
  hide: string;
  lock: string;
  unlock: string;
  delete?: string;
  wallName(index: number): string;
  openingName(kind: "door" | "window" | "gate" | "passage", index: number): string;
  stairsName(index: number): string;
  elevatorName?(index: number): string;
};

export function SheetObjectList({ project, activePlaceId, selections = [], copy, onSelect, onUpdateElement, onDelete, onUpdateSelection }: {
  project: EditorProject;
  activePlaceId: string;
  selections?: MapSelection[];
  copy: SheetObjectListCopy;
  onSelect(selection: MapSelection, additive?: boolean): void;
  onUpdateElement?(id: string, details: { visible?: boolean; locked?: boolean }): void;
  onDelete?(selection: MapSelection): void;
  onUpdateSelection?(selection: MapSelection, details: { visible?: boolean; locked?: boolean }): void;
}) {
  const [query, setQuery] = useState("");
  const allGroups = useMemo(() => sheetObjectGroups(project, activePlaceId, copy), [project, activePlaceId, copy]);
  const groups = useMemo(() => filterSheetObjectGroups(allGroups, query), [allGroups, query]);
  const selected = new Set(selections.map(({ kind, id }) => `${kind}:${id}`));
  const emptyMessage = allGroups.length ? copy.noResults : copy.empty;
  return <section className={styles.list}><h3>{copy.title}</h3><label className={styles.search}><span className={styles.visuallyHidden}>{copy.search}</span><input type="search" value={query} placeholder={copy.search} onChange={(event) => setQuery(event.currentTarget.value)}/></label>{groups.length ? groups.map((group) => <details key={group.id} open={query ? true : group.open}><summary>{group.label} <small>{group.items.length}</small></summary><div className={styles.items}>{group.items.map((item) => <ObjectRow key={`${item.selection.kind}:${item.selection.id}`} item={item} selected={selected.has(`${item.selection.kind}:${item.selection.id}`)} copy={copy} onSelect={onSelect} onUpdateElement={onUpdateElement} onUpdateSelection={onUpdateSelection} onDelete={onDelete}/>)}</div></details>) : <p>{emptyMessage}</p>}</section>;
}

function ObjectRow({ item, selected, copy, onSelect, onUpdateElement, onUpdateSelection, onDelete }: { item: SheetObjectItem; selected: boolean; copy: SheetObjectListCopy; onSelect(selection: MapSelection, additive?: boolean): void; onUpdateElement?(id: string, details: { visible?: boolean; locked?: boolean }): void; onUpdateSelection?(selection: MapSelection, details: { visible?: boolean; locked?: boolean }): void; onDelete?(selection: MapSelection): void }) {
  const update = onUpdateSelection ?? (item.selection.kind === "element" && onUpdateElement ? (selection: MapSelection, details: { visible?: boolean; locked?: boolean }) => onUpdateElement(selection.id, details) : undefined);
  const supportsState = item.visible !== undefined && item.locked !== undefined && Boolean(update);
  return <div className={`${styles.row} ${selected ? styles.selected : ""}`}><button type="button" className={styles.object} aria-pressed={selected} title={item.description || item.label} onClick={(event) => onSelect(item.selection, event.ctrlKey || event.metaKey || event.shiftKey)}><span>{item.label}</span>{item.tags?.length ? <small>{item.tags.join(" · ")}</small> : null}</button><div className={styles.controls}>{supportsState && <><button type="button" className={!item.visible ? styles.off : undefined} title={item.visible ? copy.hide : copy.show} aria-label={`${item.visible ? copy.hide : copy.show}: ${item.label}`} aria-pressed={!item.visible} onClick={() => update?.(item.selection, { visible: !item.visible })}>{item.visible ? <EyeIcon/> : <HiddenIcon/>}</button><button type="button" className={item.locked ? styles.on : undefined} title={item.locked ? copy.unlock : copy.lock} aria-label={`${item.locked ? copy.unlock : copy.lock}: ${item.label}`} aria-pressed={item.locked} onClick={() => update?.(item.selection, { locked: !item.locked })}>{item.locked ? <LockIcon/> : <UnlockIcon/>}</button></>}{onDelete && <button type="button" disabled={item.locked} title={item.locked ? copy.unlock : (copy.delete ?? "Delete")} aria-label={`${copy.delete ?? "Delete"}: ${item.label}`} onClick={() => onDelete(item.selection)}><TrashIcon/></button>}</div></div>;
}

function EyeIcon() { return <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M1.5 8s2.2-3.5 6.5-3.5S14.5 8 14.5 8 12.3 11.5 8 11.5 1.5 8 1.5 8Z"/><circle cx="8" cy="8" r="1.6"/></svg>; }
function HiddenIcon() { return <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2 2l12 12M5.2 4.9A7.6 7.6 0 0 1 8 4.4c4.3 0 6.5 3.6 6.5 3.6a10 10 0 0 1-2 2.3M9.7 11.3c-.5.2-1.1.3-1.7.3C3.7 11.6 1.5 8 1.5 8a11 11 0 0 1 2.1-2.4"/></svg>; }
function LockIcon() { return <svg viewBox="0 0 16 16" aria-hidden="true"><rect x="3.2" y="7" width="9.6" height="7" rx="1"/><path d="M5.2 7V5a2.8 2.8 0 0 1 5.6 0v2"/></svg>; }
function UnlockIcon() { return <svg viewBox="0 0 16 16" aria-hidden="true"><rect x="3.2" y="7" width="9.6" height="7" rx="1"/><path d="M5.2 7V5a2.8 2.8 0 0 1 5.3-1.3"/></svg>; }
function TrashIcon() { return <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 4.5h10M6 4.5V3h4v1.5M5 6.5v6m3-6v6m3-6v6M4 4.5l.6 9h6.8l.6-9"/></svg>; }
