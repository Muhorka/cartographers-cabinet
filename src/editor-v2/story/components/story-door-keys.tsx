"use client";

import { useMemo, useState } from "react";
import type { EditorProject } from "../../model/project-model";
import { workbenchCopy } from "../../i18n/workbench-copy";
import { effectiveProjectStoryObject } from "../project-effective";
import { storyObjectDisplayName } from "../object-display-name";
import type { StoryObjectRef, StoryViewContext } from "../types";
import { storyRefKey } from "../types";
import type { StoryLocale } from "./story-types";
import type { AssignProjectKeyHoldersInput } from "../project-key-holders";
import styles from "./story-door-keys.module.css";

type DoorKeyCopy = {
  title: string;
  key: string;
  noKey: string;
  whoHasKey: string;
  chooseHolders: string;
  saveHolders: string;
  createKey: string;
  noHolderHint: string;
  storedHint: string;
  sharedHint: string;
  openWorldbook: string;
  scenarioHint: string;
  scenarioMissing: string;
  noKnownKey: string;
  character: string;
  faction: string;
  accessGroup: string;
  newKeyName(openingName: string): string;
};

const copy: Record<StoryLocale, DoorKeyCopy> = {
  en: {
    title: "Door keys", key: "Key", noKey: "No key is assigned to these doors yet.", whoHasKey: "Who has a key to these doors?", chooseHolders: "Choose existing characters, factions or people groups.", saveHolders: "Save key holders", createKey: "Create key and save", noHolderHint: "A key may be created without a holder, for a lost key or a ruin.", storedHint: "Key holders are stored in the World book as a shared world fact.", sharedHint: "Changing a key changes every door that uses this key.", openWorldbook: "Open World book", scenarioHint: "The key on the door is edited in the selected scenario; who holds it remains a base-world fact.", scenarioMissing: "Select a scenario before editing scenario access.", noKnownKey: "An attached key entry is missing from the World book.", character: "Character", faction: "Faction", accessGroup: "People group", newKeyName: (openingName) => `Key: ${openingName}`,
  },
  pl: {
    title: "Klucze drzwi", key: "Klucz", noKey: "Te drzwi nie mają jeszcze przypisanego klucza.", whoHasKey: "Kto ma klucz do tych drzwi?", chooseHolders: "Wybierz istniejące postacie, frakcje lub grupy osób.", saveHolders: "Zapisz posiadaczy", createKey: "Utwórz klucz i zapisz", noHolderHint: "Klucz może powstać bez posiadacza — na przykład jako zgubiony lub należący do ruin.", storedHint: "Posiadacze klucza są zapisani w Księdze świata jako wspólny fakt świata.", sharedHint: "Zmiana klucza zmienia wszystkie drzwi, które go używają.", openWorldbook: "Otwórz Księgę świata", scenarioHint: "Klucz na drzwiach jest edytowany w wybranym scenariuszu; informacja o posiadaczu pozostaje faktem bazowym.", scenarioMissing: "Wybierz scenariusz przed edycją dostępu scenariusza.", noKnownKey: "Przypisany klucz nie ma wpisu w Księdze świata.", character: "Postać", faction: "Frakcja", accessGroup: "Grupa osób", newKeyName: (openingName) => `Klucz: ${openingName}`,
  },
};

const holderKinds = new Set(["character", "faction", "access-group"]);
const kindLabel = (kind: string, text: DoorKeyCopy) => kind === "character" ? text.character : kind === "faction" ? text.faction : text.accessGroup;

export type StoryDoorKeysProps = {
  project: EditorProject;
  ref: StoryObjectRef & { kind: "opening" };
  locale: StoryLocale;
  context?: StoryViewContext;
  target?: "base" | "scenario";
  onAssign: (assignment: Pick<AssignProjectKeyHoldersInput, "keyId" | "holderIds" | "keyName">) => void;
  onOpenWorldbook?: () => void;
};

function holderIdsFor(project: EditorProject, keyId: string) {
  return project.story.memberships.filter((membership) => membership.kind === "holds-key" && membership.groupId === keyId).map(({ subjectId }) => subjectId);
}

export function StoryDoorKeys({ ref: openingRef, ...props }: StoryDoorKeysProps) {
  return <StoryDoorKeysContent {...props} openingRef={openingRef} />;
}

