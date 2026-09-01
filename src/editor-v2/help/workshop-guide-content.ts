import type { EditorLocale } from "../i18n/workbench-copy";
import { agentGuideTopic } from "./workshop-guide-agent";
import { drawingGuideTopic } from "./workshop-guide-drawing";
import { styled, type WorkshopGuide } from "./workshop-guide-model";
import { storyGuideTopic } from "./workshop-guide-story";

export type { WorkshopGuideText, WorkshopGuideTopicId } from "./workshop-guide-model";

const pl: WorkshopGuide = {
  title: "Księga warsztatu", contents: "Rozdziały", close: "Zamknij księgę", search: "Czego szukasz?", searchResults: "Pasujące miejsca", noSearchResults: "Nie znalazłem pasującego miejsca w Księdze.",
  topics: [
    { id: "start", title: "Zacznij tutaj", summary: "Do czego służy program, co znajduje się na ekranie i czym różnią się dwa tryby pracy.", sections: [
      { heading: "Do czego służy Gabinet kartografa", paragraphs: [
        "Gabinet kartografa pozwala zbudować własny świat od strony przestrzeni. Możesz zacząć bardzo szeroko — od mapy całego świata lub krainy — albo od czegoś znacznie mniejszego: miasta, posiadłości, budynku, pojedynczego piętra czy nawet jednego pomieszczenia.",
        "Nie musisz od razu wiedzieć, jak duży będzie projekt. Jeśli zaczniesz od planu domu, a później zechcesz umieścić go w ogrodzie, mieście albo całym państwie, możesz rozbudować projekt w obu kierunkach.",
        styled("Najpierw możesz po prostu ", { text: "rysować", emphasis: "strong" }, ": teren, drogi, budynki, ściany, drzwi, schody, meble i inne elementy mapy."),
        styled("Później możesz dopisać do nich ", { text: "znaczenie", emphasis: "strong" }, ": kto jest właścicielem danego miejsca, kto może tam wejść, kto posiada klucz, jakie cechy ma pomieszczenie, gdzie znajduje się strażnik albo którędy konkretna postać może dostać się z jednego miejsca do drugiego."),
        "Gabinet składa więc świat z dwóch rzeczy:",
        styled({ text: "Kreślenia", emphasis: "strong" }, " — tego, ", { text: "jak świat wygląda i jak jest zbudowany", emphasis: "em" }, "."),
        styled({ text: "Opowieści", emphasis: "strong" }, " — tego, ", { text: "co ten świat znaczy i jak działa dla jego mieszkańców", emphasis: "em" }, "."),
        "Możesz korzystać tylko z Kreślenia. Tryb Opowieść przydaje się dopiero wtedy, gdy chcesz, aby mapa była czymś więcej niż rysunkiem.",
      ] },
      { heading: "Co znajduje się na ekranie", paragraphs: [
        "Na pierwszy rzut oka Gabinet może wyglądać jak biurko kartografa, który zdecydowanie posiada zbyt wiele szuflad. W praktyce większość pracy odbywa się w czterech miejscach.",
        styled({ text: "Atlas", emphasis: "strong" }, ", po lewej stronie, pokazuje wszystkie mapy należące do projektu. To tutaj przechodzisz między światem, miejscowościami, budynkami, kondygnacjami i pomieszczeniami."),
        styled({ text: "Arkusz", emphasis: "strong" }, ", pośrodku, jest mapą, nad którą właśnie pracujesz. Tutaj rysujesz, zaznaczasz obiekty, przesuwasz je i oglądasz rezultat."),
        styled({ text: "Piórnik", emphasis: "strong" }, " znajduje się nad arkuszem w trybie Kreślenia. Wybierasz w nim, ", { text: "co", emphasis: "em" }, " chcesz narysować i ", { text: "jak", emphasis: "em" }, " chcesz to narysować."),
        styled({ text: "Inspektor", emphasis: "strong" }, ", po prawej stronie, pokazuje informacje o zaznaczonym obiekcie. Jeśli klikniesz budynek, drzwi albo drogę, właśnie tutaj zmienisz jego nazwę, wygląd, właściwości i inne dane."),
        styled("Na górnym pasku znajdziesz także ", { text: "Bibliotekę projektów", emphasis: "strong" }, " oraz przełącznik ", { text: "Kreślenie / Opowieść", emphasis: "strong" }, "."),
      ] },
      { heading: "Kreślenie i Opowieść", paragraphs: [
        styled("W ", { text: "Kreśleniu", emphasis: "strong" }, " budujesz fizyczną mapę."),
        "Tutaj powstają lasy, rzeki, drogi i budynki. Tutaj stawiasz ściany, osadzasz drzwi i okna w ścianach, dodajesz schody, rozstawiasz meble i poprawiasz kształty. Jeżeli coś można zobaczyć na planie i ma swoje miejsce w przestrzeni, najprawdopodobniej zajmiesz się tym właśnie w Kreśleniu.",
        styled("W ", { text: "Opowieści", emphasis: "strong" }, " opisujesz zasady istniejącego już świata."),
        "Możesz utworzyć postacie i organizacje, wskazać właścicieli miejsc, określić dostęp do pomieszczeń, rozdać klucze, tworzyć strefy, sprawdzać trasy postaci albo zapisywać zmiany zachodzące podczas konkretnych wydarzeń.",
        "Przełączanie między tymi trybami nie tworzy dwóch różnych map. Pracujesz cały czas nad tym samym projektem — po prostu raz patrzysz na niego jak kartograf, a raz jak autor.",
      ] },
      { heading: "Nie musisz poznać wszystkiego od razu", paragraphs: [
        "Gabinet ma sporo narzędzi, ale do rozpoczęcia pracy potrzebujesz tylko kilku.",
        "Jeżeli chcesz po prostu narysować pierwszą mapę, wystarczy, że nauczysz się:",
        "wybierać mapę w Atlasie, poruszać się po arkuszu, wybierać obiekt i przybór w Piórniku oraz poprawiać zaznaczone rzeczy w Inspektorze.",
        "Reszta może spokojnie poczekać, aż będzie potrzebna.",
      ] },
    ] },
    { id: "atlas", title: "Atlas, poziomy map i arkusze", summary: "Jak projekt mieści mapy w mapach oraz czym poziom mapy różni się od kondygnacji budynku.", sections: [
      { heading: "Mapa może mieścić się w innej mapie", paragraphs: [
        "Świat rzadko kończy się na jednym arkuszu.",
        "Miasto może zawierać posiadłość, posiadłość — pałac, pałac — kilka kondygnacji, a każda z nich — dziesiątki pomieszczeń. Gabinet kartografa pozwala ułożyć te miejsca jedno wewnątrz drugiego, zamiast próbować zmieścić cały świat na jednej gigantycznej mapie.",
        styled("Do poruszania się po tej strukturze służy ", { text: "Atlas", emphasis: "strong" }, " — księga po lewej stronie ekranu. Pokazuje wszystkie miejsca i mapy należące do projektu oraz ich wzajemne położenie w jego strukturze."),
        "Przykładowy Atlas może wyglądać tak:",
      ], example: "Królestwo\n↳ Miasto Arken\n ↳ Posiadłość\n  ↳ Pałac\n   ↳ Parter\n   ↳ Piętro reprezentacyjne\n   ↳ Drugie piętro" },
      { heading: "Czym jest poziom mapy", paragraphs: [
        "Poziom mapy to miejsce, które ma własny arkusz do oglądania i rysowania.",
        "Może nim być cały świat, kraina, miasto, posiadłość, budynek, kondygnacja albo pomieszczenie. Każdy taki poziom pozwala spojrzeć na inną część projektu w odpowiedniej skali.",
        "Na mapie posiadłości możesz więc zobaczyć pałac jako budynek stojący pośród ogrodów. Po otwarciu pałacu przechodzisz do jego własnej części projektu, gdzie możesz zajmować się jego wnętrzem i kondygnacjami.",
        "To trochę jak zestaw map przechowywanych w jednej teczce: jedna pokazuje kraj, druga miasto, trzecia konkretną rezydencję. Atlas pamięta, jak są ze sobą powiązane.",
      ] },
      { heading: "A czym w takim razie jest kondygnacja?", paragraphs: [
        "Kondygnacja jest jednym z rodzajów poziomu mapy, przeznaczonym specjalnie dla fizycznego piętra budynku.",
        "To rozróżnienie jest ważne, bo nie każdy poziom projektu jest piętrem.",
        "Świat jest poziomem mapy. Miasto jest poziomem mapy. Pałac jest poziomem mapy. Jego parter również jest poziomem mapy — ale właśnie parter jest dodatkowo kondygnacją.",
        "Dzięki temu Gabinet wie, które mapy są kolejnymi piętrami tego samego budynku. Możesz później zmieniać ich kolejność oraz łączyć je schodami lub windami.",
        "Sama kolejność kondygnacji nie tworzy jednak przejścia między nimi — trzeba jeszcze dodać schody lub windę i wskazać, które piętra łączą.",
      ] },
      { heading: "Atlas — twoja mapa map", paragraphs: [
        "Kliknięcie miejsca w Atlasie otwiera jego mapę na środku ekranu.",
        "Jeżeli obok miejsca znajduje się możliwość rozwinięcia jego zawartości, możesz jej użyć, aby zobaczyć znajdujące się wewnątrz mapy. Samo rozwinięcie listy nie przenosi cię jeszcze na inną mapę — służy tylko do zaglądania w strukturę projektu.",
        "Możesz więc rozwinąć Pałac, zobaczyć jego trzy kondygnacje i dopiero wtedy otworzyć Parter.",
        styled("Gdy znajdziesz się głęboko w projekcie, polecenie ", { text: "Wróć do szerszej mapy", emphasis: "strong" }, " otworzy miejsce, które zawiera aktualny arkusz. Z pomieszczenia możesz wrócić do kondygnacji, z kondygnacji do budynku, a z budynku do posiadłości."),
      ] },
      { heading: "Arkusz — mapa leżąca właśnie na biurku", paragraphs: [
        "Arkusz to duży obszar pośrodku ekranu. Pokazuje mapę, którą masz obecnie otwartą.",
        "Atlas jest więc spisem wszystkich map w projekcie, a arkusz jest tą jedną, którą właśnie wyjęłaś z szuflady i rozłożyłaś na stole.",
        "Otwarcie innego miejsca w Atlasie po prostu wymienia arkusz. Nie zamykasz projektu i nie tworzysz nowego dokumentu — przechodzisz do innej jego części.",
        "Na arkuszu będziesz później rysować, zaznaczać obiekty, przesuwać je i poprawiać. Możesz również przesuwać sam widok, przybliżać go, oddalać i obracać, nie zmieniając przy tym położenia narysowanych rzeczy.",
      ] },
      { heading: "Zaczęłam od zbyt małej mapy. Co teraz?", paragraphs: [
        "Nic straconego.",
        "Załóżmy, że zaczęłaś projekt od planu pałacu. Po pewnym czasie okazuje się, że potrzebujesz również ogrodów, stajni, bramy i całej posiadłości.",
        "Nie trzeba budować projektu od początku.",
        styled("Polecenie ", { text: "Dodaj poziom", emphasis: "strong" }, " tworzy nowe, szersze miejsce i umieszcza w nim dotychczasową mapę. W ten sposób istniejący pałac może stać się częścią nowo utworzonej posiadłości."),
        "To samo działa na innych skalach. Możesz zacząć od miasta, a później dodać nad nim krainę. Albo od pojedynczego budynku i dopiero później zdecydować, gdzie właściwie stoi.",
        "Gabinet nie wymaga więc, żeby cała geografia świata była ustalona przed postawieniem pierwszej kreski.",
      ] },
      { heading: "Dodawanie kolejnych pięter", paragraphs: [
        styled("Jeżeli pracujesz nad budynkiem, możesz użyć polecenia ", { text: "Dodaj kondygnację", emphasis: "strong" }, ", aby utworzyć jego kolejne piętro."),
        "Kondygnacje należą do tego samego budynku i mają określoną kolejność. Jeżeli po namyśle okaże się, że „Piętro gościnne” powinno znajdować się nad „Piętrem reprezentacyjnym”, możesz przesunąć je wyżej lub niżej w strukturze budynku.",
        "Później Gabinet może wykorzystać tę wiedzę między innymi przy schodach, windach i wyznaczaniu tras prowadzących przez kilka pięter.",
      ] },
      { heading: "Przenoszenie miejsc", paragraphs: [
        "Struktura projektu nie jest wyryta w kamieniu.",
        "Jeśli miejsce znalazło się pod niewłaściwym rodzicem, możesz zmienić jego położenie w Inspektorze. Gabinet pokaże tylko takie miejsca docelowe, do których wybrany element można przenieść bez tworzenia niemożliwej struktury.",
        "Przydaje się to na przykład wtedy, gdy budynek utworzony początkowo bezpośrednio pod miastem powinien jednak należeć do znajdującej się w nim posiadłości.",
      ] },
      { heading: "Usuwanie poziomu mapy", paragraphs: [
        "Z poziomami mapy warto obchodzić się ostrożniej niż z pojedynczą kreską.",
        "Usunięcie miejsca może oznaczać również usunięcie map znajdujących się wewnątrz niego oraz ich zawartości. Dlatego Gabinet wymaga dodatkowego potwierdzenia przed wykonaniem takiej operacji.",
        "Jeżeli więc usuwasz cały Pałac, problemem nie jest tylko jego nazwa w Atlasie. Pod nim mogą znajdować się kondygnacje, pomieszczenia i cała wykonana na nich praca.",
        "Przed większą przebudową Atlasu warto zachować wersję projektu. Do wersji i kalek wrócimy później.",
      ] },
      { heading: "Najważniejsze na początek", paragraphs: [
        "Nie musisz od razu budować wielopiętrowej genealogii każdej szopy.",
        "Na początku wystarczy pamiętać o trzech rzeczach:",
        "Atlas pokazuje wszystkie mapy projektu i ich wzajemne położenie.",
        "Poziom mapy jest miejscem posiadającym własną mapę — od całego świata aż po pojedyncze pomieszczenie.",
        "Arkusz jest mapą, którą masz w tej chwili otwartą przed sobą.",
        "A jeśli projekt urośnie w stronę, której na początku nie przewidziałaś, Atlas można przebudować razem z nim.",
      ] },
    ] },
    drawingGuideTopic.pl,
    storyGuideTopic.pl,
    agentGuideTopic.pl,
  ],
};

