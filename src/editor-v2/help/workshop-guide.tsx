"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import type { EditorLocale } from "../i18n/workbench-copy";
import { workshopGuide, type WorkshopGuideText, type WorkshopGuideTopicId } from "./workshop-guide-content";
import type { WorkshopGuideSubsection } from "./workshop-guide-model";
import { createWorkshopGuideSearch } from "./workshop-guide-search";
import styles from "./workshop-guide.module.css";

function GuideText({ value }: { value: WorkshopGuideText }) {
  if (typeof value === "string") return value;
  return value.parts.map((part, index) => {
    const content = part.emphasis === "strong" ? <strong>{part.text}</strong> : part.emphasis === "em" ? <em>{part.text}</em> : part.text;
    return part.href ? <a key={index} href={part.href} target="_blank" rel="noreferrer">{content}</a> : <Fragment key={index}>{content}</Fragment>;
  });
}

function GuideList({ values, ordered = false }: { values: WorkshopGuideText[]; ordered?: boolean }) {
  const items = values.map((value, index) => <li key={index}><GuideText value={value}/></li>);
  return ordered ? <ol>{items}</ol> : <ul>{items}</ul>;
}

function GuideSubsection({ subsection }: { subsection: WorkshopGuideSubsection }) {
  return <div className={styles.subsection}><h4>{subsection.heading}</h4>
    {subsection.paragraphs?.map((paragraph, index) => <p key={index}><GuideText value={paragraph}/></p>)}
    {subsection.bullets && <GuideList values={subsection.bullets}/>}
    {subsection.steps && <GuideList values={subsection.steps} ordered/>}
  </div>;
}

export function WorkshopGuide({ locale, onClose }: { locale: EditorLocale; onClose(): void }) {
  const copy = workshopGuide[locale];
  const [activeId, setActiveId] = useState<WorkshopGuideTopicId>("start");
  const [query, setQuery] = useState("");
  const [pendingSection, setPendingSection] = useState<string>();
  const dialog = useRef<HTMLElement>(null);
  const active = copy.topics.find(({ id }) => id === activeId) ?? copy.topics[0];
  const search = useMemo(() => createWorkshopGuideSearch(copy), [copy]);
  const searchResults = useMemo(() => search(query), [query, search]);
  useEffect(() => {
    const keys = (event: KeyboardEvent) => {
      if (event.key === "Escape") { onClose(); return; }
      if (event.key !== "Tab" || !dialog.current) return;
      const focusable = [...dialog.current.querySelectorAll<HTMLElement>("button, a[href], input, select, textarea, [tabindex]:not([tabindex='-1'])")].filter((element) => !element.hasAttribute("disabled"));
      const first = focusable[0]; const last = focusable.at(-1); if (!first || !last) return;
      if (event.shiftKey && (document.activeElement === first || !dialog.current.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !dialog.current.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", keys); return () => document.removeEventListener("keydown", keys);
  }, [onClose]);
  useEffect(() => {
    if (!pendingSection) return;
    const frame = requestAnimationFrame(() => {
      const target = document.getElementById(pendingSection);
      target?.scrollIntoView?.({ block: "start" });
      target?.querySelector<HTMLElement>("h3")?.focus();
      setPendingSection(undefined);
    });
    return () => cancelAnimationFrame(frame);
  }, [active.id, pendingSection]);
  return <div className={styles.backdrop} onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}>
    <section ref={dialog} className={styles.guide} role="dialog" aria-modal="true" aria-labelledby="workshop-guide-title">
      <header><div><small>{copy.contents}</small><h2 id="workshop-guide-title">{copy.title}</h2>{copy.introduction && <p>{copy.introduction}</p>}</div><button type="button" autoFocus onClick={onClose} aria-label={copy.close}>×</button></header>
      <div className={styles.layout}>
        <nav aria-label={copy.contents}>
          <div className={styles.navContent}>{query.trim() ? <div className={styles.results} aria-live="polite"><small>{searchResults.length ? `${copy.searchResults}: ${searchResults.length}` : copy.noSearchResults}</small>{searchResults.map((result) => {
            const targetId = `guide-${result.topicId}-${result.sectionIndex}`;
            return <button key={targetId} type="button" onClick={() => { setActiveId(result.topicId); setPendingSection(targetId); }}><strong>{result.topicTitle}</strong><span>{result.sectionHeading}</span><em>{result.excerpt}</em></button>;
          })}</div> : copy.topics.map((topic) => <button key={topic.id} type="button" aria-current={topic.id === active.id ? "page" : undefined} onClick={() => setActiveId(topic.id)}><strong>{topic.title}</strong><span>{topic.summary}</span></button>)}</div>
          <label className={styles.search}><span>{copy.search}</span><input type="search" value={query} placeholder={copy.search} onChange={(event) => setQuery(event.currentTarget.value)}/></label>
        </nav>
        <article key={active.id}><h2>{active.title}</h2><p className={styles.summary}>{active.summary}</p>{active.sections.map((section, sectionIndex) => <section id={`guide-${active.id}-${sectionIndex}`} key={section.heading}><h3 tabIndex={-1}>{section.heading}</h3>{section.paragraphs.map((paragraph, index) => <p key={index}><GuideText value={paragraph}/></p>)}{section.example && <pre className={styles.example}>{section.example}</pre>}{section.bullets && <GuideList values={section.bullets}/>} {section.steps && <GuideList values={section.steps} ordered/>}{section.subsections?.map((subsection) => <GuideSubsection key={subsection.heading} subsection={subsection}/>)}</section>)}</article>
      </div>
    </section>
  </div>;
}
