import { Hono } from "hono";
import { cors } from "hono/cors";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { serveStatic } from "hono/bun";
import {
  stockQueries,
  drinkQueries,
  ingredientQueries,
  passcodeQueries,
  cocktailDBQueries,
  shoppingQueries,
  ibaQueries,
  menuQueries,
  menuDrinkQueries,
  requestQueries,
  settingsQueries,
  swapQueries,
  type Stock,
  type ShoppingListItem,
  type Menu,
  type DrinkRequest,
} from "./db";

const app = new Hono();

// CORS for development
app.use("/api/*", cors());

// Session helper
const getSession = (c: any): { type: "owner" | "guest" } | null => {
  const session = getCookie(c, "session");
  if (!session) return null;
  try {
    return JSON.parse(session);
  } catch {
    return null;
  }
};

// Auth middleware
const requireAuth = (allowGuest = false) => {
  return async (c: any, next: any) => {
    const session = getSession(c);
    if (!session) {
      return c.json({ error: "Unauthorized" }, 401);
    }
    if (!allowGuest && session.type !== "owner") {
      return c.json({ error: "Owner access required" }, 403);
    }
    c.set("session", session);
    await next();
  };
};

// ============ AUTH ROUTES ============

app.post("/api/auth", async (c) => {
  const { code } = await c.req.json();
  const passcode = passcodeQueries.validate.get(code);

  if (!passcode) {
    return c.json({ error: "Invalid passcode" }, 401);
  }

  setCookie(c, "session", JSON.stringify({ type: passcode.type }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "Lax",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });

  return c.json({ type: passcode.type });
});

app.post("/api/logout", (c) => {
  deleteCookie(c, "session");
  return c.json({ success: true });
});

app.get("/api/session", (c) => {
  const session = getSession(c);
  return c.json(session || { type: null });
});

// ============ STOCK ROUTES ============

app.get("/api/stock", requireAuth(true), (c) => {
  const stock = stockQueries.getAll.all();
  return c.json(stock);
});

app.post("/api/stock", requireAuth(), async (c) => {
  const { name, category, current_ml, total_ml, image_path, unit_type, aliases } = await c.req.json();
  const stock = stockQueries.create.get(name, category || "Other", current_ml || 0, total_ml || 0, image_path || null, unit_type || "ml", aliases || null);
  return c.json(stock, 201);
});

app.put("/api/stock/:id", requireAuth(), async (c) => {
  const id = parseInt(c.req.param("id"));
  const { name, category, current_ml, total_ml, image_path, unit_type, aliases } = await c.req.json();
  const stock = stockQueries.update.get(name, category, current_ml, total_ml, image_path || null, unit_type || "ml", aliases || null, id);
  if (!stock) {
    return c.json({ error: "Not found" }, 404);
  }
  return c.json(stock);
});

app.patch("/api/stock/:id/volume", requireAuth(), async (c) => {
  const id = parseInt(c.req.param("id"));
  const { current_ml } = await c.req.json();
  const stock = stockQueries.updateVolume.get(current_ml, id);
  if (!stock) {
    return c.json({ error: "Not found" }, 404);
  }
  return c.json(stock);
});

app.delete("/api/stock/:id", requireAuth(), (c) => {
  const id = parseInt(c.req.param("id"));
  stockQueries.delete.run(id);
  return c.json({ success: true });
});

// ============ DRINKS ROUTES ============

app.get("/api/drinks", requireAuth(true), (c) => {
  const drinks = drinkQueries.getAll.all();
  const drinksWithIngredients = drinks.map((drink) => ({
    ...drink,
    ingredients: ingredientQueries.getByDrinkId.all(drink.id),
  }));
  return c.json(drinksWithIngredients);
});

app.get("/api/drinks/:id", requireAuth(true), (c) => {
  const id = parseInt(c.req.param("id"));
  const drink = drinkQueries.getById.get(id);
  if (!drink) {
    return c.json({ error: "Not found" }, 404);
  }
  const ingredients = ingredientQueries.getByDrinkId.all(id);
  return c.json({ ...drink, ingredients });
});

app.post("/api/drinks", requireAuth(), async (c) => {
  const { name, category, instructions, image_path, ingredients } = await c.req.json();
  const drink = drinkQueries.create.get(name, category || "Other", instructions || null, image_path || null);

  if (drink && ingredients?.length) {
    for (const ing of ingredients) {
      ingredientQueries.create.run(
        drink.id,
        ing.stock_id || null,
        ing.ingredient_name,
        ing.amount_ml || null,
        ing.amount_text || null,
        ing.optional ? 1 : 0
      );
    }
  }

  const savedIngredients = drink ? ingredientQueries.getByDrinkId.all(drink.id) : [];
  return c.json({ ...drink, ingredients: savedIngredients }, 201);
});

app.put("/api/drinks/:id", requireAuth(), async (c) => {
  const id = parseInt(c.req.param("id"));
  const { name, category, instructions, image_path, ingredients } = await c.req.json();

  const drink = drinkQueries.update.get(name, category, instructions || null, image_path || null, id);
  if (!drink) {
    return c.json({ error: "Not found" }, 404);
  }

  ingredientQueries.deleteByDrinkId.run(id);
  if (ingredients?.length) {
    for (const ing of ingredients) {
      ingredientQueries.create.run(
        id,
        ing.stock_id || null,
        ing.ingredient_name,
        ing.amount_ml || null,
        ing.amount_text || null,
        ing.optional ? 1 : 0
      );
    }
  }

  const savedIngredients = ingredientQueries.getByDrinkId.all(id);
  return c.json({ ...drink, ingredients: savedIngredients });
});

app.delete("/api/drinks/:id", requireAuth(), (c) => {
  const id = parseInt(c.req.param("id"));
  drinkQueries.delete.run(id);
  return c.json({ success: true });
});

// Parse amount text like "1 oz", "1 1/2 oz", "30ml", "2 cl" to ml
function parseAmountToMl(text: string | null): number | null {
  if (!text) return null;
  const trimmed = text.trim().toLowerCase();

  // Parse fractions like "1 1/2" or "1/2"
  const parseFraction = (str: string): number => {
    let total = 0;
    const parts = str.trim().split(/\s+/);
    for (const part of parts) {
      if (part.includes("/")) {
        const [num, denom] = part.split("/").map(Number);
        if (denom) total += num / denom;
      } else {
        total += parseFloat(part) || 0;
      }
    }
    return total;
  };

  // Ounces: "1 oz", "1 1/2 oz", "1.5 oz"
  const ozMatch = trimmed.match(/^([\d.\/\s]+)\s*oz/);
  if (ozMatch) {
    const oz = parseFraction(ozMatch[1]);
    if (oz > 0) return Math.round(oz * 30);
  }

  // Milliliters: "30ml", "30 ml"
  const mlMatch = trimmed.match(/^(\d+(?:\.\d+)?)\s*ml/);
  if (mlMatch) return Math.round(parseFloat(mlMatch[1]));

  // Centiliters: "3cl", "3 cl"
  const clMatch = trimmed.match(/^(\d+(?:\.\d+)?)\s*cl/);
  if (clMatch) return Math.round(parseFloat(clMatch[1]) * 10);

  // Tablespoons: "1 tbsp"
  const tbspMatch = trimmed.match(/^([\d.\/\s]+)\s*(?:tbsp|tblsp|tablespoon)/);
  if (tbspMatch) {
    const tbsp = parseFraction(tbspMatch[1]);
    if (tbsp > 0) return Math.round(tbsp * 15);
  }

  // Teaspoons: "1 tsp"
  const tspMatch = trimmed.match(/^([\d.\/\s]+)\s*(?:tsp|teaspoon)/);
  if (tspMatch) {
    const tsp = parseFraction(tspMatch[1]);
    if (tsp > 0) return Math.round(tsp * 5);
  }

  // Dashes/splashes - small amounts (approx 1ml each)
  const dashMatch = trimmed.match(/^(\d+)?\s*(?:dash|splash)/);
  if (dashMatch) {
    const count = parseInt(dashMatch[1]) || 1;
    return count; // 1ml per dash
  }

  return null;
}

