export type KernelPoint = { x: number; y: number };

export type BezierNode = {
  anchor: KernelPoint;
  inHandle?: KernelPoint;
  outHandle?: KernelPoint;
};

export type CanonicalWall = {
  id: string;
  /** Immediate wall record from which this segment was derived. */
  sourceWallId?: string;
  start: KernelPoint;
  end: KernelPoint;
  thickness: number;
  role: "boundary" | "wall" | "partition";
  visible?: boolean;
  locked?: boolean;
};

export type NodedWallSegment = {
  id: string;
  sourceWallId: string;
  start: KernelPoint;
  end: KernelPoint;
};

export type RoomFace = {
  id: string;
  outer: KernelPoint[];
  holes: KernelPoint[][];
  area: number;
  wallIds: string[];
};

export type GeometryDiagnostic = {
  kind: "zero-length-wall" | "dangling-edge" | "cut-edge" | "invalid-ring";
  wallIds: string[];
  points: KernelPoint[];
};

export type WallNetworkResult = {
  segments: NodedWallSegment[];
  faces: RoomFace[];
  diagnostics: GeometryDiagnostic[];
};
