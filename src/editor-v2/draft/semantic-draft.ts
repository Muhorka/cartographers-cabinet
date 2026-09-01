import { buildWallNetwork } from "../geometry/wall-network-kernel";
import type { CanonicalWall, KernelPoint, RoomFace } from "../geometry/geometry-types";
import type { WorkLayerId } from "../toolbox/toolbox-model";

export type DraftStroke = { id: string; points: KernelPoint[] };

export type SemanticDraft = {
  id: string;
  layerId: WorkLayerId;
  subjectId: string;
  belongsToId: string;
  strokes: DraftStroke[];
};

export type DraftAnalysis = {
  faces: RoomFace[];
  hasLooseLines: boolean;
  looseStrokeIds: string[];
};

function wallsForStroke(stroke: DraftStroke): CanonicalWall[] {
  return stroke.points.slice(0, -1).map((start, index) => ({
    id: `${stroke.id}:${index + 1}`,
    start,
    end: stroke.points[index + 1],
    thickness: 0,
    role: "wall",
  }));
}

export function wallsForDraft(draft: SemanticDraft) {
  return draft.strokes.flatMap(wallsForStroke);
}

export function consumedDraftStrokes(draft: SemanticDraft, existingWalls: readonly CanonicalWall[]) {
  const used = new Set(buildWallNetwork([...existingWalls, ...wallsForDraft(draft)]).faces.flatMap(({ wallIds }) => wallIds));
  return draft.strokes.filter((stroke) => !wallsForStroke(stroke).some(({ id }) => used.has(id)));
}

export function createSemanticDraft(id: string, layerId: WorkLayerId, subjectId: string, belongsToId: string): SemanticDraft {
  return { id, layerId, subjectId, belongsToId, strokes: [] };
}

export function appendDraftStroke(draft: SemanticDraft, stroke: DraftStroke) {
  if (stroke.points.length < 2) return draft;
  if (draft.strokes.some(({ id }) => id === stroke.id)) throw new Error("A draft stroke with this identifier already exists");
  return { ...draft, strokes: [...draft.strokes, stroke] };
}

export function analyzeDraft(draft: SemanticDraft): DraftAnalysis {
  const network = buildWallNetwork(wallsForDraft(draft));
  const faceWallIds = new Set(network.faces.flatMap(({ wallIds }) => wallIds));
  const looseStrokeIds = draft.strokes.filter((stroke) => wallsForStroke(stroke).some(({ id }) => !faceWallIds.has(id))).map(({ id }) => id);
  return { faces: network.faces, hasLooseLines: looseStrokeIds.length > 0, looseStrokeIds };
}

export function looseDraftStrokes(draft: SemanticDraft, trimTolerance = 0) {
  const network = buildWallNetwork(wallsForDraft(draft));
  const faceWallIds = new Set(network.faces.flatMap(({ wallIds }) => wallIds));
  const loose: DraftStroke[] = [];
  for (const stroke of draft.strokes) {
    let run: KernelPoint[] = []; let part = 0;
    for (let index = 0; index < stroke.points.length - 1; index += 1) {
      const usedByFace = faceWallIds.has(`${stroke.id}:${index + 1}`);
      if (!usedByFace) {
        if (!run.length) run.push(stroke.points[index]);
        run.push(stroke.points[index + 1]);
      } else if (run.length > 1) {
        if (pathLength(run) > trimTolerance) loose.push({ id: `${stroke.id}:loose:${++part}`, points: run }); run = [];
      }
    }
    if (run.length > 1 && pathLength(run) > trimTolerance) loose.push({ id: `${stroke.id}:loose:${++part}`, points: run });
  }
  return loose;
}

function pathLength(points: readonly KernelPoint[]) {
  return points.slice(1).reduce((sum, point, index) => sum + Math.hypot(point.x - points[index].x, point.y - points[index].y), 0);
}

export function draftNavigationDecision(draft?: SemanticDraft) {
  if (!draft?.strokes.length) return { state: "free" as const };
  const analysis = analyzeDraft(draft);
  return { state: "decision-required" as const, canCreate: analysis.faces.length > 0, canKeepAsSketch: true, analysis };
}
