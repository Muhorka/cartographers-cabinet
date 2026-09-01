import type { EditorLocale } from "../i18n/workbench-copy";

export type LegalMarginaliaSection = "privacy" | "terms" | "legal";

type SectionCopy = { label: string; heading: string; paragraphs: string[]; bullets?: string[] };
type MarginaliaCopy = {
  title: string;
  open: string;
  publisher: string;
  contact: string;
  footer: {
    ariaLabel: string;
    privacy: string;
    terms: string;
    licences: string;
    contact: string;
  };
  sections: Record<LegalMarginaliaSection, SectionCopy>;
};

export const legalMarginaliaCopy: Record<EditorLocale, MarginaliaCopy> = {
  pl: {
    title: "Marginalia",
    open: "Informacje o prywatności, zasadach korzystania i licencjach",
    publisher: "Niezależny, niekomercyjny projekt Varéra",
    contact: "Kontakt",
    footer: { ariaLabel: "Stopka prawna", privacy: "Prywatność", terms: "Warunki", licences: "Licencje", contact: "Kontakt" },
    sections: {
      privacy: {
        label: "Privacy",
        heading: "Prywatność i zapis lokalny",
        paragraphs: [
          "Treść projektów pozostaje w tej przeglądarce. Kod aplikacji nie przesyła projektów do Varéra ani do Cloudflare.",
          "Projekty i wersje są zapisywane w IndexedDB, a wybrane ustawienia interfejsu w localStorage. Dane można usunąć w aplikacji albo przez wyczyszczenie danych witryny. Przedtem warto wyeksportować kopię JSON.",
          "Publiczne żądania przechodzą przez Cloudflare Pages. Dostawca hostingu może przetwarzać techniczne dane połączenia, takie jak adres IP, rodzaj urządzenia i przeglądarki, zgodnie ze swoją polityką prywatności. Varéra nie otrzymuje logów żądań tej statycznej strony.",
          "Jeżeli użytkownik sam napisze na adres kontaktowy, wiadomość i podane w niej dane będą używane w uzasadnionym interesie udzielenia odpowiedzi oraz obsługi zgłoszenia. Korespondencję przechowujemy tylko tak długo, jak jest potrzebna do tej sprawy; pocztę obsługuje Gmail, więc dane przetwarza również Google jako dostawca usługi.",
          "Możesz poprosić przez adres kontaktowy o dostęp, sprostowanie lub usunięcie dotyczących Cię danych, ograniczenie przetwarzania albo wnieść sprzeciw. Masz też prawo złożyć skargę do Prezesa Urzędu Ochrony Danych Osobowych. Nie stosujemy profilowania ani automatycznych decyzji.",
        ],
      },
      terms: {
        label: "Terms",
        heading: "Zasady korzystania",
        paragraphs: [
          "Aplikacja jest bezpłatnym, rozwijanym projektem konkursowym do przestrzennego światotwórstwa. Korzystanie z niej można zakończyć w dowolnej chwili przez zamknięcie strony.",
          "Do działania potrzebna jest współczesna przeglądarka z JavaScript i lokalnym magazynem danych. WebMCP wymaga dodatkowo zgodnej przeglądarki i hosta agenta.",
        ],
        bullets: [
          "Nie wprowadzaj treści bezprawnych ani danych innych osób bez odpowiedniej podstawy.",
          "Samodzielnie wykonuj kopie zapasowe ważnych projektów; wyczyszczenie danych witryny lub zmiana domeny może usunąć dostęp do lokalnego zapisu.",
          "Wersja konkursowa może się zmieniać i nie gwarantuje nieprzerwanego działania ani przydatności do określonego celu.",
          "Błędy i pytania można zgłaszać na adres kontaktowy podany poniżej.",
        ],
      },
      legal: {
        label: "Legal",
        heading: "Wydawca, WebMCP i licencje",
        paragraphs: [
          "Wydawca: Varéra — niezależny, niekomercyjny projekt. Użytkownik zachowuje prawa do treści własnych projektów; aplikacja nie odbiera ani nie publikuje ich kopii.",
          "Połączony agent może na żądanie odczytać dane otwartego projektu przez narzędzia WebMCP. Korzystaj wyłącznie z zaufanego agenta i sprawdź zasady prywatności jego dostawcy. Sama aplikacja nie zawiera modelu AI ani klucza API.",
          "Oryginalny kod źródłowy jest udostępniany na licencji MIT. Biblioteki, fonty Gelasio i Italianno oraz inne składniki zewnętrzne zachowują własne licencje opisane w informacjach o licencjach zewnętrznych.",
        ],
      },
    },
  },
  en: {
    title: "Marginalia",
    open: "Privacy, terms of use and licensing information",
    publisher: "An independent, non-commercial Varéra project",
    contact: "Contact",
    footer: { ariaLabel: "Legal footer", privacy: "Privacy", terms: "Terms", licences: "Licences", contact: "Contact" },
    sections: {
      privacy: {
        label: "Privacy",
        heading: "Privacy and local storage",
        paragraphs: [
          "Project content stays in this browser. The application code does not upload projects to Varéra or Cloudflare.",
          "Projects and checkpoints are stored in IndexedDB, while selected interface preferences use localStorage. Delete them in the application or by clearing this site's browser data. Export a JSON backup first if the work matters to you.",
          "Public requests pass through Cloudflare Pages. The hosting provider may process technical connection data such as an IP address, device type and browser under its own privacy policy. Varéra does not receive request logs for this static site.",
          "If you email the contact address, the message and information you provide are used under the legitimate interest of replying and handling the report. Correspondence is kept only as long as the matter requires; Gmail handles the mailbox, so Google also processes the data as the service provider.",
          "You may use the contact address to request access, correction or deletion of your data, restriction of processing, or to object. You can also complain to the President of the Polish Personal Data Protection Office. We do not profile users or make automated decisions.",
        ],
      },
      terms: {
        label: "Terms",
        heading: "Terms of use",
        paragraphs: [
          "This is a free, evolving hackathon project for spatial worldbuilding. You can stop using it at any time by closing the page.",
          "A modern browser with JavaScript and local storage is required. WebMCP also requires a compatible browser and agent host.",
        ],
        bullets: [
          "Do not enter unlawful content or another person's data without an appropriate basis.",
          "Back up important projects yourself; clearing site data or changing domains can remove access to locally stored work.",
          "The hackathon version may change and does not guarantee uninterrupted operation or fitness for a particular purpose.",
          "Report errors or questions through the contact address below.",
        ],
      },
      legal: {
        label: "Legal",
        heading: "Publisher, WebMCP and licences",
        paragraphs: [
          "Publisher: Varéra — an independent, non-commercial project. You retain rights to your own project content; the application does not receive or publish a copy.",
          "A connected agent can request data from the open project through WebMCP tools. Use only an agent you trust and review its provider's privacy terms. This application does not embed an AI model or API key.",
          "Original source code is released under the MIT License. Libraries, the Gelasio and Italianno fonts and other third-party components retain the licences described in the third-party notices.",
        ],
      },
    },
  },
};
