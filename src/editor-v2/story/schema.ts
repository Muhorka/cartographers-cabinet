import { z } from "zod";
import type { StoryData, StoryGroup, StoryObjectMetadata } from "./types";
import { routeRecordSchema } from "./routes/schema";

const id = z.string().trim().min(1).max(512);
const text = z.string().max(100_000);
const shortText = z.string().max(2_000);
const kind = z.enum(["place", "element", "surface", "room", "wall", "opening", "transition"]);
const ref = z.object({ kind, id, scopeId: id.optional() }).strict();
export const storyObjectRefSchema = ref;
const scalar = z.union([text, z.number().finite(), z.boolean(), z.null()]);
const worldRef = z.object({ entityId: id }).strict();
const value: z.ZodTypeAny = z.lazy(() => z.union([scalar, z.array(text).max(10_000), ref, z.array(ref).max(10_000), worldRef, z.array(worldRef).max(10_000)]));
const properties = z.record(id, value).superRefine((record, context) => {
  if (Object.keys(record).length > 10_000) context.addIssue({ code: "custom", message: "Too many story properties." });
  for (const key of Object.keys(record)) if (["__proto__", "prototype", "constructor"].includes(key)) context.addIssue({ code: "custom", message: `Unsafe property name: ${key}` });
});
const unique = (values: string[], context: z.RefinementCtx, label: string) => {
  const seen = new Set<string>();
  values.forEach((entry, index) => { if (seen.has(entry)) context.addIssue({ code: "custom", message: `Duplicate ${label}: ${entry}`, path: [index] }); seen.add(entry); });
};
const worldEntry = z.object({ id, kind: z.enum(["character", "faction", "access-group", "key"]), name: shortText, description: text.optional(), tags: z.array(shortText).max(10_000), properties }).strict();
const membership = z.object({ subjectId: id, groupId: id, kind: z.enum(["member-of", "holds-key", "knows"]), source: z.enum(["manual", "imported", "legacy"]), note: text.optional() }).strict();
const access = z.object({ allow: z.array(id).max(10_000), deny: z.array(id).max(10_000), permission: z.enum(["open", "restricted"]), physicalState: z.enum(["open", "closed"]), lock: z.enum(["none", "locked", "sealed"]).default("none"), keyIds: z.array(id).max(10_000), guardIds: z.array(id).max(10_000), secretKnowledge: z.array(id).max(10_000) }).strict();
const objectMetadata = z.object({ narrativeLabel: shortText.optional(), narrativeDescription: text.optional(), owners: z.array(id).max(10_000).optional(), access: access.optional(), tags: z.array(shortText).max(10_000).optional(), properties: properties.optional() }).strict();
export const storyMetadataSchema = objectMetadata as typeof objectMetadata & z.ZodType<StoryObjectMetadata>;
const objectRecord = z.object({ ref, metadata: objectMetadata }).strict();
const propertyDefinition = z.object({ id, name: shortText, type: z.enum(["text", "number", "unit", "boolean", "single", "multi", "entity"]), group: shortText.optional(), unit: shortText.optional(), options: z.array(shortText).max(10_000).optional(), targetKinds: z.array(kind).max(20).optional() }).strict();
const group = z.object({ id, name: shortText, description: text.optional(), memberRefs: z.array(ref).max(100_000), entryIds: z.array(id).max(100_000), metadata: objectMetadata }).strict() as z.ZodType<StoryGroup>;
const zoneMember = z.object({ ref, relation: z.enum(["inside", "overlaps", "touches", "near"]), partial: z.boolean(), note: text.optional() }).strict();
const zonePoint = z.object({ x: z.number().finite(), y: z.number().finite() }).strict();
const zoneShape = z.discriminatedUnion("kind", [z.object({ kind: z.literal("polygon"), points: z.array(zonePoint).min(3).max(100_000) }).strict(), z.object({ kind: z.literal("rectangle"), x: z.number().finite(), y: z.number().finite(), width: z.number().positive(), height: z.number().positive() }).strict(), z.object({ kind: z.literal("circle"), cx: z.number().finite(), cy: z.number().finite(), radius: z.number().positive() }).strict(), z.object({ kind: z.literal("ellipse"), cx: z.number().finite(), cy: z.number().finite(), rx: z.number().positive(), ry: z.number().positive() }).strict(), z.object({ kind: z.literal("bezier"), nodes: z.array(z.object({ anchor: zonePoint, inHandle: zonePoint.optional(), outHandle: zonePoint.optional() }).strict()).min(2).max(100_000), closed: z.literal(true) }).strict(), z.object({ kind: z.literal("compound"), polygons: z.array(z.object({ outer: z.array(zonePoint).min(3), holes: z.array(z.array(zonePoint).min(3)).default([]) }).strict()).min(1) }).strict()]);
const zone = z.object({ id, name: shortText, description: text.optional(), ownerPlaceId: id.optional(), shape: zoneShape.optional(), members: z.array(zoneMember).max(100_000), tags: z.array(shortText).max(10_000), metadata: objectMetadata.optional(), color: z.string().max(64).optional(), entryIds: z.array(id).max(100_000).optional(), legacyGroupId: id.optional() }).strict();
const predicate = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("object"), ref }).strict(),
  z.object({ kind: z.literal("tag"), value: shortText }).strict(),
  z.object({ kind: z.literal("group"), groupId: id }).strict(),
  z.object({ kind: z.literal("property"), propertyId: id, equals: value }).strict(),
  z.object({ kind: z.literal("access"), entryId: id, state: z.enum(["allowed", "denied"]) }).strict(),
  z.object({ kind: z.literal("owner"), entryId: id }).strict(),
  z.object({ kind: z.literal("zone"), zoneId: id }).strict(),
]);
const expression: z.ZodTypeAny = z.lazy(() => z.union([
  z.object({ kind: z.literal("all"), items: z.array(expression).max(100) }).strict(),
  z.object({ kind: z.literal("any"), items: z.array(expression).max(100) }).strict(),
  z.object({ kind: z.literal("not"), item: expression }).strict(),
  z.object({ kind: z.literal("predicate"), predicate }).strict(),
]));
const lens = z.object({ id, name: shortText, color: z.string().max(64), expression, favorite: z.boolean().optional() }).strict();
const patch = z.object({ id, target: ref, title: shortText.optional(), description: text.optional(), properties: properties.optional(), metadata: z.object({ owners: z.array(id).max(10_000).optional(), tags: z.array(shortText).max(10_000).optional(), access: access.optional() }).strict().optional() }).strict().superRefine((entry, context) => { if (entry.title === undefined && entry.description === undefined && entry.properties === undefined && entry.metadata === undefined) context.addIssue({ code: "custom", message: "A story patch must change text or metadata." }); });
const step = z.object({ id, name: shortText, description: text.optional(), patches: z.array(patch).max(100_000) }).strict();
const scenario = z.object({ id, name: shortText, description: text.optional(), patches: z.array(patch).max(100_000), steps: z.array(step).max(100_000) }).strict();
const actor = z.union([ref, z.object({ entryId: id }).strict()]);
const relation = z.object({ id, from: actor, to: actor, kind: z.enum(["owns", "knows", "visits", "guards", "uses", "contains", "custom"]), label: shortText.optional(), source: text.optional() }).strict();
const intention = z.object({ id, authorId: id.optional(), subject: ref, kind: z.enum(["reachability", "must-pass", "avoid-zone", "access-rule", "custom"]), text, status: z.enum(["draft", "accepted", "rejected"]), target: ref.optional(), through: z.array(ref).max(100_000).optional(), avoidZoneId: id.optional(), accessEntryId: id.optional() }).strict();
const evidence = z.object({ id, text, refs: z.array(ref).max(100_000), source: z.literal("local"), locator: shortText.optional() }).strict();
export const storyViewContextSchema = z.object({ scenarioId: id.optional(), stepId: id.optional(), lensId: id.optional() }).strict();