app.post("/api/drinks/:id/make", requireAuth(), (c) => {
  const id = parseInt(c.req.param("id"));
  const drink = drinkQueries.getById.get(id);
  if (!drink) {
    return c.json({ error: "Drink not found" }, 404);
  }

  const ingredients = ingredientQueries.getByDrinkId.all(id);
  const updatedStock: Stock[] = [];

  for (const ing of ingredients) {
    if (ing.stock_id) {
      // Use amount_ml if set, otherwise try to parse amount_text
      const amountMl = ing.amount_ml || parseAmountToMl(ing.amount_text);
      if (amountMl && amountMl > 0) {
        const stock = stockQueries.getById.get(ing.stock_id);
        if (stock) {
          const amountUsed = Math.min(amountMl, stock.current_ml);
          const newAmount = Math.max(0, stock.current_ml - amountMl);
          // Update current_ml and add to total_used_ml
          const updated = stockQueries.updateVolumeAndUsed.get(newAmount, amountUsed, ing.stock_id);
          if (updated) updatedStock.push(updated);
        }
      }
    }
  }

  // Increment times_made counter for the drink
  const updatedDrink = drinkQueries.incrementTimesMade.get(id);

  return c.json({ success: true, updatedStock, drink: updatedDrink });
});

// Generate AI description for a drink
app.post("/api/drinks/:id/generate-description", requireAuth(), async (c) => {
  const id = parseInt(c.req.param("id"));
  const drink = drinkQueries.getById.get(id);
  if (!drink) {
    return c.json({ error: "Drink not found" }, 404);
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return c.json({ error: "OpenAI API key not configured" }, 500);
  }

  const ingredients = ingredientQueries.getByDrinkId.all(id);
  const ingredientList = ingredients.map((i) => i.ingredient_name).join(", ");

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "You are a cocktail expert writing short, enticing descriptions for a bar menu. Keep descriptions under 15 words. Be evocative and appetizing. No quotes around the response.",
          },
          {
            role: "user",
            content: `Write a short menu description for "${drink.name}" (${drink.category}). Ingredients: ${ingredientList}.`,
          },
        ],
        max_tokens: 50,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("OpenAI error:", error);
      return c.json({ error: "Failed to generate description" }, 500);
    }

    const data = await response.json();
    const description = data.choices?.[0]?.message?.content?.trim();

    if (description) {
      const updated = drinkQueries.updateDescription.get(description, id);
      return c.json({ success: true, drink: updated });
    }

    return c.json({ error: "No description generated" }, 500);
  } catch (err) {
    console.error("OpenAI request failed:", err);
    return c.json({ error: "Failed to connect to OpenAI" }, 500);
  }
});

// ============ SETTINGS ROUTES ============

app.get("/api/settings", requireAuth(), (c) => {
  const passcodes = passcodeQueries.getAll.all();
  return c.json({ passcodes });
});

app.put("/api/settings/passcode", requireAuth(), async (c) => {
  const { type, code } = await c.req.json();
  if (!["owner", "guest"].includes(type)) {
    return c.json({ error: "Invalid type" }, 400);
  }
  if (!code || code.length < 4) {
    return c.json({ error: "Code must be at least 4 characters" }, 400);
  }
  const updated = passcodeQueries.update.get(code, type);
  return c.json(updated);
});

// ============ COCKTAILDB ROUTES ============

app.get("/api/cocktaildb/all", requireAuth(true), (c) => {
  const drinks = cocktailDBQueries.getAll.all();
  return c.json(drinks);
});

app.get("/api/cocktaildb/search", requireAuth(true), (c) => {
  const q = c.req.query("q") || "";
  const drinks = cocktailDBQueries.search.all(`%${q}%`);
  return c.json(drinks);
});

app.get("/api/cocktaildb/random", requireAuth(true), (c) => {
  const drink = cocktailDBQueries.getRandom();
  return c.json(drink);
});

app.get("/api/cocktaildb/count", requireAuth(true), (c) => {
  const result = cocktailDBQueries.getCount.get();
  return c.json({ count: result?.count || 0 });
});

// Normalize ingredient name by removing common prefixes like "Fresh", "Freshly Squeezed", measure words that leaked in, etc.
const normalizeIngredientName = (name: string): string => {
  let normalized = name.toLowerCase().trim();
  // Collapse multiple spaces into single space
  normalized = normalized.replace(/\s+/g, " ");
  // Remove "freshly squeezed" or "fresh" prefix
  normalized = normalized.replace(/^freshly squeezed /i, "");
  normalized = normalized.replace(/^fresh /i, "");
  // Remove "thin slices", "slices", "slice" etc. (with optional leading number)
  normalized = normalized.replace(/^(?:\d+\s*)?(?:thin\s+)?slices?\s+(?:of\s+)?/i, "");
  // Remove measure words that might have leaked into the name (few dashes, dash, drop, splash, shot, jigger)
  normalized = normalized.replace(/^(?:few\s+)?(?:dash(?:es)?|drop(?:s)?|splash(?:es)?|shot(?:s)?|jigger(?:s)?)\s+(?:of\s+)?/i, "");
  // Remove "top with", "top up with", "top up"
  normalized = normalized.replace(/^top(?:\s*up)?(?:\s*with)?\s+/i, "");
  return normalized.trim();
};

// Helper to fuzzy match ingredient name to stock (including aliases)
const findStockMatch = (ingredientName: string, stockItems: Array<{ id: number; name: string; aliases: string | null }>) => {
  const lower = normalizeIngredientName(ingredientName);
  return stockItems.find((s) => {
    const stockLower = normalizeIngredientName(s.name);
    // Check name (using normalized names for better matching)
    if (
      stockLower === lower ||
      stockLower.includes(lower) ||
      lower.includes(stockLower)
    ) {
      return true;
    }
    // Check aliases
    if (s.aliases) {
      const aliasList = s.aliases.split(",").map((a) => normalizeIngredientName(a));
      return aliasList.some(
        (alias) =>
          alias === lower ||
          alias.includes(lower) ||
          lower.includes(alias)
      );
    }
    return false;
  });
};

