"use client";

import { useMemo, useState } from "react";
import { type StoryLensExpression, type StoryLensPredicate } from "../types";
import type { StoryCopy, StoryDocumentLike, StoryRecord, StoryResolvedObject } from "./story-types";
import { appendLensPredicate, changeLensMode, emptyLensExpression, removeLensNode } from "./lens-expression-edit";
import { storyObjectOptions } from "./story-object-options";
import styles from "./story-workbench.module.css";
import { ExpressionRules, explanationFor, lensUi, predicateChoices, predicateKinds, predicateLabel, predicateName, propertyControl, propertyValue, type PredicateKind } from "./story-lens-helpers";
import { storyEntityOptions } from "./story-entity-choices";

type StoryLensesProps = {
  story: StoryDocumentLike;
  resolvedObjects?: StoryResolvedObject[];
  copy: StoryCopy;
  lenses: StoryRecord[];
  activeLensId?: string;
  onSelect(id?: string): void;
  onChange(next: StoryRecord[]): void;
};

export function StoryLenses({ story, resolvedObjects, copy, lenses, activeLensId, onSelect, onChange }: StoryLensesProps) {
  const selected = lenses.find(({ id }) => id === activeLensId);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [draft, setDraft] = useState<{ id?: string; name: string }>({ id: activeLensId, name: selected?.name ?? "" });
  const [predicateKind, setPredicateKind] = useState<PredicateKind>("owner");
  const [predicateValue, setPredicateValue] = useState("");
  const [propertyEquals, setPropertyEquals] = useState<string | string[]>("");
  const [accessState, setAccessState] = useState<"allowed" | "denied">("allowed");
  const ui = lensUi(copy);
  const objects = useMemo(() => storyObjectOptions(story, resolvedObjects), [story, resolvedObjects]);
  const choices = useMemo(() => predicateChoices(story, predicateKind, objects, resolvedObjects), [story, predicateKind, objects, resolvedObjects]);
  const definition = predicateKind === "property" ? story.propertyDefinitions.find(({ id }) => id === predicateValue) : undefined;
  const expression = selected?.expression as StoryLensExpression | undefined;
  const mode = expression?.kind === "any" || expression?.kind === "not" ? expression.kind : "all";
  const entries = useMemo(() => [...lenses].sort((a, b) => Number(b.favorite === true) - Number(a.favorite === true)), [lenses]);
  const draftName = selected && draft.id === selected.id ? draft.name : selected?.name ?? "";

  function resetPredicate() { setPredicateValue(""); setPropertyEquals(""); }
  function updateLens(id: string, update: Partial<StoryRecord>) { onChange(lenses.map((lens) => lens.id === id ? { ...lens, ...update } : lens)); }
  function updateExpression(next: StoryLensExpression) { if (selected) updateLens(selected.id, { expression: next }); }

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

  function addToSelected() {
    const predicate = makeCurrentPredicate();
    if (!predicate || !selected) return;
    updateExpression(appendLensPredicate(expression ?? emptyLensExpression(), predicate));
    resetPredicate();
  }

  function createLens(explicitName?: string) {
    const cleanName = (explicitName ?? name).trim();
    if (!cleanName) return;
    const baseExpression = emptyLensExpression();
    let serial = lenses.length + 1;
    while (lenses.some((lens) => lens.id === `lens-${serial}`)) serial += 1;
    const next: StoryRecord = { id: `lens-${serial}`, name: cleanName, color: "#8a7043", expression: baseExpression };
    const predicate = makeCurrentPredicate();
    if (predicate) next.expression = appendLensPredicate(baseExpression, predicate);
    onChange([...lenses, next]); onSelect(next.id); setCreating(false); setName(""); resetPredicate();
  }

  function quickUse() {
    const predicate = makeCurrentPredicate();
    if (!predicate) return;
    if (selected) { updateExpression(appendLensPredicate(expression ?? emptyLensExpression(), predicate)); resetPredicate(); }
    else createLens(predicateName(predicate, story, objects, copy));
  }
  function beginCreate() { setCreating(true); setName(""); onSelect(undefined); }
  function toggleFavorite(id: string) { updateLens(id, { favorite: lenses.find((lens) => lens.id === id)?.favorite !== true }); }
  function setMode(nextMode: "all" | "any" | "not") { updateExpression(changeLensMode(expression ?? emptyLensExpression(), nextMode)); }

  return <section className={styles.lensPanel} aria-label={copy.lenses}>
    <header className={styles.panelHeading}><div><span className={styles.kicker}>{ui.saved}</span><h2>{ui.question}</h2></div><button type="button" className={styles.neutralButton} aria-pressed={!activeLensId} onClick={() => { setCreating(false); setDraft({ name: "" }); onSelect(undefined); }}>{copy.noLens}</button></header>
    <div className={styles.lensGrid}>
      <div className={styles.entryList} aria-label={ui.saved}>
        {entries.map((lens) => <div className={styles.lensRow} key={lens.id}><button type="button" className={activeLensId === lens.id ? styles.selectedEntry : undefined} onClick={() => { setCreating(false); setDraft({ id: lens.id, name: lens.name }); onSelect(lens.id); }}><strong>{lens.name}</strong><small>{explanationFor(lens.expression, copy, story, objects)}</small></button><button type="button" className={styles.favoriteButton} aria-label={`${copy.favorite}: ${lens.name}`} aria-pressed={lens.favorite === true} onClick={() => toggleFavorite(lens.id)}>{lens.favorite === true ? "★" : "☆"}</button></div>)}
        {lenses.length === 0 && <p className={styles.empty}>{copy.noItems}</p>}<button type="button" className={styles.primaryButton} onClick={beginCreate}>{ui.newLens}</button>
      </div>
      <div className={styles.entryEditor}>
        <fieldset className={styles.predicateBuilder}><legend>{ui.question}</legend>
          <label className={styles.field}><span>{ui.filterType}</span><select value={predicateKind} onChange={(event) => { setPredicateKind(event.currentTarget.value as PredicateKind); resetPredicate(); }}>{predicateKinds.map((kind) => <option key={kind} value={kind}>{predicateLabel(kind, copy, ui)}</option>)}</select></label>
          {predicateKind === "access" && <label className={styles.field}><span>{ui.accessState}</span><select value={accessState} onChange={(event) => setAccessState(event.currentTarget.value as "allowed" | "denied")}><option value="allowed">{copy.allow}</option><option value="denied">{copy.deny}</option></select></label>}
          {predicateKind === "property" ? <><label className={styles.field}><span>{ui.hasTrait}</span><select value={predicateValue} onChange={(event) => { setPredicateValue(event.currentTarget.value); setPropertyEquals(""); }}><option value="">{ui.choose}</option>{choices.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}</select></label>{propertyControl(definition, propertyEquals, setPropertyEquals, story, copy, objects)}</> : <label className={styles.field}><span>{predicateLabel(predicateKind, copy, ui)}</span><select value={predicateValue} onChange={(event) => setPredicateValue(event.currentTarget.value)}><option value="">{ui.choose}</option>{choices.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}</select></label>}
          <div className={styles.bulkActions}><button type="button" onClick={quickUse} disabled={!makeCurrentPredicate()}>{ui.quickUse}</button><button type="button" onClick={addToSelected} disabled={!selected || !makeCurrentPredicate()}>{copy.add}</button></div>
        </fieldset>
        {creating && <div className={styles.addRow}><label htmlFor="new-lens">{ui.autoName}</label><input id="new-lens" value={name} onChange={(event) => setName(event.currentTarget.value)} placeholder={ui.nameHint} /><button type="button" disabled={!name.trim()} onClick={() => createLens()}>{ui.create}</button></div>}
        {selected && !creating ? <div className={styles.form}><label className={styles.field}><span>{ui.editName}</span><input value={draftName} onChange={(event) => setDraft({ id: selected.id, name: event.currentTarget.value })} /></label><button type="button" className={styles.primaryButton} disabled={!draftName.trim()} onClick={() => updateLens(selected.id, { name: draftName.trim() })}>{copy.save}</button><fieldset className={styles.segmented}><legend>{copy.matches}</legend>{(["all", "any", "not"] as const).map((candidate) => <label key={candidate}><input type="radio" name={`lens-mode-${selected.id}`} checked={mode === candidate} onChange={() => setMode(candidate)} /><span>{copy[candidate]}</span></label>)}</fieldset><details className={styles.subsection} open><summary>{ui.advanced}</summary><p>{ui.advancedHint}</p>{expression && <ExpressionRules expression={expression} copy={copy} story={story} objects={objects} onRemove={(path) => updateExpression(removeLensNode(expression, path))} />}</details><p className={styles.explanation}><strong>{copy.explanation}</strong> {explanationFor(selected.expression, copy, story, objects)}</p></div> : !creating && <p className={styles.empty}>{ui.chooseLens}</p>}
      </div>
    </div><p className={styles.lensNote}>{ui.note}</p>
  </section>;
}
