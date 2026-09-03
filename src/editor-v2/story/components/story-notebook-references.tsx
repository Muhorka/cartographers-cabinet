"use client";

import { memo, useState } from "react";
import { sameStoryRef, storyRefKey, type StoryDocumentReference, type StoryObjectRef, type StoryScenario } from "../types";
import type { StoryResolvedObject } from "./story-types";
import styles from "./story-notebook.module.css";

type Props = {
  locale: "pl" | "en";
  references: StoryDocumentReference[];
  objects: StoryResolvedObject[];
  scenarios: StoryScenario[];
  onChange(references: StoryDocumentReference[]): void;
  onFocus(refs: StoryObjectRef[]): boolean;
  onScenario(id: string): void;
};

const referenceKey = (reference: StoryDocumentReference) => reference.kind === "object" ? `object:${storyRefKey(reference.ref)}` : `scenario:${reference.scenarioId}`;

export const StoryNotebookReferences = memo(function StoryNotebookReferences({ locale, references, objects, scenarios, onChange, onFocus, onScenario }: Props) {
  const [objectValue, setObjectValue] = useState("");
  const [scenarioValue, setScenarioValue] = useState("");
  const addReference = (reference: StoryDocumentReference) => {
    if (!references.some((item) => referenceKey(item) === referenceKey(reference))) onChange([...references, reference]);
  };
  return <section className={styles.references}>
    <h3>{locale === "pl" ? "Odnośniki" : "References"}</h3>
    <div className={styles.referencePicker}>
      <select value={objectValue} onChange={(event) => setObjectValue(event.target.value)}><option value="">{locale === "pl" ? "Obiekt z mapy…" : "Map object…"}</option>{objects.map((object) => <option key={storyRefKey(object.ref)} value={storyRefKey(object.ref)}>{object.name ?? object.ref.id}</option>)}</select>
      <button type="button" disabled={!objectValue} onClick={() => { const object = objects.find(({ ref }) => storyRefKey(ref) === objectValue); if (object) addReference({ kind: "object", ref: object.ref }); setObjectValue(""); }}>{locale === "pl" ? "Dodaj" : "Add"}</button>
      <select value={scenarioValue} onChange={(event) => setScenarioValue(event.target.value)}><option value="">{locale === "pl" ? "Scenariusz…" : "Scenario…"}</option>{scenarios.map((scenario) => <option key={scenario.id} value={scenario.id}>{scenario.name}</option>)}</select>
      <button type="button" disabled={!scenarioValue} onClick={() => { if (scenarioValue) addReference({ kind: "scenario", scenarioId: scenarioValue }); setScenarioValue(""); }}>{locale === "pl" ? "Dodaj" : "Add"}</button>
    </div>
    <div className={styles.chips}>{references.map((reference) => { const key = referenceKey(reference); const object = reference.kind === "object" ? objects.find(({ ref }) => sameStoryRef(ref, reference.ref)) : undefined; const scenario = reference.kind === "scenario" ? scenarios.find(({ id }) => id === reference.scenarioId) : undefined; const label = object?.name ?? scenario?.name ?? (reference.kind === "object" ? reference.ref.id : reference.scenarioId); return <span key={key}><button type="button" onClick={() => reference.kind === "object" ? onFocus([reference.ref]) : onScenario(reference.scenarioId)}>{label}</button><button type="button" aria-label={`${locale === "pl" ? "Usuń odnośnik" : "Remove reference"}: ${label}`} onClick={() => onChange(references.filter((item) => referenceKey(item) !== key))}>×</button></span>; })}</div>
  </section>;
});
