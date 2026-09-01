"use client";

import { useMemo } from "react";
import type { EditorProject } from "../../model/project-model";
import type { StoryScenario, StoryObjectRef } from "../types";
import { readScenarioEffects } from "../scenario-effects";
import type { ScenarioCopy } from "../i18n/scenario-copy";
import { scenarioCopy } from "../i18n/scenario-copy";
import { formatScenarioEffect, type FormattedScenarioEffectField } from "./story-scenario-effect-format";
import styles from "./story-scenario-editor.module.css";

type Props = {
  project: EditorProject;
  scenarioId: string;
  activeStepId?: string;
  locale: "pl" | "en";
  onActivate(stepId?: string): void;
  onChange(next: StoryScenario): boolean | void;
  onInspect(ref: StoryObjectRef, stepId?: string): void;
  onRemoveEffect(patchId: string, stepId?: string): void;
  onAddSelection(stepId?: string): void;
  selectionCount: number;
};

type ScenarioStep = StoryScenario["steps"][number];
type Effect = ReturnType<typeof readScenarioEffects>[number];
type FormattedEffect = Omit<Effect, "fields"> & { fields: FormattedScenarioEffectField[] };

function newStepId(scenario: StoryScenario) {
  const ids = new Set(scenario.steps.map(({ id }) => id));
  let id = `step-${scenario.steps.length + 1}`;
  while (ids.has(id)) id = `step-${Math.random().toString(36).slice(2, 8)}`;
  return id;
}

function EffectCard({ effect, copy, stepId, onInspect, onRemoveEffect }: { effect: FormattedEffect; copy: ScenarioCopy; stepId?: string; onInspect(ref: StoryObjectRef, stepId?: string): void; onRemoveEffect(patchId: string, stepId?: string): void }) {
  const changed = effect.fields.filter(({ changed }) => changed);
  const unchanged = effect.fields.filter(({ changed }) => !changed);
  const fields = (values: FormattedScenarioEffectField[]) => <dl className={styles.fieldList}>{values.map((field) => <div className={styles.fieldRow} key={`${effect.patchId}:${field.label}`}><dt>{field.label}</dt><dd><span className={styles.value}>{copy.previous}: {field.before}</span> → <span className={styles.value}>{copy.current}: {field.after}</span>{field.authored !== undefined && field.authored !== field.after && <small> · {copy.authored}: {field.authored}</small>}</dd></div>)}</dl>;
  return <article className={styles.effect}>
    <div className={styles.effectTitle}><strong>{effect.objectName}</strong></div>
    {effect.missing && <p className={styles.warning}>{copy.targetMissing}</p>}
    {effect.locked && <p className={styles.effectWarning}>{copy.locked}</p>}
    {changed.length ? fields(changed) : <p className={styles.empty}>{copy.unchanged}</p>}
    {unchanged.length > 0 && <details className={styles.unchanged}><summary>{copy.unchanged} ({unchanged.length})</summary>{fields(unchanged)}</details>}
    <div className={styles.effectActions}><button type="button" disabled={effect.missing} onClick={() => onInspect(effect.target, stepId)}>{copy.inspect}</button><button type="button" disabled={effect.missing || effect.locked} onClick={() => onInspect(effect.target, stepId)}>{copy.edit}</button><button type="button" disabled={effect.locked} onClick={() => onRemoveEffect(effect.patchId, stepId)}>{copy.removeEffect}</button></div>
  </article>;
}

