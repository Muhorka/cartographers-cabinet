import type { StoryRecord } from "./story-types";

function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

/** Applies only fields changed by an editor rendered from `before` to a live record. */
function mergeChangedValue(current: unknown, before: unknown, edited: unknown): unknown {
  if (Object.is(before, edited)) return current;
  if (!record(before) || !record(edited) || !record(current)) return edited;
  const result = { ...current };
  for (const key of new Set([...Object.keys(before), ...Object.keys(edited)])) {
    if (!Object.hasOwn(edited, key)) delete result[key];
    else if (!Object.hasOwn(before, key)) result[key] = edited[key];
    else result[key] = mergeChangedValue(current[key], before[key], edited[key]);
  }
  return result;
}

export function mergeStoryRecordUpdate(current: StoryRecord, before: StoryRecord, edited: StoryRecord): StoryRecord {
  return mergeChangedValue(current, before, edited) as StoryRecord;
}
