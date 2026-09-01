import type { DrawingNoticeModel } from "./drawing-notice";

export function confirmationNotice(message: string, confirmLabel: string, cancelLabel: string, onConfirm: () => void, onCancel: () => void): DrawingNoticeModel {
  return {
    message,
    tone: "warning",
    actions: [
      { id: "confirm", label: confirmLabel, destructive: true, onClick: onConfirm },
      { id: "cancel", label: cancelLabel, onClick: onCancel },
    ],
  };
}
