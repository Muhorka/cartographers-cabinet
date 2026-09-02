import fs from "node:fs";
import path from "node:path";

const [sourcePath, outputPath] = process.argv.slice(2);
if (!sourcePath || !outputPath) throw new Error("Usage: node scripts/build-silver-lindens-example.mjs <source.cartographer.json> <output.json>");

const envelope = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
if (envelope.format !== "cartographers-cabinet.project" || envelope.fileVersion !== 1 || envelope.project?.schemaVersion !== 9) {
  throw new Error("Expected a version 1 Cartographer's Cabinet project containing schema version 9.");
}

const project = structuredClone(envelope.project);
const names = new Map(Object.entries({
  "Pałac Srebrnych Lip": "Residence of the Silver Lindens",
  "Rezydencja Srebrne Lipy — plan założenia": "Residence of the Silver Lindens — Estate Plan",
  "Parter — sale reprezentacyjne": "Ground Floor — State Rooms",
  "Piętro I — apartamenty prywatne": "First Floor — Private Apartments",
  "Piętro II — apartamenty gościnne i pracownie": "Second Floor — Guest Apartments and Studios",
  "Stajnie książęce": "Ducal Stables",
  "Stajnie — boksy i siodlarnia": "Stables — Stalls and Tack Room",
  "Powozownia": "Coach House",
  "Powozownia i warsztat": "Coach House and Workshop",
  "Oranżeria": "Orangery",
  "Oranżeria ogrodowa": "Garden Orangery",
  "Kordegarda zachodnia": "West Gatehouse",
  "Kordegarda wschodnia": "East Gatehouse",
  "Schody służbowe": "Service Staircase",
  "Schody honorowe": "Grand Staircase",
  "Jadalnia galowa": "State Dining Room",
  "Galeria komunikacyjna": "Connecting Gallery",
  "Salon muzyczny": "Music Salon",
  "Biblioteka": "Library",
  "Sala balowa i salon ogrodowy": "Ballroom and Garden Salon",
  "Salon herbaciany": "Tea Salon",
  "Szatnia gości": "Guest Cloakroom",
  "Toalety gościnne": "Guest Washrooms",
  "Westybul kolumnowy": "Columned Vestibule",
  "Kredens i przygotowanie stołu": "Butler's Pantry and Table Service",
  "Przyjęcie dostaw": "Deliveries",
  "Kancelaria zarządcy": "Estate Steward's Office",
  "Pokój lokajów": "Footmen's Room",
  "Szatnia przy schodach": "Stair Hall Wardrobe",
  "Kuchnia pałacowa": "Palace Kitchen",
  "Zmywalnia": "Scullery",
  "Spiżarnia": "Pantry",
  "Sypialnia właścicielki": "Lady's Bedroom",
  "Galeria apartamentów": "Private Apartments Gallery",
  "Apartament Błękitny": "Blue Apartment",
  "Sypialnia właściciela": "Gentleman's Bedroom",
  "Salon prywatny": "Private Salon",
  "Apartament Zielony": "Green Apartment",
  "Biblioteka kameralna": "Private Library",
  "Łazienka gościnna": "Guest Bathroom",
  "Salon portretowy": "Portrait Salon",
  "Salon dziecięcy": "Children's Sitting Room",
  "Łazienka dziecięca": "Children's Bathroom",
  "Gabinet prywatny": "Private Study",
  "Garderoba gościnna": "Guest Dressing Room",
  "Garderoba przy schodach": "Stair Hall Dressing Room",
  "Sypialnia dziecięca": "Children's Bedroom",
  "Bieliźniarnia": "Linen Room",
  "Pokój opiekunki": "Governess's Room",
  "Łazienka zachodnia": "West Bathroom",
  "Łazienka apartamentu zachodniego": "West Apartment Bathroom",
  "Łazienka apartamentu wschodniego": "East Apartment Bathroom",
  "Łazienka wschodnia": "East Bathroom",
  "Apartament Szafirowy": "Sapphire Apartment",
  "Galeria drugiego piętra": "Second-Floor Gallery",
  "Apartament Rubinowy": "Ruby Apartment",
  "Apartament Perłowy": "Pearl Apartment",
  "Pracownia malarska": "Painting Studio",
  "Apartament Bursztynowy": "Amber Apartment",
  "Archiwum i mapoteka": "Archive and Map Room",
  "Łazienka służby": "Servants' Bathroom",
  "Salon wypoczynkowy": "Drawing Room",
  "Pokój gościnny południowy": "South Guest Room",
  "Pralnia podręczna": "Small Laundry",
  "Pracownia pisarska": "Writing Room",
  "Pokój kamerdynera": "Butler's Room",
  "Magazyn podręczny": "General Store",
  "Gabinet apartamentu": "Apartment Study",
  "Pracownia krawiecka": "Sewing Room",
  "Pokój pokojowych": "Maids' Room",
  "Siodłanie": "Tack-up Area",
  "Paszarnia": "Feed Room",
  "Myjka i kowal": "Wash Bay and Farrier",
  "Przejazd stajenny": "Stable Passage",
  "Siodlarnia": "Tack Room",
  "Bryczki": "Light Carriages",
  "Powóz galowy": "State Coach",
  "Powóz podróżny": "Travelling Carriage",
  "Warsztat": "Workshop",
  "Pokój ogrodnika": "Gardener's Room",
  "Ogród zimowy": "Winter Garden",
  "Magazyn roślin": "Plant Store",
  "Posterunek": "Guard Post",
  "Izba straży": "Guardroom",
  "Pokój odźwiernego": "Gatekeeper's Room",
  "Portiernia": "Gate Lodge",
  "Aleja wjazdowa": "Entrance Avenue",
  "Podjazd pod portyk": "Portico Drive",
  "Wielka aleja ogrodowa": "Grand Garden Avenue",
  "Aleja poprzeczna": "Cross Avenue",
  "Aleja lip zachodnia": "West Linden Avenue",
  "Aleja lip wschodnia": "East Linden Avenue",
  "Promenada północna": "North Promenade",
  "Dojście do oranżerii": "Orangery Walk",
  "Dojazd gospodarczy": "Service Drive",
  "Dojście służbowe": "Service Walk",
  "Podjazd zachodni": "West Drive",
  "Obejście basenu zachodnie": "West Reflecting Pool Walk",
  "Podjazd wschodni": "East Drive",
  "Obejście basenu wschodnie": "East Reflecting Pool Walk",
  "Dojazd do wrót stajni": "Stable Gate Drive",
  "Wyjście na padok": "Paddock Track",
  "Trawniki parkowe": "Park Lawns",
  "Parter różany zachodni": "West Rose Parterre",
  "Parter różany wschodni": "East Rose Parterre",
  "Parter bukszpanowy zachodni": "West Boxwood Parterre",
  "Parter bukszpanowy wschodni": "East Boxwood Parterre",
  "Padok koni": "Horse Paddock",
  "Bosket zachodni": "West Bosquet",
  "Bosket wschodni": "East Bosquet",
  "Park krajobrazowy": "Landscape Park",
  "Dziedziniec honorowy": "Court of Honour",
  "Dziedziniec stajenny": "Stable Yard",
  "Basen lustrzany": "Reflecting Pool",
  "Fontanna honorowa": "Court of Honour Fountain",
  "Gazony dziedzińca": "Courtyard Lawns",
  "Posąg Flory": "Statue of Flora",
  "Regały zachodnie": "West Bookcases",
  "Regały wschodnie": "East Bookcases",
  "Stół biblioteczny": "Library Table",
  "Stół galowy": "State Dining Table",
  "Fortepian": "Grand Piano",
  "Stół herbaciany": "Tea Table",
  "Blat kuchenny": "Kitchen Worktop",
  "Stół kuchenny": "Kitchen Table",
  "Piec kuchenny": "Kitchen Range",
  "Biurko zarządcy": "Steward's Desk",
  "Łoże": "Bed",
  "Stół salonu": "Salon Table",
  "Wanna": "Bathtub",
  "Stół pracowni": "Studio Table",
  "Żłób": "Manger",
  "Powóz": "Carriage",
  "Rośliny oranżerii": "Orangery Plants",
  "Ławka ogrodowa": "Garden Bench 1",
  "Ławka ogrodowa — kopia": "Garden Bench 2",
  "Portyk wejściowy": "Entrance Portico",
  "Taras ogrodowy": "Garden Terrace",
  "Taras wschodni": "East Terrace",
  "Taras zachodni": "West Terrace",
}));

