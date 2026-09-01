"use client";

import { useMemo, useState, type ReactNode } from "react";
import { defaultStoryAccessPolicy, sameStoryRef, type StoryAccessPolicy, type StoryObjectMetadata, type StoryObjectRef, type StoryPropertyValue } from "../types";
import type { StoryCopy, StoryDocumentLike, StorySelection, StoryCollection } from "./story-types";
import { storyObjectOptions } from "./story-object-options";
import { StoryReferenceChoices } from "./story-reference-choices";
import { inspectorCopy } from "../i18n/inspector-copy";
import { StoryPropertyField } from "./story-property-field";
import { StoryQuickAssign } from "./story-quick-assign";
import { StoryAccessFields } from "./story-access-fields";
import type { StoryOwnershipResolution } from "../ownership";
import flow from "./story-worldbook-flow.module.css";
import styles from "./story-workbench.module.css";

type StoryMetadataAction = "add" | "remove" | "replace";
type StoryMetadataChangeOptions = { accessFields?: Array<keyof StoryAccessPolicy> };
type StoryMetadataChangeResult = boolean | void;
type StoryMetadataEvidence = { propertyId: string; source: string; value?: unknown; patchIds?: string[]; conflict?: boolean };
type ResolvedStoryObject = { ref: StoryObjectRef; name?: string; description?: string; metadata?: StoryObjectMetadata; legacyMetadata?: StoryObjectMetadata; effectiveProperties?: StoryMetadataEvidence[]; conflicts?: string[] };
type StoryContextPanelProps = { detailsOpen?: boolean; onDetailsOpenChange?(open: boolean): void; scope?: "selection" | "open-place"; readOnly?: boolean; editTarget?: "base" | "scenario"; onQuickAssign?(kind: "character" | "faction" | "boolean-property", name: string): boolean; onOpenWorldbook?(collection: StoryCollection): void; onSelectCurrentPlace?(): void; keyHoldersEditor?: ReactNode; story: StoryDocumentLike; selection?: StorySelection; selections?: StorySelection[]; resolvedObjects?: ResolvedStoryObject[]; ownership?: StoryOwnershipResolution; canResetOwnership?: boolean; copy: StoryCopy; onUpdate?(selection: StorySelection, metadata: Record<string, unknown>): void; onMetadataChange?(refs: StoryObjectRef[], metadata: Partial<StoryObjectMetadata>, action: StoryMetadataAction, options?: StoryMetadataChangeOptions): StoryMetadataChangeResult; onResetOwnership?(refs: StoryObjectRef[]): StoryMetadataChangeResult; agentContext?: { label: string; detail?: string; status?: "idle" | "working" | "proposal" } };
type DirtyField = "narrativeLabel" | "narrativeDescription" | "owners" | "access" | "properties";

