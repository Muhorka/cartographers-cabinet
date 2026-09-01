import { useId } from "react";
import styles from "./story-worldbook-flow.module.css";

type Props = {
  label: string; hint?: string; empty: string; values: string[];
  options: Array<{ id: string; name: string }>; onChange(values: string[]): void;
};

export function StoryReferenceChoices({ label, hint, empty, values, options, onChange }: Props) {
  const hintId = useId();
  return <fieldset className={styles.choices} aria-describedby={hint ? hintId : undefined}>
    <legend>{label}</legend>
    {hint && <p id={hintId} className={styles.hint}>{hint}</p>}
    {options.length ? <div className={styles.choiceList}>{options.map(({ id, name }) => <label key={id}>
      <input type="checkbox" checked={values.includes(id)} onChange={(event) => onChange(event.currentTarget.checked ? [...new Set([...values, id])] : values.filter((value) => value !== id))}/>
      <span>{name}</span>
    </label>)}</div> : <p className={styles.hint}>{empty}</p>}
  </fieldset>;
}