const en: WorkshopGuide = {
  title: "Workshop guide", contents: "Chapters", close: "Close guide", search: "What are you looking for?", searchResults: "Matching places", noSearchResults: "I could not find a matching place in the guide.",
  topics: [
    { id: "start", title: "Start here", summary: "What the application is for, what is on screen and how its two work modes differ.", sections: [
      { heading: "What the Cartographer's Cabinet is for", paragraphs: [
        "The Cartographer's Cabinet lets you build your own world through its spaces. You can begin on the broadest scale — with a map of an entire world or realm — or with something much smaller: a town, an estate, a building, a single floor, or even one room.",
        "You do not need to know how large the project will become. If you begin with a house plan and later decide to place it in a garden, a city, or an entire country, you can expand the project in either direction.",
        styled("At first, you can simply ", { text: "draw", emphasis: "strong" }, ": terrain, roads, buildings, walls, doors, stairs, furniture, and other parts of the map."),
        styled("Later, you can give them ", { text: "meaning", emphasis: "strong" }, ": who owns a place, who may enter it, who holds a key, which traits a room has, where a guard is stationed, or how a particular character can travel from one place to another."),
        "The Cabinet therefore builds a world from two things:",
        styled({ text: "Drawing", emphasis: "strong" }, " — ", { text: "what the world looks like and how it is built", emphasis: "em" }, "."),
        styled({ text: "Story", emphasis: "strong" }, " — ", { text: "what the world means and how it works for its inhabitants", emphasis: "em" }, "."),
        "You can use Drawing on its own. Story becomes useful when you want your map to be more than a drawing.",
      ] },
      { heading: "What is on screen", paragraphs: [
        "At first glance, the Cabinet may look like the desk of a cartographer who definitely owns too many drawers. In practice, most of the work happens in four places.",
        styled("The ", { text: "Atlas", emphasis: "strong" }, ", on the left, shows every map in the project. This is where you move between the world, settlements, buildings, floors, and rooms."),
        styled("The ", { text: "Sheet", emphasis: "strong" }, ", in the centre, is the map you are currently working on. This is where you draw, select objects, move them, and see the result."),
        styled("The ", { text: "Tool case", emphasis: "strong" }, " sits above the sheet in Drawing. Here you choose ", { text: "what", emphasis: "em" }, " you want to draw and ", { text: "how", emphasis: "em" }, " you want to draw it."),
        styled("The ", { text: "Inspector", emphasis: "strong" }, ", on the right, shows information about the selected object. Select a building, door, or road, and this is where you change its name, appearance, properties, and other details."),
        styled("The top bar also contains the ", { text: "Project Library", emphasis: "strong" }, " and the ", { text: "Drawing / Story", emphasis: "strong" }, " switch."),
      ] },
      { heading: "Drawing and Story", paragraphs: [
        styled("In ", { text: "Drawing", emphasis: "strong" }, ", you build the physical map."),
        "This is where forests, rivers, roads, and buildings take shape. You raise walls, set doors and windows into them, add stairs, arrange furniture, and refine shapes. If something can be seen on a plan and occupies a place in space, you will most likely work on it in Drawing.",
        styled("In ", { text: "Story", emphasis: "strong" }, ", you describe the rules of the world you have built."),
        "You can create characters and organisations, name the owners of places, decide who may enter a room, hand out keys, create zones, check character routes, or record changes caused by particular events.",
        "Switching between these modes does not create two different maps. You are always working on the same project — you simply look at it once as a cartographer and once as an author.",
      ] },
      { heading: "You do not need to learn everything at once", paragraphs: [
        "The Cabinet has plenty of tools, but you only need a few of them to begin.",
        "If you simply want to draw your first map, all you need to learn is how to:",
        "choose a map in the Atlas, move around the sheet, choose an object and an instrument in the Tool case, and adjust selected things in the Inspector.",
        "Everything else can wait until you need it.",
      ] },
    ] },
    { id: "atlas", title: "Atlas, map levels and sheets", summary: "How a project contains maps within maps, and why a map level is different from a building floor.", sections: [
      { heading: "A map can contain another map", paragraphs: [
        "A world rarely ends on a single sheet.",
        "A city may contain an estate, the estate a palace, the palace several floors, and every floor dozens of rooms. The Cartographer's Cabinet lets you arrange these places inside one another instead of trying to squeeze the entire world onto one enormous map.",
        styled("You move through this structure with the ", { text: "Atlas", emphasis: "strong" }, " — the book on the left side of the screen. It shows every place and map in the project and where each one sits within the structure."),
        "For example, an Atlas might look like this:",
      ], example: "Kingdom\n↳ City of Arken\n ↳ Estate\n  ↳ Palace\n   ↳ Ground floor\n   ↳ State floor\n   ↳ Second floor" },
      { heading: "What is a map level?", paragraphs: [
        "A map level is a place with its own sheet to view and draw on.",
        "It may be an entire world, a realm, a city, an estate, a building, a floor, or a room. Each level lets you look at a different part of the project at a suitable scale.",
        "On an estate map, for example, you might see a palace standing among its gardens. Open the palace and you enter its own part of the project, where you can work on its interior and floors.",
        "Think of it as a set of maps kept in one portfolio: one shows the country, another the city, and a third a particular residence. The Atlas remembers how they fit together.",
      ] },
      { heading: "So what is a floor?", paragraphs: [
        "A floor is one particular kind of map level, intended for a physical storey of a building.",
        "The distinction matters because not every level in a project is a floor.",
        "A world is a map level. A city is a map level. A palace is a map level. Its ground floor is also a map level — but the ground floor is additionally a floor of that building.",
        "This tells the Cabinet which maps are successive floors of the same building. You can later change their order and connect them with stairs or lifts.",
        "The order of the floors does not create a passage between them by itself — you must still add stairs or a lift and specify which floors they connect.",
      ] },
      { heading: "The Atlas — your map of maps", paragraphs: [
        "Selecting a place in the Atlas opens its map in the centre of the screen.",
        "If a place can be expanded, use that control to see the maps inside it. Expanding the list does not take you to another map; it only lets you look through the structure of the project.",
        "You can therefore expand the Palace, see its three floors, and only then open the Ground floor.",
        styled("When you find yourself deep inside the project, ", { text: "Back to the wider map", emphasis: "strong" }, " opens the place containing the current sheet. From a room you can return to its floor, from the floor to its building, and from the building to its estate."),
      ] },
      { heading: "The Sheet — the map spread across the desk", paragraphs: [
        "The Sheet is the large area in the centre of the screen. It shows the map you currently have open.",
        "The Atlas is therefore the index of every map in the project, while the Sheet is the one you have just taken from the drawer and laid out on the desk.",
        "Opening another place in the Atlas simply replaces the Sheet. You do not close the project or create a new document; you move to another part of the same project.",
        "This is where you will draw, select objects, move them, and refine them. You can also pan the view, zoom in and out, and rotate it without changing the position of anything you have drawn.",
      ] },
      { heading: "I began with a map that is too small. What now?", paragraphs: [
        "Nothing is lost.",
        "Suppose you began the project with a palace plan. After a while, you realise that you also need its gardens, stables, gate, and the rest of the estate.",
        "You do not need to rebuild the project from the beginning.",
        styled("The ", { text: "Add map level", emphasis: "strong" }, " command creates a new, broader place and puts the existing map inside it. In this way, an existing palace can become part of a newly created estate."),
        "The same works at other scales. You can start with a city and later add a realm around it, or begin with a single building and only later decide where it actually stands.",
        "The Cabinet does not require you to settle the entire geography of the world before drawing the first line.",
      ] },
      { heading: "Adding more floors", paragraphs: [
        styled("When you are working on a building, use ", { text: "Add level", emphasis: "strong" }, " to create another floor."),
        "The floors belong to the same building and have a defined order. If you later decide that the “Guest floor” should sit above the “State floor”, you can move it higher or lower in the building's structure.",
        "The Cabinet can later use this information for stairs, lifts, and routes that cross several floors.",
      ] },
      { heading: "Moving places", paragraphs: [
        "The structure of a project is not set in stone.",
        "If a place ended up under the wrong parent, you can change its position in the Inspector. The Cabinet only offers destinations to which the selected element can be moved without creating an impossible structure.",
        "This is useful, for example, when a building initially created directly under a city should instead belong to an estate within that city.",
      ] },
      { heading: "Deleting a map level", paragraphs: [
        "Map levels deserve more care than a single drawn line.",
        "Deleting a place may also delete the maps inside it and everything they contain. The Cabinet therefore asks for additional confirmation before carrying out such an operation.",
        "If you delete the entire Palace, the loss is not limited to its name in the Atlas. Beneath it may sit floors, rooms, and all the work done on their maps.",
        "Before a substantial rebuild of the Atlas, preserve a project version. We will return to versions and overlays later.",
      ] },
      { heading: "What to remember at first", paragraphs: [
        "You do not need to build a many-storeyed genealogy for every shed straight away.",
        "At first, you only need to remember three things:",
        "The Atlas shows every map in the project and where each one sits in relation to the others.",
        "A map level is a place with a map of its own — from an entire world down to a single room.",
        "The Sheet is the map you currently have open in front of you.",
        "And if the project grows in a direction you did not anticipate, the Atlas can be rebuilt along with it.",
      ] },
    ] },
    drawingGuideTopic.en,
    storyGuideTopic.en,
    agentGuideTopic.en,
  ],
};

export const workshopGuide: Record<EditorLocale, WorkshopGuide> = { pl, en };
