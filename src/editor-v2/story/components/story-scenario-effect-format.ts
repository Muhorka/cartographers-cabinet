import type { EditorProject } from "../../model/project-model";
import { formatStoryFieldValue, storyFieldLabel, storyFieldObjectName } from "../field-format";
import type { ScenarioEffect, ScenarioEffectField } from "../scenario-effects";
import type { ScenarioCopy } from "../i18n/scenario-copy";

export type FormattedScenarioEffectField = { label: string; before: string; after: string; authored?: string; changed: boolean };

function formatField(project: EditorProject, field: ScenarioEffectField, copy: ScenarioCopy, locale: "pl" | "en"): FormattedScenarioEffectField {
  return { label: storyFieldLabel(project, field.key, locale), before: formatStoryFieldValue(project, field.before, field.key, locale, copy), after: formatStoryFieldValue(project, field.after, field.key, locale, copy), changed: field.changed, ...(field.authored !== undefined ? { authored: formatStoryFieldValue(project, field.authored, field.key, locale, copy) } : {}) };
}

export function formatScenarioEffect(project: EditorProject, effect: ScenarioEffect, copy: ScenarioCopy, locale: "pl" | "en") {
  return { ...effect, objectName: effect.missing ? effect.objectName : storyFieldObjectName(project, effect.target, {}, locale), fields: effect.fields.map((field) => formatField(project, field, copy, locale)) };
}
