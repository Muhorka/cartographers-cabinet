import { z } from "zod";

const point = z.object({ x: z.number().finite(), y: z.number().finite() }).strict();
const endpoint = z.object({ placeId: z.string().trim().min(1).max(512), point, levelId: z.string().trim().min(1).max(512).optional() }).strict();
export const routeRequestSchema = z.object({
  from: endpoint,
  to: endpoint,
  profile: z.enum(["foot", "mounted", "vehicle"]).optional(),
  width: z.number().finite().positive().optional(),
  actorId: z.string().trim().min(1).max(512).optional(),
  scenarioId: z.string().trim().min(1).max(512).optional(),
  stepId: z.string().trim().min(1).max(512).optional(),
  preferences: z.object({ preferRoads: z.boolean().optional(), allowOffroad: z.boolean().optional(), allowWindows: z.boolean().optional() }).strict().optional(),
}).strict();
const segment = z.object({ placeId: z.string().trim().min(1).max(512), levelId: z.string().trim().min(1).max(512).optional(), kind: z.enum(["indoor", "outdoor", "road", "transition"]), points: z.array(point).min(1).max(100_000), faceId: z.string().trim().min(1).max(512).optional(), sourceId: z.string().trim().min(1).max(512).optional(), conditions: z.array(z.string().max(2_000)).max(100).optional() }).strict();
const alternative = z.object({ id: z.string().trim().min(1).max(512), sourceRevision: z.string().trim().min(1).max(512).optional(), segments: z.array(segment).max(100_000), points: z.array(point).min(1).max(100_000), distance: z.number().finite().nonnegative(), conditions: z.array(z.string().max(2_000)).max(100), reasons: z.array(z.string().max(2_000)).max(100), usedOpeningIds: z.array(z.string().trim().min(1).max(512)).max(100_000), usedTransitionIds: z.array(z.string().trim().min(1).max(512)).max(100_000) }).strict();
const result = z.object({ status: z.enum(["ready", "unreachable", "unknown"]), revision: z.number().int().nonnegative(), sourceRevision: z.string().trim().min(1).max(512), routes: z.array(alternative).max(3), route: alternative.optional(), missingFacts: z.array(z.string().max(2_000)).max(100_000), reasons: z.array(z.string().max(2_000)).max(100_000) }).strict();
export const routeRecordSchema = z.object({ id: z.string().trim().min(1).max(512), name: z.string().max(2_000), query: routeRequestSchema, result, sourceRevision: z.string().trim().min(1).max(512) }).strict();