app.post("/api/cocktaildb/import/:id", requireAuth(), async (c) => {
  const id = parseInt(c.req.param("id"));
  const cocktailDBDrink = cocktailDBQueries.getById.get(id);

  if (!cocktailDBDrink) {
    return c.json({ error: "Drink not found in cache" }, 404);
  }

  let ingredients: Array<{ name: string; measure: string }> = [];
  try {
    ingredients = JSON.parse(cocktailDBDrink.ingredients_json || "[]");
  } catch {}

  // Get all stock items for fuzzy matching
  const stockItems = stockQueries.getAll.all();

  const drink = drinkQueries.create.get(
    cocktailDBDrink.name,
    cocktailDBDrink.category || "Other",
    cocktailDBDrink.instructions,
    cocktailDBDrink.image_url // Use the URL as image path
  );

  if (drink) {
    for (const ing of ingredients) {
      // Try to auto-link to stock
      const stockMatch = findStockMatch(ing.name, stockItems);
      ingredientQueries.create.run(
        drink.id,
        stockMatch?.id || null,
        ing.name,
        null,
        ing.measure || null,
        0
      );
    }
  }

  const savedIngredients = drink ? ingredientQueries.getByDrinkId.all(drink.id) : [];
  return c.json({ ...drink, ingredients: savedIngredients }, 201);
});

app.post("/api/cocktaildb/sync", requireAuth(), async (c) => {
  const API_KEY = "1";
  const baseUrl = "https://www.thecocktaildb.com/api/json/v1";

  // Get existing external IDs to skip
  const existingIds = new Set(
    cocktailDBQueries.getAllExternalIds.all().map((r) => r.external_id)
  );

  let synced = 0;
  let skipped = 0;
  const errors: string[] = [];
  const letters = "abcdefghijklmnopqrstuvwxyz".split("");

  for (const letter of letters) {
    try {
      const res = await fetch(`${baseUrl}/${API_KEY}/search.php?f=${letter}`);
      const data = (await res.json()) as { drinks: any[] | null };

      if (data.drinks) {
        for (const d of data.drinks) {
          // Skip if we already have this drink
          if (existingIds.has(d.idDrink)) {
            skipped++;
            continue;
          }

          const ingredients: Array<{ name: string; measure: string }> = [];
          for (let i = 1; i <= 15; i++) {
            const name = d[`strIngredient${i}`];
            const measure = d[`strMeasure${i}`];
            if (name && name.trim()) {
              ingredients.push({ name: name.trim(), measure: measure?.trim() || "" });
            }
          }

          cocktailDBQueries.upsert.run(
            d.idDrink,
            d.strDrink,
            d.strCategory,
            d.strGlass,
            d.strInstructions,
            null,
            d.strDrinkThumb,
            JSON.stringify(ingredients)
          );

          // Cache ingredients
          for (const ing of ingredients) {
            if (ing.name) {
              cocktailDBQueries.insertIngredient.run(ing.name);
            }
          }

          synced++;
        }
      }
    } catch (err) {
      errors.push(`Letter ${letter}: ${err}`);
    }
  }

  return c.json({ synced, skipped, errors: errors.length > 0 ? errors : undefined });
});

// Get cached ingredients from CocktailDB for autocomplete
app.get("/api/cocktaildb/ingredients", requireAuth(true), (c) => {
  const ingredients = cocktailDBQueries.getAllIngredients.all();
  return c.json(ingredients.map((i) => i.name));
});

// Toggle hidden status on a cocktaildb drink
app.post("/api/cocktaildb/:id/toggle-hidden", requireAuth(), (c) => {
  const id = parseInt(c.req.param("id"));
  const drink = cocktailDBQueries.toggleHidden.get(id);
  if (!drink) {
    return c.json({ error: "Drink not found" }, 404);
  }
  return c.json(drink);
});

// ============ IBA COCKTAIL ROUTES ============

app.get("/api/iba/all", requireAuth(true), (c) => {
  const drinks = ibaQueries.getAll.all();
  return c.json(drinks);
});

app.get("/api/iba/search", requireAuth(true), (c) => {
  const q = c.req.query("q") || "";
  const drinks = ibaQueries.search.all(`%${q}%`);
  return c.json(drinks);
});

app.get("/api/iba/random", requireAuth(true), (c) => {
  const drink = ibaQueries.getRandom();
  return c.json(drink);
});

app.get("/api/iba/count", requireAuth(true), (c) => {
  const result = ibaQueries.getCount.get();
  return c.json({ count: result?.count || 0 });
});

app.get("/api/iba/:id", requireAuth(true), (c) => {
  const id = parseInt(c.req.param("id"));
  const drink = ibaQueries.getById.get(id);
  if (!drink) {
    return c.json({ error: "Not found" }, 404);
  }
  return c.json(drink);
});

app.post("/api/iba/:id/toggle-hidden", requireAuth(), (c) => {
  const id = parseInt(c.req.param("id"));
  const drink = ibaQueries.toggleHidden.get(id);
  if (!drink) {
    return c.json({ error: "Drink not found" }, 404);
  }
  return c.json(drink);
});

// Import IBA drink to My Drinks
app.post("/api/iba/import/:id", requireAuth(), async (c) => {
  const id = parseInt(c.req.param("id"));
  const ibaDrink = ibaQueries.getById.get(id);

  if (!ibaDrink) {
    return c.json({ error: "Drink not found in cache" }, 404);
  }

  let ingredients: Array<{ name: string; measure: string }> = [];
  try {
    ingredients = JSON.parse(ibaDrink.ingredients_json || "[]");
  } catch {}

  // Get all stock items for fuzzy matching
  const stockItems = stockQueries.getAll.all();

  const drink = drinkQueries.create.get(
    ibaDrink.name,
    ibaDrink.category || "Cocktail",
    ibaDrink.method || null,
    ibaDrink.image_url
  );

  if (drink) {
    for (const ing of ingredients) {
      // Try to auto-link to stock
      const stockMatch = findStockMatch(ing.name, stockItems);
      ingredientQueries.create.run(
        drink.id,
        stockMatch?.id || null,
        ing.name,
        null,
        ing.measure || null,
        0
      );
    }
  }

  const savedIngredients = drink ? ingredientQueries.getByDrinkId.all(drink.id) : [];
  return c.json({ ...drink, ingredients: savedIngredients }, 201);
});

// Clear all IBA drinks (for resync)
app.delete("/api/iba/all", requireAuth(), (c) => {
  ibaQueries.deleteAll.run();
  return c.json({ success: true });
});

