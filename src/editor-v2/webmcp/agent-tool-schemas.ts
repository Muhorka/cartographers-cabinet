import { constructionClearApiCategories } from "../state/clear-construction-layer";

export const pointSchema = {
  type: "object", description: "Local to map owner, in metres.", properties: { x: { type: "number" }, y: { type: "number" } }, required: ["x", "y"], additionalProperties: false,
};

export const objectRefSchema = {
  type: "object", properties: {
    type: { type: "string", enum: ["place", "room", "element", "surface", "wall", "opening", "transition"] },
    id: { type: "string" }, scopeId: { type: "string" },
  }, required: ["type", "id"], additionalProperties: false,
};

const appearanceSchema = {
  type: "object", properties: { fillColor: { type: "string" }, fillOpacity: { type: "number", minimum: 0, maximum: 1 } }, additionalProperties: false,
};

export const metadataProperties = {
  name: { type: "string" }, description: { type: "string" }, tags: { type: "array", items: { type: "string" } },
  appearance: appearanceSchema, visible: { type: "boolean" }, locked: { type: "boolean" },
};

export const transitionProperties = {
  sourceLevelId: { type: "string" }, targetLevelId: { type: "string" }, connectedLevelIds: { type: "array", items: { type: "string" } },
  transitionStyle: { type: "string", enum: ["straight", "l", "u", "spiral", "curved"] }, direction: { type: "number" }, sameLevelRise: { type: "boolean" },
};

export const regionShapeSchema = {
  oneOf: [
    { type: "object", properties: { kind: { const: "polygon" }, points: { type: "array", minItems: 3, items: pointSchema } }, required: ["kind", "points"], additionalProperties: false },
    { type: "object", properties: { kind: { const: "rectangle" }, x: { type: "number" }, y: { type: "number" }, width: { type: "number", exclusiveMinimum: 0 }, height: { type: "number", exclusiveMinimum: 0 } }, required: ["kind", "x", "y", "width", "height"], additionalProperties: false },
    { type: "object", properties: { kind: { const: "circle" }, cx: { type: "number" }, cy: { type: "number" }, radius: { type: "number", exclusiveMinimum: 0 } }, required: ["kind", "cx", "cy", "radius"], additionalProperties: false },
    { type: "object", properties: { kind: { const: "ellipse" }, cx: { type: "number" }, cy: { type: "number" }, rx: { type: "number", exclusiveMinimum: 0 }, ry: { type: "number", exclusiveMinimum: 0 } }, required: ["kind", "cx", "cy", "rx", "ry"], additionalProperties: false },
    { type: "object", properties: { kind: { const: "bezier" }, nodes: { type: "array", minItems: 2, items: { type: "object", properties: { anchor: pointSchema, inHandle: pointSchema, outHandle: pointSchema }, required: ["anchor"], additionalProperties: false } } }, required: ["kind", "nodes"], additionalProperties: false },
    { type: "object", properties: { kind: { const: "compound" }, polygons: { type: "array", minItems: 1, items: { type: "object", properties: { outer: { type: "array", minItems: 3, items: pointSchema }, holes: { type: "array", items: { type: "array", minItems: 3, items: pointSchema } } }, required: ["outer"], additionalProperties: false } } }, required: ["kind", "polygons"], additionalProperties: false },
  ],
};

export const preparedTokenSchema = {
  type: "object", properties: { token: { type: "string" } }, required: ["token"], additionalProperties: false,
};

export const layers = ["roads", "terrain", "boundaries", "buildings", "construction", "openings", "equipment", "sketch"];
export const constructionClearCategories = constructionClearApiCategories;
const instruments = ["place", "pencil", "pen", "line", "wall-run", "rectangle", "circle", "ellipse", "arc", "polygon", "point", "note", "erase"];

export const drawingSchema = {
  type: "object", properties: {
    ownerId: { type: "string" }, layerId: { type: "string", enum: layers }, subjectId: { type: "string" },
    instrumentId: { type: "string", enum: instruments, description: "Editor geometry: circle uses centre+circumference point; rectangle/ellipse use opposite corners." }, points: { type: "array", minItems: 1, description: "Owner-local metres. circle: exactly centre+circumference point; rectangle/ellipse: opposite corners; polygon: vertices.", items: pointSchema },
    bezierNodes: { type: "array", minItems: 2, items: { type: "object", properties: { anchor: pointSchema, inHandle: pointSchema, outHandle: pointSchema }, required: ["anchor"], additionalProperties: false } },
    closed: { type: "boolean" }, snapTolerance: { type: "number", minimum: 0 }, hitRadius: { type: "number", exclusiveMinimum: 0 },
    widthMeters: { type: "number", minimum: .1, maximum: 1000 }, acceptClip: { type: "boolean" }, boundaryEditing: { type: "boolean" }, openingWidth: { type: "number", exclusiveMinimum: 0 }, levelName: { type: "string" },
    ...transitionProperties,
    ...metadataProperties,
  }, required: ["layerId", "subjectId", "instrumentId", "points"], additionalProperties: false,
};