function StoryContextPanel({ story, selection, selections, resolvedObjects, ownership, canResetOwnership = false, copy, onUpdate, onMetadataChange, onResetOwnership, agentContext, onOpenWorldbook, onSelectCurrentPlace, keyHoldersEditor, onQuickAssign, editTarget = "base", scope = "selection", readOnly = false, detailsOpen, onDetailsOpenChange }: StoryContextPanelProps) {
  const c = inspectorCopy[copy.locale === "pl" ? "pl" : "en"];
  const selectedItems = selections?.length ? selections : selection ? [selection] : [];
  const activeSelection = selectedItems.at(-1);
  const activeRef = activeSelection ? selectionRef(activeSelection) : undefined;
  const resolved = activeRef ? resolvedObjects?.find(({ ref }) => sameStoryRef(ref, activeRef)) : undefined;
  const object = activeRef ? story.objects.find(({ ref }) => sameStoryRef(ref, activeRef)) : undefined;
  const current = resolved?.metadata ?? object?.metadata ?? {};
  const evidence = resolved?.effectiveProperties ?? evidenceFromSelection(activeSelection?.metadata?.effectiveProperties);
  const conflicts = resolved?.conflicts ?? stringArray(activeSelection?.metadata?.conflicts);
  const [dirty, setDirty] = useState<Set<DirtyField>>(() => new Set());
  const [label, setLabel] = useState(resolved?.name ?? current.narrativeLabel ?? "");
  const [narrativeDescription, setNarrativeDescription] = useState(resolved?.description ?? current.narrativeDescription ?? "");
  const initialOwners = ownership ? ownership.effectiveOwners : current.owners ?? [];
  const [owners, setOwners] = useState(initialOwners);
  const [access, setAccess] = useState({ ...defaultStoryAccessPolicy(), ...(current.access ?? {}) });
  const [properties, setProperties] = useState<Record<string, StoryPropertyValue>>(current.properties ?? {});
  const [dirtyAccessFields, setDirtyAccessFields] = useState<Set<keyof StoryAccessPolicy>>(() => new Set());
  const [dirtyPropertyIds, setDirtyPropertyIds] = useState<Set<string>>(() => new Set());
  const mark = (field: DirtyField) => setDirty((old) => new Set(old).add(field));
  const updateAccess = (patch: Partial<typeof access>) => { setAccess((old) => ({ ...old, ...patch })); setDirtyAccessFields((old) => new Set([...old, ...Object.keys(patch) as Array<keyof StoryAccessPolicy>])); mark("access"); };
  const world = useMemo(() => story.world.filter(({ kind }) => kind === "character" || kind === "faction").map(({ id, name }) => ({ id, name })), [story.world]);
  const objectOptions = storyObjectOptions(story, resolvedObjects);
  const metadata = (): Partial<StoryObjectMetadata> => { const next: Partial<StoryObjectMetadata> = {}; if (dirty.has("narrativeLabel")) next.narrativeLabel = label.trim() || undefined; if (dirty.has("narrativeDescription")) next.narrativeDescription = narrativeDescription; if (dirty.has("owners")) next.owners = owners; if (dirty.has("properties")) next.properties = Object.fromEntries([...dirtyPropertyIds].map((id) => [id, properties[id]])); if (dirty.has("access")) next.access = access; return next; };
  function clearDirty() { setDirty(new Set()); setDirtyAccessFields(new Set()); setDirtyPropertyIds(new Set()); }
  function clearOwnershipDirty() { setDirty((old) => { const next = new Set(old); next.delete("owners"); return next; }); }
  function save(action: StoryMetadataAction = "replace") {
    const refs = selectedItems.map(selectionRef).filter((ref): ref is StoryObjectRef => Boolean(ref)); const next = metadata(); if (!refs.length || !Object.keys(next).length) return;
    let result: StoryMetadataChangeResult = true;
    if (onMetadataChange) { const options = dirtyAccessFields.size ? { accessFields: [...dirtyAccessFields] } : undefined; result = options ? onMetadataChange(refs, next, action, options) : onMetadataChange(refs, next, action); }
    else selectedItems.forEach((item) => onUpdate?.(item, next as Record<string, unknown>));
    if (result !== false) clearDirty();
  }
  const ownershipHint = ownership?.mode === "inherited"
    ? c.ownershipInherited.replace("{name}", ownership.source?.name ?? c.ownershipSourceUnknown)
    : ownership?.mode === "custom" ? c.ownershipCustom : c.ownershipNone;
  const resetOwnership = () => {
    const refs = selectedItems.map(selectionRef).filter((ref): ref is StoryObjectRef => Boolean(ref));
    if (!onResetOwnership || !refs.length || dirty.size > 0 || !canResetOwnership) return;
    const result = onResetOwnership(refs);
    if (result !== false) clearOwnershipDirty();
  };
  const multi = (labelText: string, values: string[], options: Array<{ id: string; name: string }>, set: (value: string[]) => void, field: DirtyField = "access", hint?: string) => <StoryReferenceChoices label={labelText} hint={hint} values={values} options={options} empty={c.noPeople} onChange={(value) => { set(value); mark(field); }}/>;
  const bookLink = (collection: StoryCollection, text: string) => onOpenWorldbook && <button type="button" onClick={() => onOpenWorldbook(collection)}>{text}</button>;
  function cancel() {
    setDirty(new Set()); setDirtyAccessFields(new Set()); setDirtyPropertyIds(new Set());
    setLabel(resolved?.name ?? current.narrativeLabel ?? ""); setNarrativeDescription(resolved?.description ?? current.narrativeDescription ?? "");
    setOwners(initialOwners); setAccess({ ...defaultStoryAccessPolicy(), ...(current.access ?? {}) }); setProperties(current.properties ?? {});
  }
  return <aside className={styles.contextPanel} aria-label={copy.metadata}>
    <header className={styles.panelHeading}><div><span className={styles.kicker}>{scope === "open-place" ? copy.place : copy.selection}</span><h2>{scope === "open-place" ? c.openPlace : copy.metadata}</h2></div><span className={styles.contextGlyph}>✦</span></header>
    {readOnly && <p role="status" className={flow.hint}>{c.lockedEditing}</p>}
    {activeSelection ? <fieldset disabled={readOnly} className={`${styles.form} ${flow.detailFields}`}>
      <p className={styles.selectionBadge}><strong>{c.editing}: {selectedItems.length > 1 ? selectedItems.length + " " + c.objects : activeSelection.name ?? resolved?.name ?? activeSelection.id}</strong><small>{selectedItems.length > 1 ? selectedItems.map((item) => item.name ?? item.id).join(" · ") : kindLabel(activeSelection.kind, copy)}</small></p>
      {editTarget === "scenario" && <p className={flow.hint}>{c.appliesScenario}</p>}
      {dirty.size > 0 && <div className={flow.saveBar}><span>{c.unsaved}</span><div><button type="button" onClick={() => save()}>{copy.save}</button><button type="button" onClick={cancel}>{copy.cancel}</button></div></div>}
      {selectedItems.length > 1 && <p className={flow.hint}>{c.multiHint}</p>}
      <label className={styles.field}><span>{copy.narrativeLabel}</span><input value={label} onChange={(event) => { setLabel(event.currentTarget.value); mark("narrativeLabel"); }}/></label>
      <label className={styles.field}><span>{copy.narrativeDescription}</span><textarea value={narrativeDescription} onChange={(event) => { setNarrativeDescription(event.currentTarget.value); mark("narrativeDescription"); }} rows={2}/></label>
      <div className={flow.optionalSections}><details open={detailsOpen} onToggle={(event) => onDetailsOpenChange?.(event.currentTarget.open)}><summary>{c.additionalDetails}</summary><div className={styles.form}>
      <p className={flow.hint}>{c.additionalHint}</p>
      <p className={flow.hint}>{editTarget === "scenario" ? c.appliesScenario : c.appliesBase}</p>
      {multi(c.owners, owners, world, setOwners, "owners", c.ownersHint)}
      {selectedItems.length === 1 && ownership && <div className={flow.explanation}><p className={flow.hint} role="status">{ownershipHint}</p>{ownership.mode !== "inherited" && ownership.inheritedOwners.length > 0 && <p className={flow.hint}>{c.ownershipAvailable.replace("{name}", ownership.inheritedSource?.name ?? c.ownershipSourceUnknown)}</p>}{onResetOwnership && ownership.directPresent && canResetOwnership && <><button type="button" disabled={dirty.size > 0} onClick={resetOwnership}>{c.resetOwnership}</button><p className={flow.hint}>{dirty.size > 0 ? c.resetOwnershipSaveFirst : c.resetOwnershipHint}</p></>}</div>}
      {onQuickAssign && <StoryQuickAssign mode="owner" copy={copy} disabled={dirty.size > 0} onAssign={onQuickAssign}/>}
      <section className={flow.explanation}><h3>{c.traits}</h3><p className={flow.hint}>{c.traitsHint}</p>
        {!story.propertyDefinitions.length && <p className={flow.hint}>{c.noTraits}</p>}
        {story.propertyDefinitions.filter((definition) => !definition.targetKinds?.length || selectedItems.every((item) => { const ref = selectionRef(item); return ref && definition.targetKinds!.includes(ref.kind); })).map((definition) => <StoryPropertyField key={definition.id} definition={definition} value={properties[definition.id]} sourceLabel={propertySourceLabel(definition.id, evidence, story, c)} objectOptions={objectOptions} worldOptions={story.world} copy={copy} onChange={(value) => { setProperties((old) => ({ ...old, [definition.id]: value })); setDirtyPropertyIds((old) => new Set(old).add(definition.id)); mark("properties"); }}/>)}
        {onQuickAssign && <StoryQuickAssign mode="trait" copy={copy} disabled={dirty.size > 0} onAssign={onQuickAssign}/>}
        <div className={flow.toolbar}>{bookLink("propertyDefinitions", c.manageTraits)}</div>
        {Boolean(current.tags?.length) && <details><summary>{c.legacyTraits}</summary><p className={flow.hint}>{c.legacyHint}</p><p>{current.tags!.join(" · ")}</p></details>}
      </section>
      <StoryAccessFields story={story} copy={copy} value={access} passage={selectedItems.every((item) => { const kind = selectionRef(item)?.kind; return kind === "opening" || kind === "transition"; })} dirty={dirty.size > 0} keyHoldersEditor={keyHoldersEditor} onChange={updateAccess} onOpenWorldbook={onOpenWorldbook}/>
      {selectedItems.length > 1 && <div className={flow.optionalSections}><details><summary>{c.bulk}</summary><div className={styles.bulkActions}><button type="button" disabled={!dirty.size} onClick={() => save("add")}>{copy.addToSelection}</button><button type="button" disabled={!dirty.size} onClick={() => save("remove")}>{copy.removeFromSelection}</button><button type="button" disabled={!dirty.size} onClick={() => save("replace")}>{copy.replaceSelection}</button></div></details></div>}
      {(evidence.length > 0 || conflicts.length > 0) && <details className={styles.provenance}><summary>{copy.provenance}</summary>{conflicts.length > 0 && <strong>{copy.conflicts}: {conflicts.join(", ")}</strong>}{evidence.map((item) => <small key={item.propertyId}>{propertyName(item.propertyId, story, c)}: <strong>{evidenceSourceLabel(item.source, c, story)}</strong>{item.conflict ? ` · ${copy.conflicts}` : ""}</small>)}</details>}
      </div></details></div>
    </fieldset> : <><p className={styles.empty}>{c.pick}</p>{onSelectCurrentPlace && <div className={flow.toolbar}><button type="button" onClick={onSelectCurrentPlace}>{c.openPlace}</button></div>}</>}
    <div className={styles.agentCard}><span className={styles.agentDot} aria-hidden="true"/><div><strong>{agentContext?.label ?? copy.agent}</strong><p>{agentContext?.detail ?? copy.agentIdle}</p></div></div>
  </aside>;
}

