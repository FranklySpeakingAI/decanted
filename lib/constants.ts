export const APP = {
  name: 'Decanted',
  tagline: 'Find the best value pours at your table',
  description: 'Instantly find the best-value wines on any restaurant list. Powered by AI sommelier analysis.',
  pageTitle: 'Decanted — Wine Value Finder',
} as const;

export const UI = {
  newSearch: 'New search',
  scanUrl: 'Scan URL',
  uploadFile: 'Upload File',
  findBestPours: 'Analyse My Wine List →',
  topPicks: 'Top picks',
  noWinesMatch: 'No wines match those filters.',
  adjustFilters: 'Try adjusting your selection.',
  foundWines: (n: number) => `Found ${n} ${n === 1 ? 'wine' : 'wines'} — here are your best pours`,
  allWinesFound: (n: number) => `All ${n} ${n === 1 ? 'wine' : 'wines'} found`,
  sortedByValue: 'sorted by value',
  rankLabels: ['1st', '2nd', '3rd'] as const,
} as const;

export const METRICS = {
  menuPrice: 'Menu price',
  estMarket: 'Est. market',
  markup: 'Markup',
  criticScore: 'Critic score',
  valueScore: 'Value score',
  pts: 'pts',
} as const;

export const FILTERS = {
  foodPairing: 'Food pairing',
  region: 'Region',
  priceRange: 'Menu price range',
  all: 'All',
  wineTypes: ['All', 'Champagne', 'White', 'Red', 'Rosé', 'Sparkling', 'Dessert', 'Non-Alcoholic'] as const,
  pairings: ['Red Meat', 'White Meat', 'Game', 'Fish', 'Vegetarian'] as const,
  regionGroups: {
    France: ['Bordeaux', 'Burgundy', 'Champagne', 'Rhône', 'Alsace', 'Loire', 'Languedoc', 'Provence', 'Jura', 'Beaujolais', 'Southwest France'],
    Switzerland: ['Swiss — Vaud', 'Swiss — Valais', 'Swiss — Geneva', 'Swiss — Neuchâtel'],
    Italy: ['Tuscany', 'Piedmont', 'Veneto', 'Sicily'],
    'Germany/Austria': ['Germany', 'Austria'],
    Spain: ['Rioja', 'Ribera del Duero', 'Priorat'],
    'New World': ['Napa Valley', 'Sonoma', 'Argentina', 'Chile', 'Australia', 'New Zealand', 'South Africa'],
    Other: ['Other'],
  },
} as const;

export const LOADING = {
  title: 'Finding your best pours…',
  subtitle: 'Our sommelier is hard at work',
  stages: ['Reading your list', 'Researching prices', 'Ranking your pours'] as const,
  messages: [
    'Reading your wine list…',
    'Checking market prices…',
    'Finding your best pours…',
    'Almost there — sorting your top picks…',
  ] as const,
  slowWarning: 'Still working — a large wine list can take a little longer. Hang tight!',
} as const;

export const ERRORS = {
  rateLimit: "You've reached the limit of 10 searches per hour. Please try again later.",
  invalidRequest: 'Invalid request.',
  generic: 'Something went wrong. Please try again.',
  urlRequired: 'Please provide a valid URL.',
  urlProtocol: 'Only http and https URLs are supported.',
  urlUnreachable: 'Could not access that URL. Please check the address and try again.',
  noWineListFound: 'No wine list found on that page. Try pasting the direct link to their wine list or PDF.',
  noFile: 'No file provided.',
  fileUnreadable: "We couldn't read that file. Please try a different PDF, Word, or Excel file.",
  fileEmpty: 'The file appears to be empty or contains only images. Please try a text-based PDF.',
  fileTooLarge: 'Please upload a file under 10 MB.',
  fileType: 'This file type is not supported. Please upload a PDF, Word, or Excel file.',
  pdfTooLarge: (pages: number) => `This PDF is too large (${pages} pages). We can scan up to 100 pages — please upload just the wine list section.`,
  pdfImagesOnly: 'PDF appears to contain only images — no extractable text found.',
  noWineLines: 'No wine lines detected. Please check that the document contains a wine list.',
  parseFailure: 'Could not parse any wines from the document. Please try a different file.',
} as const;

export const VALIDATION = {
  urlEmpty: 'Please enter a URL.',
  urlProtocol: 'Only http and https URLs are supported.',
  urlInvalid: 'Please enter a valid URL (e.g. https://restaurant.com/wine-list).',
  dropzoneLabel: 'Click to select file or drag and drop',
  dropzoneHint: 'PDF, Word, or Excel · Max 10 MB',
  removeFile: 'Remove file',
  tapToChoose: 'Tap to choose a file',
} as const;

export const UPLOAD = {
  label: 'Upload wine list',
  urlLabel: 'Restaurant website URL',
  urlPlaceholder: 'https://restaurant.com/wine-list',
} as const;

// Currency fallback only — the LLM detects the actual currency from the wine list.
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