// Scrape IBA cocktails from all-cocktails page with pagination
app.post("/api/iba/sync", requireAuth(), async (c) => {
  const baseUrl = "https://iba-world.com/cocktails/all-cocktails/";
  const maxPages = 10; // Safety limit

  // Get existing slugs to track new vs updated
  const existingSlugs = new Set(ibaQueries.getAllSlugs.all().map((r) => r.slug));

  let synced = 0;
  let skipped = 0;
  const errors: string[] = [];
  const allCocktailUrls: string[] = [];

  // Helper to extract cocktail URLs from listing page
  const extractCocktailUrls = (html: string): string[] => {
    const urls: string[] = [];
    const regex = /href="(https:\/\/iba-world\.com\/iba-cocktail\/[^"]+)"/g;
    let match;
    while ((match = regex.exec(html)) !== null) {
      if (!urls.includes(match[1])) {
        urls.push(match[1]);
      }
    }
    return urls;
  };

  // Fetch all pages to collect cocktail URLs
  for (let page = 1; page <= maxPages; page++) {
    const pageUrl = page === 1 ? baseUrl : `${baseUrl}page/${page}/`;
    try {
      const res = await fetch(pageUrl);
      if (!res.ok) {
        if (page > 1) break; // No more pages
        errors.push(`Failed to fetch page ${page}: ${res.status}`);
        continue;
      }
      const html = await res.text();
      const urls = extractCocktailUrls(html);
      if (urls.length === 0) break; // No more cocktails

      for (const url of urls) {
        if (!allCocktailUrls.includes(url)) {
          allCocktailUrls.push(url);
        }
      }

      // Check if there's a next page link
      if (!html.includes(`/page/${page + 1}/`)) break;

      await new Promise((r) => setTimeout(r, 200)); // Rate limit
    } catch (err) {
      errors.push(`Error fetching page ${page}`);
      break;
    }
  }

  // Helper to decode HTML entities
  const decodeHtmlEntities = (text: string): string => {
    return text
      .replace(/&#8211;/g, "–")
      .replace(/&#8212;/g, "—")
      .replace(/&#8216;/g, "'")
      .replace(/&#8217;/g, "'")
      .replace(/&#8220;/g, '"')
      .replace(/&#8221;/g, '"')
      .replace(/&#38;/g, "&")
      .replace(/&#39;/g, "'")
      .replace(/&amp;/g, "&")
      .replace(/&nbsp;/g, " ")
      .replace(/&ndash;/g, "–")
      .replace(/&mdash;/g, "—")
      .replace(/&lsquo;/g, "'")
      .replace(/&rsquo;/g, "'")
      .replace(/&ldquo;/g, '"')
      .replace(/&rdquo;/g, '"')
      .trim();
  };

  // Helper to extract cocktail details from detail page
  const extractCocktailDetails = (html: string, url: string, category: string) => {
    const slug = url.split("/iba-cocktail/")[1]?.replace(/\/$/, "") || "";

    // Extract name from h1 first (most reliable), then title
    let name = slug;
    const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
    if (h1Match) {
      name = decodeHtmlEntities(h1Match[1].trim());
    } else {
      const titleMatch = html.match(/<title>([^<|]+)/i);
      if (titleMatch) {
        name = decodeHtmlEntities(titleMatch[1].trim());
      }
    }
    // Clean up name - remove " – IBA", " - IBA", etc.
    name = name.replace(/\s*[-–—]\s*IBA.*$/i, "").trim();

    // Extract image URL - find image with cocktail name/slug in the path
    let image_url: string | null = null;
    const imgMatches = html.match(/src="(https:\/\/iba-world\.com\/wp-content\/uploads\/[^"]+)"/gi) || [];
    for (const match of imgMatches) {
      const urlMatch = match.match(/src="([^"]+)"/);
      if (urlMatch && urlMatch[1]) {
        const imgUrl = urlMatch[1].toLowerCase();
        // Skip logos, icons, and elementor thumbs
        if (imgUrl.includes('logo') || imgUrl.includes('icon') || imgUrl.includes('elementor/thumbs')) {
          continue;
        }
        // Best match: image URL contains the cocktail slug (e.g., "margarita", "sex-on-the-beach")
        if (imgUrl.includes(slug.toLowerCase())) {
          image_url = urlMatch[1];
          break;
        }
        // Fallback: image with "iba-cocktail" in path
        if (!image_url && imgUrl.includes('iba-cocktail')) {
          image_url = urlMatch[1];
        }
      }
    }

    // Extract glass type - look for "Glass:" or glass in a list
    let glass: string | null = null;
    const glassPatterns = [
      /Glass\s*:\s*([^<\n]+)/i,
      /served\s+in\s+(?:a\s+)?([^<.\n]+(?:glass|coupe|flute|mug|cup))/i,
    ];
    for (const pattern of glassPatterns) {
      const match = html.match(pattern);
      if (match) {
        glass = match[1].trim().replace(/[.,]$/, "");
        break;
      }
    }

    // Extract garnish - look for "Garnish:" section
    let garnish: string | null = null;
    const garnishPatterns = [
      /Garnish\s*:?\s*<\/h\d>\s*<p>([^<]+)/i,
      /Garnish\s*:\s*([^<\n]+)/i,
      /<strong>Garnish<\/strong>\s*:?\s*([^<]+)/i,
    ];
    for (const pattern of garnishPatterns) {
      const match = html.match(pattern);
      if (match) {
        garnish = match[1].trim().replace(/^["']|["']$/g, "").replace(/[.,]$/, "");
        break;
      }
    }

    // Extract method/instructions - collect all <p> tags after ingredients
    let method: string | null = null;
    const methodPatterns = [
      /Method\s*:?\s*<\/h\d>\s*<p>([^<]+(?:<\/p>\s*<p>[^<]+)*)/i,
      /Preparation\s*:?\s*<\/h\d>\s*<p>([^<]+)/i,
      /Method\s*:\s*([^<\n]+)/i,
    ];
    for (const pattern of methodPatterns) {
      const match = html.match(pattern);
      if (match) {
        method = match[1].replace(/<\/p>\s*<p>/g, " ").trim().replace(/^["']|["']$/g, "");
        break;
      }
    }

    // If no method found, look for paragraphs that describe preparation
    if (!method) {
      const prepMatch = html.match(/(?:shake|stir|pour|muddle|blend|build)[^<]{10,100}/i);
      if (prepMatch) {
        method = prepMatch[0].trim();
      }
    }

    // Extract ingredients - look for <ul><li> patterns or text with measurements
    const ingredients: Array<{ name: string; measure: string }> = [];

    // Try to find ingredients section - multiple patterns for IBA site structure
    const ingredientPatterns = [
      // h4 Ingredients followed by ul
      /<h4[^>]*>\s*Ingredients?\s*<\/h4>\s*<ul[^>]*>([\s\S]*?)<\/ul>/i,
      // h3/h2 Ingredients followed by ul
      /Ingredients?\s*:?\s*<\/h\d>\s*<ul[^>]*>([\s\S]*?)<\/ul>/i,
      // Any ul with class containing ingredient
      /<ul[^>]*class="[^"]*ingredients?[^"]*"[^>]*>([\s\S]*?)<\/ul>/i,
      // ul after elementor shortcode widget with measurements
      /elementor-widget-shortcode[^>]*>[\s\S]*?<ul[^>]*>([\s\S]*?)<\/ul>/i,
      // Any ul that contains ml/cl measurements
      /<ul[^>]*>([\s\S]*?)<\/ul>/gi,
    ];

    let ingredientHtml = "";
    for (const pattern of ingredientPatterns) {
      if (pattern.global) {
        // For global patterns, find the one with measurements
        let match;
        const regex = new RegExp(pattern.source, 'gi');
        while ((match = regex.exec(html)) !== null) {
          if (/\d+\s*(?:ml|cl|oz|dash)/i.test(match[1])) {
            ingredientHtml = match[1];
            break;
          }
        }
        if (ingredientHtml) break;
      } else {
        const match = html.match(pattern);
        if (match && /\d+\s*(?:ml|cl|oz|dash)/i.test(match[1])) {
          ingredientHtml = match[1];
          break;
        }
      }
    }

    if (ingredientHtml) {
      const liRegex = /<li[^>]*>([\s\S]*?)<\/li>/gi;
      let liMatch;
      while ((liMatch = liRegex.exec(ingredientHtml)) !== null) {
        // Strip any HTML tags from the li content
        const text = liMatch[1].replace(/<[^>]+>/g, "").trim();
        if (!text) continue;

        // Decode any HTML entities
        const decodedText = decodeHtmlEntities(text);

        // Parse various formats: "50 ml Vodka", "2 dashes Angostura", "Dash Bitters", "Few Dashes Bitters", "Top with Cola", "Bar Spoon Maraschino", "2 thin slices Lemon"
        const measureMatch = decodedText.match(/^([\d.\/]+\s*(?:ml|cl|oz|dashes?|drops?|tsp|tbsp|tablespoons?|teaspoons?|bar\s*spoons?|parts?|(?:thin\s+)?slices?)?|(?:bar\s*spoon)|(?:few\s+)?(?:dashes?|drops?)|top(?:\s*up)?(?:\s*with)?)\s+(.+)$/i);
        if (measureMatch) {
          ingredients.push({
            measure: measureMatch[1].trim(),
            name: measureMatch[2].trim(),
          });
        } else {
          // Try to extract just the ingredient name
          ingredients.push({ measure: "", name: decodedText });
        }
      }
    }

    // If no ingredients found via ul/li, try finding raw text with measurements
    if (ingredients.length === 0) {
      const measurementLines = html.match(/>\s*(\d+\s*(?:ml|cl)\s+[A-Z][^<]{5,50})\s*</gi);
      if (measurementLines) {
        for (const line of measurementLines) {
          const textMatch = line.match(/>\s*(.+?)\s*</);
          if (textMatch) {
            const text = decodeHtmlEntities(textMatch[1].trim());
            const measureMatch = text.match(/^([\d.\/]+\s*(?:ml|cl|oz))\s+(.+)$/i);
            if (measureMatch) {
              ingredients.push({
                measure: measureMatch[1].trim(),
                name: measureMatch[2].trim(),
              });
            }
          }
        }
      }
    }

    return {
      slug,
      name,
      category,
      glass,
      garnish,
      method,
      image_url,
      ingredients_json: JSON.stringify(ingredients),
    };
  };

  // Process each cocktail URL
  for (const url of allCocktailUrls) {
    try {
      const slug = url.split("/iba-cocktail/")[1]?.replace(/\/$/, "") || "";

      // Skip if we already have it
      if (existingSlugs.has(slug)) {
        skipped++;
        continue;
      }

      // Small delay to be respectful
      await new Promise((r) => setTimeout(r, 200));

      const drinkRes = await fetch(url);
      if (!drinkRes.ok) {
        errors.push(`Failed to fetch ${url}: ${drinkRes.status}`);
        continue;
      }
      const drinkHtml = await drinkRes.text();
      const details = extractCocktailDetails(drinkHtml, url, "IBA Official");

      ibaQueries.upsert.run(
        details.slug,
        details.name,
        details.category,
        details.glass,
        details.garnish,
        details.method,
        details.image_url,
        details.ingredients_json
      );

      synced++;
    } catch (err) {
      errors.push(`Error processing ${url}: ${err}`);
    }
  }

  return c.json({ synced, skipped, errors: errors.length > 0 ? errors : undefined });
});

// ============ IMPORT FROM URL ============

// Import a cocktail from makemeacocktail.com
app.post("/api/import-url", requireAuth(), async (c) => {
  const { url } = await c.req.json();

  if (!url || !url.includes("makemeacocktail.com/cocktail/")) {
    return c.json({ error: "Invalid URL. Please provide a makemeacocktail.com cocktail URL" }, 400);
  }

  try {
    // Fetch with browser-like headers
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
        "Accept-Encoding": "gzip, deflate, br",
        "Connection": "keep-alive",
        "Upgrade-Insecure-Requests": "1",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
        "Sec-Fetch-User": "?1",
        "Cache-Control": "max-age=0",
      },
    });

    if (!res.ok) {
      return c.json({ error: `Failed to fetch URL: ${res.status}` }, 400);
    }

    const html = await res.text();

    // Check for Cloudflare challenge page
    if (html.includes("Just a moment...") || html.includes("cf_chl_opt") || html.includes("challenge-platform")) {
      return c.json({ error: "Site has bot protection. Try copying the recipe manually." }, 400);
    }

    // Extract cocktail name - look for h1 or title
    let name = "";
    const h1Match = html.match(/<h1[^>]*class="[^"]*recipe-title[^"]*"[^>]*>([^<]+)<\/h1>/i) ||
                    html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
    if (h1Match) {
      name = h1Match[1].trim();
    } else {
      const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
      if (titleMatch) {
        name = titleMatch[1].replace(/\s*[-|].*$/, "").trim();
      }
    }

    if (!name) {
      return c.json({ error: "Could not extract cocktail name" }, 400);
    }

    // Extract image
    let image_url: string | null = null;
    const imgPatterns = [
      /<img[^>]*class="[^"]*recipe-image[^"]*"[^>]*src="([^"]+)"/i,
      /<img[^>]*src="([^"]+)"[^>]*class="[^"]*recipe[^"]*"/i,
      /<meta[^>]*property="og:image"[^>]*content="([^"]+)"/i,
      /<img[^>]*src="(https:\/\/[^"]*makemeacocktail[^"]*\/cocktails\/[^"]+)"/i,
    ];
    for (const pattern of imgPatterns) {
      const match = html.match(pattern);
      if (match && match[1]) {
        image_url = match[1];
        break;
      }
    }

    // Extract ingredients - look for ingredient list
    const ingredients: Array<{ name: string; measure: string }> = [];

    // Pattern 1: ingredient items with amount and name
    const ingredientPattern = /<li[^>]*class="[^"]*ingredient[^"]*"[^>]*>[\s\S]*?<span[^>]*class="[^"]*amount[^"]*"[^>]*>([^<]*)<\/span>[\s\S]*?<span[^>]*class="[^"]*name[^"]*"[^>]*>([^<]*)<\/span>/gi;
    let match;
    while ((match = ingredientPattern.exec(html)) !== null) {
      const measure = match[1].trim();
      const ingredientName = match[2].trim();
      if (ingredientName) {
        ingredients.push({ name: ingredientName, measure });
      }
    }

    // Pattern 2: simpler list items
    if (ingredients.length === 0) {
      const simplePattern = /<li[^>]*class="[^"]*ingredient[^"]*"[^>]*>([\s\S]*?)<\/li>/gi;
      while ((match = simplePattern.exec(html)) !== null) {
        const text = match[1].replace(/<[^>]+>/g, " ").trim();
        // Try to split measure from name (same patterns as IBA parsing)
        const measureMatch = text.match(/^([\d.\/]+\s*(?:ml|cl|oz|dashes?|drops?|tsp|tbsp|tablespoons?|teaspoons?|bar\s*spoons?|parts?|shots?)?|(?:bar\s*spoon)|(?:few\s+)?(?:dashes?|drops?)|top(?:\s*up)?(?:\s*with)?)\s+(.+)$/i);
        if (measureMatch) {
          ingredients.push({ name: measureMatch[2].trim(), measure: measureMatch[1].trim() });
        } else {
          ingredients.push({ name: text, measure: "" });
        }
      }
    }

    // Pattern 3: look for data attributes or JSON
    if (ingredients.length === 0) {
      const jsonMatch = html.match(/ingredients['"]\s*:\s*\[([^\]]+)\]/i);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(`[${jsonMatch[1]}]`);
          for (const ing of parsed) {
            if (typeof ing === "object" && ing.name) {
              ingredients.push({ name: ing.name, measure: ing.amount || ing.measure || "" });
            }
          }
        } catch {}
      }
    }

    // Extract method/instructions
    let instructions = "";
    const methodPatterns = [
      /<div[^>]*class="[^"]*method[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
      /<div[^>]*class="[^"]*instructions[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
      /<section[^>]*class="[^"]*method[^"]*"[^>]*>([\s\S]*?)<\/section>/i,
      /<ol[^>]*class="[^"]*method[^"]*"[^>]*>([\s\S]*?)<\/ol>/i,
    ];
    for (const pattern of methodPatterns) {
      const methodMatch = html.match(pattern);
      if (methodMatch) {
        // Clean up HTML tags, keep list structure
        instructions = methodMatch[1]
          .replace(/<li[^>]*>/gi, "\n• ")
          .replace(/<\/li>/gi, "")
          .replace(/<p[^>]*>/gi, "\n")
          .replace(/<\/p>/gi, "")
          .replace(/<br\s*\/?>/gi, "\n")
          .replace(/<[^>]+>/g, "")
          .replace(/\n{3,}/g, "\n\n")
          .trim();
        break;
      }
    }

    // Get stock for auto-linking
    const stockItems = stockQueries.getAll.all();

    // Create the drink
    const drink = drinkQueries.create.get(
      name,
      "Cocktail",
      instructions || null,
      image_url
    );

    if (drink) {
      for (const ing of ingredients) {
        const stockMatch = findStockMatch(ing.name, stockItems);
        ingredientQueries.create.run(
          drink.id,
          stockMatch?.id || null,
          ing.name,
          null,
          ing.measure || null,
          0
        );
      }
    }

    const savedIngredients = drink ? ingredientQueries.getByDrinkId.all(drink.id) : [];
    return c.json({
      success: true,
      drink: { ...drink, ingredients: savedIngredients },
      extracted: { name, image_url, ingredients: ingredients.length, instructions: !!instructions }
    }, 201);

  } catch (err) {
    return c.json({ error: `Failed to import: ${err}` }, 500);
  }
});