const descriptions = new Map(Object.entries({
  "Samodzielna, fikcyjna rezydencja: pałac o trzech kondygnacjach, dziedziniec honorowy, ogrody regularne oraz oddzielny dziedziniec stajenny.": "A self-contained fictional estate with a three-storey palace, a court of honour, formal gardens and a separate stable yard.",
  "Korpus 60 × 36 m. Oś wejście–hall–salon ogrodowy. Trzy pełne kondygnacje, dwie niezależne klatki schodowe.": "A 60 × 36 m palace arranged along an entrance–hall–garden salon axis, with three full storeys and two independent staircases.",
  "Oddzielny budynek stajenny z szerokim przejazdem, boksami, siodlarnią i magazynem pasz.": "A separate stable building with a broad passage, twelve stalls, a tack room and feed storage.",
  "Trzy stanowiska powozów i warsztat, otwarte na dziedziniec stajenny.": "Three carriage bays and a workshop opening onto the stable yard.",
  "Przeszklony pawilon przy bocznym ogrodzie, z zapleczem ogrodników.": "A glazed pavilion beside the west garden, with rooms for the gardening staff.",
  "Posterunek przy bramie wjazdowej.": "A guard post beside the main entrance gate.",
  "Portiernia i pomieszczenie gospodarza bramy.": "A gate lodge with an office and a room for the gatekeeper.",
  "Drzewo alei pałacowej.": "A linden tree lining the palace avenues.",
  "Kordegarda wschodnia": "East Gatehouse",
  "Kordegarda zachodnia": "West Gatehouse",
  "Oranżeria": "Orangery",
  "Powozownia": "Coach House",
  "Stajnie książęce": "Ducal Stables",
  "Pałac Srebrnych Lip • Parter — sale reprezentacyjne": "Residence of the Silver Lindens • Ground Floor — State Rooms",
  "Pałac Srebrnych Lip • Piętro I — apartamenty prywatne": "Residence of the Silver Lindens • First Floor — Private Apartments",
  "Pałac Srebrnych Lip • Piętro II — apartamenty gościnne i pracownie": "Residence of the Silver Lindens • Second Floor — Guest Apartments and Studios",
}));

