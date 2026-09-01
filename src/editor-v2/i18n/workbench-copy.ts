import type { HierarchyNavigatorCopy } from "../components/hierarchy-navigator";
import type { MapSheetCopy } from "../components/map-sheet";
import type { SheetObjectListCopy } from "../components/sheet-object-list";
import type { StartingScale } from "../model/starter-project";

export type EditorLocale = "pl" | "en";

export type WorkbenchCopy = {
  title: string;
  strapline: string;
  project: string;
  projects: string;
  atlas: string;
  projectTree: string;
  drawing: string;
  story: string;
  saved: string;
  saving: string;
  saveFailed: string;
  retrySave: string;
  inspector: string;
  inspectorContext: { ariaLabel: string; buildingLevel(building: string, level: string): string; editLevel: string };
  openPlace: string;
  selection: string;
  noSelection: string;
  selectedCount(count: number): string;
  name: string;
  description: string;
  tags: string;
  tagsHint: string;
  belongsTo: string;
  type: string;
  width: string;
  fillColor: string;
  fillOpacity: string;
  markerSize: string;
  noteText: string;
  fontSize: string;
  inheritAppearance: string;
  objectList: SheetObjectListCopy;
  room: string;
  wall: string;
  opening: string;
  stairs: string;
  elevator: string;
  connectsLevels: string;
  sameLevelRise: string;
  stairStyle: string;
  direction: string;
  stairStyles: Record<"straight" | "l" | "u" | "spiral" | "curved", string>;
  transitionCreation: { title: string; chooseLevels: string; noOtherLevels: string; create: string };
  object: string;
  wallTypes: Record<"boundary" | "wall" | "partition", string>;
  openingTypes: Record<"door" | "window" | "gate" | "passage", string>;
  roomDerived: string;
  delete: string;
  close: string;
  newProject: string;
  duplicateProject: string;
  deleteProject: string;
  renameProject: string;
  exportProject: string;
  importProject: string;
  saveName: string;
  openProject: string;
  projectName: string;
  startingScale: string;
  startingScales: Record<StartingScale, string>;
  create: string;
  language: string;
  addContaining: string;
  deletePlaceQuestion: string;
  deletePlaceWithContents: string;
  clearLayerQuestion(layer: string, place: string): string;
  clearConstructionQuestion(place: string): string;
  confirmClearLayer: string;
  addLevel: string;
  independentMap: string;
  selectionActions: { title: string; duplicate: string; rotateLeft: string; rotateRight: string; mirrorHorizontal: string; mirrorVertical: string; merge: string; mergeRooms: string };
  overlapDecision: { arranging: string; mustResolve: string; outerOnly: string; keepPartitions: string; continueArranging: string };
  hierarchy: HierarchyNavigatorCopy;
  map: MapSheetCopy;
  drawingStatus: {
    unfinished: string;
    unfinishedWithNavigation: string;
    continueDrawing: string;
    autoClose: string;
    autoClosePreview: string;
    applyAutoClose: string;
    cancelAutoClose: string;
    saveAsSketch: string;
    saveAsPath: string;
    discard: string;
    clipQuestion: string;
    clip: string;
    cancel: string;
    deleteQuestion: string;
    confirmDelete: string;
    blocked: Record<"unavailable-here" | "outside-outline" | "geometry-conflict" | "no-wall" | "stairs-need-room" | "bezier-pending" | "road-obstacle" | "transaction-failed", string>;
  };
  editingStatus: {
    reviewQuestion: string;
    apply: string;
    cancel: string;
    blocked: Record<"locked-outline" | "outside-outline" | "collision" | "unsupported" | "not-found" | "road-obstacle" | "transaction-failed" | "road-not-found" | "road-different-owner" | "road-too-far" | "road-already-joined" | "road-unsupported" | "road-routing", string>;
  };
};