// ============ INGREDIENT SWAP ROUTES ============

// Get all swaps for a source
app.get("/api/swaps/:source", requireAuth(), (c) => {
  const source = c.req.param("source");
  if (source !== "iba" && source !== "cocktaildb") {
    return c.json({ error: "Invalid source" }, 400);
  }
  const swaps = swapQueries.getAll.all(source);
  return c.json(swaps);
});

// Get swaps for a specific drink
app.get("/api/swaps/:source/:drinkId", requireAuth(), (c) => {
  const source = c.req.param("source");
  const drinkId = parseInt(c.req.param("drinkId"));
  if (source !== "iba" && source !== "cocktaildb") {
    return c.json({ error: "Invalid source" }, 400);
  }
  const swaps = swapQueries.getByDrink.all(source, drinkId);
  return c.json(swaps);
});

// Add or update a swap
app.post("/api/swaps/:source/:drinkId", requireAuth(), async (c) => {
  const source = c.req.param("source");
  const drinkId = parseInt(c.req.param("drinkId"));
  const { original_ingredient, stock_id } = await c.req.json();

  if (source !== "iba" && source !== "cocktaildb") {
    return c.json({ error: "Invalid source" }, 400);
  }

  const swap = swapQueries.upsert.get(source, drinkId, original_ingredient, stock_id);
  return c.json(swap, 201);
});