const tags = new Map(Object.entries({
  "aleja": "avenue", "apartament": "apartment", "apartamenty": "apartments", "komunikacja": "circulation",
  "lipa": "linden", "łazienka": "bathroom", "parter": "ground floor", "plan założenia": "estate plan",
  "projekt testowy WebMCP": "example project", "stajnie": "stables", "zaplecze": "service area",
}));

function translateName(value) {
  if (names.has(value)) return names.get(value);
  const linden = /^Lipa (\d+)$/.exec(value);
  if (linden) return `Linden ${linden[1]}`;
  const stall = /^Boks (\d+)$/.exec(value);
  if (stall) return `Stall ${stall[1]}`;
  return value;
}
function translateRecord(record) {
  if (typeof record.name === "string") record.name = translateName(record.name);
  if (typeof record.description === "string") record.description = descriptions.get(record.description) ?? record.description;
  if (Array.isArray(record.tags)) record.tags = record.tags.map((tag) => tags.get(tag) ?? tag);
}

project.name = "Residence of the Silver Lindens — Example Project";
for (const place of project.places) translateRecord(place);
for (const element of project.elements) translateRecord(element);
for (const surface of project.surfaces ?? []) translateRecord(surface);
for (const construction of project.constructions) for (const room of construction.rooms) translateRecord(room);

const byName = (collection, name) => {
  const matches = collection.filter((item) => item.name === name);
  if (matches.length !== 1) throw new Error(`Expected one ${name}, found ${matches.length}.`);
  return matches[0];
};
const placesNamed = (name) => project.places.filter((item) => item.name === name);
const placeRef = (name, kind) => {
  const place = byName(kind ? project.places.filter((item) => item.kind === kind) : project.places, name);
  if (place.kind !== "room" && place.kind !== "standalone-room") return { kind: "place", id: place.id };
  const level = project.places.find(({ id }) => id === place.parentId);
  if (!level?.constructionId) throw new Error(`Room ${name} has no construction scope.`);
  return { kind: "room", id: place.id, scopeId: level.constructionId };
};
const roomRefs = (name) => placesNamed(name).map((place) => {
  const level = project.places.find(({ id }) => id === place.parentId);
  if (!level?.constructionId) throw new Error(`Room ${name} has no construction scope.`);
  return { kind: "room", id: place.id, scopeId: level.constructionId };
});
const elementRef = (name) => ({ kind: "element", id: byName(project.elements, name).id });
const surfaceRef = (name) => ({ kind: "surface", id: byName(project.surfaces, name).id });
const member = (ref, relation = "inside", partial = false, note) => ({ ref, relation, partial, ...(note ? { note } : {}) });
const access = ({ allow = [], deny = [], permission = "restricted", physicalState = "open", lock = "none", keyIds = [], guardIds = [], secretKnowledge = [], hidden, knownBy } = {}) => ({
  allow, deny, permission, physicalState, lock, keyIds, guardIds, secretKnowledge,
  ...(hidden !== undefined ? { hidden } : {}), ...(knownBy ? { knownBy } : {}),
});

