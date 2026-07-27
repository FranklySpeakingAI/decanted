export const APP = {
  name: 'Decanted',
  tagline: 'Finde die besten Weine zum fairsten Preis',
  description: 'Finde sofort die besten Preis-Leistungs-Weine auf jeder Weinkarte – analysiert von einem KI-Sommelier.',
  pageTitle: 'Decanted — Weinkarten-Scanner',
} as const;

export const UI = {
  newSearch: 'Neue Suche',
  scanUrl: 'URL scannen',
  uploadFile: 'Datei hochladen',
  findBestPours: 'Weinkarte analysieren →',
  topPicks: 'Top-Empfehlungen',
  noWinesMatch: 'Keine Weine passen zu diesen Filtern.',
  adjustFilters: 'Passe deine Auswahl an.',
  foundWines: (n: number) => `${n} ${n === 1 ? 'Wein' : 'Weine'} gefunden — hier sind deine besten Weine`,
  allWinesFound: (n: number) => `Alle ${n} ${n === 1 ? 'Wein' : 'Weine'}`,
  sortedByValue: 'nach Preis-Leistung sortiert',
  rankLabels: ['1.', '2.', '3.'] as const,
} as const;

export const METRICS = {
  menuPrice: 'Kartenpreis',
  estMarket: 'Marktpreis ca.',
  markup: 'Aufschlag',
  criticScore: 'Bewertung',
  valueScore: 'Preis-Leistung',
  pts: 'Pkt.',
} as const;

// Display labels for the WineType enum (the enum values themselves stay English —
// they are used for filtering logic; see FILTERS.wineTypes).
export const WINE_TYPE_LABELS: Record<string, string> = {
  Champagne: 'Champagner',
  White: 'Weisswein',
  Red: 'Rotwein',
  'Rosé': 'Rosé',
  Sparkling: 'Schaumwein',
  Dessert: 'Dessert',
  'Non-Alcoholic': 'Alkoholfrei',
};

// Display labels for the FoodPairing enum (values stay English for matching).
export const FOOD_PAIRING_LABELS: Record<string, string> = {
  'Red Meat': 'Rotes Fleisch',
  'White Meat': 'Weisses Fleisch',
  Game: 'Wild',
  Fish: 'Fisch',
  Vegetarian: 'Vegetarisch',
};

// Display labels for the region filter groups (keys stay English — they are the
// lookup keys into REGION_GROUPS in FilterBar).
export const REGION_GROUP_LABELS: Record<string, string> = {
  Bordeaux: 'Bordeaux',
  Burgundy: 'Burgund',
  Champagne: 'Champagne',
  'Rhône': 'Rhône',
  Switzerland: 'Schweiz',
  Italy: 'Italien',
  'Germany/Austria': 'Deutschland/Österreich',
  Spain: 'Spanien',
  'New World': 'Neue Welt',
  Other: 'Andere',
};

export const FILTERS = {
  foodPairing: 'Passt zu',
  region: 'Region',
  priceRange: 'Preisspanne',
  all: 'Alle',
  // Enum values — kept English; TYPE_ORDER slices this for WineType filtering.
  wineTypes: ['All', 'Champagne', 'White', 'Red', 'Rosé', 'Sparkling', 'Dessert', 'Non-Alcoholic'] as const,
  pairings: ['Red Meat', 'White Meat', 'Game', 'Fish', 'Vegetarian'] as const,
} as const;

export const LOADING = {
  title: 'Wir finden deine besten Weine…',
  subtitle: 'Unser Sommelier ist im Einsatz',
  stages: ['Karte wird gelesen', 'Preise werden recherchiert', 'Weine werden bewertet'] as const,
  messages: [
    'Deine Weinkarte wird gelesen…',
    'Marktpreise werden geprüft…',
    'Deine besten Weine werden gesucht…',
    'Fast geschafft — deine Top-Weine werden sortiert…',
  ] as const,
  slowWarning: 'Läuft noch — eine grosse Weinkarte kann etwas länger dauern. Bleib dran!',
} as const;

export const ERRORS = {
  rateLimit: 'Du hast dein heutiges Scan-Limit erreicht. Bitte versuche es morgen wieder.',
  invalidRequest: 'Ungültige Anfrage.',
  generic: 'Etwas ist schiefgelaufen. Bitte versuche es erneut.',
  urlRequired: 'Bitte gib eine gültige URL ein.',
  urlProtocol: 'Es werden nur http- und https-URLs unterstützt.',
  urlUnreachable: 'Diese URL ist nicht erreichbar. Bitte prüfe die Adresse und versuche es erneut.',
  noWineListFound: 'Auf dieser Seite wurde keine Weinkarte gefunden. Füge den direkten Link zur Weinkarte oder zum PDF ein.',
  noFile: 'Keine Datei ausgewählt.',
  fileUnreadable: 'Diese Datei konnte nicht gelesen werden. Bitte versuche ein anderes PDF, Word- oder Excel-Dokument.',
  fileEmpty: 'Die Datei scheint leer zu sein oder enthält nur Bilder. Bitte verwende ein PDF mit auswählbarem Text.',
  fileTooLarge: 'Bitte lade eine Datei unter 10 MB hoch.',
  fileType: 'Dieser Dateityp wird nicht unterstützt. Bitte lade ein PDF, Word- oder Excel-Dokument hoch.',
  pdfTooLarge: (pages: number) => `Dieses PDF ist zu gross (${pages} Seiten). Wir können bis zu 100 Seiten scannen — bitte lade nur den Weinkarten-Teil hoch.`,
  pdfImagesOnly: 'Das PDF scheint nur Bilder zu enthalten — es wurde kein auswählbarer Text gefunden.',
  noWineLines: 'Keine Weinzeilen erkannt. Bitte prüfe, ob das Dokument eine Weinkarte enthält.',
  parseFailure: 'Es konnten keine Weine aus dem Dokument gelesen werden. Bitte versuche eine andere Datei.',
} as const;

export const VALIDATION = {
  urlEmpty: 'Bitte gib eine URL ein.',
  urlProtocol: 'Es werden nur http- und https-URLs unterstützt.',
  urlInvalid: 'Bitte gib eine gültige URL ein (z. B. https://restaurant.ch/weinkarte).',
  dropzoneLabel: 'Zum Auswählen klicken oder Datei hierher ziehen',
  dropzoneHint: 'PDF, Word oder Excel · max. 10 MB',
  removeFile: 'Datei entfernen',
  tapToChoose: 'Zum Auswählen tippen',
} as const;

export const UPLOAD = {
  label: 'Weinkarte hochladen',
  urlLabel: 'Restaurant-Website URL',
  urlPlaceholder: 'https://restaurant.ch/weinkarte',
} as const;

// Currency fallback only — Switzerland-only, always CHF.
export const DEFAULT_CURRENCY = 'CHF';

// Wine list detection keywords — all languages, single source of truth.
export const WINE_LIST_KEYWORDS = [
  // English
  'wine', 'wines',
  // German
  'wein', 'weinkarte', 'weissweine', 'rotweine', 'schaumweine', 'roséweine',
  'dessertweine', 'offenwein', 'vinothek', 'getränke',
  // French
  'vins', 'vins blancs', 'vins rouges', 'cave', 'carte des vins',
  // Italian
  'vino', 'vini', 'cantina', 'bevande', 'carta dei vini',
  // Spanish
  'vinos', 'bodega', 'bebidas', 'carta de vinos',
] as const;