// Remove a swap
app.delete("/api/swaps/:source/:drinkId/:ingredient", requireAuth(), (c) => {
  const source = c.req.param("source");
  const drinkId = parseInt(c.req.param("drinkId"));
  const ingredient = decodeURIComponent(c.req.param("ingredient"));

  if (source !== "iba" && source !== "cocktaildb") {
    return c.json({ error: "Invalid source" }, 400);
  }

  swapQueries.delete.run(source, drinkId, ingredient);
  return c.json({ success: true });
});

// ============ SHOPPING LIST ROUTES ============

// Get all shopping list items with linked drinks
app.get("/api/shopping", requireAuth(), (c) => {
  const items = shoppingQueries.getAll.all();
  const itemsWithDrinks = items.map((item) => ({
    ...item,
    drinks: shoppingQueries.getDrinksByItemId.all(item.id),
  }));
  return c.json(itemsWithDrinks);
});

// Add item to shopping list
app.post("/api/shopping", requireAuth(), async (c) => {
  const { ingredient_name, stock_id, quantity, notes, suggested } = await c.req.json();

  // Check if already exists
  const existing = shoppingQueries.getByName.get(ingredient_name);
  if (existing) {
    return c.json({ error: "Item already in shopping list", existing }, 409);
  }

  const item = shoppingQueries.create.get(
    ingredient_name,
    stock_id || null,
    quantity || 1,
    notes || null,
    suggested ? 1 : 0
  );
  return c.json(item, 201);
});

// Delete shopping list item
app.delete("/api/shopping/:id", requireAuth(), (c) => {
  const id = parseInt(c.req.param("id"));
  shoppingQueries.delete.run(id);
  return c.json({ success: true });
});