type StoryDoorKeysContentProps = Omit<StoryDoorKeysProps, "ref"> & { openingRef: StoryDoorKeysProps["ref"] };

/** Shows one independent holder editor per key attached to a scoped opening. */
function StoryDoorKeysContent({ project, openingRef, locale, context, target = "base", onAssign, onOpenWorldbook }: StoryDoorKeysContentProps) {
  const text = copy[locale];
  const effective = useMemo(() => effectiveProjectStoryObject(project, openingRef, target === "scenario" ? context ?? {} : {}), [context, openingRef, project, target]);
  const attachedKeyIds = useMemo(() => [...new Set(effective?.metadata.access?.keyIds ?? [])], [effective]);
  const keys = useMemo(() => project.story.world.filter((entry) => entry.kind === "key" && attachedKeyIds.includes(entry.id)), [attachedKeyIds, project.story.world]);
  const holders = useMemo(() => project.story.world.filter((entry) => holderKinds.has(entry.kind)), [project.story.world]);
  const scope = `${storyRefKey(openingRef)}:${target}:${context?.scenarioId ?? ""}:${context?.stepId ?? ""}`;
  const initialDrafts = useMemo(() => {
    const next: Record<string, string[]> = {};
    for (const key of keys) next[key.id] = holderIdsFor(project, key.id);
    if (!keys.length) next.new = [];
    return next;
  }, [keys, project]);
  const [draftState, setDraftState] = useState<{ scope: string; drafts: Record<string, string[]> }>({ scope: "", drafts: {} });
  const drafts = draftState.scope === scope ? draftState.drafts : initialDrafts;
  const canEdit = target === "base" || Boolean(context?.scenarioId);
  const setHolder = (keyId: string, holderId: string, checked: boolean) => setDraftState((current) => {
    const values = new Set((current.scope === scope ? current.drafts : initialDrafts)[keyId] ?? []);
    if (checked) values.add(holderId); else values.delete(holderId);
    return { scope, drafts: { ...(current.scope === scope ? current.drafts : initialDrafts), [keyId]: [...values] } };
  });
  const openingName = effective ? storyObjectDisplayName(project, effective, workbenchCopy[locale].objectList) : text.key;
  const assign = (keyId: string | undefined) => onAssign({ ...(keyId ? { keyId } : {}), holderIds: [...(drafts[keyId ?? "new"] ?? [])], ...(!keyId ? { keyName: text.newKeyName(openingName) } : {}) });
  const holderChecklist = (keyId: string) => <div className={styles.holderChecklist}><h4>{text.whoHasKey}</h4><p className={styles.hint}>{text.chooseHolders}</p>{holders.length ? <div className={styles.holderList}>{holders.map((holder) => <label key={holder.id}><input type="checkbox" checked={(drafts[keyId] ?? []).includes(holder.id)} onChange={(event) => setHolder(keyId, holder.id, event.currentTarget.checked)}/><span>{holder.name} <small>· {kindLabel(holder.kind, text)}</small></span></label>)}</div> : <p className={styles.empty}>{text.noHolderHint}</p>}</div>;
  const saveButton = (keyId: string | undefined, label: string) => <button type="button" className={styles.saveButton} disabled={!canEdit} onClick={() => assign(keyId)}>{label}</button>;
  return <section className={styles.editor} aria-label={text.title}>{target === "scenario" && <p className={styles.hint}>{context?.scenarioId ? text.scenarioHint : text.scenarioMissing}</p>}<p className={styles.hint}>{text.storedHint} {text.sharedHint}</p>{keys.map((key) => <fieldset className={styles.keyGroup} key={key.id}><legend>{text.key}: {key.name}</legend>{holderChecklist(key.id)}<div className={styles.actions}>{saveButton(key.id, text.saveHolders)}</div></fieldset>)}{attachedKeyIds.length > keys.length && <p className={styles.empty}>{text.noKnownKey}</p>}{!keys.length && <fieldset className={styles.keyGroup}><legend>{text.noKey}</legend>{holderChecklist("new")}<div className={styles.actions}>{saveButton(undefined, text.createKey)}</div></fieldset>}{onOpenWorldbook && <div className={styles.actions}><button type="button" className={styles.worldbookButton} onClick={onOpenWorldbook}>{text.openWorldbook}</button></div>}</section>;
}
