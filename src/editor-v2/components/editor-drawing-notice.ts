import type { WorkbenchCopy } from "../i18n/workbench-copy";

export type DrawingNoticeActionId = "delete" | "cancel" | "apply-auto-close" | "cancel-auto-close" | "continue" | "auto-close" | "path" | "sketch" | "discard" | "close";
export type DrawingNoticeSpec = { message: string; tone?: "warning"; actions: { id: DrawingNoticeActionId; label: string; primary?: boolean; destructive?: boolean }[] };

type NoticeInput = {
  copy: WorkbenchCopy;
  deleteCandidates: boolean;
  closureReview: boolean;
  hasDraft: boolean;
  waitingToLeave: boolean;
  canAutoClose: boolean;
  canSavePath: boolean;
  blockedReason?: keyof WorkbenchCopy["drawingStatus"]["blocked"];
};

export function editorDrawingNotice(input: NoticeInput): DrawingNoticeSpec | undefined {
  const { copy } = input;
  if (input.deleteCandidates) return { message: copy.drawingStatus.deleteQuestion, tone: "warning", actions: [
    { id: "delete", label: copy.drawingStatus.confirmDelete, destructive: true },
    { id: "cancel", label: copy.drawingStatus.cancel },
  ] };
  if (input.closureReview) return { message: copy.drawingStatus.autoClosePreview, actions: [
    { id: "apply-auto-close", label: copy.drawingStatus.applyAutoClose, primary: true },
    { id: "cancel-auto-close", label: copy.drawingStatus.cancelAutoClose },
  ] };
  if (input.hasDraft && input.waitingToLeave) return { message: copy.drawingStatus.unfinishedWithNavigation, actions: [
    { id: "continue", label: copy.drawingStatus.continueDrawing },
    ...(input.canAutoClose ? [{ id: "auto-close" as const, label: copy.drawingStatus.autoClose }] : []),
    ...(input.canSavePath ? [{ id: "path" as const, label: copy.drawingStatus.saveAsPath }] : []),
    { id: "sketch", label: copy.drawingStatus.saveAsSketch },
    { id: "discard", label: copy.drawingStatus.discard, destructive: true },
  ] };
  if (input.blockedReason) return { message: copy.drawingStatus.blocked[input.blockedReason], tone: "warning", actions: [
    { id: "close", label: copy.close },
  ] };
}