const kindLabels = {
  pl: { world: "świat", location: "lokalizacja", building: "budynek", level: "kondygnacja", room: "pomieszczenie", object: "obiekt", "standalone-room": "samodzielne pomieszczenie", custom: "własny poziom" },
  en: { world: "world", location: "place", building: "building", level: "level", room: "room", object: "object", "standalone-room": "standalone room", custom: "custom scale" },
} as const;

export const workbenchCopy: Record<EditorLocale, WorkbenchCopy> = {
  pl: {
    title: "Gabinet kartografa", strapline: "Rysuj miejsca, które pamiętają, kto może wejść, jak łączą się wnętrza i co zmienia fabuła.", project: "Projekt", projects: "Biblioteka", atlas: "Atlas", projectTree: "Drzewo projektu", drawing: "Kreślenie", story: "Opowieść", saved: "zapisano atramentem", saving: "zapisywanie…", saveFailed: "Nie udało się zapisać. Nie zamykaj strony.", retrySave: "Ponów zapis", inspector: "Inspektor", inspectorContext: { ariaLabel: "Kontekst inspektora", buildingLevel: (building, level) => `Edytujesz budynek „${building}”. Na mapie wyświetla się jego kondygnacja „${level}”.`, editLevel: "Edytuj kondygnację" }, openPlace: "Właściwości otwartej lokalizacji", selection: "Właściwości zaznaczenia", noSelection: "Wybierz lokalizację lub obiekt na arkuszu.", selectedCount: (count) => `Zaznaczono: ${count}`, name: "Nazwa", description: "Opis", tags: "Hasła", tagsHint: "np. zniszczony, murowany, przeciekający dach", belongsTo: "Przynależy do", type: "Rodzaj", width: "Szerokość", fillColor: "Kolor wypełnienia", fillOpacity: "Przezroczystość", markerSize: "Wielkość znacznika", noteText: "Treść notatki", fontSize: "Rozmiar pisma", inheritAppearance: "Użyj koloru kondygnacji", room: "Pomieszczenie", wall: "Ściana", opening: "Drzwi lub okno", stairs: "Schody", elevator: "Winda", connectsLevels: "Łączy kondygnacje", sameLevelRise: "Podwyższenie na tej kondygnacji", stairStyle: "Kształt schodów", direction: "Kierunek", stairStyles: { straight: "proste", l: "w kształcie L", u: "w kształcie U", spiral: "kręcone", curved: "łukowe" }, transitionCreation: { title: "Dokąd prowadzi przejście?", chooseLevels: "Wybierz dokładnie kondygnacje połączone tymi schodami lub windą.", noOtherLevels: "Ten budynek nie ma jeszcze innej kondygnacji. Możesz utworzyć podwyższenie na tym poziomie albo najpierw dodać kondygnację.", create: "Utwórz przejście" }, object: "Obiekt", wallTypes: { boundary: "ściana zewnętrzna", wall: "ściana", partition: "ściana działowa" }, openingTypes: { door: "drzwi", window: "okno", gate: "brama", passage: "przejście" }, roomDerived: "Pomieszczenie powstaje z zamkniętych ścian. Zmień lub usuń ścianę, aby zmienić jego kształt.", delete: "Usuń", close: "Zamknij", newProject: "Nowy projekt", duplicateProject: "Powiel projekt", deleteProject: "Usuń projekt", openProject: "Otwórz", projectName: "Nazwa projektu", startingScale: "Zacznij od", startingScales: { world: "Świat", location: "Lokalizacja", building: "Budynek", level: "Kondygnacja", room: "Pomieszczenie" }, create: "Utwórz", language: "English", addContaining: "Dodaj poziom", deletePlaceQuestion: "Ten poziom mapy zawiera dalsze mapy i obiekty. Usunąć całość?", deletePlaceWithContents: "Usuń wraz z zawartością", clearLayerQuestion: (layer, place) => `Usunąć wszystkie elementy warstwy „${layer}” z arkusza „${place}”?`, confirmClearLayer: "Wyczyść warstwę", addLevel: "Dodaj kondygnację", independentMap: "Samodzielny plan", selectionActions: { title: "Operacje na zaznaczeniu", duplicate: "Powiel", rotateLeft: "Obróć w lewo", rotateRight: "Obróć w prawo", mirrorHorizontal: "Odbij lewo–prawo", mirrorVertical: "Odbij góra–dół", merge: "Scal obrysy", mergeRooms: "Połącz pomieszczenia" },
    renameProject: "Zmień nazwę", exportProject: "Eksportuj", importProject: "Importuj jako nowy projekt", saveName: "Zapisz nazwę",
    overlapDecision: { arranging: "Obrysy budynków nakładają się. Możesz spokojnie dopasować ich położenie albo scalić je już teraz.", mustResolve: "Przed opuszczeniem tego arkusza zdecyduj, jak połączyć nakładające się bryły.", outerOnly: "Scal — tylko obrys zewnętrzny", keepPartitions: "Scal — zachowaj ściany działowe", continueArranging: "Wróć do układania" },
    objectList: { title: "Obiekty na tym arkuszu", places: "Lokalizacje i poziomy", terrain: "Teren", roads: "Drogi", equipment: "Obiekty", surfaces: "Podesty i balkony", sketch: "Szkice i notatki", rooms: "Pomieszczenia", walls: "Ściany", features: "Elementy konstrukcji", empty: "Ten arkusz nie zawiera jeszcze obiektów.", noResults: "Nie znaleziono pasujących obiektów.", search: "Szukaj po nazwie, opisie lub haśle…", show: "Pokaż", hide: "Ukryj", lock: "Zablokuj", unlock: "Odblokuj", delete: "Usuń", wallName: (index) => `Ściana ${index}`, openingName: (kind, index) => `${({ door: "Drzwi", window: "Okno", gate: "Brama", passage: "Przejście" })[kind]} ${index}`, stairsName: (index) => `Schody ${index}`, elevatorName: (index) => `Winda ${index}` },
    hierarchy: { ariaLabel: "Drzewo projektu", openPlace: "Otwórz poziom mapy", expandPlace: "Rozwiń", collapsePlace: "Zwiń", addContainingPlace: "Dodaj poziom", addLevel: "Dodaj nową kondygnację", reorderLevel: "Przeciągnij, aby ustawić kolejność kondygnacji", containingKind: "Jaki poziom dodać?", containingName: "Nazwa (opcjonalnie)", createContaining: "Dodaj poziom", cancel: "Anuluj", noPlaces: "Projekt nie zawiera jeszcze żadnych lokalizacji ani planów.", kindLabels: kindLabels.pl, surface: "Powierzchnia konstrukcyjna" },
    clearConstructionQuestion: (place) => `Wyczyścić konstrukcję na arkuszu „${place}”? Zostaną usunięte ściany wewnętrzne i wynikające z nich pomieszczenia, podesty, tarasy, balkony, antresole, drzwi, okna, bramy, przejścia oraz schody i windy. Zablokowane elementy, obrys zewnętrzny i pustki pozostaną bez zmian.`,
    map: { ariaLabel: "Arkusz kartograficzny", empty: "Ten arkusz jest jeszcze pusty", compass: "Obróć mapę", zoomIn: "Przybliż mapę", zoomOut: "Oddal mapę", resetView: "Wyzeruj widok", back: "Wróć do szerszej mapy", northMark: "P", measurements: { title: "Widok i miary", grid: "Siatka pomocnicza", axes: "Pokaż osie", opacity: "Przezroczystość", spacing: "Odstęp", cell: "1 kratka", snap: "Przyciągaj do siatki", units: "Jednostki", metric: "metry", imperial: "stopy", roomAreas: "Powierzchnie obiektów" }, openingLabel: (kind) => ({ door: "Drzwi", window: "Okno", gate: "Brama", passage: "Przejście" })[kind], transitionLabel: (_id, kind) => kind === "elevator" ? "Winda" : "Schody" },
    drawingStatus: {
      unfinished: "Rysunek nie zamknął jeszcze obiektu. Możesz rysować dalej albo zdecydować, co zachować.",
      unfinishedWithNavigation: "Najpierw zdecyduj, co zrobić z niedokończonym rysunkiem.",
      continueDrawing: "Rysuj dalej",
      autoClose: "Domknij automatycznie i utwórz obiekt",
      autoClosePreview: "Tak program domknie rysunek, korzystając w razie potrzeby z istniejącego obrysu. Utworzyć obiekt?",
      applyAutoClose: "Domknij i utwórz obiekt",
      cancelAutoClose: "Wróć",
      saveAsSketch: "Zachowaj jako szkic",
      saveAsPath: "Zachowaj jako obiekt",
      discard: "Odrzuć",
      clipQuestion: "Rysunek wychodzi poza dozwolony obrys.",
      clip: "Przytnij do obrysu",
      cancel: "Anuluj",
      deleteQuestion: "Gumka trafiła w element zawierający dalsze poziomy. Usunąć je razem?",
      confirmDelete: "Usuń wraz z zawartością",
      blocked: {
        "unavailable-here": "Tego rodzaju obiektu nie można tworzyć na otwartym poziomie mapy.",
        "outside-outline": "Rysunek nie zajmuje żadnej części dozwolonego obszaru.",
        "geometry-conflict": "Ta zmiana tworzy konflikt geometrii i nie została zastosowana.",
        "no-wall": "W tym miejscu nie ma ściany, do której można przypisać ten element.",
        "stairs-need-room": "Schody muszą w całości mieścić się w jednym pomieszczeniu.",
        "road-obstacle": "Nie znalazłem przejazdu o tej szerokości. Przesuń początek lub koniec drogi poza budynek albo wybierz węższą drogę.",
        "transaction-failed": "Zmiany nie udało się zapisać. Dotychczasowy plan pozostał bez zmian.",
        "bezier-pending": "Prawdziwe pióro Béziera jest jeszcze podpinane do nowego rdzenia — ten gest nie został zapisany jako zwykła kreska.",
      },
    },
    editingStatus: {
      reviewQuestion: "Ta zmiana wpłynie na układ pomieszczeń. Zastosować ją?",
      apply: "Zastosuj zmianę",
      cancel: "Anuluj",
      blocked: {
        "locked-outline": "Obrys otwartego poziomu mapy jest zablokowany. Włącz jego edycję, aby go zmieniać.",
        "outside-outline": "Element musi pozostać wewnątrz dozwolonego obrysu.",
        collision: "W tym miejscu element kolidowałby z inną częścią planu.",
        unsupported: "Tego elementu nie można jeszcze przesunąć w ten sposób.",
        "not-found": "Nie udało się odnaleźć zaznaczonego elementu.", "road-obstacle": "Nie można połączyć dróg, ponieważ trasa koliduje z przeszkodą.", "transaction-failed": "Zmiany nie udało się zapisać. Dotychczasowy plan pozostał bez zmian.", "road-not-found": "Nie znaleziono jednej z wybranych dróg.", "road-different-owner": "Wybierz drogi należące do tego samego arkusza.", "road-too-far": "Końce wybranych dróg są zbyt daleko od siebie, a ich osie się nie krzyżują.", "road-already-joined": "Te drogi mają już zapisane skrzyżowanie.", "road-unsupported": "Można łączyć tylko dwie otwarte drogi o edytowalnym przebiegu.", "road-routing": "Nie można połączyć dróg, ponieważ nowy przebieg koliduje z przeszkodą.",
      },
    },
  },
  en: {
    title: "The Cartographer's Cabinet", strapline: "Draw places that remember who may enter, how rooms connect, and what a story changes.", project: "Project", projects: "Library", atlas: "Atlas", projectTree: "Project tree", drawing: "Drawing", story: "Story", saved: "saved in ink", saving: "saving…", saveFailed: "Save failed. Keep this page open.", retrySave: "Retry saving", inspector: "Inspector", inspectorContext: { ariaLabel: "Inspector context", buildingLevel: (building, level) => `You are editing the building “${building}”. Its level “${level}” is shown on the map.`, editLevel: "Edit level" }, openPlace: "Open place properties", selection: "Selection properties", noSelection: "Choose a place or object on the sheet.", selectedCount: (count) => `Selected: ${count}`, name: "Name", description: "Description", tags: "Tags", tagsHint: "e.g. ruined, masonry, leaking roof", belongsTo: "Belongs to", type: "Type", width: "Width", room: "Room", wall: "Wall", opening: "Door or window", stairs: "Stairs", elevator: "Lift", connectsLevels: "Connects levels", sameLevelRise: "Rise on this level", stairStyle: "Stair shape", direction: "Direction", stairStyles: { straight: "straight", l: "L-shaped", u: "U-shaped", spiral: "spiral", curved: "curved" }, transitionCreation: { title: "Where does this connection lead?", chooseLevels: "Choose the exact levels connected by these stairs or this lift.", noOtherLevels: "This building has no other level yet. Create a rise on this level or add another level first.", create: "Create connection" }, object: "Object", wallTypes: { boundary: "exterior wall", wall: "wall", partition: "partition wall" }, openingTypes: { door: "door", window: "window", gate: "gate", passage: "passage" }, roomDerived: "A room comes from closed walls. Move or remove a wall to change its shape.", delete: "Delete", close: "Close", newProject: "New project", duplicateProject: "Duplicate project", deleteProject: "Delete project", openProject: "Open", projectName: "Project name", startingScale: "Start with", startingScales: { world: "World", location: "Place", building: "Building", level: "Level", room: "Room" }, create: "Create", language: "Polski", addContaining: "Add level", deletePlaceQuestion: "This place contains further maps and objects. Delete everything inside it?", deletePlaceWithContents: "Delete with contents", clearLayerQuestion: (layer, place) => `Delete every item from the “${layer}” layer on “${place}”?`, confirmClearLayer: "Clear layer", addLevel: "Add level", independentMap: "Independent map", selectionActions: { title: "Selection operations", duplicate: "Duplicate", rotateLeft: "Rotate left", rotateRight: "Rotate right", mirrorHorizontal: "Mirror left–right", mirrorVertical: "Mirror top–bottom", merge: "Merge outlines", mergeRooms: "Join rooms" },
    renameProject: "Rename", exportProject: "Export", importProject: "Import as a new project", saveName: "Save name",
    overlapDecision: { arranging: "Building outlines overlap. Keep arranging them freely or merge them now.", mustResolve: "Choose how to combine the overlapping masses before leaving this sheet.", outerOnly: "Merge — outer outline only", keepPartitions: "Merge — retain partition walls", continueArranging: "Return to arranging" },
    fillColor: "Fill colour", fillOpacity: "Opacity", markerSize: "Marker size", noteText: "Note text", fontSize: "Font size", inheritAppearance: "Use level colour",
    objectList: { title: "Objects on this sheet", places: "Places and map levels", terrain: "Terrain", roads: "Roads", equipment: "Objects", surfaces: "Platforms and balconies", sketch: "Sketches and notes", rooms: "Rooms", walls: "Walls", features: "Construction features", empty: "This sheet does not contain any objects yet.", noResults: "No matching objects found.", search: "Search names, descriptions or tags…", show: "Show", hide: "Hide", lock: "Lock", unlock: "Unlock", delete: "Delete", wallName: (index) => `Wall ${index}`, openingName: (kind, index) => `${({ door: "Door", window: "Window", gate: "Gate", passage: "Passage" })[kind]} ${index}`, stairsName: (index) => `Stairs ${index}`, elevatorName: (index) => `Lift ${index}` },
    hierarchy: { ariaLabel: "Project tree", openPlace: "Open place", expandPlace: "Expand", collapsePlace: "Collapse", addContainingPlace: "Add map level", addLevel: "Add a new level", reorderLevel: "Drag to reorder levels", containingKind: "Which scale should be added?", containingName: "Name (optional)", createContaining: "Add scale", cancel: "Cancel", noPlaces: "This project has no places yet.", kindLabels: kindLabels.en, surface: "Construction surface" },
    clearConstructionQuestion: (place) => `Clear construction on “${place}”? This removes interior walls and derived rooms, platforms, terraces, balconies, mezzanines, doors, windows, gates, passages, stairs and lifts. Locked items, the outer boundary and voids remain unchanged.`,
    map: { ariaLabel: "Cartographer's sheet", empty: "This sheet is still empty", compass: "Rotate map", zoomIn: "Zoom in", zoomOut: "Zoom out", resetView: "Reset view", back: "Return to the broader map", northMark: "N", measurements: { title: "View & measurements", grid: "Grid", axes: "Show axes", opacity: "Opacity", spacing: "Spacing", cell: "1 cell", snap: "Snap to grid", units: "Units", metric: "metres", imperial: "feet", roomAreas: "Object areas" }, openingLabel: (kind) => ({ door: "Door", window: "Window", gate: "Gate", passage: "Passage" })[kind], transitionLabel: (_id, kind) => kind === "elevator" ? "Lift" : "Stairs" },
    drawingStatus: {
      unfinished: "The drawing has not closed an object yet. Continue drawing or decide what to keep.",
      unfinishedWithNavigation: "Decide what to do with the unfinished drawing before leaving this sheet.",
      continueDrawing: "Keep drawing",
      autoClose: "Close automatically and create object",
      autoClosePreview: "This is how the drawing will be closed, using the existing outline when needed. Create the object?",
      applyAutoClose: "Close and create object",
      cancelAutoClose: "Back",
      saveAsSketch: "Keep as sketch",
      saveAsPath: "Keep as object",
      discard: "Discard",
      clipQuestion: "The drawing extends beyond the allowed outline.",
      clip: "Clip to outline",
      cancel: "Cancel",
      deleteQuestion: "The eraser hit a place containing further levels. Delete them together?",
      confirmDelete: "Delete with contents",
      blocked: {
        "unavailable-here": "This kind of object cannot be created on the open map scale.",
        "outside-outline": "The drawing does not occupy any part of the allowed area.",
        "geometry-conflict": "This change creates a geometry conflict and was not applied.",
        "no-wall": "There is no wall here to receive this element.",
        "stairs-need-room": "Stairs must fit completely inside one room.",
        "road-obstacle": "No clear route of this width was found. Move the road endpoints outside the building or choose a narrower road.",
        "transaction-failed": "The change could not be saved. The current plan remains unchanged.",
        "bezier-pending": "The true Bezier pen is still being connected to the new core; this gesture was not saved as an ordinary line.",
      },
    },
    editingStatus: {
      reviewQuestion: "This change affects the room layout. Apply it?",
      apply: "Apply change",
      cancel: "Cancel",
      blocked: {
        "locked-outline": "The open place outline is locked. Enable outline editing to change it.",
        "outside-outline": "The item must remain inside the allowed outline.",
        collision: "The item would collide with another part of the plan here.",
        unsupported: "This item cannot yet be moved in this way.",
        "not-found": "The selected item could not be found.", "road-obstacle": "The roads cannot be joined because the route conflicts with an obstacle.", "transaction-failed": "The change could not be saved. The current plan remains unchanged.", "road-not-found": "One of the selected roads could not be found.", "road-different-owner": "Choose roads that belong to the same sheet.", "road-too-far": "The road endpoints are too far apart and their centerlines do not cross.", "road-already-joined": "These roads already have a recorded junction.", "road-unsupported": "Only two open roads with editable paths can be joined.", "road-routing": "The joined road would conflict with an obstacle.",
      },
    },
  },
};
