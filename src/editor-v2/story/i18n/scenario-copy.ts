import type { StoryLocale } from "../components/story-types";

export type ScenarioCopy = {
  title: string;
  scenarioDetails: string;
  stepDetails: string;
  selectStepHint: string;
  scenarioName: string;
  scenarioDescription: string;
  descriptionHint: string;
  autosave: string;
  wholeScenario: string;
  steps: string;
  addStep: string;
  stepName: string;
  stepDescription: string;
  moveUp: string;
  moveDown: string;
  removeStep: string;
  effects: string;
  noEffects: string;
  noteOnly: string;
  addSelection: (count: number) => string;
  noSelection: string;
  targetMissing: string;
  locked: string;
  inspect: string;
  edit: string;
  removeEffect: string;
  previous: string;
  current: string;
  authored: string;
  emptyValue: string;
  emptyText: string;
  unsetValue: string;
  unchanged: string;
  scenario: string;
  step: string;
  noStep: string;
};

export const scenarioCopy: Record<StoryLocale, ScenarioCopy> = {
  pl: {
    title: "Warsztat scenariusza",
    scenarioDetails: "Szczegóły scenariusza",
    stepDetails: "Szczegóły aktywnego kroku",
    selectStepHint: "Wybierz krok powyżej, aby zmienić jego nazwę lub opis.",
    scenarioName: "Nazwa scenariusza",
    scenarioDescription: "Opis scenariusza",
    descriptionHint: "Zbuduj sytuację krok po kroku: nazwij ją, dodaj etapy i określ, co zmienia się w każdym z nich. Zmiany scenariusza zapisują się automatycznie.",
    autosave: "Zmiany scenariusza zapisują się automatycznie.",
    wholeScenario: "Cały scenariusz",
    steps: "Kroki",
    addStep: "Dodaj krok",
    stepName: "Nazwa kroku",
    stepDescription: "Opis kroku",
    moveUp: "Przenieś wyżej",
    moveDown: "Przenieś niżej",
    removeStep: "Usuń krok",
    effects: "Skutki scenariusza",
    noEffects: "Brak zapisanych skutków w tym zakresie.",
    noteOnly: "To na razie notatka. Skutek dodasz z zaznaczenia obiektu na mapie.",
    addSelection: (count) => `Dodaj skutek dla zaznaczenia (${count})`,
    noSelection: "Zaznacz obiekt na mapie, aby dodać skutek.",
    targetMissing: "Obiekt nie jest już dostępny w projekcie; skutek zachowano.",
    locked: "Obiekt zablokowany",
    inspect: "Pokaż obiekt",
    edit: "Edytuj skutek",
    removeEffect: "Usuń tylko ten skutek",
    previous: "Poprzednio",
    current: "Teraz",
    authored: "Wpisano",
    emptyValue: "Brak (pusta lista)",
    emptyText: "Puste",
    unsetValue: "Dziedziczenie / brak wartości",
    unchanged: "bez zmiany",
    scenario: "Scenariusz",
    step: "Krok",
    noStep: "Bez kroku",
  },
  en: {
    title: "Scenario workshop",
    scenarioDetails: "Scenario details",
    stepDetails: "Active step details",
    selectStepHint: "Choose a step above to edit its name or description.",
    scenarioName: "Scenario name",
    scenarioDescription: "Scenario description",
    descriptionHint: "Build a situation step by step: name it, add stages, and define what changes in each one. Scenario changes are saved automatically.",
    autosave: "Scenario changes save automatically.",
    wholeScenario: "Whole scenario",
    steps: "Steps",
    addStep: "Add step",
    stepName: "Step name",
    stepDescription: "Step description",
    moveUp: "Move up",
    moveDown: "Move down",
    removeStep: "Remove step",
    effects: "Scenario effects",
    noEffects: "No saved effects in this context.",
    noteOnly: "This is currently a note. Add an effect by selecting a map object.",
    addSelection: (count) => `Add effect for selection (${count})`,
    noSelection: "Select a map object to add an effect.",
    targetMissing: "The object is no longer available in the project; the effect was kept.",
    locked: "Object is locked",
    inspect: "Show object",
    edit: "Edit effect",
    removeEffect: "Remove only this effect",
    previous: "Before",
    current: "Now",
    authored: "Authored",
    emptyValue: "None (empty list)",
    emptyText: "Empty",
    unsetValue: "Inherited / not set",
    unchanged: "unchanged",
    scenario: "Scenario",
    step: "Step",
    noStep: "No step",
  },
};
