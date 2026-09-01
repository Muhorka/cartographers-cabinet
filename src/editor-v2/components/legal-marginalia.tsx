"use client";
import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import type { EditorLocale } from "../i18n/workbench-copy";
import { legalMarginaliaCopy, type LegalMarginaliaSection } from "./legal-marginalia-copy";
import styles from "./legal-marginalia.module.css";

const sections: LegalMarginaliaSection[] = ["privacy", "terms", "legal"];

export type LegalMarginaliaHandle = { openSection: (section: LegalMarginaliaSection) => void };

export const LegalMarginalia = forwardRef<LegalMarginaliaHandle, { locale: EditorLocale }>(function LegalMarginalia({ locale }, ref) {
  const [active, setActive] = useState<LegalMarginaliaSection>("privacy");
  const disclosureRef = useRef<HTMLDetailsElement>(null);
  useImperativeHandle(ref, () => ({
    openSection(section) {
      setActive(section);
      const disclosure = disclosureRef.current;
      if (!disclosure) return;
      disclosure.open = true;
      requestAnimationFrame(() => document.getElementById(`marginalia-${section}`)?.scrollIntoView?.({ behavior: "smooth", block: "nearest" }));
    },
  }), []);
  const copy = legalMarginaliaCopy[locale];
  const section = copy.sections[active];
  return <details ref={disclosureRef} id="legal-marginalia" className={styles.marginalia}>
    <summary title={copy.open}><span aria-hidden="true">✦</span>{copy.title}</summary>
    <div className={styles.body}>
      <div className={styles.tabs} role="tablist" aria-label={copy.title}>{sections.map((id) => <button key={id} type="button" role="tab" aria-selected={active === id} aria-controls={`marginalia-${id}`} id={`marginalia-tab-${id}`} onClick={() => setActive(id)}>{copy.sections[id].label}</button>)}</div>
      <section className={styles.page} role="tabpanel" id={`marginalia-${active}`} aria-labelledby={`marginalia-tab-${active}`}><h3>{section.heading}</h3>{section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}{section.bullets && <ul>{section.bullets.map((item) => <li key={item}>{item}</li>)}</ul>}</section>
      <footer><strong>{copy.publisher}</strong><span>{copy.contact}: <a href="mailto:varera.contact@gmail.com">varera.contact@gmail.com</a></span><span><a href="https://www.cloudflare.com/privacypolicy/" target="_blank" rel="noreferrer">Cloudflare Privacy</a> · <a href="https://policies.google.com/privacy" target="_blank" rel="noreferrer">Google Privacy</a> · <a href="/THIRD_PARTY_NOTICES.md" target="_blank">Third-party notices</a></span></footer>
    </div>
  </details>;
});
