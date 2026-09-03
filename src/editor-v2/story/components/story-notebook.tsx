"use client";

import { useCallback, useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import type { StoryDocument, StoryObjectRef, StoryScenario } from "../types";
import type { StoryResolvedObject } from "./story-types";
import { StoryNotebookRichEditor } from "./story-notebook-rich-editor";
import { StoryNotebookReferences } from "./story-notebook-references";
import styles from "./story-notebook.module.css";

type Props = {
  open: boolean;
  locale: "pl" | "en";
  documents: StoryDocument[];
  objects: StoryResolvedObject[];
  scenarios: StoryScenario[];
  onClose(): void;
  onDocumentsDraftChange(documents: StoryDocument[]): boolean;
  onDocumentsChange(documents: StoryDocument[], label: string): Promise<boolean>;
  onFocus(refs: StoryObjectRef[]): boolean;
  onScenario(id: string): void;
};

const widthKey = "cartographers-cabinet:story-notebook-width";
const clampWidth = (value: number) => Math.min(.75, Math.max(.34, value));
const newDocument = (locale: "pl" | "en"): StoryDocument => ({ id: crypto.randomUUID(), title: locale === "pl" ? "Nowa notatka" : "New note", bodyMarkdown: "", references: [] });

export function StoryNotebookToggle({ open, locale, onClick }: { open: boolean; locale: "pl" | "en"; onClick(): void }) {
  const label = locale === "pl" ? (open ? "Zwiń notatnik autora" : "Otwórz notatnik autora") : (open ? "Fold the writer's notebook" : "Open the writer's notebook");
  return <button type="button" className={`${styles.toggle}${open ? ` ${styles.toggleActive}` : ""}`} aria-pressed={open} aria-label={label} title={label} onClick={onClick}>
    <svg viewBox="0 0 48 48" aria-hidden="true"><path d="M12 30h24l3 13H9l3-13Z"/><path d="M15 27h18v5H15z"/><path d="M29 5c4 8-1 14-10 22 3-8 5-16 10-22Z"/><path d="m18 29 9-17"/></svg><span>{locale === "pl" ? "Notatnik" : "Notebook"}</span>
  </button>;
}

export function StoryNotebook({ open, locale, documents, objects, scenarios, onClose, onDocumentsDraftChange, onDocumentsChange, onFocus, onScenario }: Props) {
  const [workingDocuments, setWorkingDocuments] = useState(documents);
  const [selectedId, setSelectedId] = useState(documents[0]?.id);
  const [draft, setDraft] = useState<StoryDocument | undefined>(documents[0]);
  const [dirty, setDirty] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const width = useRef(.5);
  const notebook = useRef<HTMLElement>(null);
  const latestChange = useRef(onDocumentsChange);
  const latestDraftChange = useRef(onDocumentsDraftChange);
  const [sourceDocuments, setSourceDocuments] = useState(documents);
  const editVersion = useRef(0);
  const pendingUnmountSave = useRef<StoryDocument[] | undefined>(undefined);
  const localeRef = useRef(locale);
  const workingDocumentsRef = useRef(workingDocuments);
  const draftRef = useRef(draft);
  if (sourceDocuments !== documents) {
    setSourceDocuments(documents);
    if (dirty && draft) setWorkingDocuments([...documents.filter(({ id }) => id !== draft.id), draft]);
    else {
      const selected = documents.find(({ id }) => id === selectedId) ?? documents[0];
      setWorkingDocuments(documents); setSelectedId(selected?.id); setDraft(selected);
    }
  }
  useEffect(() => { latestChange.current = onDocumentsChange; }, [onDocumentsChange]);
  useEffect(() => { latestDraftChange.current = onDocumentsDraftChange; }, [onDocumentsDraftChange]);
  useEffect(() => {
    localeRef.current = locale; workingDocumentsRef.current = workingDocuments; draftRef.current = draft;
    pendingUnmountSave.current = dirty && draft
      ? [...workingDocuments.filter(({ id }) => id !== draft.id), draft]
      : undefined;
  }, [dirty, draft, locale, workingDocuments]);
  useEffect(() => () => {
    const pending = pendingUnmountSave.current;
    if (pending) void latestChange.current(pending, localeRef.current === "pl" ? "Zapisz notatkę" : "Save note");
  }, []);
  useEffect(() => { const stored = Number(window.localStorage.getItem(widthKey)); if (!Number.isFinite(stored) || stored <= 0) return; width.current = clampWidth(stored); notebook.current?.style.setProperty("width", `${width.current * 100}%`); }, []);
  useEffect(() => {
    if (!dirty || !draft) return;
    const version = editVersion.current;
    const timer = window.setTimeout(() => {
      const next = [...workingDocuments.filter(({ id }) => id !== draft.id), draft];
      void latestChange.current(next, locale === "pl" ? "Zapisz notatkę" : "Save note").then((saved) => {
        if (!saved) { setSaveFailed(true); return; }
        setWorkingDocuments(next); setSaveFailed(false);
        if (editVersion.current === version) setDirty(false);
      });
    }, 650);
    return () => window.clearTimeout(timer);
  }, [dirty, draft, locale, workingDocuments]);

  const updateDraft = useCallback((patch: Partial<StoryDocument>) => {
    const current = draftRef.current;
    if (!current) return;
    const nextDraft = { ...current, ...patch };
    const next = [...workingDocumentsRef.current.filter(({ id }) => id !== current.id), nextDraft];
    if (!latestDraftChange.current(next)) { setSaveFailed(true); return; }
    editVersion.current += 1; draftRef.current = nextDraft; pendingUnmountSave.current = next;
    setDraft(nextDraft); setDirty(true); setSaveFailed(false);
  }, []);
  const updateReferences = useCallback((references: StoryDocument["references"]) => updateDraft({ references }), [updateDraft]);
  const saveBeforeLeaving = async () => {
    if (!dirty || !draft) return workingDocuments;
    const version = editVersion.current;
    const next = [...workingDocuments.filter(({ id }) => id !== draft.id), draft];
    if (!await onDocumentsChange(next, locale === "pl" ? "Zapisz notatkę" : "Save note")) { setSaveFailed(true); return undefined; }
    setWorkingDocuments(next); setSaveFailed(false); if (editVersion.current === version) setDirty(false); return next;
  };
  const selectDocument = async (id: string) => { const next = await saveBeforeLeaving(); if (!next) return; const source = next.find((item) => item.id === id); if (!source) return; setSelectedId(id); setDraft(source); setDirty(false); };
  const create = async () => { const current = await saveBeforeLeaving(); if (!current) return; const document = newDocument(locale); const next = [...current, document]; if (await onDocumentsChange(next, locale === "pl" ? "Utwórz notatkę" : "Create note")) { setWorkingDocuments(next); setSelectedId(document.id); setDraft(document); setDirty(false); setSaveFailed(false); } else setSaveFailed(true); };
  const remove = async () => {
    if (!draft || !window.confirm(locale === "pl" ? `Usunąć notatkę „${draft.title}”?` : `Delete “${draft.title}”?`)) return;
    const next = workingDocuments.filter(({ id }) => id !== draft.id);
    if (await onDocumentsChange(next, locale === "pl" ? "Usuń notatkę" : "Delete note")) { setWorkingDocuments(next); setSelectedId(next[0]?.id); setDraft(next[0]); setDirty(false); setSaveFailed(false); } else setSaveFailed(true);
  };
  const beginResize = (event: React.PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    const parent = event.currentTarget.parentElement?.parentElement;
    const resize = (clientX: number) => { if (!parent) return; const rect = parent.getBoundingClientRect(); const next = clampWidth((rect.right - clientX) / rect.width); width.current = next; notebook.current?.style.setProperty("width", `${next * 100}%`); window.localStorage.setItem(widthKey, String(next)); };
    const move = (moveEvent: PointerEvent) => resize(moveEvent.clientX);
    const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
  };
  const resizeByKeyboard = (event: ReactKeyboardEvent<HTMLDivElement>) => { if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return; event.preventDefault(); const next = clampWidth(width.current + (event.key === "ArrowLeft" ? .04 : -.04)); width.current = next; notebook.current?.style.setProperty("width", `${next * 100}%`); window.localStorage.setItem(widthKey, String(next)); };

  return <section ref={notebook} className={`${styles.notebook}${open ? "" : ` ${styles.closed}`}`} style={{ width: "50%" }} aria-label={locale === "pl" ? "Notatnik autora" : "Writer's notebook"}>
    <div className={styles.resizeHandle} role="separator" aria-orientation="vertical" aria-label={locale === "pl" ? "Zmień szerokość notatnika" : "Resize notebook"} tabIndex={0} onPointerDown={beginResize} onKeyDown={resizeByKeyboard}/>
    <header className={styles.header}><div><small>{locale === "pl" ? "Opowieść" : "Story"}</small><h2>{locale === "pl" ? "Notatnik autora" : "Writer's notebook"}</h2></div><button type="button" onClick={onClose} aria-label={locale === "pl" ? "Zwiń notatnik" : "Fold notebook"}>×</button></header>
    <div className={styles.layout}>
      <aside className={styles.index}><button type="button" className={styles.newButton} onClick={() => void create()}>＋ {locale === "pl" ? "Nowa" : "New"}</button>{workingDocuments.map((document) => <button type="button" key={document.id} className={document.id === selectedId ? styles.selected : undefined} onClick={() => void selectDocument(document.id)}>{document.title || (locale === "pl" ? "Bez tytułu" : "Untitled")}</button>)}</aside>
      <div className={styles.page}>{!draft ? <div className={styles.empty}><p>{locale === "pl" ? "Zapisuj pomysły, sceny i rozdziały razem z mapą." : "Keep ideas, scenes, and chapters together with the map."}</p><button type="button" onClick={create}>{locale === "pl" ? "Utwórz pierwszą notatkę" : "Create the first note"}</button></div> : <>
        <div className={styles.titleRow}><input value={draft.title} maxLength={2000} aria-label={locale === "pl" ? "Tytuł notatki" : "Note title"} onChange={(event) => updateDraft({ title: event.target.value })}/><span aria-live="polite">{saveFailed ? (locale === "pl" ? "Błąd zapisu" : "Save failed") : dirty ? (locale === "pl" ? "Zapisywanie…" : "Saving…") : (locale === "pl" ? "Zapisano" : "Saved")}</span><button type="button" className={styles.deleteButton} onClick={() => void remove()}>{locale === "pl" ? "Usuń" : "Delete"}</button></div>
        <StoryNotebookRichEditor key={draft.id} documentId={draft.id} locale={locale} markdown={draft.bodyMarkdown} onChange={(bodyMarkdown) => updateDraft({ bodyMarkdown })}/>
        <StoryNotebookReferences locale={locale} references={draft.references} objects={objects} scenarios={scenarios} onChange={updateReferences} onFocus={onFocus} onScenario={onScenario}/>
      </>}</div>
    </div>
  </section>;
}
