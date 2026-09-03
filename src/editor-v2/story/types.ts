import type { RegionShape } from "../model/project-model";
import type { StoryRouteRecord } from "./routes/types";

/** Shared, geometry-free narrative model. Spatial objects stay owned by the editor. */
type StoryObjectKind = "place" | "element" | "surface" | "room" | "wall" | "opening" | "transition";

export type StoryObjectRef = { kind: StoryObjectKind; id: string; scopeId?: string };
type StoryWorldRef = { entityId: string };

type StoryPropertyScalar = string | number | boolean | null;
export type StoryPropertyValue = StoryPropertyScalar | string[] | StoryObjectRef | StoryObjectRef[] | StoryWorldRef | StoryWorldRef[];
type StoryPropertyType = "text" | "number" | "unit" | "boolean" | "single" | "multi" | "entity";

export type StoryPropertyDefinition = {
  id: string;
  name: string;
  type: StoryPropertyType;
  group?: string;
  unit?: string;
  options?: string[];
  targetKinds?: StoryObjectKind[];
};

type StoryWorldEntryKind = "character" | "faction" | "access-group" | "key";
type StoryMembershipSource = "manual" | "imported" | "legacy";
export type StoryWorldEntry = {
  id: string;
  kind: StoryWorldEntryKind;
  name: string;
  description?: string;
  tags: string[];
  properties: Record<string, StoryPropertyValue>;
};
type StoryMembershipKind = "member-of" | "holds-key" | "knows";
type StoryMembership = { subjectId: string; groupId: string; kind: StoryMembershipKind; source: StoryMembershipSource; note?: string };

export type StoryAccessPolicy = {
  allow: string[];
  deny: string[];
  permission: "open" | "restricted" | "nobody";
  physicalState: "open" | "closed";
  lock?: "none" | "locked" | "sealed";
  keyIds: string[];
  guardIds: string[];
  secretKnowledge: string[];
  /** Hide the object from actor-specific route discovery when true. */
  hidden?: boolean;
  /** Actor or membership ids that know about a hidden object. */
  knownBy?: string[];
};

export function defaultStoryAccessPolicy(): StoryAccessPolicy {
  return { allow: [], deny: [], permission: "open", physicalState: "open", lock: "none", keyIds: [], guardIds: [], secretKnowledge: [] };
}

export type StoryObjectMetadata = {
  /** Narrative annotations are especially useful for walls/openings/transitions without native labels. */
  narrativeLabel?: string;
  narrativeDescription?: string;
  owners?: string[];
  access?: StoryAccessPolicy;
  tags?: string[];
  properties?: Record<string, StoryPropertyValue>;
};
export type StoryObject = {
  ref: StoryObjectRef;
  metadata: StoryObjectMetadata;
};

/** @deprecated Object groups are accepted at the boundary and normalized to StoryZone. */
export type StoryGroup = {
  id: string;
  name: string;
  description?: string;
  memberRefs: StoryObjectRef[];
  entryIds: string[];
  metadata: StoryObjectMetadata;
};

export type StoryZoneRelation = "inside" | "overlaps" | "touches" | "near";
type StoryZoneMembership = { ref: StoryObjectRef; relation: StoryZoneRelation; partial: boolean; note?: string };
/** A zone is the canonical group of places/objects with inherited narrative metadata. */
export type StoryZone = { id: string; name: string; description?: string; ownerPlaceId?: string; shape?: RegionShape; members: StoryZoneMembership[]; tags: string[]; metadata?: StoryObjectMetadata; color?: string; entryIds?: string[]; /** Original object-group id when imported from the legacy collection. */ legacyGroupId?: string };

export type StoryLensPredicate =
  | { kind: "object"; ref: StoryObjectRef }
  | { kind: "tag"; value: string }
  | { kind: "group"; groupId: string }
  | { kind: "property"; propertyId: string; equals: StoryPropertyValue }
  | { kind: "access"; entryId: string; state: "allowed" | "denied" }
  | { kind: "owner"; entryId: string }
  | { kind: "zone"; zoneId: string };
export type StoryLensExpression =
  | { kind: "all"; items: StoryLensExpression[] }
  | { kind: "any"; items: StoryLensExpression[] }
  | { kind: "not"; item: StoryLensExpression }
  | { kind: "predicate"; predicate: StoryLensPredicate };
