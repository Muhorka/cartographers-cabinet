"use client";

import { useMemo, useState } from "react";
import { type StoryLens, type StoryLensExpression, type StoryLensPredicate } from "../types";
import type { StoryCopy, StoryDocumentLike, StoryRecord, StoryResolvedObject } from "./story-types";
import { appendLensPredicate, changeLensMode, emptyLensExpression, removeLensNode } from "./lens-expression-edit";
import { storyObjectOptions } from "./story-object-options";
import styles from "./story-workbench.module.css";
import { ExpressionRules, explanationFor, lensUi, predicateChoices, predicateKinds, predicateLabel, propertyControl, propertyValue, type PredicateKind } from "./story-lens-helpers";
import { storyEntityOptions } from "./story-entity-choices";
import { LensSwatch } from "./lens-visual";

const DEFAULT_LENS_COLOR = "#9d3f35";

export type StoryLensesProps = {
  story: StoryDocumentLike;
  resolvedObjects?: StoryResolvedObject[];
  copy: StoryCopy;
  lenses: StoryRecord[];
  activeLensId?: string;
  activeLensIds?: string[];
  previewLens?: StoryLens;
  onSelect(id?: string): void;
  onChange(next: StoryRecord[]): void;
  onToggle?(id: string): void;
  onPreview?(lens?: StoryLens): void;
};

type LensDraft = { id?: string; name: string; color: string; expression: StoryLensExpression };

function draftFromLens(lens?: StoryRecord): LensDraft {
  return { id: lens?.id, name: lens?.name ?? "", color: typeof lens?.color === "string" ? lens.color : DEFAULT_LENS_COLOR, expression: (lens?.expression as StoryLensExpression | undefined) ?? emptyLensExpression() };
}

function hasPredicate(expression: StoryLensExpression): boolean {
  if (expression.kind === "predicate") return true;
  return expression.kind === "not" ? hasPredicate(expression.item) : expression.items.some(hasPredicate);
}

function baseMode(expression: StoryLensExpression): "all" | "any" {
  if (expression.kind === "not") return expression.item.kind === "any" ? "any" : "all";
  return expression.kind === "any" ? "any" : "all";
}

function draftKey(draft: LensDraft): string {
  return JSON.stringify({ name: draft.name.trim(), color: draft.color, expression: draft.expression });
}

