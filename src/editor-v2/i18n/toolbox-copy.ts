import type { InstrumentId, SubjectGroupId, WorkLayerId } from "../toolbox/toolbox-model";

type Locale = "en" | "pl";

export type ToolboxCopy = {
  ariaLabel: string;
  chooseLayer: string;
  chooseSubject: string;
  chooseInstrument: string;
  noteGestureHint: string;
  layers: Record<WorkLayerId, string>;
  constructionGroups: Record<SubjectGroupId, string>;
  subjects: Record<string, string>;
  instruments: Record<InstrumentId, string>;
  editBoundary: string;
  stopEditingBoundary: string;
  editBoundaryFor(name: string): string;
  stopEditingBoundaryFor(name: string): string;
  cutout: string;
  addOutline: string;
  undo: string;
  redo: string;
  clearLayer: string;
  collapse: string;
  expand: string;
  moveCase: string;
  sketchVisibility: string;
  sketchOpacity: string;
  eraserSize: string;
  closeGaps: string;
  closeGapsStrength: string;
  pencilSmoothing: string;
  roadWidth: string;
  ribbonWidth: string;
};

const subjects = {
  en: {
    "road.paved": "Paved road", "road.dirt": "Dirt road", "road.path": "Path / alley", "road.sidewalk": "Sidewalk",
    "terrain.water": "Water", "terrain.river": "River", "terrain.stream": "Stream", "terrain.meadow": "Meadow", "terrain.field": "Field", "terrain.forest": "Forest", "terrain.rocks": "Rocks", "terrain.custom": "Other terrain",
    "boundary.place": "Place boundary", "boundary.zone": "Area boundary", "boundary.custom": "Other boundary",
    "building.building": "Building", "building.tower": "Tower", "building.ruin": "Ruins", "building.bridge": "Bridge", "building.custom": "Other structure",
    "construction.wall": "Structural wall", "construction.partition": "Partition wall",
    "platform.platform": "Platform", "platform.porch": "Porch", "platform.terrace": "Terrace", "platform.balcony": "Balcony", "platform.mezzanine": "Mezzanine", "platform.stage": "Stage", "platform.custom": "Other platform",
    "opening.door": "Door", "opening.window": "Window", "opening.gate": "Gate", "opening.passage": "Passage", "opening.stairs": "Stairs", "opening.elevator": "Lift",
    "equipment.furniture": "Furniture", "equipment.object": "Object", "equipment.vegetation": "Vegetation", "equipment.monument": "Monument", "equipment.small-architecture": "Small architecture", "equipment.bridge": "Bridge", "equipment.marker": "Marker", "equipment.custom": "Other object",
    "sketch.stroke": "Concept sketch", "sketch.note": "Note",
  },
  pl: {
    "road.paved": "Droga utwardzona", "road.dirt": "Droga polna", "road.path": "Ścieżka / alejka", "road.sidewalk": "Chodnik",
    "terrain.water": "Woda", "terrain.river": "Rzeka", "terrain.stream": "Strumień", "terrain.meadow": "Łąka", "terrain.field": "Pole", "terrain.forest": "Las", "terrain.rocks": "Skały", "terrain.custom": "Inny teren",
    "boundary.place": "Granica lokalizacji", "boundary.zone": "Granica obszaru", "boundary.custom": "Inna granica",
    "building.building": "Budynek", "building.tower": "Wieża", "building.ruin": "Ruiny", "building.bridge": "Most", "building.custom": "Inna budowla",
    "construction.wall": "Ściana konstrukcyjna", "construction.partition": "Ściana działowa",
    "platform.platform": "Podest", "platform.porch": "Ganek", "platform.terrace": "Taras", "platform.balcony": "Balkon", "platform.mezzanine": "Antresola", "platform.stage": "Scena", "platform.custom": "Inny podest",
    "opening.door": "Drzwi", "opening.window": "Okno", "opening.gate": "Brama", "opening.passage": "Przejście", "opening.stairs": "Schody", "opening.elevator": "Winda",
    "equipment.furniture": "Mebel", "equipment.object": "Przedmiot", "equipment.vegetation": "Roślinność", "equipment.monument": "Pomnik", "equipment.small-architecture": "Mała architektura", "equipment.bridge": "Most", "equipment.marker": "Znacznik", "equipment.custom": "Inny obiekt",
    "sketch.stroke": "Szkic koncepcyjny", "sketch.note": "Notatka",
  },
} satisfies Record<Locale, Record<string, string>>;