const ids = {
  helena: "demo:character:helena-arden", edmund: "demo:character:edmund-hale", clara: "demo:character:clara-finch",
  samuel: "demo:character:samuel-moss", household: "demo:access:household", domestic: "demo:access:domestic-staff",
  stableStaff: "demo:access:stable-staff", guests: "demo:access:invited-guests",
  masterKey: "demo:key:grand-master", privateKey: "demo:key:private-apartments", serviceKey: "demo:key:service-wing",
  stableKey: "demo:key:stable-yard",
};
const entry = (id, kind, name, description, tags = [], properties = {}) => ({ id, kind, name, description, tags, properties });
const membership = (subjectId, groupId, kind = "member-of", note) => ({ subjectId, groupId, kind, source: "manual", ...(note ? { note } : {}) });

const estate = placeRef("Residence of the Silver Lindens — Estate Plan");
const palace = placeRef("Residence of the Silver Lindens");
const groundFloor = placeRef("Ground Floor — State Rooms");
const firstFloor = placeRef("First Floor — Private Apartments");
const secondFloor = placeRef("Second Floor — Guest Apartments and Studios");
const stables = placeRef("Ducal Stables");
const coachHouse = placeRef("Coach House");
const orangery = placeRef("Orangery");
const westGatehouse = placeRef("West Gatehouse", "building");
const eastGatehouse = placeRef("East Gatehouse", "building");
const court = elementRef("Court of Honour");
const stableYard = elementRef("Stable Yard");
const paddock = elementRef("Horse Paddock");
const gardenTerrace = surfaceRef("Garden Terrace");
const ballroom = placeRef("Ballroom and Garden Salon");
const diningRoom = placeRef("State Dining Room");
const vestibule = placeRef("Columned Vestibule");
const kitchen = placeRef("Palace Kitchen");
const butlersPantry = placeRef("Butler's Pantry and Table Service");
const stewardOffice = placeRef("Estate Steward's Office");
const archive = placeRef("Archive and Map Room");
const ladyBedroom = placeRef("Lady's Bedroom");
const gentlemanBedroom = placeRef("Gentleman's Bedroom");

// Structural features do not carry a native name in the geometry model. Keep
// the demo's authored Story labels next to the fixture's known door order so
// the drawing catalogue can show the same names as the Story workbench.
const groundFloorDoorNarrativeLabels = [
  "Music Salon threshold", "Library threshold", "Ballroom and Garden Salon threshold", "State Dining Room threshold", "Tea Salon threshold",
  "Estate Steward's Office threshold", "Footmen's Room threshold", "Grand Staircase threshold", "Columned Vestibule threshold", "Butler's Pantry threshold",
  "Service Staircase threshold", "Pantry threshold", "Steward's Office to Guest Cloakroom threshold", "Footmen's Room to Guest Washrooms threshold", "Stair Hall to Grand Staircase threshold",
  "Kitchen to Butler's Pantry threshold", "Scullery to Service Staircase threshold", "Pantry to Deliveries threshold", "Vestibule to Grand Staircase threshold", "Service Staircase to Butler's Pantry threshold",
  "Library to Music Salon threshold", "Library to Ballroom threshold", "Ballroom to State Dining Room threshold", "Tea Salon to State Dining Room threshold", "Columned Vestibule entrance",
  "Ballroom garden entrance", "Connecting Gallery west entrance", "Connecting Gallery east entrance", "Deliveries service entrance",
];
const groundFloorTransitionNarrativeLabels = ["Service Staircase", "Grand Staircase"];