export const storyDataSchema = z.object({
  version: z.literal(1), world: z.array(worldEntry).max(100_000), memberships: z.array(membership).max(200_000), propertyDefinitions: z.array(propertyDefinition).max(100_000), objects: z.array(objectRecord).max(200_000), groups: z.array(group).max(100_000), zones: z.array(zone).max(100_000), lenses: z.array(lens).max(100_000), scenarios: z.array(scenario).max(100_000), relations: z.array(relation).max(200_000), intentions: z.array(intention).max(100_000), evidence: z.array(evidence).max(100_000), routes: z.array(routeRecordSchema).max(100_000).default([]),
}).strict().superRefine((story, context) => {
  unique(story.world.map(({ id: value }) => value), context, "world id");
  unique(story.memberships.map(({ subjectId, groupId, kind }) => `${subjectId}:${groupId}:${kind}`), context, "membership");
  unique(story.propertyDefinitions.map(({ id: value }) => value), context, "property definition id");
  unique(story.objects.map(({ ref: value }) => `${value.kind}:${value.scopeId ?? ""}:${value.id}`), context, "object reference");
  unique(story.groups.map(({ id: value }) => value), context, "group id");
  unique(story.zones.map(({ id: value }) => value), context, "zone id");
  unique(story.lenses.map(({ id: value }) => value), context, "lens id");
  unique(story.scenarios.map(({ id: value }) => value), context, "scenario id");
  unique(story.relations.map(({ id: value }) => value), context, "relation id");
  unique(story.intentions.map(({ id: value }) => value), context, "intention id");
  unique(story.evidence.map(({ id: value }) => value), context, "evidence id");
  unique(story.routes.map(({ id: value }) => value), context, "route id");
}) as z.ZodType<StoryData>;

export const storyCollectionSchemas = { world: z.array(worldEntry), memberships: z.array(membership), propertyDefinitions: z.array(propertyDefinition), objects: z.array(objectRecord), groups: z.array(group), zones: z.array(zone), lenses: z.array(lens), scenarios: z.array(scenario), relations: z.array(relation), intentions: z.array(intention), evidence: z.array(evidence), routes: z.array(routeRecordSchema) } as const;