export function StoryLenses({ story, resolvedObjects, copy, lenses, activeLensId, activeLensIds, previewLens, onSelect, onChange, onToggle, onPreview }: StoryLensesProps) {
  const ui = lensUi(copy);
  const objects = useMemo(() => storyObjectOptions(story, resolvedObjects), [story, resolvedObjects]);
  const [editingId, setEditingId] = useState<string>();
  const [builderDraft, setBuilderDraft] = useState<LensDraft>(() => draftFromLens());
  const [editDraft, setEditDraft] = useState<LensDraft>();
  const [savedDraft, setSavedDraft] = useState<LensDraft>();
  const [saveStatus, setSaveStatus] = useState("");
  const [saveNewOpen, setSaveNewOpen] = useState(false);
  const [predicateKind, setPredicateKind] = useState<PredicateKind>("owner");
  const [predicateValue, setPredicateValue] = useState("");
  const [propertyEquals, setPropertyEquals] = useState<string | string[]>("");
  const [accessState, setAccessState] = useState<"allowed" | "denied">("allowed");
  const choices = useMemo(() => predicateChoices(story, predicateKind, objects, resolvedObjects), [story, predicateKind, objects, resolvedObjects]);
  const definition = predicateKind === "property" ? story.propertyDefinitions.find(({ id }) => id === predicateValue) : undefined;
  const entries = useMemo(() => [...lenses].sort((a, b) => Number(b.favorite === true) - Number(a.favorite === true)), [lenses]);
  const selected = editingId ? lenses.find(({ id }) => id === editingId) : undefined;
  const draft = editDraft ?? builderDraft;
  const enabledLensIds = activeLensIds ?? (activeLensId ? [activeLensId] : []);
  const isPreviewing = previewLens?.id === "temporary-lens";
  const draftIsDirty = Boolean(editingId && selected && savedDraft && draftKey(draft) !== draftKey(savedDraft));

  function resetPredicate() { setPredicateValue(""); setPropertyEquals(""); }
  function setDraft(update: LensDraft | ((current: LensDraft) => LensDraft)) {
    const apply = (current: LensDraft) => typeof update === "function" ? update(current) : update;
    if (editingId) setEditDraft((current) => apply(current ?? draftFromLens(selected)));
    else setBuilderDraft(apply);
  }
  function makeCurrentPredicate(): StoryLensPredicate | undefined {
    if (!predicateValue) return undefined;
    if (predicateKind === "tag") return { kind: "tag", value: predicateValue };
    if (predicateKind === "owner") return { kind: "owner", entryId: predicateValue };
    if (predicateKind === "access") return { kind: "access", entryId: predicateValue, state: accessState };
    if (predicateKind === "zone") return { kind: "zone", zoneId: predicateValue };
    if (predicateKind === "object") {
      const option = objects.find(({ id }) => id === predicateValue);
      return option ? { kind: "object", ref: option.ref } : undefined;
    }
    const parsed = propertyValue(definition, propertyEquals, storyEntityOptions(story.world, objects));
    return definition && parsed !== undefined ? { kind: "property", propertyId: definition.id, equals: parsed } : undefined;
  }
  function updateExpression(expression: StoryLensExpression) { setSaveStatus(""); setDraft((current) => ({ ...current, expression })); }
  function addCondition() {
    const predicate = makeCurrentPredicate();
    if (!predicate) return;
    updateExpression(appendLensPredicate(draft.expression, predicate));
    resetPredicate();
  }
  function previewDraft() {
    if (!onPreview || !hasPredicate(draft.expression)) return;
    onPreview({ id: "temporary-lens", name: ui.temporaryName, color: draft.color, expression: draft.expression });
  }
  function toggleLens(id: string) { if (onToggle) onToggle(id); else onSelect(id); }
  function clearAll() { onSelect(undefined); onPreview?.(undefined); }
  function beginNew() { setEditingId(undefined); setEditDraft(undefined); setSaveNewOpen(false); setSavedDraft(undefined); setSaveStatus(""); setBuilderDraft(draftFromLens()); resetPredicate(); }
  function beginEdit(lens: StoryRecord) { const nextDraft = draftFromLens(lens); setEditingId(lens.id); setEditDraft(nextDraft); setSaveNewOpen(false); setSavedDraft(nextDraft); setSaveStatus(""); resetPredicate(); }
  function cancelEdit() { setEditDraft(undefined); setSavedDraft(undefined); setEditingId(undefined); setSaveStatus(""); resetPredicate(); }
  function saveChanges() {
    if (!editingId || !draftIsDirty || !draft.name.trim() || !selected) return;
    const nextDraft = { ...draft, name: draft.name.trim() };
    onChange(lenses.map((lens) => lens.id === editingId ? { ...lens, name: nextDraft.name, color: nextDraft.color, expression: nextDraft.expression } : lens));
    setEditDraft(nextDraft);
    setSavedDraft(nextDraft);
    setSaveStatus(ui.savedStatus);
  }
  function deleteLens() {
    if (!editingId) return;
    onChange(lenses.filter((lens) => lens.id !== editingId));
    setEditingId(undefined);
    setEditDraft(undefined);
    setSavedDraft(undefined);
    setSaveStatus("");
  }
  function saveNewLens() {
    if (!draft.name.trim() || !hasPredicate(draft.expression)) return;
    let serial = lenses.length + 1;
    while (lenses.some((lens) => lens.id === `lens-${serial}`)) serial += 1;
    const next: StoryRecord = { id: `lens-${serial}`, name: draft.name.trim(), color: draft.color, expression: draft.expression };
    onChange([...lenses, next]);
    setBuilderDraft(draftFromLens());
    setSavedDraft(undefined);
    setSaveStatus("");
    setSaveNewOpen(false);
  }
  function setMode(mode: "all" | "any") {
    const expression = draft.expression;
    const excluded = expression.kind === "not";
    const inner = excluded ? expression.item : expression;
    const changed = changeLensMode(inner, mode);
    updateExpression(excluded ? { kind: "not", item: changed } : changed);
  }
  function setExcluded(excluded: boolean) {
    if (excluded && draft.expression.kind !== "not") updateExpression({ kind: "not", item: draft.expression });
    if (!excluded && draft.expression.kind === "not") updateExpression(draft.expression.item);
  }
  const canPreview = hasPredicate(draft.expression);

  return <section className={styles.lensPanel} aria-label={copy.lenses}>
    <p className={styles.lensIntro}>{ui.intro}</p>
    <div className={styles.lensGrid}>
      <section className={styles.entryList} aria-labelledby="saved-lenses-heading">
        <h2 id="saved-lenses-heading">{ui.saved}</h2>
        <button type="button" className={styles.clearAllButton} aria-pressed={enabledLensIds.length === 0 && !isPreviewing} onClick={clearAll}><LensSwatch clear/><span>{ui.clearAll}</span></button>
        {entries.map((lens) => {
          const active = enabledLensIds.includes(lens.id);
          return <div className={`${styles.lensRow}${active ? ` ${styles.lensRowActive}` : ""}`} key={lens.id}>
            <button type="button" className={styles.lensToggle} aria-label={`${active ? ui.hide : ui.show}: ${lens.name}`} aria-pressed={active} onClick={() => toggleLens(lens.id)}><LensSwatch color={typeof lens.color === "string" ? lens.color : DEFAULT_LENS_COLOR}/><span className={styles.lensIdentity}><strong>{lens.name}</strong><small>{explanationFor(lens.expression, copy, story, objects)}</small></span></button>
            <button type="button" className={styles.editButton} title={ui.edit} aria-label={`${ui.edit}: ${lens.name}`} onClick={() => beginEdit(lens)}><span aria-hidden="true">✎</span></button>
            <button type="button" className={styles.favoriteButton} aria-label={`${copy.favorite}: ${lens.name}`} aria-pressed={lens.favorite === true} onClick={() => onChange(lenses.map((item) => item.id === lens.id ? { ...item, favorite: item.favorite !== true } : item))}>{lens.favorite === true ? "★" : "☆"}</button>
          </div>;
        })}
        {lenses.length === 0 && <p className={styles.empty}>{copy.noItems}</p>}
        {editingId && <button type="button" className={styles.secondaryButton} onClick={beginNew}>{ui.newLens}</button>}
      </section>
      <div className={styles.entryEditor}>
        <div className={styles.builderHeading}><span className={styles.kicker}>{ui.builder}</span><h2>{ui.question}</h2><p className={styles.builderHint}>{ui.builderHint}</p></div>
        <div className={styles.predicateBuilder} aria-label={ui.question}>
          <label className={styles.field}><span>{ui.filterType}</span><select value={predicateKind} onChange={(event) => { setPredicateKind(event.currentTarget.value as PredicateKind); resetPredicate(); }}>{predicateKinds.map((kind) => <option key={kind} value={kind}>{predicateLabel(kind, copy, ui)}</option>)}</select></label>
          {predicateKind === "access" && <label className={styles.field}><span>{ui.accessState}</span><select value={accessState} onChange={(event) => setAccessState(event.currentTarget.value as "allowed" | "denied")}><option value="allowed">{copy.allow}</option><option value="denied">{copy.deny}</option></select></label>}
          {predicateKind === "property" ? <><label className={styles.field}><span>{ui.hasTrait}</span><select value={predicateValue} onChange={(event) => { setPredicateValue(event.currentTarget.value); setPropertyEquals(""); }}><option value="">{ui.choose}</option>{choices.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}</select></label>{propertyControl(definition, propertyEquals, setPropertyEquals, story, copy, objects)}</> : <label className={styles.field}><span>{predicateLabel(predicateKind, copy, ui)}</span><select value={predicateValue} onChange={(event) => setPredicateValue(event.currentTarget.value)}><option value="">{ui.choose}</option>{choices.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}</select></label>}
          <button type="button" className={styles.addCondition} onClick={addCondition} disabled={!makeCurrentPredicate()}>{copy.add}</button>
          <div className={styles.colorAndMode}>
            <label className={styles.colorField}><span>{ui.color}</span><input type="color" value={draft.color} onChange={(event) => { const color = event.currentTarget.value; setSaveStatus(""); setDraft((current) => ({ ...current, color })); }}/></label>
            <div className={styles.matchControls} role="group" aria-label={copy.matches}><span>{copy.matches}</span><label><input type="radio" name="lens-match-mode" checked={baseMode(draft.expression) === "all"} onChange={() => setMode("all")}/>{copy.all}</label><label><input type="radio" name="lens-match-mode" checked={baseMode(draft.expression) === "any"} onChange={() => setMode("any")}/>{copy.any}</label><label className={styles.excludeControl}><input type="checkbox" checked={draft.expression.kind === "not"} onChange={(event) => setExcluded(event.currentTarget.checked)}/>{ui.exclude}</label></div>
          </div>
        </div>
        <details className={styles.conditions} open>
          <summary className={styles.conditionsHeading}><strong>{ui.advanced}</strong><small>{ui.conditionsHint}</small></summary>
          {hasPredicate(draft.expression) ? <ExpressionRules expression={draft.expression} copy={copy} story={story} objects={objects} onRemove={(path) => updateExpression(removeLensNode(draft.expression, path))}/> : <p className={styles.empty}>{ui.noConditions}</p>}
        </details>
        {editingId ? <div className={styles.editForm}><label className={styles.field}><span>{ui.editName}</span><input value={draft.name} onChange={(event) => { const name = event.currentTarget.value; setSaveStatus(""); setDraft((current) => ({ ...current, name })); }}/></label><div className={styles.editActions}><button type="button" className={styles.primaryButton} disabled={!draftIsDirty || !draft.name.trim()} onClick={saveChanges}>{ui.saveChanges}</button><button type="button" className={styles.secondaryButton} onClick={cancelEdit}>{ui.cancel}</button><button type="button" className={styles.deleteButton} onClick={deleteLens}>{ui.deleteLens}</button></div>{saveStatus && <p className={styles.saveStatus} aria-live="polite">{saveStatus}</p>}</div> : saveNewOpen ? <div className={styles.saveNewRow}><label className={styles.field}><span>{ui.autoName}</span><input value={draft.name} onChange={(event) => { const name = event.currentTarget.value; setDraft((current) => ({ ...current, name })); }} placeholder={ui.nameHint}/></label><button type="button" className={styles.primaryButton} disabled={!draft.name.trim() || !canPreview} onClick={saveNewLens}>{ui.create}</button><button type="button" className={styles.secondaryButton} onClick={() => setSaveNewOpen(false)}>{ui.cancel}</button></div> : <div className={styles.builderActions}><button type="button" className={styles.primaryButton} disabled={!canPreview || !onPreview} onClick={previewDraft}>{ui.showOnMap}</button><button type="button" className={styles.secondaryButton} disabled={!canPreview} onClick={() => setSaveNewOpen(true)}>{ui.create}</button><button type="button" className={styles.secondaryButton} onClick={beginNew}>{ui.newLens}</button></div>}
        {isPreviewing && <p className={styles.previewState}>{ui.previewActive}</p>}
      </div>
    </div>
    <p className={styles.lensNote}>{ui.note}</p>
  </section>;
}