function selectionRef(selection: StorySelection): StoryObjectRef | undefined { if (selection.ref) return selection.ref; return selection.kind && ["place", "element", "surface", "room", "wall", "opening", "transition"].includes(selection.kind) ? { kind: selection.kind as StoryObjectRef["kind"], id: selection.id, ...(selection.scopeId ? { scopeId: selection.scopeId } : {}) } : undefined; }
function kindLabel(kind: string | undefined, copy: StoryCopy) { return kind ? copy[kind] ?? kind : copy.objects ?? "map object"; }
function stringArray(value: unknown): string[] { return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []; }
function evidenceFromSelection(value: unknown): StoryMetadataEvidence[] { return Array.isArray(value) ? value.filter((item): item is StoryMetadataEvidence => Boolean(item) && typeof item === "object" && typeof (item as { propertyId?: unknown }).propertyId === "string" && typeof (item as { source?: unknown }).source === "string") : []; }
function propertyName(propertyId: string, story: StoryDocumentLike, copy: typeof inspectorCopy.en): string {
  return story.propertyDefinitions.find(({ id }) => id === propertyId)?.name ?? `${propertyId} (${copy.missingProperty})`;
}
function propertySourceLabel(propertyId: string, evidence: StoryMetadataEvidence[], story: StoryDocumentLike, copy: typeof inspectorCopy.en): string | undefined {
  const item = evidence.find(({ propertyId: candidate }) => candidate === propertyId);
  return item ? evidenceSourceLabel(item.source, copy, story) : undefined;
}
function evidenceSourceLabel(source: string, copy: typeof inspectorCopy.en, story: StoryDocumentLike): string {
  if (source === "local") return copy.ownValue;
  if (source.startsWith("zone:")) {
    const names = source.slice("zone:".length).split(",").map((id) => id.trim()).filter(Boolean).map((id) => story.zones.find(({ id: candidate }) => candidate === id)?.name ?? `${id} (${copy.missingZone})`);
    return copy.inheritedFromZone.replace("{name}", names.join(", ") || copy.missingZone);
  }
  return source;
}
export const StoryInspector = StoryContextPanel;