// Mark item as bought - add to stock
app.post("/api/shopping/:id/bought", requireAuth(), async (c) => {
  const id = parseInt(c.req.param("id"));
  const { total_ml, category } = await c.req.json();

  const item = shoppingQueries.getById.get(id);
  if (!item) {
    return c.json({ error: "Not found" }, 404);
  }

  // If linked to existing stock, refill it
  if (item.stock_id) {
    const stock = stockQueries.getById.get(item.stock_id);
    if (stock) {
      const newTotal = total_ml || stock.total_ml;
      stockQueries.update.get(
        stock.name,
        stock.category,
        newTotal, // current = full
        newTotal,
        stock.image_path,
        stock.id
      );
      shoppingQueries.delete.run(id);
      return c.json({ action: "refilled", stockId: item.stock_id, stock });
    }
  }

  // If not linked, need bottle size to create stock
  if (!total_ml) {
    return c.json({ action: "needs_size", itemId: id, item });
  }

  // Create new stock item
  const newStock = stockQueries.create.get(
    item.ingredient_name,
    category || "Other",
    total_ml,
    total_ml,
    null,
    "ml",
    null
  );

  shoppingQueries.delete.run(id);
  return c.json({ action: "created", stock: newStock });
});

// Mark all items as bought
app.post("/api/shopping/bought-all", requireAuth(), async (c) => {
  const { items } = await c.req.json(); // Array of { id, total_ml?, category? }
  const results: Array<{ id: number; action: string; stock?: Stock }> = [];

  for (const { id, total_ml, category } of items) {
    const item = shoppingQueries.getById.get(id);
    if (!item) continue;

    if (item.stock_id) {
      const stock = stockQueries.getById.get(item.stock_id);
      if (stock) {
        const newTotal = total_ml || stock.total_ml;
        stockQueries.update.get(
          stock.name,
          stock.category,
          newTotal,
          newTotal,
          stock.image_path,
          stock.unit_type || "ml",
          stock.aliases,
          stock.id
        );
        shoppingQueries.delete.run(id);
        results.push({ id, action: "refilled", stock });
        continue;
      }
    }

    if (total_ml) {
      const newStock = stockQueries.create.get(
        item.ingredient_name,
        category || "Other",
        total_ml,
        total_ml,
        null,
        "ml",
        null
      );
      shoppingQueries.delete.run(id);
      results.push({ id, action: "created", stock: newStock! });
    } else {
      results.push({ id, action: "needs_size" });
    }
  }

  return c.json({ results });
});

// Get low stock suggestions
app.get("/api/shopping/suggestions", requireAuth(), (c) => {
  const lowStock = shoppingQueries.getLowStock.all();

  // For each low-stock item, find drinks that use it
  const suggestions = lowStock.map((stock) => {
    const drinks = ingredientQueries.getByDrinkId
      ? [] // We need a different query for this
      : [];
    return {
      ...stock,
      drinks,
    };
  });

  return c.json(suggestions);
});

// Add suggestions to shopping list
app.post("/api/shopping/add-suggestions", requireAuth(), async (c) => {
  const { stockIds } = await c.req.json(); // Array of stock IDs to add

  const added: ShoppingListItem[] = [];
  for (const stockId of stockIds) {
    const stock = stockQueries.getById.get(stockId);
    if (!stock) continue;

    // Check if already in shopping list
    const existing = shoppingQueries.getByStockId.get(stockId);
    if (existing) continue;

    const item = shoppingQueries.create.get(
      stock.name,
      stockId,
      1,
      null,
      1 // suggested = true
    );
    if (item) added.push(item);
  }

  return c.json({ added });
});

// Add missing ingredients from a drink to shopping list
app.post("/api/shopping/from-drink/:id", requireAuth(), async (c) => {
  const drinkId = parseInt(c.req.param("id"));
  const drink = drinkQueries.getById.get(drinkId);
  if (!drink) {
    return c.json({ error: "Drink not found" }, 404);
  }

  const ingredients = ingredientQueries.getByDrinkId.all(drinkId);
  const added: ShoppingListItem[] = [];

  for (const ing of ingredients) {
    // Check if ingredient needs to be added
    let needsAdding = false;

    if (!ing.stock_id) {
      // Not linked to any stock - add it
      needsAdding = true;
    } else {
      // Linked to stock - check if empty or low
      const stockItem = stockQueries.getById.get(ing.stock_id);
      if (!stockItem || stockItem.current_ml === 0) {
        needsAdding = true;
      }
    }

    if (needsAdding) {
      // Check if already in shopping list
      const existing = shoppingQueries.getByName.get(ing.ingredient_name);
      if (existing) {
        // Just link the drink to existing item
        shoppingQueries.linkDrink.run(existing.id, drinkId);
      } else {
        // Create new shopping list item
        const item = shoppingQueries.create.get(
          ing.ingredient_name,
          ing.stock_id,
          1,
          null,
          0 // not suggested
        );
        if (item) {
          shoppingQueries.linkDrink.run(item.id, drinkId);
          added.push(item);
        }
      }
    }
  }

  return c.json({ added, drinkName: drink.name });
});

// ============ MENU ROUTES ============

// Get all menus (owner sees all, guests see active only)
app.get("/api/menus", requireAuth(true), (c) => {
  const session = c.get("session");
  const isOwner = session?.type === "owner";

  const menus = isOwner ? menuQueries.getAll.all() : menuQueries.getActive.all();

  // Get drinks for each menu with availability info
  const menusWithDrinks = menus.map((menu) => {
    const drinks = menuDrinkQueries.getDrinksForMenu.all(menu.id);
    const allStock = stockQueries.getAll.all();

    const drinksWithAvailability = drinks.map((drink) => {
      const ingredients = ingredientQueries.getByDrinkId.all(drink.id);
      let canMake = true;
      let minServings = Infinity;

      for (const ing of ingredients) {
        if (ing.stock_id && ing.amount_ml) {
          const stock = allStock.find((s) => s.id === ing.stock_id);
          if (!stock || stock.current_ml <= 0) {
            canMake = false;
            minServings = 0;
          } else if (canMake) {
            const servings = Math.floor(stock.current_ml / ing.amount_ml);
            minServings = Math.min(minServings, servings);
          }
        } else if (!ing.stock_id) {
          // Ingredient not linked to stock - can't make
          canMake = false;
          minServings = 0;
        }
      }

      return {
        ...drink,
        canMake,
        servingsLeft: canMake ? (minServings === Infinity ? 99 : minServings) : 0,
        ingredients: ingredients.map((ing) => ({
          name: ing.ingredient_name,
          amount: ing.amount_text || (ing.amount_ml ? `${ing.amount_ml}ml` : null),
          optional: ing.optional === 1,
        })),
      };
    });

    return {
      ...menu,
      drinks: drinksWithAvailability,
    };
  });

  return c.json(menusWithDrinks);
});

// Create a menu
app.post("/api/menus", requireAuth(), async (c) => {
  const { name, description } = await c.req.json();
  const menu = menuQueries.create.get(name, description || null);
  return c.json(menu, 201);
});

// Update a menu
app.put("/api/menus/:id", requireAuth(), async (c) => {
  const id = parseInt(c.req.param("id"));
  const { name, description, active, sort_order } = await c.req.json();
  const menu = menuQueries.update.get(name, description || null, active ? 1 : 0, sort_order || 0, id);
  if (!menu) {
    return c.json({ error: "Not found" }, 404);
  }
  return c.json(menu);
});

