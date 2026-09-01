import { useState } from "react";
import { WorkshopGuideTrigger } from "../help/workshop-guide-trigger";
import type { EditorLocale, WorkbenchCopy } from "../i18n/workbench-copy";
import styles from "./workbench-masthead.module.css";

type MastheadCopy = Pick<WorkbenchCopy, "title" | "strapline" | "drawing" | "story">;
type WorkbenchMode = "drawing" | "story";

export function WorkbenchMasthead({ locale, copy, mode, onLanguage, onModeToggle }: { locale: EditorLocale; copy: MastheadCopy; mode: WorkbenchMode; onLanguage(): void; onModeToggle(): void }) {
  const modeLabel = mode === "drawing" ? copy.drawing : copy.story;
  const nextMode = mode === "drawing" ? copy.story : copy.drawing;
  const sealSource = `/editor-v2/mode-seals/${mode}-seal.png`;
  const [failedSealSource, setFailedSealSource] = useState<string>();
  const showSealGraphic = failedSealSource !== sealSource;
  return <header className={styles.masthead}>
    <div className={styles.copy}>
      <small>{locale === "pl" ? "PRACOWNIA PRZESTRZENNEGO ŚWIATOTWÓRSTWA" : "A SPATIAL WORLDBUILDING WORKSHOP"}</small>
      <h1>{copy.title}</h1>
      <div className={styles.straplineRow}><p>{copy.strapline}</p></div>
    </div>
    <button type="button" className={`${styles.modeSeal} ${showSealGraphic ? styles.modeSealGraphic : ""}`} title={locale === "pl" ? `Przejdź do trybu: ${nextMode}` : `Switch to ${nextMode}`} aria-label={locale === "pl" ? `Aktualny tryb: ${modeLabel}. Przejdź do: ${nextMode}` : `Current mode: ${modeLabel}. Switch to ${nextMode}`} onClick={onModeToggle}>
      {showSealGraphic
        ? <img className={styles.modeSealImage} src={sealSource} alt="" onError={() => setFailedSealSource(sealSource)}/>
        : <span>{modeLabel}</span>}
    </button>
    <WorkshopGuideTrigger locale={locale} languageClass={styles.language} onLanguage={onLanguage}/>
  </header>;
}