const objectMap = new Map();
const annotate = (ref, metadata) => objectMap.set(`${ref.kind}:${ref.scopeId ?? ""}:${ref.id}`, { ref, metadata });
annotate(estate, { owners: [ids.helena], tags: ["estate", "example"], properties: { "demo:property:role": "estate plan" } });
annotate(palace, { owners: [ids.helena], access: access({ allow: [ids.household, ids.domestic, ids.guests] }), tags: ["residence"] });
annotate(groundFloor, { access: access({ allow: [ids.household, ids.domestic, ids.guests] }), tags: ["state rooms", "guest access"] });
annotate(firstFloor, { access: access({ allow: [ids.household, ids.domestic], keyIds: [ids.privateKey] }), tags: ["private"] });
annotate(secondFloor, { access: access({ allow: [ids.household, ids.domestic, ids.guests] }), tags: ["guest apartments"] });
annotate(stables, { owners: [ids.helena], access: access({ allow: [ids.household, ids.stableStaff], keyIds: [ids.stableKey] }), tags: ["stables"] });
annotate(coachHouse, { owners: [ids.helena], access: access({ allow: [ids.household, ids.stableStaff], keyIds: [ids.stableKey] }), tags: ["service"] });
annotate(orangery, { owners: [ids.helena], access: access({ allow: [ids.household, ids.domestic, ids.guests] }), tags: ["garden"] });
annotate(westGatehouse, { access: access({ allow: [ids.household, ids.domestic] }), tags: ["security"] });
annotate(eastGatehouse, { access: access({ allow: [ids.household, ids.domestic] }), tags: ["security"] });
annotate(court, { access: access({ allow: [ids.household, ids.domestic, ids.guests] }), tags: ["arrival", "public"] });
annotate(stableYard, { access: access({ allow: [ids.household, ids.stableStaff], keyIds: [ids.stableKey] }), tags: ["service"] });
annotate(paddock, { access: access({ allow: [ids.household, ids.stableStaff] }), tags: ["horses"] });
annotate(gardenTerrace, { access: access({ allow: [ids.household, ids.guests, ids.domestic] }), tags: ["entertaining", "garden"] });
annotate(archive, { owners: [ids.helena], access: access({ allow: [ids.helena, ids.edmund], physicalState: "closed", lock: "locked", keyIds: [ids.masterKey] }), tags: ["locked", "records"], properties: { "demo:property:security": "high" } });
annotate(ladyBedroom, { owners: [ids.helena], access: access({ allow: [ids.helena, ids.domestic], physicalState: "closed", lock: "locked", keyIds: [ids.privateKey] }), tags: ["private", "locked"] });
annotate(gentlemanBedroom, { owners: [ids.helena], access: access({ allow: [ids.household, ids.domestic], physicalState: "closed", lock: "locked", keyIds: [ids.privateKey] }), tags: ["private", "locked"] });
annotate(kitchen, { access: access({ allow: [ids.domestic, ids.household], keyIds: [ids.serviceKey] }), tags: ["service", "food"] });
annotate(stewardOffice, { owners: [ids.edmund], access: access({ allow: [ids.edmund, ids.household], keyIds: [ids.serviceKey] }), tags: ["administration"] });

const groundFloorConstructionId = project.places.find(({ id }) => id === groundFloor.id)?.constructionId;
const groundFloorConstruction = project.constructions.find(({ id }) => id === groundFloorConstructionId);
if (!groundFloorConstruction) throw new Error("Ground Floor has no construction document.");
const groundFloorDoors = groundFloorConstruction.openings.filter(({ kind }) => kind === "door");
if (groundFloorDoors.length !== groundFloorDoorNarrativeLabels.length) {
  throw new Error(`Expected ${groundFloorDoorNarrativeLabels.length} Ground Floor doors, found ${groundFloorDoors.length}.`);
}
groundFloorDoors.forEach((opening, index) => {
  annotate({ kind: "opening", id: opening.id, scopeId: groundFloorConstruction.id }, { narrativeLabel: groundFloorDoorNarrativeLabels[index] });
});
groundFloorConstruction.transitions.forEach((transition, index) => {
  const narrativeLabel = groundFloorTransitionNarrativeLabels[index];
  if (narrativeLabel) annotate({ kind: "transition", id: transition.id, scopeId: groundFloorConstruction.id }, { narrativeLabel });
});

const publicRooms = ["Ballroom and Garden Salon", "Music Salon", "Tea Salon", "State Dining Room", "Library", "Columned Vestibule", "Guest Cloakroom", "Guest Washrooms"].map((name) => placeRef(name));
const familyRooms = ["Lady's Bedroom", "Gentleman's Bedroom", "Private Salon", "Private Library", "Private Study", "Children's Sitting Room", "Children's Bedroom", "Governess's Room"].map((name) => placeRef(name));
const serviceRooms = ["Palace Kitchen", "Scullery", "Pantry", "Butler's Pantry and Table Service", "Deliveries", "Estate Steward's Office", "Footmen's Room", "Linen Room", "Butler's Room", "Maids' Room", "Small Laundry", "General Store"].map((name) => placeRef(name));
const serviceStairs = roomRefs("Service Staircase");

