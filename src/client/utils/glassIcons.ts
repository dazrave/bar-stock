// Glass type to icon/emoji mapping
// Based on common cocktail glass types from CocktailDB and IBA

const GLASS_ICONS: Record<string, string> = {
  // Standard glasses
  "cocktail glass": "🍸",
  "martini glass": "🍸",
  "coupe glass": "🍸",
  "coupe": "🍸",

  // Highball/Collins
  "highball glass": "🥛",
  "highball": "🥛",
  "collins glass": "🥛",
  "collins": "🥛",

  // Rocks/Old Fashioned
  "old-fashioned glass": "🥃",
  "old fashioned glass": "🥃",
  "rocks glass": "🥃",
  "whiskey glass": "🥃",
  "lowball glass": "🥃",

  // Wine glasses
  "wine glass": "🍷",
  "red wine glass": "🍷",
  "white wine glass": "🍷",
  "balloon glass": "🍷",

  // Champagne
  "champagne flute": "🥂",
  "champagne glass": "🥂",
  "flute glass": "🥂",
  "flute": "🥂",

  // Beer
  "beer glass": "🍺",
  "beer mug": "🍺",
  "pint glass": "🍺",
  "pilsner glass": "🍺",

  // Tropical/Tiki
  "hurricane glass": "🌴",
  "hurricane": "🌴",
  "tiki glass": "🌴",
  "tiki mug": "🌴",
  "poco grande glass": "🌴",

  // Shot glasses
  "shot glass": "🥃",
  "shooter": "🥃",

  // Specialty
  "margarita glass": "🍹",
  "margarita/coupette glass": "🍹",
  "copper mug": "🫖",
  "moscow mule mug": "🫖",
  "mule mug": "🫖",
  "irish coffee cup": "☕",
  "irish coffee glass": "☕",
  "coffee mug": "☕",
  "punch bowl": "🍲",
  "brandy snifter": "🥃",
  "cordial glass": "🍸",
  "pousse cafe glass": "🍸",
  "parfait glass": "🍨",
  "jar": "🫙",
  "mason jar": "🫙",
  "nick and nora glass": "🍸",
  "nick and nora": "🍸",
  "sour glass": "🍸",
  "whiskey sour glass": "🍸",
  "zombie glass": "🧟",
};

/**
 * Get an emoji icon for a glass type
 * @param glassName - The name of the glass type
 * @returns Emoji icon or default glass emoji
 */
export function getGlassIcon(glassName: string): string {
  if (!glassName) return "🍸";

  const normalized = glassName.toLowerCase().trim();

  // Exact match
  if (GLASS_ICONS[normalized]) {
    return GLASS_ICONS[normalized];
  }

  // Partial match
  for (const [key, icon] of Object.entries(GLASS_ICONS)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return icon;
    }
  }

  // Default
  return "🍸";
}

/**
 * Format glass name with icon
 * @param glassName - The name of the glass type
 * @returns Formatted string with icon and name
 */
export function formatGlassWithIcon(glassName: string): { icon: string; name: string } {
  return {
    icon: getGlassIcon(glassName),
    name: glassName,
  };
}