export function StoryScenarioEditor({ project, scenarioId, activeStepId, locale, onActivate, onChange, onInspect, onRemoveEffect, onAddSelection, selectionCount }: Props) {
  const copy = scenarioCopy[locale];
  const source = project.story.scenarios.find(({ id }) => id === scenarioId);
  const selectedStepId = source?.steps.some(({ id }) => id === activeStepId) ? activeStepId : undefined;
  const effects = useMemo(() => source ? readScenarioEffects(project, scenarioId, selectedStepId).map((effect) => formatScenarioEffect(project, effect, copy, locale)) : [], [copy, locale, project, scenarioId, selectedStepId, source]);
  if (!source) return null;
  const current = source;

  function update(next: StoryScenario) { return onChange(next); }
  function updateStep(stepId: string, patch: Partial<ScenarioStep>) { update({ ...current, steps: current.steps.map((step) => step.id === stepId ? { ...step, ...patch } : step) }); }
  function addStep() { const step: ScenarioStep = { id: newStepId(current), name: `${copy.step} ${current.steps.length + 1}`, patches: [] }; if (onChange({ ...current, steps: [...current.steps, step] }) !== false) onActivate(step.id); }
  function removeStep(stepId: string) { if (update({ ...current, steps: current.steps.filter(({ id }) => id !== stepId) }) !== false && selectedStepId === stepId) onActivate(undefined); }
  function moveStep(stepId: string, offset: -1 | 1) { const index = current.steps.findIndex(({ id }) => id === stepId); const target = index + offset; if (index < 0 || target < 0 || target >= current.steps.length) return; const steps = [...current.steps]; const [step] = steps.splice(index, 1); if (step) steps.splice(target, 0, step); update({ ...current, steps }); }

  return <section className={styles.workshop} aria-label={copy.title}>
    <header><h2>{copy.title}: {current.name}</h2><p className={styles.intro}>{copy.descriptionHint}</p></header>
    <details className={styles.identity}><summary>{copy.scenarioDetails}</summary><label>{copy.scenarioName}<input value={current.name} onChange={(event) => update({ ...current, name: event.currentTarget.value })} /></label><label>{copy.scenarioDescription}<textarea rows={3} value={current.description ?? ""} onChange={(event) => update({ ...current, description: event.currentTarget.value })} /></label><p className={styles.status}>{copy.autosave}</p></details>
    <div className={styles.switcher} role="group" aria-label={copy.steps}><button type="button" aria-pressed={!selectedStepId} onClick={() => onActivate(undefined)}>{copy.wholeScenario}</button>{current.steps.map((step) => <button type="button" key={step.id} aria-pressed={selectedStepId === step.id} onClick={() => onActivate(step.id)}>{step.name}</button>)}<button type="button" onClick={addStep}>{copy.addStep}</button></div>
    <section className={styles.section} aria-label={copy.steps}><h3>{copy.steps}</h3>{current.steps.length === 0 && <p className={styles.empty}>{copy.noStep}</p>}{activeStepId && !selectedStepId && <p className={styles.empty}>{copy.selectStepHint}</p>}{selectedStepId && current.steps.filter(({ id }) => id === selectedStepId).map((step) => { const index = current.steps.findIndex(({ id }) => id === step.id); return <article className={styles.step} key={step.id}><div className={styles.stepHeader}><strong>{step.name}</strong><small>{copy.stepDetails}</small></div><div className={styles.stepFields}><label>{copy.stepName}<input value={step.name} onChange={(event) => updateStep(step.id, { name: event.currentTarget.value })} /></label><label>{copy.stepDescription}<textarea rows={2} value={step.description ?? ""} onChange={(event) => updateStep(step.id, { description: event.currentTarget.value })} /></label></div><div className={styles.actions}><button type="button" disabled={index === 0} onClick={() => moveStep(step.id, -1)}>{copy.moveUp}</button><button type="button" disabled={index === current.steps.length - 1} onClick={() => moveStep(step.id, 1)}>{copy.moveDown}</button><button type="button" onClick={() => removeStep(step.id)}>{copy.removeStep}</button></div></article>; })}</section>
    <section className={styles.section} aria-label={copy.effects}><div className={styles.stepHeader}><h3>{copy.effects}: {selectedStepId ? copy.step : copy.scenario}</h3><button type="button" disabled={!selectionCount} onClick={() => onAddSelection(selectedStepId)}>{copy.addSelection(selectionCount)}</button></div>{!selectionCount && <p className={styles.empty}>{copy.noSelection}</p>}{effects.length === 0 && <p className={styles.empty}>{copy.noEffects}</p>}{effects.length === 0 && !selectedStepId && <p className={styles.empty}>{copy.noteOnly}</p>}{effects.map((effect) => <EffectCard key={effect.patchId} effect={effect} copy={copy} stepId={selectedStepId} onInspect={onInspect} onRemoveEffect={onRemoveEffect} />)}</section>
  </section>;
}
