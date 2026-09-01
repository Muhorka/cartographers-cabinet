import { activeStoryLensIds } from "../lens-view";
import { storyViewCopy } from "../i18n/view-copy";
import type { StoryCopy, StoryRecord, StoryViewState } from "./story-types";
import styles from "./story-lens-picker.module.css";

export function StoryLensPicker({ copy, view, lenses, onChange }: {
  copy: StoryCopy; view: StoryViewState; lenses: StoryRecord[]; onChange(patch: Partial<StoryViewState>): void;
}) {
  const text = storyViewCopy[copy.locale === "pl" ? "pl" : "en"];
  const ids = activeStoryLensIds(view).filter((id) => lenses.some((lens) => lens.id === id));
  const count = ids.length + Number(Boolean(view.previewLens));
  return <div className={styles.picker}><span className={styles.caption}>{copy.lenses}</span><details>
    <summary>{count ? `${text.activeLenses}: ${count}` : text.noLenses}</summary>
    <div className={styles.menu} aria-label={text.chooseLenses}>
      {lenses.map((lens) => <label key={lens.id}><input type="checkbox" checked={ids.includes(lens.id)} onChange={(event) => onChange({ activeLensIds: event.currentTarget.checked ? [...ids, lens.id] : ids.filter((id) => id !== lens.id) })}/><i className={styles.color} style={{ backgroundColor: typeof lens.color === "string" ? lens.color : "#8a7043" }}/><span>{lens.name}</span></label>)}
      {view.previewLens && <><p>{text.temporary}</p><button type="button" onClick={() => onChange({ previewLens: undefined })}>{text.stopPreview}</button></>}
      {count > 0 && <button type="button" onClick={() => onChange({ activeLensIds: [], previewLens: undefined })}>{text.clearLenses}</button>}
      <p>{text.overlap}</p>
    </div>
  </details></div>;
}
