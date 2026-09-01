import type { StoryObjectRef, StoryPropertyDefinition, StoryPropertyValue } from "../types";
import type { StoryCopy } from "./story-types";
import { StoryReferenceChoices } from "./story-reference-choices";
import { storyEntityOptionId, storyEntityOptions, storyEntityValue } from "./story-entity-choices";
import styles from "./story-workbench.module.css";

export function StoryPropertyField({ definition, value, objectOptions, worldOptions, copy, sourceLabel, onChange }: {
  definition: StoryPropertyDefinition; value: StoryPropertyValue | undefined;
  objectOptions: Array<{ id: string; name: string; ref: StoryObjectRef }>; worldOptions: Array<{ id: string; name: string }>; copy: StoryCopy;
  sourceLabel?: string; onChange(value: StoryPropertyValue): void;
}) {
  const label = definition.unit ? `${definition.name} (${definition.unit})` : definition.name;
  const source = sourceLabel && <small className={styles.resolvedHint}>{sourceLabel}</small>;
  const text = value === null || value === undefined || typeof value === "object" ? "" : String(value);
  if (definition.type === "boolean") return <label className={styles.check}><input type="checkbox" checked={value === true} onChange={(event) => onChange(event.currentTarget.checked)}/><span>{label}</span>{source}</label>;
  if (definition.type === "multi") return <StoryReferenceChoices label={label} hint={sourceLabel} empty={copy.noItems} values={Array.isArray(value) ? value.map(String) : []} options={(definition.options ?? []).map((option) => ({ id: option, name: option }))} onChange={onChange}/>;
  if (definition.type === "single") return <label className={styles.field}><span>{label}</span><select value={text} onChange={(event) => onChange(event.currentTarget.value || null)}><option value="">{copy.none}</option>{(definition.options ?? []).map((option) => <option key={option} value={option}>{option}</option>)}</select>{source}</label>;
  if (definition.type === "entity") {
    const options = storyEntityOptions(worldOptions, objectOptions); const selected = storyEntityOptionId(value);
    return <label className={styles.field}><span>{label}</span><select value={selected} onChange={(event) => onChange(storyEntityValue(event.currentTarget.value, options))}><option value="">{copy.none}</option>{options.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}</select>{source}</label>;
  }
  const numeric = definition.type === "number" || definition.type === "unit";
  return <label className={styles.field}><span>{label}</span><input type={numeric ? "number" : "text"} value={text} onChange={(event) => { const input = event.currentTarget.value; onChange(numeric ? input === "" ? null : Number(input) : input); }}/>{source}</label>;
}
