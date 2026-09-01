import type { EditorStoryView, StoryViewUpdateResult } from "../webmcp/editor-context";

type DraftGuard = { canUndoDraft: boolean; transitionRequest?: unknown; requestAfterDraft(action: () => void): void };
export function requestStoryViewTransition({ view, drawing, hasOverlap, requestAfterOverlap, setMode, setStoryView }: {
  view: EditorStoryView; drawing: DraftGuard; hasOverlap(): boolean; requestAfterOverlap(action: () => void): void; setMode(): void; setStoryView(view: EditorStoryView): void;
}): StoryViewUpdateResult {
  const draftGuarded = drawing.canUndoDraft || Boolean(drawing.transitionRequest); let overlapGuarded = false;
  drawing.requestAfterDraft(() => { overlapGuarded = hasOverlap(); requestAfterOverlap(() => { setMode(); setStoryView(view); }); });
  if (draftGuarded) return { status: "deferred", reason: "draft" };
  return overlapGuarded ? { status: "deferred", reason: "overlap" } : { status: "applied" };
}
