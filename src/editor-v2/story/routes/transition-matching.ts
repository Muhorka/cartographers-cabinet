import type { ConstructionDocument } from "../../construction/construction-document";
import type { VerticalTransition } from "../../construction/wall-features";
import { applyAffinePoint, relativePlaceMatrix } from "../../geometry/affine-transform";
import { distance } from "./geometry";
import { routeTransitionPoint } from "./revision";
import type { EditorProject } from "../../model/project-model";

function transitionLevelIds(transition: VerticalTransition) {
  return new Set([transition.sourceLevelId, transition.targetLevelId, ...(transition.connectedLevelIds ?? [])].filter((id): id is string => Boolean(id)));
}

/** Resolve a target landing only when its scoped record describes the same physical transition. */
export function findMatchingTargetTransition(project: EditorProject, sourcePlaceId: string, source: VerticalTransition, targetDocument: ConstructionDocument, targetLevelId: string) {
  const sourcePoint = routeTransitionPoint(source);
  if (!sourcePoint) return undefined;
  const expectedPoint = applyAffinePoint(relativePlaceMatrix(project, targetLevelId, sourcePlaceId), sourcePoint);
  return targetDocument.transitions.find((candidate) => {
    if (candidate.id !== source.id || candidate.kind !== source.kind) return false;
    const declaredLevels = transitionLevelIds(candidate);
    if (declaredLevels.size && !declaredLevels.has(targetLevelId)) return false;
    const candidatePoint = routeTransitionPoint(candidate);
    return Boolean(candidatePoint && distance(candidatePoint, expectedPoint) <= 0.5);
  });
}
