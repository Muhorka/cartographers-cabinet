import type { EditorSession } from "../state/editor-session";
import type { WorkbenchCopy } from "../i18n/workbench-copy";
import type { DrawingNoticeModel } from "./drawing-notice";

export function selectionNotice({
  review,
  session,
  blocked,
  copy,
  acceptReview,
  clearReview,
  clearBlocked,
}: {
  review?: { session: EditorSession };
  session?: EditorSession;
  blocked?: keyof WorkbenchCopy["editingStatus"]["blocked"];
  copy: WorkbenchCopy;
  acceptReview(): void;
  clearReview(): void;
  clearBlocked(): void;
}): DrawingNoticeModel | undefined {
  if (review?.session === session) return { message: copy.editingStatus.reviewQuestion, tone: "warning", actions: [
    { id: "apply", label: copy.editingStatus.apply, primary: true, onClick: acceptReview },
    { id: "cancel", label: copy.editingStatus.cancel, onClick: clearReview },
  ] };
  if (blocked) return { message: copy.editingStatus.blocked[blocked], tone: "warning", actions: [
    { id: "close", label: copy.close, onClick: clearBlocked },
  ] };
  return undefined;
}
