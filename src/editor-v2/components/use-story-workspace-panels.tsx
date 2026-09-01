"use client";

import { useState } from "react";
import type { EditorProject } from "../model/project-model";
import type { ProjectTransaction } from "../state/editor-session";
import type { EditorStoryView } from "../webmcp/editor-context";
import { StoryScenarioEditor } from "../story/components/story-scenario-editor";
import { StoryIntentionReview } from "../story/components/story-intention-review";
import type { StoryViewController } from "../story/components/use-story-view";
import type { StoryCollection, StoryRecord } from "../story/components/story-types";
import { removeScenarioEffect, replaceScenario, replaceProjectScenarios } from "../story/scenario-commands";
import type { StoryObjectRef, StoryViewContext } from "../story/types";
import type { StoryRouteRecord } from "../story/routes/types";
import { storyWorkspaceCopy } from "../story/i18n/workspace-copy";
import styles from "./workbench-story.module.css";

type Props = {
  project?: EditorProject; controller: StoryViewController; locale: "pl" | "en";
  context: StoryViewContext; refs: StoryObjectRef[];
  reviewOpen: boolean; onReviewOpenChange(open: boolean): void;
  commit(transaction: ProjectTransaction): void; setContext(patch: EditorStoryView): void;
  onFocus(refs: StoryObjectRef[]): boolean; onOpenDetails(): void; onOpenWorldbook(): void;
  onError(message: string): void; onPreviewRoute(route: StoryRouteRecord | undefined): void;
};

/** Connects story workspaces to the same session, selection and inspector as drawing. */
export function useStoryWorkspacePanels({ project, controller, locale, context, refs, reviewOpen, onReviewOpenChange, commit, setContext, onFocus, onOpenDetails, onOpenWorldbook, onError, onPreviewRoute }: Props) {
  const c = storyWorkspaceCopy[locale];
  const [notice, setNotice] = useState<string>();
  function apply(change: ProjectTransaction["apply"]) {
    try { commit({ id: `story-workspace:${crypto.randomUUID()}`, apply: change }); setNotice(undefined); return true; }
    catch (cause) { onError(cause instanceof Error ? cause.message : String(cause)); return false; }
  }
  function focus(targets: StoryObjectRef[]) {
    if (onFocus(targets)) { setNotice(undefined); return true; }
    setNotice(c.focusFailed); return false;
  }
  function openCollection(collection: StoryCollection) { onReviewOpenChange(false); setNotice(undefined); controller.chooseCollection(collection); onOpenWorldbook(); }
  function openRoute(id?: string) { openCollection("routes"); setContext({ routeId: id }); }
  function renderEntry(collection: StoryCollection, entry: StoryRecord) {
    if (!project || collection !== "scenarios") return undefined;
    const scenario = project.story.scenarios.find(({ id }) => id === entry.id);
    if (!scenario) return undefined;
    const active = context.scenarioId === scenario.id;
    const stepId = active && scenario.steps.some(({ id }) => id === context.stepId) ? context.stepId : undefined;
    const activate = (activeStepId?: string) => setContext({ scenarioId: scenario.id, stepId: activeStepId, editTarget: "scenario" });
    return <div>
      {!active && <p>{c.inactiveScenario}</p>}
      <StoryScenarioEditor project={project} scenarioId={scenario.id} activeStepId={stepId} locale={locale} selectionCount={refs.length}
        onActivate={activate} onChange={(next) => apply((current) => replaceScenario(current, next))}
        onInspect={(ref, currentStep) => { if (focus([ref])) { activate(currentStep); onOpenDetails(); } }}
        onAddSelection={(currentStep) => { if (refs.length) { activate(currentStep); onOpenDetails(); setNotice(c.selectionHint); } }}
        onRemoveEffect={(patchId, currentStep) => apply((current) => removeScenarioEffect(current, scenario.id, patchId, currentStep))}/>
      <button type="button" onClick={() => {
        if (apply((current) => replaceProjectScenarios(current, current.story.scenarios.filter(({ id }) => id !== scenario.id)))) {
          if (active) setContext({ scenarioId: undefined, stepId: undefined, editTarget: "base" });
          controller.selectEntry(undefined);
        }
      }}>{c.deleteScenario}</button>
    </div>;
  }
  return {
    renderEntry, reviewOpen, closeReview: () => onReviewOpenChange(false),
    notice: notice ? <p role="status">{notice}</p> : undefined,
    controls: <div className={styles.workspaceActions}>
      <button type="button" onClick={() => { openCollection("scenarios"); controller.selectEntry(context.scenarioId); }}>{c.scenario}</button>
      <button type="button" aria-pressed={reviewOpen} onClick={() => { onOpenWorldbook(); controller.chooseTab("worldbook"); onReviewOpenChange(true); setNotice(undefined); }}>{c.review}</button>
    </div>,
    reviewPanel: reviewOpen && project ? <div>
      <div className={styles.workspaceActions}><button type="button" onClick={() => openCollection("characters")}>{c.back}</button><button type="button" onClick={() => openCollection("intentions")}>{c.intentions}</button></div>
      <StoryIntentionReview key={project.id} project={project} context={context} refs={refs} locale={locale}
        onFocus={focus} onOpenRoute={openRoute} onRequestRoute={() => openRoute()} onPreviewRoute={onPreviewRoute}/>
    </div> : undefined,
  };
}
