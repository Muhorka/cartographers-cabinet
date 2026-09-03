import type { BezierNode, KernelPoint } from "../geometry/geometry-types";
import type { MapAppearance } from "../model/project-model";
import type { VerticalTransition } from "../construction/wall-features";
import type { InstrumentId, WorkLayerId } from "../toolbox/toolbox-model";

export type AgentLocale = "pl" | "en";

export type AgentObjectRef = {
  type: "place" | "room" | "element" | "surface" | "wall" | "opening" | "transition";
  id: string;
  scopeId?: string;
};

export type AgentMetadata = {
  name?: string;
  description?: string;
  tags?: string[];
  appearance?: MapAppearance;
  visible?: boolean;
  locked?: boolean;
};

export type AgentDrawingInput = AgentMetadata & {
  ownerId?: string;
  layerId: WorkLayerId;
  subjectId: string;
  instrumentId: Extract<InstrumentId, "place" | "pencil" | "pen" | "line" | "wall-run" | "rectangle" | "circle" | "ellipse" | "arc" | "polygon" | "point" | "note" | "erase">;
  points: KernelPoint[];
  bezierNodes?: BezierNode[];
  closed?: boolean;
  snapTolerance?: number;
  hitRadius?: number;
  acceptClip?: boolean;
  boundaryEditing?: boolean;
  openingWidth?: number;
  widthMeters?: number;
  levelName?: string;
  sourceLevelId?: string;
  targetLevelId?: string;
  connectedLevelIds?: string[];
  transitionStyle?: VerticalTransition["style"];
  direction?: number;
  sameLevelRise?: boolean;
};

export type AgentTransitionDetails = Partial<Pick<VerticalTransition, "sourceLevelId" | "targetLevelId" | "connectedLevelIds" | "style" | "direction" | "sameLevelRise">>;

export type AgentTransformation =
  | { kind: "move"; dx: number; dy: number }
  | { kind: "rotate"; degrees: number }
  | { kind: "mirror"; axis: "horizontal" | "vertical" };