// Toggle menu active status
app.post("/api/menus/:id/toggle-active", requireAuth(), (c) => {
  const id = parseInt(c.req.param("id"));
  const menu = menuQueries.toggleActive.get(id);
  if (!menu) {
    return c.json({ error: "Not found" }, 404);
  }
  return c.json(menu);
});

// Delete a menu
app.delete("/api/menus/:id", requireAuth(), (c) => {
  const id = parseInt(c.req.param("id"));
  menuQueries.delete.run(id);
  return c.json({ success: true });
});

// Add drink to menu
app.post("/api/menus/:menuId/drinks/:drinkId", requireAuth(), (c) => {
  const menuId = parseInt(c.req.param("menuId"));
  const drinkId = parseInt(c.req.param("drinkId"));
  const result = menuDrinkQueries.add.get(menuId, drinkId);
  return c.json(result || { success: true });
});

// Remove drink from menu
app.delete("/api/menus/:menuId/drinks/:drinkId", requireAuth(), (c) => {
  const menuId = parseInt(c.req.param("menuId"));
  const drinkId = parseInt(c.req.param("drinkId"));
  menuDrinkQueries.remove.run(menuId, drinkId);
  return c.json({ success: true });
});

// Toggle drink hidden on menu
app.post("/api/menus/:menuId/drinks/:drinkId/toggle-hidden", requireAuth(), (c) => {
  const menuId = parseInt(c.req.param("menuId"));
  const drinkId = parseInt(c.req.param("drinkId"));
  const result = menuDrinkQueries.toggleHidden.get(menuId, drinkId);
  return c.json(result || { success: true });
});

// ============ QUEUE (DRINK REQUEST) ROUTES ============

// Get queue status (bar open/closed)
app.get("/api/queue/status", requireAuth(true), (c) => {
  const setting = settingsQueries.get.get("bar_open");
  const pendingCount = requestQueries.getPendingCount.get();
  return c.json({
    barOpen: setting?.value !== "false",
    pendingCount: pendingCount?.count || 0,
  });
});

// Set queue status (bar open/closed)
app.post("/api/queue/status", requireAuth(), async (c) => {
  const { barOpen } = await c.req.json();
  settingsQueries.set.get("bar_open", barOpen ? "true" : "false");
  return c.json({ barOpen });
});

// Get all pending requests
app.get("/api/queue", requireAuth(true), (c) => {
  const requests = requestQueries.getPending.all();
  return c.json(requests);
});

// Create a new drink request (guests can do this)
app.post("/api/queue/request", requireAuth(true), async (c) => {
  // Check if bar is open
  const setting = settingsQueries.get.get("bar_open");
  if (setting?.value === "false") {
    return c.json({ error: "Bar is closed" }, 400);
  }

  const { drinkId, guestName } = await c.req.json();
  if (!drinkId || !guestName) {
    return c.json({ error: "Missing drinkId or guestName" }, 400);
  }

  const request = requestQueries.create.get(drinkId, guestName);
  return c.json(request, 201);
});

// Mark request as "making"
app.post("/api/queue/:id/making", requireAuth(), (c) => {
  const id = parseInt(c.req.param("id"));
  const request = requestQueries.markMaking.get(id);
  if (!request) {
    return c.json({ error: "Not found" }, 404);
  }
  return c.json(request);
});

// Mark request as "done" (auto-deducts stock)
app.post("/api/queue/:id/done", requireAuth(), (c) => {
  const id = parseInt(c.req.param("id"));
  const request = requestQueries.getById.get(id);
  if (!request) {
    return c.json({ error: "Not found" }, 404);
  }

  // Deduct stock
  const ingredients = ingredientQueries.getByDrinkId.all(request.drink_id);
  const updatedStock: Stock[] = [];

  for (const ing of ingredients) {
    if (ing.stock_id && ing.amount_ml) {
      const stock = stockQueries.getById.get(ing.stock_id);
      if (stock) {
        const amountUsed = Math.min(ing.amount_ml, stock.current_ml);
        const newAmount = Math.max(0, stock.current_ml - ing.amount_ml);
        const updated = stockQueries.updateVolumeAndUsed.get(newAmount, amountUsed, ing.stock_id);
        if (updated) updatedStock.push(updated);
      }
    }
  }

  // Increment times_made
  drinkQueries.incrementTimesMade.get(request.drink_id);

  // Mark as done
  const updatedRequest = requestQueries.markDone.get(id);
  return c.json({ request: updatedRequest, updatedStock });
});

// Mark request as "declined"
app.post("/api/queue/:id/decline", requireAuth(), (c) => {
  const id = parseInt(c.req.param("id"));
  const request = requestQueries.markDeclined.get(id);
  if (!request) {
    return c.json({ error: "Not found" }, 404);
  }
  return c.json(request);
});

// Clear completed requests
app.post("/api/queue/clear-completed", requireAuth(), (c) => {
  requestQueries.clearCompleted.run();
  return c.json({ success: true });
});

// ============ UPLOAD ROUTES ============

app.post("/api/upload", requireAuth(), async (c) => {
  const body = await c.req.parseBody();
  const file = body.file as File;

  if (!file) {
    return c.json({ error: "No file provided" }, 400);
  }

  const ext = file.name.split(".").pop() || "jpg";
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const path = `./data/uploads/${filename}`;

  await Bun.write(path, file);

  return c.json({ path: `/uploads/${filename}` });
});

// Serve uploaded files
app.get("/uploads/*", async (c) => {
  const filepath = `./data${c.req.path}`;
  const file = Bun.file(filepath);

  if (!(await file.exists())) {
    return c.json({ error: "Not found" }, 404);
  }

  return new Response(file);
});

// Export for use with Bun.serve
export { app };

// Start server with Bun.serve for HTML support
const port = parseInt(process.env.PORT || "3000");

// Import the HTML file for Bun's bundler
import homepage from "../client/index.html";

const server = Bun.serve({
  port,
  hostname: "0.0.0.0",
  // Use routes for the HTML bundle
  routes: {
    "/": homepage,
    "/stock": homepage,
    "/drinks": homepage,
    "/browse": homepage,
    "/menu": homepage,
    "/menus": homepage,
    "/queue": homepage,
    "/kiosk": homepage,
    "/settings": homepage,
    "/shopping": homepage,
  },
  async fetch(req) {
    const url = new URL(req.url);

    // API routes handled by Hono
    if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/uploads/")) {
      return app.fetch(req);
    }

    // Fallback: serve HTML for SPA routes
    return new Response(Bun.file("./src/client/index.html"), {
      headers: { "Content-Type": "text/html" },
    });
  },
  development: {
    hmr: true,
    console: true,
  },
});

console.log(`
  🍸 BarStock running at http://localhost:${port}

  Default passcodes:
    Owner: 1234
    Guest: 0000
`);
