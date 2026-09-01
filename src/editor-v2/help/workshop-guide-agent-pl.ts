import type { WorkshopGuideTopic } from "./workshop-guide-model";
import { styled } from "./workshop-guide-model";

const quote = (text: string) => styled({ text: `„${text}”`, emphasis: "em" });

export const agentGuideTopicPl: WorkshopGuideTopic = {
  id: "agent",
  title: "Praca z własnym agentem",
  summary: "Jak agent pomaga budować edytowalny świat, rozwijać opowieść i bezpiecznie pracować z prawdziwymi danymi projektu.",
  sections: [
    { heading: "Drugi kartograf przy stole", paragraphs: [
      styled("Gabinet kartografa możesz obsługiwać samodzielnie. Możesz też zaprosić do otwartego projektu ", { text: "agenta AI", emphasis: "strong" }, " i budować świat razem z nim."),
      "Najważniejsze jest jednak to, że agent nie służy wyłącznie do naciskania przycisków za ciebie.",
      styled("Dzięki WebMCP może ", { text: "odczytać uporządkowane dane projektu", emphasis: "strong" }, ", zrozumieć jego strukturę, a następnie używać własnego rozumowania do planowania, analizowania i rozwijania świata."),
      "Możesz więc zacząć nie od ręcznego stawiania każdego obiektu, ale od zwykłego opisu:",
      quote("Chcę niewielkie nadmorskie miasto z portem, starym centrum na wzgórzu i późniejszą dzielnicą przemysłową przy linii kolejowej."),
      "Agent może przełożyć taki pomysł na prawdziwy projekt Gabinetu: utworzyć odpowiednią strukturę Atlasu, rozplanować miejsca, dodać drogi, zabudowę i inne elementy, a następnie wracać do tego projektu razem z tobą.",
      "Efektem nie jest obrazek wygenerowany raz na zawsze.",
      styled("To nadal ", { text: "edytowalny projekt", emphasis: "strong" }, ", w którym możesz później przesuwać budynki, przebudowywać dzielnice, dodawać kondygnacje, zmieniać zasady dostępu albo poprosić agenta o kolejną wersję."),
    ] },
    { heading: "Od pomysłu do edytowalnego świata", paragraphs: [
      "Jedna prośba użytkownika może oznaczać wiele działań wewnątrz Gabinetu.",
      "Jeżeli powiesz:",
      quote("Zaprojektuj dużą rezydencję z częścią reprezentacyjną od frontu, prywatną od ogrodu i osobnym zapleczem gospodarczym."),
      "agent może sam rozłożyć ten cel na mniejsze decyzje.",
      "Może utworzyć budynek i jego kondygnacje, podzielić wnętrza, poprowadzić komunikację, dodać drzwi i schody, rozplanować otoczenie, a później uzupełnić projekt o dane Opowieści.",
      "Gabinet udostępnia agentowi narzędzia do odczytywania projektu, tworzenia i modyfikowania obiektów, przebudowy hierarchii, pracy z konstrukcją, Opowieścią, trasami, wersjami i Biblioteką projektów. Agent może również połączyć serię przygotowanych zmian w jedną operację.",
      "Siła tej współpracy nie polega więc na tym, że agent umie narysować prostokąt.",
      styled("Polega na tym, że może ", { text: "skomponować wiele drobnych operacji w jeden większy projekt", emphasis: "strong" }, "."),
    ] },
    { heading: "Wspólne dopracowywanie zamiast jednorazowego generowania", paragraphs: [
      "Pierwsza wersja nie musi być ostateczna. Możesz obejrzeć rezultat i powiedzieć:",
    ], bullets: [
      quote("Układ centrum jest dobry, ale port zajmuje za dużo miejsca."),
      quote("Zostaw część mieszkalną tak, jak jest, ale przebuduj zaplecze."),
      quote("Potrzebuję jeszcze jednego wejścia dla pracowników. Znajdź sensowne miejsce."),
    ], subsections: [
      { heading: "Świat pozostaje na stole", paragraphs: [
        "Agent może ponownie odczytać istniejący projekt, uwzględnić zaakceptowane części i pracować nad wskazanym problemem. Im wyraźniej określisz, czego nie należy zmieniać, tym łatwiej zachować obrany kierunek.",
        "To odróżnia wspólne projektowanie w Gabinecie od jednorazowego generowania mapy. Nie musisz za każdym razem zaczynać od pustej kartki.",
        styled({ text: "Świat pozostaje na stole. Możecie wracać do niego, poprawiać go i rozwijać.", emphasis: "strong" }),
      ] },
    ] },
    { heading: "Agent może myśleć na kilku poziomach naraz", paragraphs: [
      "Gabinet przechowuje więcej niż samą geometrię.",
      "Agent może odczytać strukturę Atlasu, obiekty i konstrukcję map, ale również postacie, grupy, właścicieli, cechy, strefy, dostęp, klucze, scenariusze, intencje oraz zapisane trasy.",
      "Dzięki temu podczas projektowania może zestawiać ze sobą różne pytania:",
    ], bullets: [
      quote("Gdzie zmieścić drugie schody?"),
      quote("Kto będzie z nich korzystał?"),
      quote("Czy prowadzą do miejsc, do których ta grupa ma dostęp?"),
      quote("Czy po zamknięciu głównego przejścia nadal istnieje sensowna droga?"),
      quote("Czy ten układ rzeczywiście oddziela przestrzeń publiczną od prywatnej?"),
    ], subsections: [
      { heading: "Obliczenia i interpretacja", paragraphs: ["Część takich odpowiedzi Gabinet może sprawdzić formalnie — na przykład obliczając trasę albo stosując zapisane zasady dostępu. Inne wymagają interpretacji agenta. I właśnie połączenie obu rzeczy jest użyteczne."] },
    ] },
    { heading: "Od budowania świata do opowiadania w nim historii", paragraphs: [
      "Współpraca z agentem nie kończy się, kiedy mapa jest gotowa.",
      styled("Gabinet może stać się ", { text: "wspólną pamięcią przestrzenną autora i agenta", emphasis: "strong" }, "."),
      "Przechowuje nie tylko układ świata, lecz także zapisane w nim znaczenia: mieszkańców, własność, grupy, cechy, relacje, dostęp, klucze, strefy, scenariusze i intencje autora.",
      "Agent może później odczytać tę wiedzę i wykorzystać ją podczas zwykłej rozmowy. Nie musisz za każdym razem tłumaczyć mu od początku, gdzie znajduje się gabinet, którędy prowadzi korytarz, które drzwi są zamknięte i kto posiada klucz.",
      "Możecie więc wspólnie zastanawiać się:",
    ], bullets: [
      "jak bohater może dostać się do trudno dostępnego miejsca",
      "gdzie najlepiej rozegrać określoną scenę",
      "jakie przeszkody wynikają z rzeczywistego układu budynku lub miasta",
      "co zmieni się po zamknięciu części mapy",
      "które postacie mają powód lub możliwość spotkania się w konkretnym miejscu",
      "jakie konflikty mogą wyniknąć z własności albo dostępu",
      "czego brakuje w zaprojektowanym świecie",
      "jak opisać podróż zgodnie z rzeczywistą trasą",
      "czy nowe wydarzenie nie przeczy wcześniejszym założeniom",
    ], subsections: [
      { heading: "Przykład: droga do archiwum", paragraphs: [
        "Załóżmy, że bohater ma niezauważenie dostać się z ogrodu do archiwum. Gabinet może dostarczyć agentowi rzeczywistych informacji: którędy prowadzą przejścia, które drzwi są zamknięte, gdzie istnieje tajne przejście, kto o nim wie, jakie strefy leżą po drodze i gdzie zapisano strażnika.",
        quote("Najbardziej wiarygodna wydaje się droga przez taras i korytarz pracowniczy. Jest dłuższa, ale omija główne wejście. Problemem pozostaje strażnik przy schodach — scena może wymagać odwrócenia jego uwagi."),
        "Gabinet nie udowodnił, że bohater pozostanie niezauważony. Dostarczył faktów i przestrzennych ograniczeń. Agent je zinterpretował. Autor decyduje, co rzeczywiście wydarzy się w opowieści.",
      ] },
    ] },
    { heading: "Fakty, obliczenia i twórcze sugestie", paragraphs: [
      "Przy pracy z agentem warto rozróżniać trzy rzeczy.",
      styled({ text: "Fakty z projektu", emphasis: "strong" }, " to informacje rzeczywiście zapisane w Gabinecie: położenie pomieszczenia, właściciel, szerokość drogi, posiadacz klucza czy przynależność do strefy."),
      styled({ text: "Wyniki Gabinetu", emphasis: "strong" }, " powstają wtedy, gdy aplikacja coś oblicza lub sprawdza — na przykład wyznacza trasę albo sprawdza intencję autora."),
      styled({ text: "Twórcze sugestie agenta", emphasis: "strong" }, " są jego interpretacją tych danych."),
      "Jeżeli agent mówi, że drzwi do magazynu są zamknięte, a Anna nie ma odpowiedniego klucza, może to wynikać bezpośrednio z danych projektu. Jeżeli dodaje, że jest to dobre miejsce na scenę konfrontacji, ponieważ prowadzi tutaj tylko jedno wygodne wejście, ta część jest już jego oceną.",
      "Nie jest przez to mniej użyteczna. Po prostu dobrze wiedzieć, co Gabinet wie, co potrafi obliczyć, a co agent proponuje od siebie.",
    ] },
    { heading: "Agent może też kontrolować i naprawiać projekt", paragraphs: [
      "Po zbudowaniu mapy agent może wrócić do niej jako kontroler. Gabinet pozwala mu sprawdzać strukturę projektu, oglądać konstrukcję, wyszukiwać obiekty i diagnozować część problemów danych, geometrii oraz powiązań.",
      "Możesz więc poprosić:",
    ], bullets: [
      quote("Przejrzyj tę kondygnację i poszukaj problemów."),
      quote("Sprawdź, czy pomieszczenia mają sensowne dojścia."),
      quote("Czy po mojej ostatniej przebudowie widzisz coś podejrzanego?"),
      quote("Sprawdź zapisane założenia projektu."),
    ], subsections: [
      { heading: "Budowanie, sprawdzanie i poprawianie", paragraphs: ["Jeżeli agent znajdzie problem, może go opisać, przygotować propozycję poprawki albo — jeśli tego chcesz — rzeczywiście zmienić projekt. Kontrola dotyczy danych i geometrii Gabinetu; nie zastępuje oceny konstrukcyjnej budynku ani sprawdzenia przepisów."] },
    ] },
    { heading: "„Sprawdź”, „zaproponuj” i „zastosuj”", paragraphs: [
      "Nie musisz znać nazw narzędzi WebMCP. Ważniejsze jest powiedzenie agentowi, czego od niego oczekujesz.",
    ], subsections: [
      { heading: "Sprawdź", paragraphs: [quote("Sprawdź, czy stąd da się dostać do wyjścia bez przechodzenia przez strefę prywatną."), "Agent odczytuje dane i przedstawia wynik lub analizę, ale nie musi niczego zmieniać."] },
      { heading: "Zaproponuj", paragraphs: [quote("Zapisz lepszy układ tego skrzydła jako propozycję, ale jeszcze go nie stosuj."), "Agent może przygotować wariant do obejrzenia przed wprowadzeniem zmian. Sprawdź, czy propozycja pojawiła się w zachowanych wersjach na końcu Inspektora."] },
      { heading: "Zastosuj", paragraphs: [quote("Dobrze. Przyjmij tę propozycję."), "Dopiero przyjęcie zapisanej propozycji zmienia właściwy projekt."] },
      { heading: "Ważne rozróżnienie", paragraphs: ["Te sformułowania pomagają agentowi dobrać sposób pracy, ale same nie są techniczną blokadą. Przy ważnej zmianie poproś wprost o zapisanie propozycji bez jej stosowania i sprawdź, czy rzeczywiście pojawiła się w zachowanych wersjach."] },
    ] },
    { heading: "Propozycje i bezpieczne eksperymenty", paragraphs: [
      styled("Agent może zachować przygotowaną zmianę jako ", { text: "propozycję", emphasis: "strong" }, ", zamiast od razu stosować ją do projektu."),
      "Możesz wtedy obejrzeć proponowany stan i zdecydować, czy chcesz go przyjąć. Dla obsługiwanych danych Opowieści Gabinet pokazuje bardziej szczegółowe różnice wartości, ich źródła i konflikty. W przypadku zmian mapy najważniejsza jest kalka proponowanego stanu oraz zbiorcza informacja o zakresie zmian.",
      "Jeżeli projekt zostanie w międzyczasie zmodyfikowany, stara propozycja może zostać oznaczona jako nieaktualna.",
      "Przy większych zmianach agent może również wykonać serię powiązanych operacji jako jedną całość i jeden krok historii.",
    ] },
    { heading: "Cofnij, Ponów i zachowane wersje", paragraphs: [
      "Odwracalne zmiany wykonane przez agenta korzystają z historii edytora tak samo jak twoje własne operacje.",
      styled({ text: "Cofnij", emphasis: "strong" }, " i ", { text: "Ponów", emphasis: "strong" }, " pozwalają wycofywać bieżące zmiany podczas tej samej otwartej sesji projektu. Ta historia nie jest trwałym archiwum i może zniknąć po przeładowaniu lub ponownym otwarciu projektu."),
      styled("Jeżeli potrzebujesz trwalszego punktu powrotu, służą do tego ", { text: "zachowane wersje projektu", emphasis: "strong" }, ". Przed niektórymi większymi lub ryzykownymi zmianami agenta może również powstać kalka bezpieczeństwa, czyli zachowany stan projektu sprzed operacji."),
      "Obiekty zablokowane do edycji są chronione również przed zmianami wykonywanymi przez agenta.",
      "Agent ma narzędzia do trwałego usuwania projektów i zapisanych wersji. Operacje te są dwuetapowe, ale nie wymagają obowiązkowego potwierdzenia człowieka w samym Gabinecie i nadal pozostają trwałe. Zlecaj je świadomie oraz wyłącznie zaufanemu agentowi.",
    ] },
    { heading: "Co agent widzi z bieżącej pracy?", paragraphs: [
      styled("Gabinet może przekazać agentowi również ", { text: "kontekst edytora", emphasis: "strong" }, ": aktualnie otwartą mapę, zaznaczenie, tryb pracy, przybór, aktywne soczewki, scenariusz i trasę."),
      "Dzięki temu zaznaczenie obiektu może ułatwić rozmowę. Możesz kliknąć budynek i powiedzieć:",
      quote("Co sądzisz o tym?"),
      "albo:",
      quote("Przenieś to bliżej drogi."),
      "Agent może sprawdzić, co jest zaznaczone.",
      styled("Zaznaczenie jest jednak ", { text: "kontekstem rozmowy, a nie granicą dostępu", emphasis: "strong" }, ". Połączony agent może korzystać także z innych danych projektu i Biblioteki, jeżeli wywoła udostępnione do tego narzędzia."),
    ] },
    { heading: "Jak połączyć agenta", paragraphs: [
      "Do zwykłej ręcznej pracy Gabinet nie potrzebuje agenta ani WebMCP.",
      "Aby agent mógł korzystać z narzędzi projektu, Gabinet musi być otwarty w przeglądarce i środowisku agenta obsługującym WebMCP. Dokładny sposób udostępnienia strony zależy od używanego produktu i może zmieniać się wraz z rozwojem przeglądarek.",
      styled("Aktualne informacje znajdziesz w materiałach ", { text: "WebMCP Challenge", href: "https://webmcp.devpost.com/resources", emphasis: "strong" }, " oraz w dokumentacji ", { text: "Chrome for Developers", href: "https://developer.chrome.com/docs/ai/agents", emphasis: "strong" }, "."),
      "Podstawowa próba wygląda tak:",
    ], steps: [
      "Otwórz Gabinet w środowisku obsługującym WebMCP.",
      "Otwórz projekt, nad którym chcesz pracować.",
      "Sprawdź panel WebMCP na dole aplikacji.",
      "Udostępnij otwartą stronę swojemu agentowi w sposób wymagany przez jego środowisko.",
      styled("Poproś: ", { text: "„Odczytaj nazwę i strukturę otwartego projektu za pomocą narzędzi Gabinetu kartografa.”", emphasis: "em" }),
    ], subsections: [
      { heading: "Co oznacza panel WebMCP", paragraphs: [
        "Panel pokazuje, czy przeglądarka udostępnia WebMCP, ile narzędzi zostało zarejestrowanych, czy wystąpiły błędy i czy host WebMCP pomyślnie wywołał któreś narzędzie strony.",
        "Sama poprawna rejestracja oznacza tylko, że Gabinet przygotował narzędzia dla środowiska. Nie dowodzi jeszcze, że konkretny agent widzi tę kartę. Jeżeli właśnie poprosiłaś agenta o próbny odczyt projektu, udane wywołanie jest praktycznym potwierdzeniem działającego połączenia.",
      ] },
    ] },
    { heading: "Prywatność", paragraphs: [
      styled("Projekty Gabinetu są przechowywane ", { text: "lokalnie w przeglądarce", emphasis: "strong" }, ". Sam Gabinet nie wysyła ich do Varéry ani do Cloudflare."),
      "Praca z zewnętrznym agentem zmienia jednak sytuację: żeby odpowiedzieć na pytanie o projekt, agent musi otrzymać odczytane dane. Informacje przekazane agentowi podlegają również zasadom jego dostawcy.",
      "Węższe zadanie może wykorzystywać mniej danych, ale zakres polecenia nie jest techniczną granicą dostępu. Połączony agent może wywołać narzędzia odczytujące szerszy zakres otwartego projektu, a także narzędzia Biblioteki.",
      "Korzystaj więc z agenta i dostawcy, którym ufasz. Przed pracą z wrażliwym projektem sprawdź jego zasady prywatności.",
    ] },
    { heading: "Pierwsze pięć minut z agentem", paragraphs: ["Najłatwiej zrozumieć tę współpracę, po prostu jej spróbować."], steps: [
      styled({ text: "Otwórz istniejący projekt.", emphasis: "strong" }, " Nie musi być rozbudowany."),
      styled({ text: "Poproś agenta:", emphasis: "strong" }, " „Przejrzyj mój projekt i opisz mi jego strukturę.”"),
      styled({ text: "Zaznacz fragment projektu i zapytaj:", emphasis: "strong" }, " „Co możesz mi powiedzieć o tym miejscu i jego otoczeniu?”"),
      styled({ text: "Przejdź do wspólnego projektowania:", emphasis: "strong" }, " „Zapisz jako propozycję jedną zmianę, która poprawiłaby ten fragment. Jeszcze jej nie stosuj.”"),
      styled({ text: "Jeżeli propozycja ci odpowiada:", emphasis: "strong" }, " „Dobrze. Przyjmij tę propozycję.”"),
      styled({ text: "Potraktuj projekt jako miejsce akcji:", emphasis: "strong" }, " „Jaka scena mogłaby się ciekawie rozegrać w tej części mapy? Oprzyj odpowiedź na danych projektu.”"),
    ], subsections: [
      { heading: "Cały przepływ", paragraphs: [styled({ text: "pomysł → uporządkowany świat → wspólna edycja → analiza → opowieść osadzona w tym samym świecie", emphasis: "strong" })] },
    ] },
    { heading: "Gabinet jako pamięć świata", paragraphs: [
      "Agent językowy świetnie radzi sobie z pomysłami, ale długa rozmowa o złożonej przestrzeni szybko obrasta w setki szczegółów: gdzie jest które pomieszczenie, kto ma klucz, które drzwi są tajne, jaka droga prowadzi do portu, gdzie kończy się dzielnica, kto jest właścicielem budynku i co zmieniło się podczas konkretnego wydarzenia.",
      styled("Gabinet przechowuje tę wiedzę ", { text: "w uporządkowanej, edytowalnej formie", emphasis: "strong" }, ". Agent może do niej wracać."),
      "Dlatego nie tworzysz tylko mapy świata.",
      styled({ text: "Tworzysz świat, o którym możesz później rozmawiać z agentem.", emphasis: "strong" }),
    ] },
    { heading: "Dla ciekawskich: narzędzia agenta", paragraphs: [
      "Gabinet udostępnia agentowi narzędzia do odczytu projektu, edycji mapy, pracy z konstrukcją i Opowieścią, tras, intencji, historii, wersji, Biblioteki projektów oraz operacji zbiorczych.",
      "Aktualną liczbę poprawnie zarejestrowanych narzędzi pokazuje panel WebMCP na dole aplikacji. Nie musisz znać ich technicznych nazw, aby pracować z agentem.",
    ] },
  ],
};