// Calculated by the current route planner against the translated, annotated fixture.
const gatehouseLevelId = "9110c42a-a042-41f3-98a8-72e7e2cb421b";
const gatehouseOpeningId = "6bc5bd8e-a3dd-47e8-b3b7-dfba8a34f1f5";
const gatehouseRevision = "fb6f613f-f3cd-4c4c-9ee9-ac6928007762:2ed35b6a107fd53a:303817";
const gatehouseQuery = { from: { placeId: gatehouseLevelId, levelId: gatehouseLevelId, point: { x: -3.5, y: 0 } }, to: { placeId: gatehouseLevelId, levelId: gatehouseLevelId, point: { x: 3.5, y: 0 } }, profile: "foot", actorId: ids.edmund };
const gatehouseSegments = [
  { placeId: gatehouseLevelId, levelId: gatehouseLevelId, kind: "indoor", points: [{ x: -3.5, y: 0 }, { x: -0.39999999999999997, y: 0 }], faceId: "room-face:1klp1fw" },
  { placeId: gatehouseLevelId, levelId: gatehouseLevelId, kind: "indoor", points: [{ x: -0.39999999999999997, y: 0 }, { x: 0, y: 0 }, { x: 0.39999999999999997, y: 0 }], faceId: "room-face:1klp1fw", sourceId: gatehouseOpeningId },
  { placeId: gatehouseLevelId, levelId: gatehouseLevelId, kind: "indoor", points: [{ x: 0.39999999999999997, y: 0 }, { x: 3.5, y: 0 }], faceId: "room-face:1btfhgo" },
];
const gatehouseAlternative = { id: `route-${gatehouseOpeningId}-level`, segments: gatehouseSegments, points: [{ x: -3.5, y: 0 }, { x: -0.39999999999999997, y: 0 }, { x: 0, y: 0 }, { x: 0.39999999999999997, y: 0 }, { x: 3.5, y: 0 }, { x: 3.5, y: 0 }], distance: 7, conditions: [], reasons: [], usedOpeningIds: [gatehouseOpeningId], usedTransitionIds: [], sourceRevision: gatehouseRevision };
const gatehouseResult = { status: "ready", revision: 144, sourceRevision: gatehouseRevision, routes: [gatehouseAlternative], route: gatehouseAlternative, missingFacts: [], reasons: [] };

