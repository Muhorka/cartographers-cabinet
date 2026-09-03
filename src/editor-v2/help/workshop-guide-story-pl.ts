import type { WorkshopGuideTopic } from "./workshop-guide-model";
import { styled } from "./workshop-guide-model";

export const storyGuideTopicPl: WorkshopGuideTopic = {
  id: "story",
  title: "Opisywanie świata i sprawdzanie sytuacji",
  summary: "Jak dopisać mieszkańców, własność i zasady świata, a potem użyć soczewek, scenariuszy, tras oraz intencji.",
  sections: [
    { heading: "Kiedy sama mapa przestaje wystarczać", paragraphs: [
      styled("Narysowana mapa mówi, ", { text: "gdzie coś się znajduje i jak wygląda przestrzeń", emphasis: "strong" }, "."),
      "Może pokazać pałac, drogę przez las, układ mieszkań w kamienicy albo drzwi pomiędzy dwoma pokojami. Nie wie jednak jeszcze, kto mieszka w tych miejscach, do kogo należą, kto posiada klucze ani czy konkretna osoba ma prawo przez te drzwi przejść.",
      styled("Do tego służy tryb ", { text: "Opowieść", emphasis: "strong" }, "."),
      "Nie musisz z niego korzystać, żeby po prostu rysować mapy. Jeśli jednak chcesz sprawdzać świat jako działający system — z mieszkańcami, własnością, dostępem, wydarzeniami i trasami — właśnie tutaj dopisujesz informacje, których nie da się wyrazić samą geometrią.",
      styled("Po przełączeniu na ", { text: "Opowieść", emphasis: "strong" }, " nadal patrzysz na ten sam projekt i ten sam arkusz. Zmieniają się przede wszystkim narzędzia znajdujące się wokół mapy."),
    ] },
    { heading: "Księga świata — kto i co istnieje w projekcie", paragraphs: [
      styled("W lewej księdze znajdziesz ", { text: "Księgę świata", emphasis: "strong" }, ". To tutaj przechowywane są rzeczy, które nie muszą mieć własnego kształtu na mapie, ale mają znaczenie dla tego, co się na niej dzieje."),
      "Możesz tworzyć między innymi:",
    ], bullets: [
      styled({ text: "Postacie", emphasis: "strong" }, " — konkretne osoby występujące w świecie."),
      styled({ text: "Frakcje", emphasis: "strong" }, " — rody, organizacje, gildie, instytucje albo inne stronnictwa."),
      styled({ text: "Grupy osób", emphasis: "strong" }, " — zbiory postaci pełniących podobną rolę, na przykład „Mieszkańcy”, „Straż”, „Pracownicy” albo „Goście”."),
      styled({ text: "Klucze", emphasis: "strong" }, " — przedmioty lub uprawnienia przypisywane przejściom jako akceptowane klucze, a postaciom, frakcjom i grupom jako posiadane klucze."),
      styled({ text: "Scenariusze", emphasis: "strong" }, " — sytuacje, w których świat przez jakiś czas działa inaczej niż zwykle."),
      styled({ text: "Intencje", emphasis: "strong" }, " — założenia autora, które Gabinet może później spróbować sprawdzić."),
      styled({ text: "Relacje", emphasis: "strong" }, " — opisowe powiązania pomiędzy ludźmi, organizacjami, miejscami i obiektami."),
    ] },
    { heading: "Postacie, grupy i frakcje", paragraphs: [
      "Załóżmy, że projektujesz dużą posiadłość. Możesz utworzyć postać Anna, należącą do grupy Mieszkańcy, oraz postać Marek, należącą do grupy Pracownicy.",
      "Grupom można przypisywać wspólne właściwości. Dzięki temu nie trzeba osobno wpisywać tej samej informacji przy kilkunastu osobach.",
      "Jeżeli wszyscy pracownicy mają dostęp do zaplecza, w zasadach dostępu zaplecza możesz wskazać całą grupę Pracownicy. Konkretna osoba może mieć własne dodatkowe cechy, a w regule dostępu miejsca można wskazać ją jako wyjątek.",
      "Podobnie działają frakcje. Postać może należeć na przykład do gildii, rodu, przedsiębiorstwa albo miejskiej straży i dziedziczyć część informacji wynikających z tej przynależności.",
      "Gabinet pokaże również sytuację, w której różne grupy przekazują tej samej osobie sprzeczne wartości. Dzięki temu konflikt nie znika po cichu gdzieś pod biurkiem kartografa.",
    ] },
    { heading: "Właściciele miejsc i obiektów", paragraphs: [
      "Każdemu miejscu lub obiektowi możesz przypisać jednego lub kilku właścicieli. Mogą nimi być postacie, frakcje albo grupy osób.",
      styled("Jeżeli cały dom należy do jednej osoby, nie musisz oznaczać osobno każdego pokoju. Mniejsze miejsca mogą ", { text: "dziedziczyć właściciela z miejsca nadrzędnego", emphasis: "strong" }, "."),
      "Dom należy do Anny, więc salon, kuchnia i sypialnia również mogą automatycznie należeć do Anny.",
      "Jeśli jednak znajdujący się w domu lokal użytkowy należy do kogoś innego, możesz dla niego ustawić własnego właściciela i przerwać dziedziczenie.",
      "W Inspektorze Opowieści zobaczysz zarówno właściciela przypisanego bezpośrednio, jak i tego wynikającego z miejsca nadrzędnego.",
    ] },
    { heading: "Cechy — własny słownik informacji", paragraphs: [
      "Nie każdy świat potrzebuje takich samych danych. W projekcie kryminału może być ważne, czy pomieszczenie ma monitoring. W grze fantasy — czy teren jest skażony magią. Przy projektowaniu miasta możesz potrzebować liczby mieszkańców, rodzaju zabudowy albo poziomu zagrożenia.",
      styled("Dlatego w Gabinecie możesz tworzyć własne ", { text: "cechy", emphasis: "strong" }, ". Cecha może przechowywać:"),
    ], bullets: ["tekst", "liczbę", "liczbę z jednostką", "odpowiedź tak / nie", "jeden wybór z listy", "kilka wyborów", "powiązanie z innym wpisem projektu"], subsections: [
      { heading: "Przykład", paragraphs: ["Możesz stworzyć cechę Ogrzewane jako Tak/Nie, Liczba mieszkańców jako liczbę albo Funkcja pomieszczenia jako wybór z przygotowanej listy. Raz utworzoną cechę można wykorzystywać w wielu miejscach projektu."] },
    ] },
    { heading: "Strefy — grupowanie miejsc według znaczenia", paragraphs: [
      styled({ text: "Strefa", emphasis: "strong" }, " pozwala połączyć kilka istniejących miejsc lub obiektów, które z jakiegoś powodu chcesz traktować jako całość. Nie muszą tworzyć osobnego poziomu w Atlasie ani nawet znajdować się obok siebie."),
      "Możesz na przykład utworzyć:",
    ], bullets: [
      "strefę prywatną obejmującą sypialnie i gabinet",
      "zaplecze pracownicze obejmujące kuchnię, magazyn i pomieszczenie gospodarcze",
      "teren zalewowy obejmujący wybrane, wcześniej narysowane obszary zieleni położone wzdłuż rzeki",
      "apartament lub mieszkanie obejmujące kilka pomieszczeń na tej samej kondygnacji",
      "dzielnicę miasta obejmującą istniejące miejsca i obiekty należące do tej części miasta",
    ], subsections: [
      { heading: "Strefa a Atlas", paragraphs: [
        "Miasto może istnieć w Atlasie jako jeden poziom mapy, a jego Stare Miasto, dzielnica portowa, przemysłowa i willowa mogą być strefami grupującymi elementy znajdujące się na tej samej mapie.",
        "Podobnie kondygnacja kamienicy może być jednym arkuszem, na którym poszczególne mieszkania są oznaczone jako osobne strefy.",
        "Jeden obiekt może należeć do więcej niż jednej strefy jednocześnie. Pokój może więc należeć zarówno do strefy „Mieszkanie 4”, jak i „Strefa prywatna”. Strefa może też posiadać własne cechy, które są dziedziczone przez znajdujące się w niej elementy.",
      ] },
    ] },
    { heading: "Soczewki — spójrz na mapę pod innym kątem", paragraphs: [
      styled("Kiedy projekt staje się większy, samo oglądanie wszystkich danych w Inspektorze przestaje być wygodne. Do tego służą ", { text: "Soczewki", emphasis: "strong" }, "."),
      "Soczewka bierze informacje zapisane w projekcie i podświetla na mapie rzeczy spełniające wybrane warunki. Możesz więc poprosić Gabinet, żeby pokazał:",
    ], bullets: [
      "wszystko należące do konkretnej osoby",
      "miejsca, których reguła dostępu dopuszcza wybraną osobę lub grupę",
      "obiekty, dla których konkretna cecha ma wskazaną wartość",
      "całą wybraną strefę",
      "kilka konkretnych obiektów",
    ], subsections: [
      { heading: "Przykłady", paragraphs: [
        "Soczewka Dostęp dla gości może pokazać miejsca, w których reguła dostępu dopuszcza grupę Goście. Nie oblicza drogi i nie sprawdza zamków ani posiadanych kluczy — do tego służy wyznaczanie trasy.",
        "Soczewka Obiekty zabytkowe może podświetlić wszystkie rzeczy, dla których cecha Zabytek ma wartość Tak.",
        "Warunki można łączyć, wymagając wszystkich albo przynajmniej jednego z nich. Możesz też odwrócić warunek, na przykład pokazując wszystko, co nie należy do określonej strefy.",
        "Soczewkę można tylko tymczasowo podejrzeć albo zapisać pod nazwą i wracać do niej później. Można również włączyć kilka soczewek jednocześnie.",
      ] },
    ] },
    { heading: "Dostęp — kto właściwie może wejść?", paragraphs: [
      styled("Drzwi na mapie mogą istnieć fizycznie, ale w Opowieści możesz określić, ", { text: "jak działają dla mieszkańców świata", emphasis: "strong" }, ". Dla miejsca lub przejścia możesz ustalić między innymi:"),
    ], bullets: [
      "dostęp dla wszystkich, tylko dla wybranych osób lub grup albo całkowity brak dostępu",
      "osoby stanowiące wyjątek od reguły",
      "czy przejście jest otwarte czy zamknięte oraz czy posiada zamek",
      "jakie klucze je otwierają i kto posiada te klucze",
      "czy miejsca pilnuje strażnik",
    ], subsections: [
      { heading: "Tajne przejścia", paragraphs: ["Możesz oznaczyć tajne przejście i zapisać, które postacie wiedzą o jego istnieniu. To istotne przy trasach: postać nie powinna korzystać ze skrótu przez sekretny korytarz tylko dlatego, że ty jako autor widzisz go na planie."] },
    ] },
    { heading: "Klucze", paragraphs: [
      "Klucz tworzysz raz w Księdze świata. Później wskazujesz go przy przejściach, które go akceptują, oraz przy postaciach, frakcjach i grupach, które go posiadają.",
      "Jeden klucz może otwierać kilka przejść, a jedne drzwi mogą akceptować więcej niż jeden klucz.",
      "Dzięki temu zamiast wpisywać przy każdych drzwiach „Anna może wejść”, opisujesz właściwy mechanizm: Anna posiada klucz → klucz otwiera drzwi → Anna może z nich skorzystać.",
      "Jeżeli później odbierzesz jej klucz, nie musisz ręcznie zmieniać wszystkich drzwi, które nim otwierała.",
    ] },
    { heading: "Trasy — czy ktoś naprawdę może dostać się z A do B?", paragraphs: [
      styled("Kiedy mapa ma już geometrię i podstawowe zasady Opowieści, Gabinet może spróbować znaleźć ", { text: "rzeczywistą trasę dla konkretnego podróżującego", emphasis: "strong" }, "."),
      "Wybierasz początek, cel oraz — jeśli ma to znaczenie — postać, frakcję albo grupę osób. Gabinet bierze wtedy pod uwagę nie tylko odległość, lecz także:",
    ], bullets: ["ściany i przejścia", "drzwi", "schody i windy", "kolejne kondygnacje", "drogi", "prawa dostępu", "zamki i klucze", "sposób podróży"], subsections: [
      { heading: "Ustawienia podróży", paragraphs: [
        "Możesz szukać trasy pieszo, konno albo pojazdem. Dla tras na zewnątrz możesz pozwolić lub zabronić poruszania się poza drogami, a dla przejść przez ściany określić, czy wolno korzystać z okien.",
        "Początek i cel możesz wybrać z istniejących miejsc lub obiektów terenu albo wskazać dokładny punkt bezpośrednio na mapie. Jeżeli istnieje kilka sensownych możliwości, Gabinet może zaproponować do trzech wariantów.",
        "Jeżeli przejścia pilnuje strażnik, Gabinet może pokazać warunek straży, ale nie zawsze rozstrzygnie sam, czy podróżujący go spełnia. Taka sytuacja może wymagać oceny autora.",
      ] },
    ] },
    { heading: "Przykład: drzwi są blisko, ale to jeszcze nie znaczy, że można przez nie przejść", paragraphs: [
      "Załóżmy, że Anna znajduje się w holu i chce dostać się do archiwum. Najkrótsza droga prowadzi przez zamknięte drzwi.",
      "Anna nie posiada odpowiedniego klucza, ale istnieje dłuższa droga przez korytarz dostępny dla wszystkich. Gabinet może odrzucić pierwsze przejście i poprowadzić Annę drugą trasą.",
      "Jeżeli żadna legalna droga nie istnieje, dostaniesz informację, że celu nie można osiągnąć — zamiast linii przeprowadzonej dla wygody przez najbliższą ścianę.",
      "I właśnie tutaj geometria Kreślenia spotyka się z zasadami Opowieści.",
    ] },
    { heading: "Zapisywanie tras", paragraphs: [
      styled("Obliczoną trasę możesz tylko obejrzeć albo ", { text: "zapisać pod własną nazwą", emphasis: "strong" }, ". Przydaje się to, jeśli regularnie wracasz do tej samej drogi — na przykład „Wejście gości”, „Droga dostaw” albo „Trasa ewakuacyjna”."),
      "Gabinet pamięta, na podstawie jakiego stanu projektu została obliczona. Jeśli później przesuniesz ścianę, zamkniesz drzwi albo zmienisz zasady dostępu, stary wynik może zostać oznaczony jako nieaktualny. Wtedy trasę można ponownie przeliczyć.",
      "Podczas sprawdzania intencji zapisana trasa działa jak zapisane pytanie: pamięta początek, cel, podróżującego i ustawienia. Gabinet nie traktuje jednak jej dawnego przebiegu jako dowodu — oblicza drogę ponownie dla aktualnej mapy, scenariusza i kroku.",
    ] },
    { heading: "Scenariusze — kiedy świat na chwilę działa inaczej", paragraphs: [
      "Nie każda zasada świata jest wieczna. Drzwi mogą być zwykle otwarte, ale zamknięte podczas alarmu. Sala może normalnie należeć do mieszkańców, ale podczas przyjęcia zostać udostępniona gościom. Przejście może zostać zablokowane podczas remontu.",
      styled("Do takich sytuacji służą ", { text: "Scenariusze", emphasis: "strong" }, ". Scenariusz opisuje alternatywny stan świata bez niszczenia jego zwykłych danych."),
      "Możesz utworzyć na przykład scenariusz Przyjęcie, Pożar, Noc albo Remont skrzydła zachodnie i określić, co w tej sytuacji ulega zmianie.",
    ] },
    { heading: "Kroki scenariusza", paragraphs: [
      "Scenariusz może składać się z kilku kroków, jeśli sytuacja zmienia się w czasie. Pożar może mieć kroki: Wykrycie pożaru, Zamknięcie części budynku oraz Ewakuacja.",
      "Każdy krok może posiadać własne skutki. Możesz też dodać zmianę obowiązującą przez cały scenariusz, niezależnie od wybranego kroku.",
      "Na górnym pasku Opowieści wybierasz scenariusz oraz krok, który chcesz właśnie oglądać.",
    ] },
    { heading: "Opis wydarzenia nie zmienia świata sam z siebie", paragraphs: [
      "Jeżeli wpiszesz w scenariuszu „Ochrona zamyka północne skrzydło”, jest to po prostu opis dla ciebie.",
      styled("Żeby Gabinet wiedział, jakie ma to konsekwencje, trzeba dodać ", { text: "skutek", emphasis: "strong" }, " do konkretnych miejsc lub obiektów."),
      "Możesz wskazać odpowiednie drzwi i w tym scenariuszu zmienić ich stan na zamknięty albo zmienić zasady dostępu do całej części budynku. Dzięki temu opis pozostaje czytelny dla człowieka, a skutki są jednocześnie zrozumiałe dla programu.",
    ] },
    { heading: "Baza czy tylko ten scenariusz?", paragraphs: [
      styled("Podczas pracy z aktywnym scenariuszem Gabinet pozwala wybrać, ", { text: "gdzie ma zostać zapisana zmiana", emphasis: "strong" }, "."),
      styled({ text: "Stałe właściwości świata", emphasis: "strong" }, " oznaczają zmianę rzeczywistego, podstawowego stanu projektu."),
      styled({ text: "Tylko w tej scenie", emphasis: "strong" }, " oznacza zmianę obowiązującą wyłącznie w wybranym scenariuszu lub jego kroku. Jeśli aktywny jest krok, zmiana trafia do tego kroku; bez wybranego kroku obowiązuje przez cały scenariusz."),
      "Jeśli odkryjesz, że drzwi zawsze powinny być zamykane na klucz — poprawiasz bazę. Jeżeli mają być zamknięte tylko podczas alarmu — zapisujesz zmianę w scenariuszu.",
    ] },
    { heading: "Intencje autora — „to powinno działać”", paragraphs: [
      styled("Czasami nie interesuje cię jeszcze dokładna odpowiedź. Wiesz przede wszystkim, ", { text: "co w zaprojektowanym świecie powinno być możliwe", emphasis: "strong" }, ". Do zapisania takich wymagań służą Intencje autora."),
      "Możesz na przykład zapisać: „Gość powinien móc dotrzeć z wejścia do sali konferencyjnej”, „Trasa dostaw musi prowadzić przez magazyn”, „Droga ewakuacyjna nie może przechodzić przez strefę zamkniętą” albo „Pracownicy techniczni muszą mieć dostęp do kotłowni”.",
      "Status autora mówi, czy intencja jest szkicem, zaakceptowanym wymaganiem czy odrzuconym pomysłem. Nie jest wynikiem automatycznego sprawdzenia.",
    ] },
    { heading: "Co można sprawdzić automatycznie", paragraphs: ["Intencja może dotyczyć między innymi:"], bullets: [
      styled({ text: "Osiągalności", emphasis: "strong" }, " — czy da się dotrzeć do celu."),
      styled({ text: "Musi przejść", emphasis: "strong" }, " — czy obliczona trasa prowadzi przez wskazane miejsce."),
      styled({ text: "Omiń strefę", emphasis: "strong" }, " — czy obliczona trasa omija wskazany obszar strefy."),
      styled({ text: "Reguły dostępu", emphasis: "strong" }, " — czy konkretna postać, frakcja lub grupa osób ma prawo wejść."),
      styled({ text: "Intencja niestandardowa", emphasis: "strong" }, " — wymaganie pozostawione do ludzkiej oceny."),
    ], subsections: [
      { heading: "Granice sprawdzenia", paragraphs: ["Sprawdzenie dotyczące przebiegu drogi ocenia jedną świeżo obliczoną trasę, a nie wszystkie możliwe drogi. Automatyczne sprawdzenie omijania strefy wymaga, aby strefa miała wyznaczony obszar na mapie."] },
    ] },
    { heading: "Sprawdź założenia sceny", paragraphs: [
      styled("Kiedy chcesz przekonać się, czy świat zachowuje się zgodnie z planem, uruchamiasz ", { text: "Sprawdź założenia sceny", emphasis: "strong" }, "."),
      "Możesz objąć sprawdzaniem intencje związane z aktualnym zaznaczeniem albo intencje z całego projektu. Przy bardzo dużym zakresie raport może objąć tylko jego część i poprosi o zawężenie.",
      "Regułę dostępu Gabinet może sprawdzić bez wyznaczania drogi. Intencje dotyczące trasy potrzebują zapisanej trasy z odpowiednim początkiem i celem. Jej punkty i ustawienia zostaną użyte do nowego obliczenia dla aktualnego scenariusza i kroku. Jeśli nie masz odpowiedniej trasy, wybierz Przygotuj trasę, wyznacz ją i zapisz, a następnie wróć do sprawdzania.",
      "Wynik nie ogranicza się do prostego „tak” albo „nie”. Możesz zobaczyć:",
    ], bullets: [
      styled({ text: "Spełniona", emphasis: "strong" }, " — wszystko działa zgodnie z założeniem."),
      styled({ text: "Warunkowo", emphasis: "strong" }, " — działa, ale zależy od określonych okoliczności."),
      styled({ text: "Naruszona", emphasis: "strong" }, " — obecny świat przeczy założeniu."),
      styled({ text: "Brak danych", emphasis: "strong" }, " — Gabinet nie ma wystarczających informacji."),
      styled({ text: "Do oceny autora", emphasis: "strong" }, " — tego pytania nie da się sensownie rozstrzygnąć automatycznie."),
    ], subsections: [
      { heading: "Raport", paragraphs: ["Przy wyniku możesz zobaczyć wykorzystane dane, brakujące informacje i konflikty. Raport niczego sam nie zmienia: nie przestawia statusu intencji ani nie zapisuje wyniku jako nowej zasady świata."] },
    ] },
    { heading: "Notatnik autora", paragraphs: [
      styled("Przycisk ", { text: "Notatnik", emphasis: "strong" }, " na górnym pasku Opowieści otwiera nad mapą kartkę na pomysły, szkice scen i dłuższe teksty."),
      "Notatki zapisują się razem z projektem. Pasek nad kartką pozwala tworzyć nagłówki i cytaty oraz wyróżniać tekst; ¶ przywraca zwykły akapit, a Tx usuwa formatowanie.",
      "Do tekstu możesz wstawiać odnośniki do miejsc, obiektów i scenariuszy projektu. Notatnik ma własne cofanie i ponawianie, a jego szerokość możesz zmienić, przeciągając lewą krawędź kartki.",
    ] },
    { heading: "Powrót do zwykłego świata", paragraphs: [
      "Podczas pracy możesz mieć jednocześnie włączone soczewki, scenariusz, konkretny krok i trasę.",
      styled("Jeżeli na mapie zaczyna być więcej kolorowych informacji niż samej mapy, wybierz ", { text: "Przywróć widok podstawowy", emphasis: "strong" }, "."),
      "Gabinet wyłączy aktywne podglądy i pokaże zwykły stan projektu. Nie usuwa przy tym zapisanych soczewek, tras ani scenariuszy.",
    ] },
    { heading: "Najprostszy sposób na rozpoczęcie Opowieści", paragraphs: [
      "Nie próbuj od razu opisywać całego społeczeństwa, systemu własności i czterystu kluczy do zamku. Na początek wystarczy mały eksperyment:",
    ], steps: [
      "Utwórz jedną postać.",
      "Wybierz miejsce na mapie i przypisz mu właściciela.",
      "Utwórz grupę i dodaj do niej postać.",
      "Ustaw zasady dostępu do jednego pomieszczenia.",
      "Jeśli są tam zamykane drzwi, utwórz klucz i daj go postaci.",
      "Poproś Gabinet o znalezienie trasy do pomieszczenia.",
    ], subsections: [
      { heading: "Co właśnie się wydarzyło?", paragraphs: [
        styled("Informacje, które zapisujesz osobno, ", { text: "zaczynają później współpracować", emphasis: "strong" }, "."),
        styled("Mapa mówi Gabinetowi, którędy można fizycznie przejść. Opowieść mówi, komu wolno. A dopiero połączenie obu pozwala odpowiedzieć na pytanie: ", { text: "„czy ta konkretna osoba naprawdę może się tam dostać?”", emphasis: "strong" }),
      ] },
    ] },
  ],
};