export const toolboxCopy: Record<Locale, ToolboxCopy> = {
  en: {
    ariaLabel: "Cartographer's tool case", chooseLayer: "Work layer", chooseSubject: "What are you making?", chooseInstrument: "Instruments", noteGestureHint: "Drag to draw the text box",
    layers: { terrain: "Terrain", roads: "Roads", boundaries: "Boundaries", buildings: "Buildings", construction: "Construction", openings: "Openings", equipment: "Objects", sketch: "Sketch" },
    roadWidth: "Road width (m)", ribbonWidth: "Watercourse width (m)",
    constructionGroups: { walls: "Walls", openings: "Openings", "vertical-connections": "Stairs & lifts", platforms: "Platforms & balconies" },
    subjects: subjects.en,
    instruments: { select: "Select & edit", marquee: "Select an area", place: "Place", pencil: "Pencil", pen: "Bézier pen", line: "Straight line", "wall-run": "Wall run", rectangle: "Rectangle", circle: "Circle", ellipse: "Ellipse", arc: "Three-point arc", polygon: "Polygon", point: "Point", note: "Write note", erase: "Eraser" },
    editBoundary: "Edit boundary", stopEditingBoundary: "Finish boundary", editBoundaryFor: (name) => `Edit current map boundary: ${name}`, stopEditingBoundaryFor: (name) => `Finish editing current map boundary: ${name}`, cutout: "Cut a void", addOutline: "Add to outline", undo: "Undo", redo: "Redo", clearLayer: "Clear current layer", collapse: "Fold tool case", expand: "Open tool case", moveCase: "Move tool case", sketchVisibility: "Show sketch layer", sketchOpacity: "Sketch opacity", eraserSize: "Eraser size", closeGaps: "Close gaps", closeGapsStrength: "Gap and tail tolerance", pencilSmoothing: "Pencil smoothing",
  },
  pl: {
    ariaLabel: "Piórnik kartografa", chooseLayer: "Warstwa pracy", chooseSubject: "Co tworzysz?", chooseInstrument: "Przybory", noteGestureHint: "Przeciągnij, aby wyznaczyć pole tekstowe",
    layers: { terrain: "Teren", roads: "Drogi", boundaries: "Granice", buildings: "Zabudowa", construction: "Konstrukcja", openings: "Otwory", equipment: "Obiekty", sketch: "Szkic" },
    roadWidth: "Szerokość drogi (m)", ribbonWidth: "Szerokość cieku (m)",
    constructionGroups: { walls: "Ściany", openings: "Otwory", "vertical-connections": "Schody i windy", platforms: "Podesty i balkony" },
    subjects: subjects.pl,
    instruments: { select: "Zaznacz i edytuj", marquee: "Zaznacz obszarem", place: "Wstaw", pencil: "Ołówek", pen: "Pióro Béziera", line: "Prosta", "wall-run": "Ciąg ścian", rectangle: "Prostokąt", circle: "Okrąg", ellipse: "Elipsa", arc: "Łuk trzypunktowy", polygon: "Wielokąt", point: "Punkt", note: "Napisz notatkę", erase: "Gumka" },
    editBoundary: "Edytuj obrys", stopEditingBoundary: "Zakończ edycję obrysu", editBoundaryFor: (name) => `Edytuj obrys bieżącej mapy: ${name}`, stopEditingBoundaryFor: (name) => `Zakończ edycję obrysu bieżącej mapy: ${name}`, cutout: "Wytnij pustkę", addOutline: "Dodaj do obrysu", undo: "Cofnij", redo: "Ponów", clearLayer: "Wyczyść bieżącą warstwę", collapse: "Zwiń piórnik", expand: "Rozwiń piórnik", moveCase: "Przesuń piórnik", sketchVisibility: "Pokaż warstwę szkicu", sketchOpacity: "Przezroczystość szkicu", eraserSize: "Rozmiar gumki", closeGaps: "Domykaj szczeliny", closeGapsStrength: "Tolerancja szczelin i ogonków", pencilSmoothing: "Wygładzenie ołówka",
  },
};