project.story = {
  version: 1,
  world: [
    entry(ids.helena, "character", "Lady Helena Arden", "Owner of the residence and keeper of its family archive.", ["household", "owner"], { "demo:property:role": "Owner", "demo:property:status": "resident", "demo:property:trusted": true }),
    entry(ids.edmund, "character", "Edmund Hale", "Estate steward responsible for accounts, staff and secure records.", ["staff", "steward"], { "demo:property:role": "Estate steward", "demo:property:status": "resident staff", "demo:property:trusted": true }),
    entry(ids.clara, "character", "Clara Finch", "Housekeeper responsible for the palace service rooms and domestic staff.", ["staff", "housekeeper"], { "demo:property:role": "Housekeeper", "demo:property:status": "resident staff", "demo:property:trusted": true }),
    entry(ids.samuel, "character", "Samuel Moss", "Head groom responsible for the stables, coach house and paddock.", ["stable staff"], { "demo:property:role": "Head groom", "demo:property:status": "day staff", "demo:property:trusted": true }),
    entry(ids.household, "access-group", "Household", "Members of the resident family and their household.", ["access"]),
    entry(ids.domestic, "access-group", "Domestic Staff", "Staff permitted to use the palace service rooms and circulation.", ["access"]),
    entry(ids.stableStaff, "access-group", "Stable Staff", "Personnel permitted to work in the stable yard, stables and coach house.", ["access"]),
    entry(ids.guests, "access-group", "Invited Guests", "Visitors admitted to the public state rooms during receptions.", ["access"]),
    entry(ids.masterKey, "key", "Grand Master Key", "Opens the principal household and service locks.", ["key"]),
    entry(ids.privateKey, "key", "Private Apartments Key", "Opens the owners' private rooms on the first floor.", ["key"]),
    entry(ids.serviceKey, "key", "Service Wing Key", "Opens the palace service rooms.", ["key"]),
    entry(ids.stableKey, "key", "Stable Yard Key", "Opens the stable and coach-house service locks.", ["key"]),
  ],
  memberships: [
    membership(ids.helena, ids.household), membership(ids.helena, ids.masterKey, "holds-key"), membership(ids.helena, ids.privateKey, "holds-key"),
    membership(ids.edmund, ids.domestic), membership(ids.edmund, ids.masterKey, "holds-key"), membership(ids.edmund, ids.serviceKey, "holds-key"),
    membership(ids.clara, ids.domestic), membership(ids.clara, ids.serviceKey, "holds-key"),
    membership(ids.samuel, ids.stableStaff), membership(ids.samuel, ids.stableKey, "holds-key"),
  ],
  propertyDefinitions: [
    { id: "demo:property:security", name: "Security level", type: "single", group: "Estate operations", options: ["low", "normal", "high"] },
    { id: "demo:property:role", name: "Role", type: "text", group: "Story" },
    { id: "demo:property:status", name: "Residence status", type: "single", group: "Story", options: ["resident", "resident staff", "day staff", "guest"] },
    { id: "demo:property:trusted", name: "Trusted with private rooms", type: "boolean", group: "Access" },
  ],
  objects: [...objectMap.values()],
  groups: [],
  zones: [
    { id: "demo:zone:public-state-rooms", name: "Public State Rooms", description: "Rooms and outdoor spaces opened to invited guests during formal receptions.", ownerPlaceId: groundFloor.id, members: [...publicRooms.map((ref) => member(ref)), member(court), member(gardenTerrace)], tags: ["public", "entertaining"], color: "#c7a75b", metadata: { access: access({ allow: [ids.household, ids.domestic, ids.guests] }) } },
    { id: "demo:zone:family-apartments", name: "Family Apartments", description: "Private rooms reserved for the resident family and trusted domestic staff.", ownerPlaceId: firstFloor.id, members: familyRooms.map((ref) => member(ref)), tags: ["private"], color: "#775a8f", metadata: { owners: [ids.helena], access: access({ allow: [ids.household, ids.domestic], keyIds: [ids.privateKey] }) } },
    { id: "demo:zone:service-circulation", name: "Service Rooms and Circulation", description: "Back-of-house rooms and staircases used by the domestic staff.", ownerPlaceId: palace.id, members: [...serviceRooms, ...serviceStairs].map((ref) => member(ref)), tags: ["service"], color: "#657b71", metadata: { access: access({ allow: [ids.domestic, ids.household], keyIds: [ids.serviceKey] }) } },
    { id: "demo:zone:stable-service", name: "Stable Service Zone", description: "The stable yard, stables, coach house and paddock used by horses, carriages and stable staff.", ownerPlaceId: estate.id, members: [stables, coachHouse, stableYard, paddock].map((ref) => member(ref)), tags: ["service", "horses"], color: "#8a7043", metadata: { access: access({ allow: [ids.stableStaff, ids.household], keyIds: [ids.stableKey] }) } },
  ],
  lenses: [
    { id: "demo:lens:guest-view", name: "Guest Access", color: "#c7a75b", favorite: true, expression: { kind: "predicate", predicate: { kind: "access", entryId: ids.guests, state: "allowed" } } },
    { id: "demo:lens:service-areas", name: "Service Areas", color: "#657b71", favorite: true, expression: { kind: "any", items: ["demo:zone:service-circulation", "demo:zone:stable-service"].map((zoneId) => ({ kind: "predicate", predicate: { kind: "zone", zoneId } })) } },
    { id: "demo:lens:locked-rooms", name: "Locked Rooms", color: "#874f4f", expression: { kind: "predicate", predicate: { kind: "tag", value: "locked" } } },
  ],
  scenarios: [
    { id: "demo:scenario:summer-reception", name: "Summer Reception", description: "The residence opens its state rooms and garden terrace for an evening reception.", patches: [
      { id: "demo:patch:reception-court", target: court, description: "Carriages arrive in the Court of Honour while attendants guide guests to the entrance portico.", metadata: { tags: ["arrival", "reception"], access: access({ allow: [ids.household, ids.domestic, ids.guests] }) } },
      { id: "demo:patch:reception-ballroom", target: ballroom, description: "The ballroom is prepared for music, dancing and access to the garden terrace.", metadata: { tags: ["reception", "music"] } },
    ], steps: [
      { id: "demo:step:guest-arrival", name: "Guest Arrival", description: "Guests enter through the Columned Vestibule and are received in the state rooms.", patches: [{ id: "demo:patch:arrival-vestibule", target: vestibule, description: "Footmen receive invitations and direct guests to the cloakroom and salons.", metadata: { tags: ["reception", "arrival"] } }] },
      { id: "demo:step:state-dinner", name: "State Dinner", description: "The company moves to the State Dining Room.", patches: [{ id: "demo:patch:dinner-room", target: diningRoom, description: "The table is laid for the formal dinner while service enters from the Butler's Pantry.", metadata: { tags: ["reception", "dinner"] } }] },
      { id: "demo:step:garden-ball", name: "Garden Ball", description: "The ballroom and garden terrace become the centre of the evening.", patches: [{ id: "demo:patch:ball-terrace", target: gardenTerrace, description: "Lanterns illuminate the terrace and guests may walk into the formal garden.", metadata: { tags: ["reception", "garden"], access: access({ allow: [ids.household, ids.domestic, ids.guests] }) } }] },
    ] },
    { id: "demo:scenario:night-watch", name: "Night Watch", description: "After the household retires, the estate is secured and the guards begin their final patrol.", patches: [
      { id: "demo:patch:night-court", target: court, description: "The Court of Honour is closed to visitors after the final carriage departs.", metadata: { tags: ["night", "patrol"], access: access({ allow: [ids.household, ids.domestic], deny: [ids.guests], physicalState: "closed" }) } },
      { id: "demo:patch:night-stables", target: stables, description: "The stable doors are closed after the evening feed.", metadata: { tags: ["night"], access: access({ allow: [ids.stableStaff, ids.household], physicalState: "closed", lock: "locked", keyIds: [ids.stableKey] }) } },
    ], steps: [
      { id: "demo:step:secure-archive", name: "Secure the Archive", description: "The steward checks the Archive and Map Room before handing over to the night watch.", patches: [{ id: "demo:patch:secure-archive", target: archive, description: "The archive door is locked and only registered key holders may enter.", metadata: { tags: ["locked", "night"], access: access({ allow: [ids.helena, ids.edmund], physicalState: "closed", lock: "locked", keyIds: [ids.masterKey] }) } }] },
      { id: "demo:step:final-patrol", name: "Final Patrol", description: "The steward checks both gatehouses and the Court of Honour.", patches: [{ id: "demo:patch:patrol-east-gate", target: eastGatehouse, description: "The east gatehouse remains closed until dawn.", metadata: { tags: ["night", "secured"], access: access({ allow: [ids.household, ids.domestic], physicalState: "closed" }) } }] },
    ] },
  ],
  relations: [
    { id: "demo:relation:owner-estate", from: { entryId: ids.helena }, to: estate, kind: "owns", label: "owns" },
    { id: "demo:relation:owner-palace", from: { entryId: ids.helena }, to: palace, kind: "owns", label: "owns" },
    { id: "demo:relation:owner-stables", from: { entryId: ids.helena }, to: stables, kind: "owns", label: "owns" },
    { id: "demo:relation:steward-office", from: { entryId: ids.edmund }, to: stewardOffice, kind: "uses", label: "works in" },
    { id: "demo:relation:housekeeper-kitchen", from: { entryId: ids.clara }, to: kitchen, kind: "uses", label: "supervises" },
    { id: "demo:relation:groom-stables", from: { entryId: ids.samuel }, to: stables, kind: "uses", label: "manages" },
  ],
  intentions: [
    { id: "demo:intention:guest-ballroom", authorId: ids.helena, subject: court, kind: "reachability", text: "During the Summer Reception, an invited guest should be able to travel from the Court of Honour to the Ballroom and Garden Salon.", status: "accepted", target: ballroom, accessEntryId: ids.guests },
    { id: "demo:intention:dinner-service", authorId: ids.clara, subject: kitchen, kind: "must-pass", text: "Domestic staff should reach the State Dining Room through the Butler's Pantry without crossing the Columned Vestibule.", status: "accepted", target: diningRoom, through: [butlersPantry] },
    { id: "demo:intention:stable-paddock", authorId: ids.samuel, subject: stableYard, kind: "avoid-zone", text: "Stable staff should be able to move between the Stable Yard and Horse Paddock without entering the public state-room zone.", status: "draft", target: paddock, avoidZoneId: "demo:zone:public-state-rooms", accessEntryId: ids.stableStaff },
  ],
  evidence: [
    { id: "demo:evidence:estate-axis", text: "The estate plan aligns the main entrance, Court of Honour, palace vestibule, garden salon and central garden avenue.", refs: [estate, court, palace, gardenTerrace], source: "local", locator: "Estate plan" },
    { id: "demo:evidence:service-route", text: "The palace plan places the kitchen, pantry and table-service rooms beside the service circulation leading to the State Dining Room.", refs: [kitchen, butlersPantry, diningRoom], source: "local", locator: "Ground Floor — State Rooms" },
    { id: "demo:evidence:guardhouses", text: "The two gatehouses flank the entrance and support a guarded arrival route into the Court of Honour.", refs: [westGatehouse, eastGatehouse, court], source: "local", locator: "Estate plan" },
  ],
  routes: [{ id: "demo:route:gatehouse-round", name: "Gate Lodge to Gatekeeper's Room", query: gatehouseQuery, result: gatehouseResult, sourceRevision: gatehouseRevision }],
};

const output = { ...envelope, exportedAt: "2026-09-02T02:00:00.000Z", project: { ...project, updatedAt: "2026-09-02T02:00:00.000Z" } };
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
console.log(`Wrote ${outputPath}`);
