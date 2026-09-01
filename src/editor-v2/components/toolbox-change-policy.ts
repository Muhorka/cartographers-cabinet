import type { InstrumentId } from "../toolbox/toolbox-model";
import type { ToolboxState } from "../toolbox/toolbox-state";

const compositionalInstruments = new Set<InstrumentId>(["pencil", "pen", "line", "wall-run", "rectangle", "circle", "ellipse", "arc", "polygon"]);

export function canContinueSemanticDraft(before: ToolboxState, after: ToolboxState, hasGestureDraft: boolean) {
  if (hasGestureDraft || before.activeLayerId !== after.activeLayerId) return false;
  const previous = before.byLayer[before.activeLayerId]; const next = after.byLayer[after.activeLayerId];
  return previous.subjectId === next.subjectId && compositionalInstruments.has(next.instrumentId);
}
