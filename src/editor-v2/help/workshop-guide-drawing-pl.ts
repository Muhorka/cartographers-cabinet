import { styled, type WorkshopGuideTopic } from "./workshop-guide-model";

const pl: WorkshopGuideTopic = {
  id: "drawing",
  title: "Kreślenie mapy",
  summary: "Jak działa Piórnik, czym różnią się warstwy, obiekty i przybory oraz jak narysować i poprawić mapę.",
  sections: [
    {
      heading: "Od pustego arkusza do pierwszej kreski",
      paragraphs: [
        styled("W ", { text: "Kreśleniu", emphasis: "strong" }, " budujesz fizyczną stronę świata: teren, drogi, budynki, ściany, drzwi, schody, wyposażenie i wszystko inne, co ma swoje miejsce na mapie."),
        styled("Najważniejsze narzędzia znajdziesz w ", { text: "Piórniku nad arkuszem", emphasis: "strong" }, ". To tam wybierasz:"),
      ],
      bullets: [
        styled({ text: "warstwę", emphasis: "strong" }, " — z jakim rodzajem mapowej zawartości pracujesz i według jakich zasad ma się ona zachowywać,"),
        styled({ text: "rodzaj obiektu", emphasis: "strong" }, " — ", { text: "co", emphasis: "em" }, " właściwie rysujesz,"),
        styled({ text: "przybór", emphasis: "strong" }, " — ", { text: "w jaki sposób", emphasis: "em" }, " chcesz nadać temu kształt."),
      ],
      subsections: [
        {
          heading: "Warstwa nie jest poziomem Atlasu",
          paragraphs: [
            styled("Warstwa nie mówi, ", { text: "gdzie w Atlasie", emphasis: "strong" }, " znajduje się obiekt. To zupełnie inna rzecz. Woda może pojawić się na mapie świata jako jezioro, na mapie posiadłości jako staw, a na kondygnacji jako fontanna. Nadal korzystasz z tej samej warstwy — zmienia się tylko mapa, na której pracujesz."),
            "Brzmi bardziej technicznie, niż jest w praktyce.",
            styled("Jeśli chcesz narysować las, wybierasz warstwę ", { text: "Teren", emphasis: "strong" }, ", następnie ", { text: "Las", emphasis: "strong" }, ", a na końcu sposób rysowania — na przykład Ołówek albo Wielokąt."),
            styled("Jeśli chcesz postawić prostokątny stół, wybierasz ", { text: "Obiekty → Mebel → Prostokąt", emphasis: "strong" }, "."),
            styled("A jeśli potrzebujesz drzwi, wybierasz ", { text: "Konstrukcja → Drzwi → Wstaw", emphasis: "strong" }, "."),
            styled({ text: "Co to jest? → Jak chcę to narysować?", emphasis: "strong" }),
          ],
        },
      ],
    },
    {
      heading: "Warstwy — porządek na stole kartografa",
      paragraphs: [
        styled("Warstwa mówi Gabinetowi, ", { text: "z jakim rodzajem zawartości mapy pracujesz", emphasis: "strong" }, ". Dzięki temu program wie, jak taki obiekt ma się zachowywać."),
        "Droga ma szerokość i przebieg. Las zajmuje obszar. Drzwi muszą znaleźć się w ścianie. Mebel można swobodnie przesuwać po pomieszczeniu. Wszystkie są widoczne na tej samej mapie, ale Gabinet traktuje je według innych zasad.",
        "W Piórniku znajdziesz kilka głównych warstw.",
      ],
      subsections: [
        {
          heading: "Teren",
          paragraphs: [
            styled("Tutaj powstaje krajobraz: ", { text: "woda, rzeki, strumienie, łąki, pola, lasy, skały", emphasis: "strong" }, " i inne rodzaje powierzchni."),
            "Używaj tej warstwy, gdy chcesz powiedzieć: „ten fragment mapy jest lasem”, „tędy płynie rzeka” albo „tutaj zaczyna się jezioro”.",
          ],
        },
        {
          heading: "Drogi",
          paragraphs: [
            styled("Tutaj rysujesz ciągi komunikacyjne: ", { text: "drogi utwardzone, drogi polne, ścieżki, alejki i chodniki", emphasis: "strong" }, "."),
            styled("Droga nie jest zwykłą kreską. Ma własny przebieg oraz szerokość, a jej szerokość możesz później ", { text: "lokalnie zwiększać lub zmniejszać", emphasis: "strong" }, " — na przykład poszerzyć trakt przy bramie albo zwęzić ścieżkę między zabudowaniami."),
            styled("Podczas rysowania Gabinet stara się prowadzić drogę w naturalny sposób i ", { text: "omijać budynki", emphasis: "strong" }, ", które stoją jej na przeszkodzie. Droga może natomiast przecinać różne rodzaje terenu: prowadzić przez łąkę, las, pole czy inny obszar mapy."),
            "Jej przebieg i szerokość mogą być później wykorzystywane przy wyznaczaniu tras.",
          ],
        },
        {
          heading: "Granice",
          paragraphs: [
            styled("Granice służą do zaznaczania ", { text: "umownych podziałów przestrzeni", emphasis: "strong" }, ": granicy miejscowości, parceli, dzielnicy albo innego wydzielonego obszaru."),
            styled("Przydadzą się, gdy chcesz pokazać, ", { text: "gdzie coś się zaczyna lub kończy", emphasis: "strong" }, ", niezależnie od tego, co fizycznie znajduje się po obu stronach. Granica może przebiegać przez las, pole, zabudowę albo kilka różnych rodzajów powierzchni."),
            styled("W tej warstwie narysujesz między innymi ", { text: "Granicę obszaru", emphasis: "strong" }, ". Jest ona widocznym oznaczeniem na mapie. Nie jest tym samym co Strefa w trybie Opowieść, która grupuje obiekty i może przekazywać im wspólne cechy."),
          ],
        },
        {
          heading: "Zabudowa",
          paragraphs: [
            styled("Tutaj umieszczasz ", { text: "budynki, wieże, ruiny, mosty będące budowlami", emphasis: "strong" }, " i inne obiekty architektoniczne widziane z zewnątrz."),
            "Budynek może później otrzymać własne wnętrze i kondygnacje w Atlasie.",
          ],
        },
        {
          heading: "Konstrukcja",
          paragraphs: [
            "To warsztat dla wnętrz budynków.",
            styled("Tutaj stawiasz ", { text: "ściany konstrukcyjne i działowe", emphasis: "strong" }, ", dodajesz ", { text: "drzwi, okna, bramy i przejścia", emphasis: "strong" }, ", tworzysz ", { text: "schody i windy", emphasis: "strong" }, ", a także powierzchnie takie jak ", { text: "tarasy, balkony, podesty, antresole czy sceny", emphasis: "strong" }, "."),
            "Jeżeli projektujesz plan domu, pałacu albo lochu, prawdopodobnie spędzisz tu sporo czasu.",
          ],
        },
        {
          heading: "Obiekty",
          paragraphs: [
            styled("Ta warstwa przechowuje wyposażenie i drobniejsze elementy otoczenia: ", { text: "meble, przedmioty, roślinność, pomniki, małą architekturę, znaczniki", emphasis: "strong" }, " i inne obiekty."),
            "To tutaj trafia stół stojący w jadalni, posąg w ogrodzie albo pojedyncze drzewo, które chcesz potraktować jako konkretny obiekt, a nie cały obszar lasu.",
          ],
        },
        {
          heading: "Szkic",
          paragraphs: [
            "Szkic jest twoim brudnopisem.",
            "Możesz nanosić pomocnicze kreski i notatki, zanim zdecydujesz, co naprawdę ma znaleźć się na mapie. Szkic można później ukrywać albo wyświetlać z mniejszym kryciem.",
          ],
        },
      ],
    },
    {
      heading: "Rodzaj obiektu i przybór to dwie różne rzeczy",
      paragraphs: [
        "To rozróżnienie jest warte zapamiętania od początku.",
        styled({ text: "Rodzaj obiektu odpowiada na pytanie „co tworzę?”", emphasis: "strong" }),
        styled({ text: "Przybór odpowiada na pytanie „jak nadaję temu kształt?”", emphasis: "strong" }),
        "Prostokąt nie jest więc rodzajem budynku. Jest sposobem narysowania budynku.",
        "Tym samym Prostokątem możesz narysować budynek, mebel albo obszar terenu — o ile wybrany rodzaj obiektu pozwala użyć tego przyboru.",
        styled("Nie każdy przybór pasuje do wszystkiego. Drzwi nie potrzebują Ołówka, ponieważ zamiast rysować je od zera, ", { text: "wstawiasz je w istniejącą ścianę", emphasis: "strong" }, ". Punktowy znacznik najlepiej po prostu wskazać jednym kliknięciem."),
        "Piórnik pokaże ci tylko sensowne możliwości dla tego, co aktualnie tworzysz.",
      ],
    },
    {
      heading: "Przybory — czym właściwie różni się Ołówek od Pióra?",
      paragraphs: [],
      subsections: [
        { heading: "Zaznacz i edytuj", paragraphs: ["To podstawowy przybór do pracy z rzeczami, które już istnieją.", "Kliknij obiekt, aby go zaznaczyć. W zależności od jego rodzaju możesz później przesuwać go, zmieniać rozmiar albo poprawiać jego kształt."] },
        { heading: "Zaznacz obszarem", paragraphs: ["Pozwala zaznaczyć wiele obiektów naraz.", "Przeciągnij prostokąt wokół interesującego cię fragmentu mapy. Przydaje się, gdy chcesz przesunąć całe umeblowanie pokoju albo wyrównać kilka elementów jednocześnie."] },
        { heading: "Ołówek", paragraphs: [styled({ text: "Ołówek służy do rysowania swobodnego.", emphasis: "strong" }), "Prowadzisz kursor tak, jak prowadziłabyś ołówek po papierze, a Gabinet zapisuje przebieg twojego ruchu.", "Nadaje się szczególnie do organicznych kształtów: nieregularnej linii brzegowej, szkicu lasu, krętej ścieżki czy roboczego obrysu.", styled("Możesz regulować ", { text: "wygładzenie Ołówka", emphasis: "strong" }, ", jeśli chcesz, aby program mocniej usuwał drobne drgania ręki.")] },
        { heading: "Pióro Béziera", paragraphs: [styled("Pióro służy do tworzenia ", { text: "precyzyjnych, gładkich krzywych", emphasis: "strong" }, "."), "Zamiast prowadzić całą linię ręcznie, stawiasz kolejne punkty. Każdy z nich może posiadać uchwyty określające kierunek i wygięcie krzywej.", styled("Ołówek jest lepszy, gdy chcesz po prostu ", { text: "narysować linię", emphasis: "em" }, ". Pióro Béziera — gdy chcesz ją ", { text: "zaprojektować", emphasis: "em" }, "."), "Po utworzeniu krzywej możesz przesuwać jej punkty, poprawiać uchwyty oraz zmieniać węzły między ostrymi i gładkimi."] },
        { heading: "Prosta", paragraphs: ["Tworzy pojedynczy prosty odcinek między dwoma wskazanymi punktami."] },
        { heading: "Ciąg ścian", paragraphs: ["Pozwala stawiać kolejne połączone odcinki ścian bez rozpoczynania każdej z osobna.", styled("Klikasz pierwszy punkt, następnie kolejny, kolejny i kolejny — jak przy prowadzeniu murów wokół pomieszczeń. Kiedy skończysz, ", { text: "naciśnij Enter", emphasis: "strong" }, ", aby zatwierdzić cały ciąg ścian.")] },
        { heading: "Prostokąt", paragraphs: ["Wskaż dwa przeciwległe narożniki. Gabinet zbuduje między nimi prostokątny kształt.", "To szybki sposób na tworzenie regularnych pomieszczeń, budynków, mebli i wielu innych obiektów."] },
        { heading: "Okrąg", paragraphs: ["Najpierw wskazujesz środek, potem punkt na jego obwodzie."] },
        { heading: "Elipsa", paragraphs: ["Wskazujesz dwa przeciwległe narożniki prostokąta, w którym ma zmieścić się elipsa."] },
        { heading: "Łuk trzypunktowy", paragraphs: ["Wskazujesz trzy punkty, a Gabinet prowadzi przez nie łuk.", "Przydatny wszędzie tam, gdzie potrzebujesz kontrolowanej krzywizny bez budowania całej krzywej Béziera."] },
        { heading: "Wielokąt", paragraphs: ["Stawiasz kolejne wierzchołki obszaru.", "To jeden z najważniejszych przyborów dla nieregularnych kształtów: parceli, ogrodów, lasów, dziedzińców czy budynków, które z jakiegoś powodu odmawiają bycia porządnym prostokątem."] },
        { heading: "Punkt", paragraphs: ["Umieszcza obiekt w jednym wskazanym miejscu.", "Używany przede wszystkim dla znaczników i innych drobnych obiektów punktowych."] },
        { heading: "Wstaw", paragraphs: [styled("Służy do elementów, które muszą zostać ", { text: "osadzone w czymś już istniejącym", emphasis: "strong" }, "."), "Najważniejszym przykładem są drzwi i okna. Najpierw powinna istnieć ściana, a potem wskazujesz miejsce, w którym ma pojawić się otwór."] },
        { heading: "Napisz notatkę", paragraphs: ["Wyznaczasz miejsce na arkuszu i wpisujesz tekst pomocniczy.", "Notatka należy do Szkicu, więc może zostać później ukryta wraz z pozostałymi pomocniczymi oznaczeniami."] },
        { heading: "Gumka", paragraphs: ["Gumka zachowuje się trochę inaczej zależnie od tego, czego dotkniesz.", "Może wyciąć fragment powierzchni, przeciąć ścianę, zetrzeć część szkicu albo usunąć cały obiekt. Jej szerokość ustawiasz w Piórniku."] },
      ],
    },
    {
      heading: "Rysowanie pierwszego obiektu",
      paragraphs: ["Załóżmy, że chcesz narysować prostokątny budynek."],
      steps: [
        styled("Włącz ", { text: "Kreślenie", emphasis: "strong" }, "."),
        styled("W Piórniku wybierz warstwę ", { text: "Zabudowa", emphasis: "strong" }, "."),
        styled("Wybierz ", { text: "Budynek", emphasis: "strong" }, "."),
        styled("Jako przybór wybierz ", { text: "Prostokąt", emphasis: "strong" }, "."),
        "Wskaż pierwszy narożnik na arkuszu.",
        "Wskaż przeciwległy narożnik.",
      ],
      subsections: [
        { heading: "Po narysowaniu", paragraphs: [styled("Podczas rysowania zobaczysz ", { text: "podgląd kształtu", emphasis: "strong" }, ", zanim zostanie zapisany."), styled("Po zakończeniu możesz przełączyć się na ", { text: "Zaznacz i edytuj", emphasis: "strong" }, ", kliknąć budynek i poprawić go bez rysowania od początku."), "Tak działa większość Gabinetu: najpierw wybierasz rzecz i sposób jej utworzenia, a później możesz ją swobodnie dopracowywać."] },
      ],
    },
    {
      heading: "Nie wszystkie kreski muszą od razu być doskonałe",
      paragraphs: [
        "Przy swobodnych i wielopunktowych kształtach może się zdarzyć, że rysunek nie zostanie poprawnie domknięty albo wyjdzie poza obszar, w którym wolno go utworzyć.",
        "Gabinet nie musi wtedy od razu wyrzucać twojej pracy.",
        "Jeżeli część rysunku wychodzi poza dozwolony obrys, Gabinet automatycznie przycina ją do tej granicy. Jeśli cały rysunek znajduje się poza obrysem, obiekt nie zostanie utworzony.",
        "W innych sytuacjach, zależnie od rodzaju obiektu i stanu rysunku, może zaproponować:",
      ],
      bullets: ["dalsze rysowanie,", "automatyczne domknięcie,", "pokazanie, jak wyglądałoby domknięcie,", "zachowanie kształtu jako otwartej ścieżki,", "przeniesienie go do Szkicu,", "albo odrzucenie rysunku."],
      subsections: [
        { heading: "Domykanie szczelin", paragraphs: [styled("Nie wszystkie możliwości są dostępne dla każdego rodzaju obiektu. W Piórniku znajdziesz także funkcję ", { text: "Domykaj szczeliny", emphasis: "strong" }, " oraz ustawienie tolerancji. Pozwala to automatycznie połączyć końce linii, które minęły się tylko nieznacznie."), "Przy planach budynków potrafi oszczędzić zaskakująco dużo polowania na mikroskopijne dziury między ścianami."] },
      ],
    },
    {
      heading: "Zaznaczanie i poprawianie tego, co już istnieje",
      paragraphs: ["Narysowanie obiektu nie zamyka sprawy.", styled("Po wybraniu ", { text: "Zaznacz i edytuj", emphasis: "strong" }, " możesz kliknąć obiekt na arkuszu. W zależności od jego rodzaju pojawią się odpowiednie uchwyty."), "Możesz między innymi:"],
      bullets: ["przesuwać obiekt,", "obracać go,", "zmieniać jego rozmiar,", "przesuwać wierzchołki,", "poprawiać końce ścian,", "edytować przebieg oraz lokalną szerokość dróg i rzek,", "edytować krzywe,", "dodawać i usuwać węzły,", "dzielić otwarte ścieżki,", "blokować i ukrywać obiekt,", "powielać go albo usuwać."],
      subsections: [
        { heading: "Działania zależą od obiektu", paragraphs: ["Nie wszystkie operacje pojawiają się przy każdym obiekcie. Stół nie potrzebuje węzłów drogi, a drzwi nie mają obrysu lasu. Inspektor i uchwyty pokazują działania pasujące do rzeczy, którą zaznaczyłaś."] },
      ],
    },
    {
      heading: "Inspektor — szczegóły wybranego obiektu",
      paragraphs: [
        styled("Po kliknięciu obiektu zajrzyj do ", { text: "prawej księgi", emphasis: "strong" }, "."),
        "Inspektor pokazuje informacje, których nie poprawia się bezpośrednio przez ciągnięcie uchwytów, oraz udostępnia te właściwości, które można zmienić dla danego rodzaju obiektu.",
        "Dla większości obiektów znajdziesz tam między innymi nazwę, opis, hasła, kolor, przezroczystość i inne właściwości zależne od wybranej rzeczy.",
        "Dla drogi możesz zmienić jej ogólną szerokość; lokalną szerokość zmieniasz uchwytami na mapie. Dla ściany Inspektor pokazuje jej rodzaj i grubość. Dla drzwi pokazuje rodzaj otworu i pozwala zmienić jego szerokość. Dla schodów możesz zmienić kształt, kierunek i połączone kondygnacje, a dla notatki — tekst oraz rozmiar pisma.",
        styled("Na końcu tej samej księgi znajdziesz również ", { text: "listę obiektów znajdujących się na otwartym arkuszu", emphasis: "strong" }, ". Możesz z niej zaznaczać rzeczy, wyszukiwać je po nazwie lub opisie, ukrywać, blokować i usuwać."),
        "Lista jest szczególnie przydatna, gdy mapa zrobi się tak gęsta, że próba trafienia kursorem w ten jeden właściwy stolik zaczyna przypominać operację chirurgiczną.",
      ],
    },
    {
      heading: "Kilka obiektów naraz",
      paragraphs: [
        "Nie musisz poprawiać wszystkiego pojedynczo.",
        "Po zaznaczeniu kilku obiektów możesz wykonywać wspólne operacje: powielać całe zaznaczenie, obracać je, odbijać, wyrównywać oraz rozmieszczać w równych odstępach.",
        styled("Masz sześć krzeseł przy ścianie sali balowej. Zamiast ustawiać każde „na oko”, zaznaczasz wszystkie i wybierasz ", { text: "równomierne rozmieszczenie poziome", emphasis: "strong" }, "."),
        "Gabinet zrobi za ciebie tę część pracy, przy której prawdziwy kartograf zaczynałby już cicho przeklinać linijkę.",
      ],
    },
    {
      heading: "Łączenie kształtów",
      paragraphs: ["Niektóre obiekty można również ze sobą łączyć."],
      bullets: [
        styled({ text: "Drogi", emphasis: "strong" }, " mogą zostać połączone końcami albo utworzyć skrzyżowanie."),
        styled({ text: "Rzeki i strumienie", emphasis: "strong" }, " można połączyć bez utraty ich szerokości."),
        styled({ text: "Budynki", emphasis: "strong" }, " można scalić w jedną bryłę. Przy scalaniu możesz zdecydować, czy dawne linie styku mają zniknąć, czy pozostać jako wewnętrzne ściany."),
        styled({ text: "Pomieszczenia", emphasis: "strong" }, " również można łączyć, gdy przestają być odrębnymi przestrzeniami."),
      ],
    },
    {
      heading: "Dodawanie i wycinanie fragmentów obrysu",
      paragraphs: [
        "Nie zawsze trzeba przebudowywać cały kształt.",
        styled("Polecenie ", { text: "Dodaj do obrysu", emphasis: "strong" }, " pozwala dorysować nowy fragment do istniejącego obszaru. Możesz w ten sposób dobudować skrzydło budynku, poszerzyć taras albo powiększyć obszar terenu."),
        styled({ text: "Wytnij pustkę", emphasis: "strong" }, " działa odwrotnie: odejmuje fragment od istniejącego obszaru. Możesz nim utworzyć:"),
      ],
      bullets: ["wewnętrzny dziedziniec,", "otwór pośrodku powierzchni,", "pustą przestrzeń otoczoną budynkiem."],
    },
    {
      heading: "Obrys aktualnej mapy",
      paragraphs: [
        styled("Każda mapa może mieć własny ", { text: "zewnętrzny obrys", emphasis: "strong" }, ", który określa, jaki obszar rzeczywiście do niej należy."),
        styled("W przypadku budynku jest to na przykład ", { text: "zewnętrzny obrys jego bryły", emphasis: "strong" }, ". Jeżeli pałac ma kształt litery U, jego mapa również może mieć taki kształt zamiast zajmować cały prostokątny arkusz."),
        styled("Polecenie ", { text: "Edytuj obrys", emphasis: "strong" }, " pozwala tę granicę poprawić. Po zakończeniu możesz ponownie zamknąć ją przed przypadkową zmianą."),
        styled({ text: "Kondygnacje domyślnie dziedziczą obrys budynku", emphasis: "strong" }, ", więc nie musisz osobno odrysowywać tej samej bryły na każdym piętrze."),
        "Możesz jednak zmienić obrys tylko wybranej kondygnacji, jeśli właśnie na niej budynek wygląda inaczej. Przydaje się to, gdy parter zajmuje pełną bryłę pałacu, ale piętro jest mniejsze albo jedna kondygnacja posiada dodatkowy taras.",
        "Dzięki temu nie trzeba rozrywać całej struktury budynku tylko dlatego, że jedno piętro postanowiło architektonicznie wyjść przed szereg.",
      ],
    },
    {
      heading: "Siatka, przyciąganie i miary",
      paragraphs: [
        styled("Jeżeli nie przepadasz za architekturą w stylu „ta ściana chyba była prosta, ale kartografowi kichnęło”, włącz ", { text: "siatkę pomocniczą", emphasis: "strong" }, "."),
        styled("W ustawieniach widoku możesz pokazać siatkę i osie, zmienić jej przezroczystość i odstęp oraz włączyć ", { text: "przyciąganie do siatki", emphasis: "strong" }, "."),
        "Przyciąganie sprawia, że tworzone i przesuwane punkty układają się na liniach lub przecięciach siatki. Jest szczególnie wygodne przy regularnych planach budynków.",
        styled("Możesz również wybrać jednostki — ", { text: "metry albo stopy", emphasis: "strong" }, " — oraz wyświetlać obliczone powierzchnie obiektów."),
      ],
    },
    {
      heading: "Poruszanie się po arkuszu",
      paragraphs: ["Nie myl przesuwania mapy z przesuwaniem obiektu.", styled("Gdy przesuwasz ", { text: "widok", emphasis: "strong" }, ", zachowujesz się tak, jakbyś przesuwała arkusz leżący pod szkłem. Narysowane rzeczy pozostają dokładnie tam, gdzie były."), "Możesz:"],
      bullets: ["przesuwać widok po arkuszu,", styled({ text: "przybliżać i oddalać kółkiem myszy", emphasis: "strong" }, " albo przyciskami ", { text: "+ / −", emphasis: "strong" }, " na obszarze roboczym,"), styled({ text: "obracać widok, kręcąc różą wiatrów", emphasis: "strong" }, " w narożniku arkusza,"), styled("kliknąć ", { text: "znaczek domku obok + / −", emphasis: "strong" }, ", aby przywrócić początkowe ustawienie widoku.")],
      subsections: [{ heading: "Widok nie zmienia projektu", paragraphs: ["Obrót widoku również nie obraca samego projektu. Jeśli ustawisz mapę bokiem, północ świata nie przeżywa z tego powodu kryzysu egzystencjalnego."] }],
    },
    {
      heading: "Gdy coś pójdzie źle",
      paragraphs: [styled("Na górze Piórnika znajdują się ", { text: "Cofnij", emphasis: "strong" }, " i ", { text: "Ponów", emphasis: "strong" }, "."), "Cofnij usuwa ostatnią wykonaną zmianę. Ponów przywraca zmianę, którą właśnie cofnięto.", "Nie trzeba więc bać się każdego przeciągnięcia uchwytu.", "A przy większych eksperymentach — takich jak przebudowa całego piętra — możesz dodatkowo zachować osobną wersję projektu. O wersjach i kalkach będzie jeszcze osobny rozdział."],
    },
    {
      heading: "Najprostszy przepis na pracę",
      paragraphs: ["Jeśli ogrom Piórnika na początku wygląda nieco podejrzanie, możesz zapamiętać jeden schemat:"],
      steps: [styled({ text: "Wybierz warstwę.", emphasis: "strong" }, " Z jakim rodzajem zawartości mapy pracujesz?"), styled({ text: "Wybierz rodzaj obiektu.", emphasis: "strong" }, " Co tworzysz?"), styled({ text: "Wybierz przybór.", emphasis: "strong" }, " Jak chcesz nadać temu kształt?"), styled({ text: "Narysuj na arkuszu.", emphasis: "strong" }), styled({ text: "Przełącz się na Zaznacz i edytuj.", emphasis: "strong" }), styled({ text: "Popraw kształt na mapie, a szczegóły w Inspektorze.", emphasis: "strong" })],
      subsections: [{ heading: "To wystarczy, żeby zacząć", paragraphs: ["Reszta Piórnika może spokojnie czekać w przegródkach, aż rzeczywiście będzie potrzebna."] }],
    },
  ],
};


export const drawingGuideTopicPl = pl;
