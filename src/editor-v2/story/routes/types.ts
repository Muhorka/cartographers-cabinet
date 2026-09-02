import type { EditorProject } from "../../model/project-model";
import type { KernelPoint } from "../../geometry/geometry-types";

type StoryRouteProfile = "foot" | "mounted" | "vehicle";

export type StoryRouteRequest = {
  from: { placeId: string; point: KernelPoint; levelId?: string };
  to: { placeId: string; point: KernelPoint; levelId?: string };
  profile?: StoryRouteProfile;
  width?: number;
  actorId?: string;
  scenarioId?: string;
  stepId?: string;
  /** Requested result count. The UI starts at one and increases this only on demand. */
  alternativeLimit?: number;
  preferences?: {
    preferRoads?: boolean;
    allowOffroad?: boolean;
    allowWindows?: boolean;
  };
};

export type StoryAccessContext = Pick<StoryRouteRequest, "actorId" | "scenarioId" | "stepId">;
export type StoryAccessDecision = boolean | { allowed: boolean; reason?: string; unknown?: boolean; conditions?: string[] };

type StoryAccessResolver = (entity: {
  kind: "place" | "room" | "opening" | "transition" | "road";
  id: string;
  scopeId?: string;
  access?: readonly string[];
  locked?: boolean;
}, context: StoryAccessContext) => StoryAccessDecision;

export type StoryRouteOptions = {
  access?: StoryAccessResolver;
  /** An explicitly supplied project story resolver can be threaded through here. */
  project?: EditorProject;
};

export type StoryRouteSegment = {
  placeId: string;
  levelId?: string;
  kind: "indoor" | "outdoor" | "road" | "transition";
  points: KernelPoint[];
  faceId?: string;
  sourceId?: string;
  conditions?: string[];
};

export type StoryRouteAlternative = {
  id: string;
  sourceRevision?: string;
  segments: StoryRouteSegment[];
  points: KernelPoint[];
  distance: number;
  conditions: string[];
  reasons: string[];
  usedOpeningIds: string[];
  usedTransitionIds: string[];
};

export type StoryRouteResult = {
  status: "ready" | "unreachable" | "unknown";
  revision: number;
  sourceRevision: string;
  routes: StoryRouteAlternative[];
  route?: StoryRouteAlternative;
  missingFacts: string[];
  reasons: string[];
};

/** Serializable route ledger entry; callers may persist this under project.story.routes. */
export type StoryRouteRecord = {
  id: string;
  name: string;
  query: StoryRouteRequest;
  result: StoryRouteResult;
  sourceRevision: string;
};
