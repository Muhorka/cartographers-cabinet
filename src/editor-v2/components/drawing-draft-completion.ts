import { completeSemanticDraft } from "../draft/complete-draft";
import { looseDraftStrokes, type SemanticDraft } from "../draft/semantic-draft";
import type { DraftClosureProposal } from "../draft/auto-close-draft";
import { normalizeDraftTopology } from "../draft/normalize-draft-topology";
import type { EditorProject } from "../model/project-model";
import { completedGesture, type MapGestureDraft } from "./map-sheet-gesture";

type Naming = { nameFor(subjectId: string, index: number): string; levelName(): string; roomName(index: number): string };
type Identity = { createId(): string };
export type ClosureReview = { kind: "semantic"; proposal: DraftClosureProposal } | { kind: "gesture"; before: MapGestureDraft; after: MapGestureDraft };

export function finishAutomaticClosure(project: EditorProject, review: ClosureReview, identity: Identity, naming: Naming) {
  if (review.kind === "gesture") return { state: "gesture" as const, gesture: completedGesture(review.after) };
  let result = completeSemanticDraft(project, review.proposal.after, identity, naming);
  if (result.state === "clip-review") result = completeSemanticDraft(project, review.proposal.after, identity, naming, true);
  return result.state === "created" ? { state: "created" as const, result } : { state: "blocked" as const };
}

export function finishCorrectedDraft(project: EditorProject, draft: SemanticDraft, tolerance: number, identity: Identity, naming: Naming) {
  const corrected = normalizeDraftTopology(draft, tolerance); const analysis = looseDraftStrokes(corrected, tolerance);
  let result = completeSemanticDraft(project, corrected, identity, naming);
  if (result.state === "clip-review") result = completeSemanticDraft(project, corrected, identity, naming, true);
  return { corrected, analysis, result };
}
