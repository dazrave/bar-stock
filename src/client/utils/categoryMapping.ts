// Smart category mapping for stock items
// Maps common ingredient names to their categories

const CATEGORY_MAPPING: Record<string, string> = {
  // Spirits
  vodka: "Spirits",
  gin: "Spirits",
  rum: "Spirits",
  tequila: "Spirits",
  mezcal: "Spirits",
  whiskey: "Spirits",
  whisky: "Spirits",
  bourbon: "Spirits",
  scotch: "Spirits",
  brandy: "Spirits",
  cognac: "Spirits",
  armagnac: "Spirits",
  pisco: "Spirits",
  cachaça: "Spirits",
  cachaca: "Spirits",
  absinthe: "Spirits",
  aquavit: "Spirits",
  sake: "Spirits",
  soju: "Spirits",
  baijiu: "Spirits",
  grappa: "Spirits",

  // Liqueurs
  amaretto: "Liqueurs",
  baileys: "Liqueurs",
  "irish cream": "Liqueurs",
  kahlua: "Liqueurs",
  "coffee liqueur": "Liqueurs",
  cointreau: "Liqueurs",
  "triple sec": "Liqueurs",
  curacao: "Liqueurs",
  curaçao: "Liqueurs",
  "blue curacao": "Liqueurs",
  "grand marnier": "Liqueurs",
  chambord: "Liqueurs",
  frangelico: "Liqueurs",
  galliano: "Liqueurs",
  midori: "Liqueurs",
  "melon liqueur": "Liqueurs",
  chartreuse: "Liqueurs",
  benedictine: "Liqueurs",
  drambuie: "Liqueurs",
  sambuca: "Liqueurs",
  limoncello: "Liqueurs",
  maraschino: "Liqueurs",
  luxardo: "Liqueurs",
  campari: "Liqueurs",
  aperol: "Liqueurs",
  "st germain": "Liqueurs",
  elderflower: "Liqueurs",
  creme: "Liqueurs",
  "crème": "Liqueurs",
  schnapps: "Liqueurs",
  sloe: "Liqueurs",
  "peach schnapps": "Liqueurs",
  "butterscotch schnapps": "Liqueurs",
  jagermeister: "Liqueurs",
  jägermeister: "Liqueurs",
  fernet: "Liqueurs",
  amaro: "Liqueurs",
  pastis: "Liqueurs",
  pernod: "Liqueurs",
  ricard: "Liqueurs",
  ouzo: "Liqueurs",

  // Vermouth & Fortified
  vermouth: "Liqueurs",
  "dry vermouth": "Liqueurs",
  "sweet vermouth": "Liqueurs",
  lillet: "Liqueurs",
  dubonnet: "Liqueurs",
  sherry: "Wine",
  port: "Wine",
  madeira: "Wine",
  marsala: "Wine",

  // Wine
  wine: "Wine",
  "red wine": "Wine",
  "white wine": "Wine",
  champagne: "Wine",
  prosecco: "Wine",
  cava: "Wine",
  sparkling: "Wine",
  "sparkling wine": "Wine",
  rosé: "Wine",
  rose: "Wine",
  pinot: "Wine",
  chardonnay: "Wine",
  sauvignon: "Wine",
  riesling: "Wine",
  merlot: "Wine",
  cabernet: "Wine",

  // Beer
  beer: "Beer",
  lager: "Beer",
  ale: "Beer",
  ipa: "Beer",
  stout: "Beer",
  porter: "Beer",
  pilsner: "Beer",
  wheat: "Beer",
  hefeweizen: "Beer",
  guinness: "Beer",
  corona: "Beer",
  heineken: "Beer",
  "ginger beer": "Mixers",

  // Mixers
  "tonic water": "Mixers",
  tonic: "Mixers",
  "club soda": "Mixers",
  "soda water": "Mixers",
  soda: "Mixers",
  "ginger ale": "Mixers",
  cola: "Mixers",
  "coca cola": "Mixers",
  coke: "Mixers",
  pepsi: "Mixers",
  sprite: "Mixers",
  "7up": "Mixers",
  "lemon lime": "Mixers",
  "energy drink": "Mixers",
  "red bull": "Mixers",
  water: "Mixers",
  "coconut water": "Mixers",
  "coconut milk": "Mixers",
  "coconut cream": "Mixers",
  cream: "Mixers",
  "heavy cream": "Mixers",
  "half and half": "Mixers",
  milk: "Mixers",
  "almond milk": "Mixers",
  "oat milk": "Mixers",
  coffee: "Mixers",
  espresso: "Mixers",
  tea: "Mixers",

  // Juices
  "orange juice": "Mixers",
  "oj": "Mixers",
  "lime juice": "Mixers",
  "lemon juice": "Mixers",
  "grapefruit juice": "Mixers",
  "pineapple juice": "Mixers",
  "cranberry juice": "Mixers",
  "cranberry": "Mixers",
  "apple juice": "Mixers",
  "tomato juice": "Mixers",
  "passion fruit": "Mixers",
  "pomegranate": "Mixers",
  "grenadine": "Syrups",
  juice: "Mixers",

  // Syrups
  syrup: "Syrups",
  "simple syrup": "Syrups",
  "sugar syrup": "Syrups",
  "honey syrup": "Syrups",
  honey: "Syrups",
  agave: "Syrups",
  "agave nectar": "Syrups",
  "maple syrup": "Syrups",
  "orgeat": "Syrups",
  "falernum": "Syrups",
  "ginger syrup": "Syrups",
  "vanilla syrup": "Syrups",
  "cinnamon syrup": "Syrups",
  "demerara syrup": "Syrups",

  // Bitters
  bitters: "Bitters",
  angostura: "Bitters",
  "aromatic bitters": "Bitters",
  "orange bitters": "Bitters",
  peychaud: "Bitters",
  "peychaud's": "Bitters",

  // Garnishes
  lemon: "Garnishes",
  lime: "Garnishes",
  orange: "Garnishes",
  grapefruit: "Garnishes",
  cherry: "Garnishes",
  "maraschino cherry": "Garnishes",
  olive: "Garnishes",
  mint: "Garnishes",
  basil: "Garnishes",
  rosemary: "Garnishes",
  thyme: "Garnishes",
  cucumber: "Garnishes",
  celery: "Garnishes",
  egg: "Garnishes",
  "egg white": "Garnishes",
  "egg yolk": "Garnishes",
  salt: "Garnishes",
  sugar: "Garnishes",
  pepper: "Garnishes",
  nutmeg: "Garnishes",
  cinnamon: "Garnishes",
  clove: "Garnishes",
  ginger: "Garnishes",
  peel: "Garnishes",
  zest: "Garnishes",
  twist: "Garnishes",
  wedge: "Garnishes",
  slice: "Garnishes",
  wheel: "Garnishes",
};

/**
 * Get category suggestion for an ingredient name
 * @param name - The ingredient name to look up
 * @returns Suggested category or null if no match found
 */
export function suggestCategory(name: string): string | null {
  if (!name) return null;

  const lower = name.toLowerCase().trim();

  // Direct match
  if (CATEGORY_MAPPING[lower]) {
    return CATEGORY_MAPPING[lower];
  }

  // Partial match - check if any keyword is in the name
  for (const [keyword, category] of Object.entries(CATEGORY_MAPPING)) {
    if (lower.includes(keyword) || keyword.includes(lower)) {
      return category;
    }
  }

  return null;
}

/**
 * Get all available categories
 */
export const STOCK_CATEGORIES = [
  "Spirits",
  "Liqueurs",
  "Wine",
  "Beer",
  "Mixers",
  "Syrups",
  "Bitters",
  "Garnishes",
  "Other",
];
