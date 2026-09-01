import type { EditorLocale } from "../i18n/workbench-copy";
import type { ToolboxState } from "../toolbox/toolbox-state";
import { constructionCategory } from "../toolbox/toolbox-model";
import { constructionClearCategories, type ConstructionClearCategory } from "../state/clear-construction-layer";
import type { DrawingNoticeModel } from "./drawing-notice";

type ConstructionCategory = Exclude<ConstructionClearCategory, "all" | "openings">;

const copy: Record<EditorLocale, {
  categories: Record<ConstructionCategory, { label: string; scope: string }>;
  question(place: string, scope: string): string;
}> = {
  pl: {
    categories: {
      walls: { label: "Ściany", scope: "ściany wewnętrzne, wynikające z nich pomieszczenia oraz niezablokowane drzwi, okna, bramy i przejścia osadzone w usuniętych ścianach" },
      "vertical-connections": { label: "Schody i windy", scope: "schody i windy" },
      platforms: { label: "Podesty i balkony", scope: "podesty, tarasy, balkony, ganki, antresole i sceny" },
      doors: { label: "Drzwi", scope: "drzwi" }, windows: { label: "Okna", scope: "okna" }, gates: { label: "Bramy", scope: "bramy" }, passages: { label: "Przejścia", scope: "przejścia" },
    },
    question: (place, scope) => `Wyczyścić na arkuszu „${place}” tylko: ${scope}? Zablokowane elementy, obrys zewnętrzny i pozostałe kategorie zostaną zachowane.`,
  },
  en: {
    categories: {
      walls: { label: "Walls", scope: "interior walls, their derived rooms, and unlocked doors, windows, gates and passages attached to removed walls" },
      "vertical-connections": { label: "Stairs & lifts", scope: "stairs and lifts" },
      platforms: { label: "Platforms & balconies", scope: "platforms, terraces, balconies, porches, mezzanines and stages" },
      doors: { label: "Doors", scope: "doors" }, windows: { label: "Windows", scope: "windows" }, gates: { label: "Gates", scope: "gates" }, passages: { label: "Passages", scope: "passages" },
    },
    question: (place, scope) => `Clear only ${scope} on “${place}”? Locked items, the outer boundary and the other categories will remain.`,
  },
};

export type ConstructionClearNoticeInput = {
  locale: EditorLocale;
  place: string;
  category: ConstructionCategory;
  confirmLabel: string;
  cancelLabel: string;
  onCategoryChange(category: ConstructionCategory): void;
  onConfirm(): void;
  onCancel(): void;
};

export function constructionClearCategoryForToolbox(toolbox: ToolboxState): ConstructionCategory | "all" {
  const layer = toolbox.activeLayerId;
  if (layer !== "construction" && layer !== "openings") return "all";
  const subject = toolbox.byLayer[layer].subjectId.split(".").at(-1);
  if (layer === "openings" && ["door", "window", "gate", "passage"].includes(subject ?? "")) return `${subject}s` as ConstructionCategory;
  return constructionCategory(layer, toolbox.byLayer[layer].subjectId).id as ConstructionCategory;
}

/** Builds the compact category picker used by the existing warning notice. */
export function constructionClearNotice(input: ConstructionClearNoticeInput): DrawingNoticeModel {
  const localized = copy[input.locale];
  const selected = localized.categories[input.category];
  return {
    message: localized.question(input.place, selected.scope),
    tone: "warning",
    actions: [
      ...constructionClearCategories.map((category) => ({
        id: `clear-category-${category}`,
        label: localized.categories[category].label,
        primary: category === input.category,
        onClick: () => input.onCategoryChange(category),
      })),
      { id: "confirm-clear-construction", label: input.confirmLabel, destructive: true, onClick: input.onConfirm },
      { id: "cancel-clear-construction", label: input.cancelLabel, onClick: input.onCancel },
    ],
  };
}
