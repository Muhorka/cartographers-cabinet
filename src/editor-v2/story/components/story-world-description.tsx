import type { StoryLocale } from "./story-types";
import { worldDescriptionCopy } from "../i18n/world-description-copy";
import flow from "./story-worldbook-flow.module.css";
import styles from "./story-workbench.module.css";

export function StoryWorldDescription({ locale, value, onChange }: { locale: StoryLocale; value: string; onChange(value: string): void }) {
  const copy = worldDescriptionCopy[locale];
  return <section className={styles.subsection} aria-labelledby="story-world-description-title">
    <h2 id="story-world-description-title">{copy.title}</h2>
    <p className={flow.intro}>{copy.hint}</p>
    <label className={styles.field}><span>{copy.label}</span><textarea rows={6} value={value} placeholder={copy.placeholder} onChange={(event) => onChange(event.currentTarget.value)}/></label>
    <p className={flow.saveHint}>{copy.saved}</p>
  </section>;
}
