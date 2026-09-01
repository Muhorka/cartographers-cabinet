"use client";

import { useRef, useState } from "react";
import type { EditorLocale } from "../i18n/workbench-copy";
import { WorkshopGuide } from "./workshop-guide";
import styles from "./workshop-guide-trigger.module.css";

export function WorkshopGuideTrigger({ locale, languageClass, onLanguage }: { locale: EditorLocale; languageClass: string; onLanguage(): void }) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const close = () => { setOpen(false); queueMicrotask(() => trigger.current?.focus()); };
  return <><div className={styles.actions}><button ref={trigger} type="button" className={styles.guide} onClick={() => setOpen(true)}>{locale === "pl" ? "Księga warsztatu" : "Workshop guide"}</button><button type="button" className={`${styles.languageChoice} ${languageClass}`} aria-label={locale === "pl" ? "Zmień język na angielski" : "Switch language to Polish"} onClick={onLanguage}><span className={locale === "pl" ? styles.currentLanguage : undefined}>PL</span><i aria-hidden="true">·</i><span className={locale === "en" ? styles.currentLanguage : undefined}>EN</span></button></div>{open && <WorkshopGuide locale={locale} onClose={close}/>}</>;
}