export type StoryLens = { id: string; name: string; color: string; expression: StoryLensExpression; favorite?: boolean };

export type StoryTextPatch = {
  id: string;
  target: StoryObjectRef;
  title?: string;
  description?: string;
  properties?: Record<string, StoryPropertyValue>;
  metadata?: Partial<Pick<StoryObjectMetadata, "narrativeLabel" | "narrativeDescription" | "owners" | "tags" | "access">>;
};
type StoryStep = { id: string; name: string; description?: string; patches: StoryTextPatch[] };
export type StoryScenario = { id: string; name: string; description?: string; patches: StoryTextPatch[]; steps: StoryStep[] };
export type StoryViewContext = { scenarioId?: string; stepId?: string; lensId?: string };

type StoryRelationKind = "owns" | "knows" | "visits" | "guards" | "uses" | "contains" | "custom";
export type StoryRelation = { id: string; from: StoryObjectRef | { entryId: string }; to: StoryObjectRef | { entryId: string }; kind: StoryRelationKind; label?: string; description?: string; source?: string };
type StoryIntentionKind = "reachability" | "must-pass" | "avoid-zone" | "access-rule" | "custom";
type StoryIntention = { id: string; authorId?: string; subject: StoryObjectRef; kind: StoryIntentionKind; text: string; status: "draft" | "accepted" | "rejected"; target?: StoryObjectRef; through?: StoryObjectRef[]; avoidZoneId?: string; accessEntryId?: string };
export type StoryEvidence = { id: string; text: string; refs: StoryObjectRef[]; source: "local"; locator?: string };

export type StoryDocumentReference =
  | { kind: "object"; ref: StoryObjectRef }
  | { kind: "scenario"; scenarioId: string };
export type StoryDocument = { id: string; title: string; bodyMarkdown: string; references: StoryDocumentReference[] };

export type StoryData = {
  version: 1;
  world: StoryWorldEntry[];
  propertyDefinitions: StoryPropertyDefinition[];
  objects: StoryObject[];
  memberships: StoryMembership[];
  /** Legacy object-group boundary; normalized StoryData keeps this empty. */
  groups: StoryGroup[];
  zones: StoryZone[];
  lenses: StoryLens[];
  scenarios: StoryScenario[];
  relations: StoryRelation[];
  intentions: StoryIntention[];
  evidence: StoryEvidence[];
  routes: StoryRouteRecord[];
  documents: StoryDocument[];
};

export type StoryMetadataBulkAction = "add" | "remove" | "replace";
export type StoryMetadataBulkCommand = { kind: "bulk-metadata"; refs: StoryObjectRef[]; action: StoryMetadataBulkAction; metadata: Partial<StoryObjectMetadata> };

export type StoryDiagnostic = { code: string; message: string; refs?: StoryObjectRef[]; ids?: string[] };
export type StoryCommandResult = { story: StoryData; changed: boolean; diagnostics: StoryDiagnostic[] };

function storyRefKeyPart(value: string) {
  return value.replaceAll("%", "%25").replaceAll(":", "%3A");
}

/**
 * Builds an injective key without treating punctuation inside user/imported
 * identifiers as structure. Common UUID-like ids retain their historical
 * representation, while reserved separators are escaped.
 */
export function storyRefKey(ref: StoryObjectRef) {
  return `${ref.kind}:${storyRefKeyPart(ref.scopeId ?? "")}:${storyRefKeyPart(ref.id)}`;
}
export function sameStoryRef(first: StoryObjectRef, second: StoryObjectRef) { return storyRefKey(first) === storyRefKey(second); }
/** Room ids are only stable within their owning construction/place. */
export function canonicalStoryRef(ref: StoryObjectRef, ownerScopeId?: string): StoryObjectRef {
  return ref.kind === "room" && !ref.scopeId && ownerScopeId ? { ...ref, scopeId: ownerScopeId } : ref;
}
export function emptyStoryData(): StoryData {
  return { version: 1, world: [], memberships: [], propertyDefinitions: [], objects: [], groups: [], zones: [], lenses: [], scenarios: [], relations: [], intentions: [], evidence: [], routes: [], documents: [] };
}
