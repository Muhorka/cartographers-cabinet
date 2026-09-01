import { defaultStoryAccessPolicy, type StoryAccessPolicy } from "./types";
import { mergeStoryMetadata } from "./operations";

/** Edit only the requested policy fields, retaining each target's other rules. */
export function editedAccessFields(current: StoryAccessPolicy, change: StoryAccessPolicy, fields: Array<keyof StoryAccessPolicy>, action: "add" | "remove" | "replace"): StoryAccessPolicy {
  const patch = { ...(action === "replace" ? current : defaultStoryAccessPolicy()), ...Object.fromEntries(fields.map((field) => [field, change[field]])) };
  return mergeStoryMetadata({ access: current }, { access: patch }, action).access ?? current;
}
